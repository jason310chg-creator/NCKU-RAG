import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

export const testUrl = "postgresql://kb_test@127.0.0.1:55433/kb_platform_test?schema=public";

export function parseMode(args) {
  if (args.length === 0) return "docker";
  if (args.length === 1 && args[0] === "--native") return "native";
  throw new Error("Usage: npm run test:integration -- [--native]");
}

export function createDockerLifecycle(run) {
  let attempted = false;
  return {
    async start() {
      // Compose may create/start the container before its health check fails.
      attempted = true;
      await run("docker", ["compose", "--profile", "test", "up", "-d", "--wait", "postgres-test"]);
    },
    async stop() {
      if (attempted) await run("docker", ["compose", "--profile", "test", "stop", "postgres-test"]);
    },
  };
}

export function buildTestEnvironment(source, mode, data = "") {
  // libpq, node-postgres and Windows resolve several of these case-insensitively.
  const env = Object.fromEntries(Object.entries(source).filter(([key]) =>
    !/^PG/i.test(key) && !/^(DATABASE_URL|TEST_DATABASE_.+)$/i.test(key)));
  return { ...env, DATABASE_URL: testUrl, TEST_DATABASE_URL: testUrl, TEST_DATABASE_MODE: mode, TEST_DATABASE_DIR: data };
}

export function validatePgBin(directory) {
  if (typeof directory !== "string" || !isAbsolute(directory) || directory.includes("\0")) {
    throw new Error("Native mode requires PG_BIN to be an absolute PostgreSQL 17 bin directory");
  }
  const binaries = {};
  for (const name of ["initdb", "pg_ctl", "postgres", "psql", "createdb"]) {
    const executable = join(directory, name + (process.platform === "win32" ? ".exe" : ""));
    if (!existsSync(executable) || !statSync(executable).isFile()) {
      throw new Error(`Missing PostgreSQL executable: ${executable}`);
    }
    binaries[name] = realpathSync(executable);
  }
  return binaries;
}

export async function assertPortAvailable(port = 55433) {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once("error", (cause) => reject(new Error(`Test port 127.0.0.1:${port} is unavailable; refusing to touch any database`, { cause })));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => server.close(resolvePromise));
  });
}

export function createOwnedDirectory() {
  const parent = realpathSync(tmpdir());
  const root = mkdtempSync(join(parent, "ncku-rag-pg-"));
  const token = randomUUID();
  writeFileSync(join(root, ".integration-owner"), token, { flag: "wx" });
  return { parent, root, data: join(root, "data"), token };
}

function samePath(a, b) {
  const normalize = (value) => {
    const normalized = resolve(value).replaceAll("\\", "/");
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
  };
  return typeof a === "string" && typeof b === "string" && normalize(a) === normalize(b);
}

export function assertOwnedDirectory(owned) {
  if (!owned || !samePath(owned.parent, realpathSync(tmpdir())) ||
      !samePath(dirname(owned.root), owned.parent) || !basename(owned.root).startsWith("ncku-rag-pg-") ||
      lstatSync(owned.root).isSymbolicLink() || !samePath(realpathSync(owned.root), owned.root)) {
    throw new Error("Refusing cleanup: temporary directory ownership is unverified");
  }
  if (!samePath(owned.data, join(owned.root, "data")) ||
      (existsSync(owned.data) && (lstatSync(owned.data).isSymbolicLink() || !samePath(realpathSync(owned.data), owned.data)))) {
    throw new Error("Refusing cleanup: unexpected data directory");
  }
  const marker = join(owned.root, ".integration-owner");
  if (lstatSync(marker).isSymbolicLink() || readFileSync(marker, "utf8") !== owned.token) {
    throw new Error("Refusing cleanup: temporary directory ownership marker changed");
  }
}

export function assertSafeToRemove(owned, status) {
  assertOwnedDirectory(owned);
  if (status !== 3 || existsSync(join(owned.data, "postmaster.pid"))) {
    throw new Error("Refusing cleanup: PostgreSQL shutdown is unverified");
  }
}

export function assertClusterIdentity(identity, data, database) {
  const version = String(identity?.server_version_num);
  if (!samePath(identity?.data_directory, data) || identity?.user !== "kb_test" ||
      identity?.database !== database || !/^17\d{4}$/.test(version)) {
    throw new Error("Refusing database writes: PostgreSQL test cluster identity does not match this run");
  }
}

export function assertOwnedPid(owned) {
  assertOwnedDirectory(owned);
  const lines = readFileSync(join(owned.data, "postmaster.pid"), "utf8").split(/\r?\n/);
  if (!/^\d+$/.test(lines[0]) || !samePath(lines[1], owned.data) || lines[3] !== "55433") {
    throw new Error("Refusing stop: PostgreSQL PID file does not identify this run's cluster");
  }
}
