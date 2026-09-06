import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const testUrl = "postgresql://kb_test@127.0.0.1:55433/kb_platform_test?schema=public";
const env = { ...process.env, DATABASE_URL: testUrl, TEST_DATABASE_URL: testUrl };

function run(command, args) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

let started = false;
try {
  run("docker", ["compose", "--profile", "test", "up", "-d", "--wait", "postgres-test"]);
  started = true;
  run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "status"]);
  run(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.ts"]);
} catch (error) {
  console.error("PostgreSQL integration tests failed or could not start:", error);
  process.exitCode = 1;
} finally {
  if (started) {
    try { run("docker", ["compose", "--profile", "test", "stop", "postgres-test"]); }
    catch (error) { console.error("Could not stop the test database:", error); process.exitCode = 1; }
  }
}
