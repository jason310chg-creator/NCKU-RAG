import { randomUUID } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const testUrl = "postgresql://kb_test@127.0.0.1:55433/kb_platform_test?schema=public";
if (process.env.TEST_DATABASE_URL !== testUrl || process.env.DATABASE_URL !== testUrl) {
  throw new Error("Use npm run test:integration with the isolated test database");
}

// pg's simple-query protocol executes the actual migration file, including its
// BEGIN/COMMIT. A dedicated connection keeps all unqualified SQL in our schema.
const client = new Client({ connectionString: testUrl, connectionTimeoutMillis: 3000 });
const phase1Sql = readFileSync(new URL("../../prisma/migrations/20260512175544_init/migration.sql", import.meta.url), "utf8");
const phase2Sql = readFileSync(new URL("../../prisma/migrations/20260907000000_phase2a_auth/migration.sql", import.meta.url), "utf8");
const ownerId = randomUUID();
const documentId = randomUUID();
const tagId = randomUUID();
const fileId = randomUUID();
let ownedSchema: string | undefined;

function quotedOwnedSchema(schema: string): string {
  if (!/^phase2a_migration_[a-f0-9]{32}$/.test(schema)) throw new Error("Refusing unowned migration schema");
  return `"${schema}"`;
}

async function contentShape() {
  return (await client.query(`SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = $1
    AND table_name IN ('documents', 'tags', 'document_tags', 'files')
    ORDER BY table_name, ordinal_position`, [ownedSchema])).rows;
}

async function contentRows() {
  return {
    documents: (await client.query('SELECT * FROM "documents" ORDER BY "id"')).rows,
    tags: (await client.query('SELECT * FROM "tags" ORDER BY "id"')).rows,
    links: (await client.query('SELECT * FROM "document_tags" ORDER BY "document_id", "tag_id"')).rows,
    files: (await client.query('SELECT * FROM "files" ORDER BY "id"')).rows,
  };
}

describe("real PostgreSQL Phase 1 to Phase 2A migration", () => {
  beforeAll(async () => {
    await client.connect();
    if (process.env.TEST_DATABASE_MODE === "native") {
      const expectedDirectory = process.env.TEST_DATABASE_DIR;
      if (!expectedDirectory) throw new Error("Native tests require their owned cluster directory");
      const { rows: [identity] } = await client.query<{
        directory: string; username: string; database: string; version: string;
      }>(`SELECT current_setting('data_directory') AS directory,
        current_user AS username, current_database() AS database,
        current_setting('server_version_num') AS version`);
      const canonical = (path: string) => {
        const value = realpathSync(path);
        return process.platform === "win32" ? value.toLowerCase() : value;
      };
      if (!identity || canonical(identity.directory) !== canonical(expectedDirectory) ||
          identity.username !== "kb_test" || identity.database !== "kb_platform_test" ||
          !/^17\d{4}$/.test(identity.version)) {
        throw new Error("Refusing migration fixtures: database is not the owned PostgreSQL 17 cluster");
      }
    }
  });

  beforeEach(async () => {
    const schema = `phase2a_migration_${randomUUID().replaceAll("-", "")}`;
    await client.query(`CREATE SCHEMA ${quotedOwnedSchema(schema)}`);
    ownedSchema = schema;
    await client.query(`SET search_path TO ${quotedOwnedSchema(schema)}`);
    await client.query(phase1Sql);
    await client.query(`INSERT INTO "users" ("id", "name", "email", "role", "created_at", "updated_at")
      VALUES ($1, 'Phase 1 Owner', $2, 'editor', '2026-05-13T00:00:00Z', '2026-05-14T00:00:00Z')`,
    [ownerId, " \tFirst.Last+Owner@Example.COM\r\n"]);
    await client.query(`INSERT INTO "documents"
      ("id", "title", "content", "content_type", "category", "status", "visibility", "owner_id",
       "version", "valid_from", "valid_until", "updated_at")
      VALUES ($1, 'Phase 1 content', 'Original text', 'document', 'department_cs', 'published', 'public',
      $2, 7, '2026-05-01', '2027-05-01', '2026-05-15T00:00:00Z')`, [documentId, ownerId]);
    await client.query('INSERT INTO "tags" ("id", "name") VALUES ($1, $2)', [tagId, "Phase 1 Tag"]);
    await client.query('INSERT INTO "document_tags" ("document_id", "tag_id") VALUES ($1, $2)', [documentId, tagId]);
    await client.query(`INSERT INTO "files" ("id", "document_id", "file_name", "file_type", "file_url", "file_size")
      VALUES ($1, $2, 'existing.txt', 'text/plain', 'https://example.com/existing.txt', 13)`, [fileId, documentId]);
  });

  afterEach(async () => {
    if (!ownedSchema) return;
    await client.query("ROLLBACK");
    await client.query("RESET search_path");
    await client.query(`DROP SCHEMA ${quotedOwnedSchema(ownedSchema)} CASCADE`);
    ownedSchema = undefined;
  });
  afterAll(async () => { await client.end(); });

  it("preserves Phase 1 content, UUID ownership, role enum and column definitions during a populated upgrade", async () => {
    const beforeRows = await contentRows();
    const beforeShape = await contentShape();
    const { rows: [beforeOwner] } = await client.query('SELECT * FROM "users" WHERE "id" = $1', [ownerId]);
    await client.query(phase2Sql);
    expect(await contentRows()).toEqual(beforeRows);
    expect(await contentShape()).toEqual(beforeShape);
    const { rows: [owner] } = await client.query('SELECT * FROM "users" WHERE "id" = $1', [ownerId]);
    expect(owner).toEqual({
      ...beforeOwner, email: "first.last+owner@example.com",
      is_active: false, email_verified: false, image: null,
    });
    expect((await client.query(`SELECT enumlabel FROM pg_enum
      WHERE enumtypid = '"Role"'::regtype ORDER BY enumsortorder`)).rows)
      .toEqual([{ enumlabel: "admin" }, { enumlabel: "editor" }, { enumlabel: "viewer" }]);
    expect((await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1
      AND table_name IN ('accounts', 'sessions', 'verifications') ORDER BY table_name`, [ownedSchema])).rows)
      .toEqual([{ table_name: "accounts" }, { table_name: "sessions" }, { table_name: "verifications" }]);
  });

  it("rolls back the entire migration on a canonical email collision without deleting either identity", async () => {
    await client.query(`INSERT INTO "users" ("id", "name", "email", "updated_at")
      VALUES ($1, 'Conflicting Identity', 'first.last+owner@example.com', CURRENT_TIMESTAMP)`, [randomUUID()]);
    const beforeUsers = (await client.query('SELECT * FROM "users" ORDER BY "id"')).rows;
    const beforeRows = await contentRows();
    await expect(client.query(phase2Sql)).rejects.toMatchObject({ code: "23505" });
    await client.query("ROLLBACK");
    expect((await client.query('SELECT * FROM "users" ORDER BY "id"')).rows).toEqual(beforeUsers);
    expect(await contentRows()).toEqual(beforeRows);
    expect((await client.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'users' AND column_name IN ('is_active', 'email_verified', 'image')`, [ownedSchema])).rows)
      .toHaveLength(0);
    expect((await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1
      AND table_name IN ('accounts', 'sessions', 'verifications')`, [ownedSchema])).rows).toHaveLength(0);
  });

  it("trims ECMAScript Unicode whitespace even in the PostgreSQL C locale", async () => {
    const whitespace = "\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF";
    await client.query('UPDATE "users" SET "email" = $1 WHERE "id" = $2',
      [`${whitespace}First.Last+Owner@Example.COM${whitespace}`, ownerId]);
    await client.query(phase2Sql);
    expect((await client.query('SELECT "email" FROM "users" WHERE "id" = $1', [ownerId])).rows)
      .toEqual([{ email: "first.last+owner@example.com" }]);
  });

  it.each(["\u00A0", "\uFEFF"])("rolls back canonical collisions hidden by Unicode edge whitespace %j", async (whitespace) => {
    await client.query('UPDATE "users" SET "email" = $1 WHERE "id" = $2',
      [`${whitespace}first.last+owner@example.com${whitespace}`, ownerId]);
    await client.query(`INSERT INTO "users" ("id", "name", "email", "updated_at")
      VALUES ($1, 'Conflicting Identity', 'first.last+owner@example.com', CURRENT_TIMESTAMP)`, [randomUUID()]);
    const beforeUsers = (await client.query('SELECT * FROM "users" ORDER BY "id"')).rows;
    await expect(client.query(phase2Sql)).rejects.toMatchObject({ code: "23505" });
    await client.query("ROLLBACK");
    expect((await client.query('SELECT * FROM "users" ORDER BY "id"')).rows).toEqual(beforeUsers);
    expect((await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1
      AND table_name IN ('accounts', 'sessions', 'verifications')`, [ownedSchema])).rows).toHaveLength(0);
  });

  it("enforces canonical email and defaults new rows to inactive without changing plus tags or dots", async () => {
    await client.query(phase2Sql);
    for (const email of ["UPPER@example.com", " leading@example.com", "two@@example.com", "no-at-sign",
      "\u00A0leading@example.com", "trailing@example.com\uFEFF", "in\u2003side@example.com"]) {
      await expect(client.query(`INSERT INTO "users" ("id", "name", "email", "updated_at")
        VALUES ($1, 'Invalid email fixture', $2, CURRENT_TIMESTAMP)`, [randomUUID(), email]))
        .rejects.toMatchObject({ code: "23514" });
    }
    const { rows: [created] } = await client.query(`INSERT INTO "users" ("id", "name", "email", "updated_at")
      VALUES ($1, 'Canonical fixture', 'another.user+tag@example.com', CURRENT_TIMESTAMP)
      RETURNING "email", "is_active", "email_verified", "role"`, [randomUUID()]);
    expect(created).toEqual({ email: "another.user+tag@example.com", is_active: false, email_verified: false, role: "editor" });
  });
});
