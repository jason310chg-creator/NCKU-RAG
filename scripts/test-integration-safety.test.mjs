import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertClusterIdentity, assertOwnedDirectory, assertPortAvailable, assertSafeToRemove, assertOwnedPid,
  buildTestEnvironment, createDockerLifecycle, createOwnedDirectory, parseMode, validatePgBin,
} from "./integration-safety.mjs";

test("Docker stays the default and native must be requested explicitly", () => {
  assert.equal(parseMode([]), "docker");
  assert.equal(parseMode(["--native"]), "native");
  for (const args of [["--docker"], ["--native", "--native"], ["--native", "--port=5432"]]) {
    assert.throws(() => parseMode(args), /Usage/);
  }
});

test("failed or interrupted Compose startup still stops only postgres-test in finally", async () => {
  for (const reason of ["unhealthy container", "SIGINT"]) {
    const calls = [];
    let reachedMigrations = false;
    const docker = createDockerLifecycle(async (command, args) => {
      calls.push([command, ...args]);
      if (args.includes("up")) throw new Error(reason);
    });
    await assert.rejects(async () => {
      try {
        await docker.start();
        reachedMigrations = true;
      } finally { await docker.stop(); }
    }, new RegExp(reason));
    assert.equal(reachedMigrations, false);
    assert.deepEqual(calls, [
      ["docker", "compose", "--profile", "test", "up", "-d", "--wait", "postgres-test"],
      ["docker", "compose", "--profile", "test", "stop", "postgres-test"],
    ]);
  }
});

test("native mode and preflight failures never stop an unattempted Docker service", async () => {
  const calls = [];
  const docker = createDockerLifecycle(async (...args) => { calls.push(args); });
  await docker.stop();
  assert.deepEqual(calls, []);
});

test("native mode requires an absolute PostgreSQL binary directory", () => {
  for (const path of [undefined, "", "pgsql/bin", ".", "\u0000"]) {
    assert.throws(() => validatePgBin(path), /PG_BIN/);
  }
  const directory = mkdtempSync(join(tmpdir(), "ncku-rag-bin-test-"));
  try { assert.throws(() => validatePgBin(directory), /PostgreSQL executable/); }
  finally { rmSync(directory, { recursive: true, force: true }); }
});

test("test environment removes connection redirects including mixed-case Windows keys", () => {
  const env = buildTestEnvironment({
    PATH: "tools", PGHOST: "production", PGDATA: "valuable", PGOPTIONS: "-c search_path=other",
    PGSERVICE: "production", PGSERVICEFILE: "services", PGPASSFILE: "passwords", PgPort: "5432",
    PG_BIN: "untrusted", DATABASE_URL: "production", database_url: "production",
    TEST_DATABASE_URL: "production", TEST_DATABASE_DIR: "valuable", TEST_DATABASE_MODE: "native",
  }, "docker");
  assert.equal(env.PATH, "tools");
  assert.equal(Object.keys(env).some((key) => /^PG/i.test(key)), false);
  assert.equal(env.database_url, undefined);
  assert.equal(env.DATABASE_URL, "postgresql://kb_test@127.0.0.1:55433/kb_platform_test?schema=public");
  assert.equal(env.TEST_DATABASE_URL, env.DATABASE_URL);
  assert.equal(env.TEST_DATABASE_MODE, "docker");
  assert.equal(env.TEST_DATABASE_DIR, "");
});

test("refuses an occupied port without connecting to the listener", async () => {
  let connections = 0;
  const server = createServer(() => { connections += 1; });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  const port = server.address().port;
  try {
    await assert.rejects(assertPortAvailable(port), /unavailable/);
    assert.equal(connections, 0);
  } finally { await new Promise((resolve) => server.close(resolve)); }
  await assertPortAvailable(port);
});

test("cleanup requires the original random ownership marker and exact temp parent", () => {
  const owned = createOwnedDirectory();
  try {
    assert.doesNotThrow(() => assertOwnedDirectory(owned));
    assert.throws(() => assertOwnedDirectory({ ...owned, root: tmpdir() }), /ownership|temporary/);
    assert.throws(() => assertOwnedDirectory({ ...owned, data: join(owned.root, "..") }), /data directory/);
    const marker = join(owned.root, ".integration-owner");
    const original = readFileSync(marker, "utf8");
    writeFileSync(marker, "another-run");
    assert.throws(() => assertOwnedDirectory(owned), /ownership/);
    writeFileSync(marker, original);
    mkdirSync(owned.data);
    assert.doesNotThrow(() => assertOwnedDirectory(owned));
  } finally {
    assertOwnedDirectory(owned);
    rmSync(owned.root, { recursive: true, force: true });
  }
});

test("cluster verification refuses a same-port foreign cluster or unexpected user/version/database", () => {
  const owned = createOwnedDirectory();
  mkdirSync(owned.data);
  const identity = { data_directory: owned.data, user: "kb_test", database: "postgres", server_version_num: "170011" };
  try {
    assert.doesNotThrow(() => assertClusterIdentity(identity, owned.data, "postgres"));
    for (const changed of [
      { data_directory: tmpdir() }, { user: "postgres" }, { database: "production" },
      { server_version_num: "180000" }, { server_version_num: "17x" },
    ]) {
      assert.throws(() => assertClusterIdentity({ ...identity, ...changed }, owned.data, "postgres"), /identity/);
    }
  } finally {
    assertOwnedDirectory(owned);
    rmSync(owned.root, { recursive: true, force: true });
  }
});

test("cleanup never removes running or ambiguously stopped data", () => {
  const owned = createOwnedDirectory();
  mkdirSync(owned.data);
  try {
    for (const status of [0, 1, 4, null, undefined]) {
      assert.throws(() => assertSafeToRemove(owned, status), /shutdown/);
    }
    assert.doesNotThrow(() => assertSafeToRemove(owned, 3));
    writeFileSync(join(owned.data, "postmaster.pid"), `123\n${owned.data}\n0\n55433\n`);
    assert.throws(() => assertSafeToRemove(owned, 3), /shutdown/);
    assert.doesNotThrow(() => assertOwnedPid(owned));
    writeFileSync(join(owned.data, "postmaster.pid"), `123\n${tmpdir()}\n0\n5432\n`);
    assert.throws(() => assertOwnedPid(owned), /Refusing stop/);
  } finally {
    assertOwnedDirectory(owned);
    rmSync(owned.root, { recursive: true, force: true });
  }
});
