import { spawn } from "node:child_process";
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertClusterIdentity, assertOwnedDirectory, assertOwnedPid, assertPortAvailable,
  assertSafeToRemove, buildTestEnvironment, createDockerLifecycle, createOwnedDirectory, parseMode, validatePgBin,
} from "./integration-safety.mjs";

const cwd = fileURLToPath(new URL("../", import.meta.url));
let env;
let owned;
let binaries;
let logPath;
const docker = createDockerLifecycle(execute);
let attemptedNativeStart = false;
let failed = false;
let interrupted;
let activeChild;
let cleaningUp = false;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    interrupted = signal;
    failed = true;
    console.error(`Received ${signal}; stopping the integration run and cleaning up its database`);
    if (!cleaningUp) activeChild?.kill();
  });
}

async function execute(command, args, { capture = false, allowFailure = false, daemon = false } = {}) {
  if (interrupted && !cleaningUp) throw new Error(`Integration run interrupted by ${interrupted}`);
  console.log(`> ${command} ${args.join(" ")}`);
  // On Windows postgres can inherit pg_ctl's pipes even with -l. File handles
  // let pg_ctl finish without waiting for the daemon to close inherited pipes.
  const daemonLog = daemon ? join(owned.root, "pg-ctl-start.log") : undefined;
  const descriptor = daemon ? openSync(daemonLog, "w") : undefined;
  let result;
  try {
    result = await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd, env, stdio: daemon ? ["ignore", descriptor, descriptor] : ["ignore", "pipe", "pipe"], windowsHide: true,
      });
      activeChild = child;
      let stdout = "";
      let stderr = "";
      let error;
      const timeout = setTimeout(() => {
        error = new Error(`${command} exceeded the five minute command timeout`);
        child.kill();
      }, 300000);
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      const collect = (stream, chunk) => {
        if (stream === "stdout") stdout += chunk;
        else stderr += chunk;
        if (stdout.length + stderr.length > 10 * 1024 * 1024) {
          error = new Error(`${command} exceeded the command output limit`);
          child.kill();
        }
      };
      child.stdout?.on("data", (chunk) => collect("stdout", chunk));
      child.stderr?.on("data", (chunk) => collect("stderr", chunk));
      child.once("error", (cause) => { clearTimeout(timeout); reject(cause); });
      child.once("close", (status, signal) => {
        clearTimeout(timeout);
        resolve({ status, signal, stdout, stderr, error });
      });
    });
  } finally {
    activeChild = undefined;
    if (descriptor !== undefined) closeSync(descriptor);
  }
  if (daemon) result.stdout = readFileSync(daemonLog, "utf8");
  if (logPath) appendFileSync(logPath, `> ${command} ${args.join(" ")}\n${result.stdout ?? ""}${result.stderr ?? ""}\n`);
  if (!capture || result.error || result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  if (result.error) throw result.error;
  if (interrupted && !cleaningUp) throw new Error(`Integration run interrupted by ${interrupted}`);
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} exited with status ${result.status}${result.signal ? ` (${result.signal})` : ""}`);
  }
  return result;
}

async function verifyNativeCluster(database) {
  assertOwnedDirectory(owned);
  assertOwnedPid(owned);
  const sql = "SELECT json_build_object('data_directory', current_setting('data_directory'), 'user', current_user, 'database', current_database(), 'server_version_num', current_setting('server_version_num'))";
  const result = await execute(binaries.psql, [
    "--no-psqlrc", "--no-password", "--host=127.0.0.1", "--port=55433", "--username=kb_test",
    `--dbname=${database}`, "--set=ON_ERROR_STOP=1", "--tuples-only", "--no-align", "--command", sql,
  ], { capture: true });
  assertClusterIdentity(JSON.parse(result.stdout.trim()), owned.data, database);
  console.log(`Verified this run's PostgreSQL 17 cluster: ${owned.data} (${database})`);
}

try {
  const mode = parseMode(process.argv.slice(2));
  env = buildTestEnvironment(process.env, mode);
  if (mode === "native") {
    binaries = validatePgBin(process.env.PG_BIN);
    for (const [name, executable] of Object.entries(binaries)) {
      const result = await execute(executable, ["--version"], { capture: true });
      if (!/\(PostgreSQL\) 17(?:\.|\s|$)/.test(result.stdout)) {
        throw new Error(`${name} must be PostgreSQL 17; received ${result.stdout.trim()}`);
      }
    }
    await assertPortAvailable();
    owned = createOwnedDirectory();
    logPath = join(owned.root, "runner.log");
    env = buildTestEnvironment(process.env, mode, owned.data);
    // psql ignores its startup file; libpq receives no inherited connection/service settings.
    env.PGCONNECT_TIMEOUT = "5";
    console.log(`Creating disposable native PostgreSQL cluster in ${owned.root}`);
    await execute(binaries.initdb, ["--pgdata", owned.data, "--username=kb_test", "--locale=C", "--encoding=UTF8", "--auth=trust", "--no-instructions"]);
    appendFileSync(join(owned.data, "postgresql.conf"), "\nlisten_addresses = '127.0.0.1'\nport = 55433\nunix_socket_directories = ''\n");
    // Recheck after initdb; any listener that wins the startup race is rejected by identity checks.
    await assertPortAvailable();
    attemptedNativeStart = true;
    await execute(binaries.pg_ctl, ["start", "-D", owned.data, "-l", join(owned.root, "postgres.log"), "-w", "-t", "30"], { daemon: true });
    await verifyNativeCluster("postgres");
    await execute(binaries.createdb, ["--no-password", "--host=127.0.0.1", "--port=55433", "--username=kb_test", "--maintenance-db=postgres", "kb_platform_test"]);
    await verifyNativeCluster("kb_platform_test");
  } else {
    await docker.start();
  }
  await execute(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  await execute(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "status"]);
  if (owned) await verifyNativeCluster("kb_platform_test");
  await execute(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.ts"]);
} catch (error) {
  failed = true;
  console.error("PostgreSQL integration tests failed or could not start:", error);
  if (logPath) {
    try { appendFileSync(logPath, `${error.stack ?? error}\n`); }
    catch (logError) { console.error("Could not write diagnostic log:", logError); }
  }
} finally {
  cleaningUp = true;
  try { await docker.stop(); }
  catch (error) { console.error("Could not stop the test database:", error); failed = true; }
  if (owned) {
    try {
      assertOwnedDirectory(owned);
      if (attemptedNativeStart) {
        const status = await execute(binaries.pg_ctl, ["status", "-D", owned.data], { capture: true, allowFailure: true });
        if (status.status === 0) {
          assertOwnedPid(owned);
          console.log(`Stopping only this run's cluster: ${owned.data}`);
          await execute(binaries.pg_ctl, ["stop", "-D", owned.data, "-m", "fast", "-w", "-t", "30"]);
        } else if (status.status !== 3 || existsSync(join(owned.data, "postmaster.pid"))) {
          throw new Error("Cannot establish the native cluster's stopped state; leaving data intact");
        }
      }
      if (!failed) {
        const status = await execute(binaries.pg_ctl, ["status", "-D", owned.data], { capture: true, allowFailure: true });
        assertSafeToRemove(owned, status.status);
        console.log(`Removing verified stopped disposable cluster: ${owned.root}`);
        rmSync(owned.root, { recursive: true, force: false });
      }
    } catch (error) {
      console.error("Native PostgreSQL cleanup failed:", error);
      failed = true;
    }
    if (failed) console.error(`Preserved native database and diagnostic logs: ${owned.root}`);
  }
  if (failed) process.exitCode = 1;
}
