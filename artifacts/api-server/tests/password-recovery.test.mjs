import assert from "node:assert/strict";
import crypto from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const artifactDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = path.join(artifactDir, "dist", "index.mjs");
const requireFromDbPackage = createRequire(path.join(artifactDir, "../../lib/db/package.json"));
const { Client } = requireFromDbPackage("pg");

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function createIsolatedSchema(client, schemaName) {
  const schema = quoteIdentifier(schemaName);
  await client.query(`CREATE SCHEMA ${schema}`);
  const tables = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  for (const { tablename } of tables.rows) {
    const table = quoteIdentifier(tablename);
    await client.query(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
  }
  const serialColumns = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'
    ORDER BY table_name, column_name
  `);
  for (const [index, row] of serialColumns.rows.entries()) {
    const table = quoteIdentifier(row.table_name);
    const column = quoteIdentifier(row.column_name);
    const sequence = quoteIdentifier(`password_reset_test_sequence_${index}`);
    await client.query(`CREATE SEQUENCE ${schema}.${sequence}`);
    await client.query(`
      ALTER TABLE ${schema}.${table}
      ALTER COLUMN ${column}
      SET DEFAULT nextval('${schema}.${sequence}'::regclass)
    `);
  }
}

async function getFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function startApi(port, databaseUrl) {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    SESSION_SECRET: "password-recovery-test-secret",
    DATABASE_URL: databaseUrl,
    APP_BASE_URL: "https://croas.example.test",
  };
  delete env.SMTP_HOST;
  delete env.SMTP_USER;
  delete env.SMTP_PASS;

  const child = spawn(process.execPath, ["--enable-source-maps", serverEntry], {
    cwd: artifactDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  return { child, getOutput: () => output };
}

async function waitForApi(port, processInfo) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (processInfo.child.exitCode !== null) {
      throw new Error(`API exited before becoming ready:\n${processInfo.getOutput()}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/healthz`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for API:\n${processInfo.getOutput()}`);
}

async function stopApi(processInfo) {
  if (!processInfo || processInfo.child.exitCode !== null) return;
  processInfo.child.kill("SIGTERM");
  await Promise.race([
    once(processInfo.child, "exit"),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out stopping API")), 5_000)),
  ]);
}

async function post(port, pathname, body, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

test("rejects unavailable email delivery and enforces expiring single-use reset tokens", async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
  const port = await getFreePort();
  const schemaName = `password_reset_test_${process.pid}_${Date.now()}`;
  const adminClient = new Client({ connectionString: process.env.DATABASE_URL });
  await adminClient.connect();
  await createIsolatedSchema(adminClient, schemaName);

  const testDatabaseUrl = new URL(process.env.DATABASE_URL);
  testDatabaseUrl.searchParams.set("options", `-c search_path=${schemaName}`);
  const schema = quoteIdentifier(schemaName);
  let processInfo;

  try {
    processInfo = startApi(port, testDatabaseUrl.toString());
    await waitForApi(port, processInfo);

    const email = `password-reset-${process.pid}-${Date.now()}@example.com`;
    const oldPassword = "old-password-value";
    const registration = await post(port, "/api/auth/register", {
      name: "Password Reset Test",
      email,
      password: oldPassword,
    });
    assert.equal(registration.response.status, 201);

    const unavailable = await post(
      port,
      "/api/auth/forgot-password",
      { email },
      { host: "attacker.example" },
    );
    assert.equal(unavailable.response.status, 503);
    assert.match(unavailable.body.error, /indisponível/i);

    const userResult = await adminClient.query(
      `SELECT id FROM ${schema}.users WHERE email = $1`,
      [email],
    );
    const userId = userResult.rows[0].id;

    const expiredRawToken = crypto.randomBytes(32).toString("hex");
    const expiredHash = crypto.createHash("sha256").update(expiredRawToken).digest("hex");
    await adminClient.query(
      `INSERT INTO ${schema}.password_reset_tokens
       (user_id, token_hash, expires_at) VALUES ($1, $2, now() - interval '1 minute')`,
      [userId, expiredHash],
    );
    const expired = await post(port, "/api/auth/reset-password", {
      token: expiredRawToken,
      password: "new-password-value",
    });
    assert.equal(expired.response.status, 400);

    const validRawToken = crypto.randomBytes(32).toString("hex");
    const validHash = crypto.createHash("sha256").update(validRawToken).digest("hex");
    await adminClient.query(
      `INSERT INTO ${schema}.password_reset_tokens
       (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
      [userId, validHash],
    );

    const reset = await post(port, "/api/auth/reset-password", {
      token: validRawToken,
      password: "new-password-value",
    });
    assert.equal(reset.response.status, 200);

    const reused = await post(port, "/api/auth/reset-password", {
      token: validRawToken,
      password: "another-password-value",
    });
    assert.equal(reused.response.status, 400);

    const oldLogin = await post(port, "/api/auth/login", {
      email,
      password: oldPassword,
    });
    assert.equal(oldLogin.response.status, 401);
    const newLogin = await post(port, "/api/auth/login", {
      email,
      password: "new-password-value",
    });
    assert.equal(newLogin.response.status, 200);

    const concurrentRawToken = crypto.randomBytes(32).toString("hex");
    const concurrentHash = crypto.createHash("sha256").update(concurrentRawToken).digest("hex");
    await adminClient.query(
      `INSERT INTO ${schema}.password_reset_tokens
       (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
      [userId, concurrentHash],
    );
    const concurrentResults = await Promise.all([
      post(port, "/api/auth/reset-password", {
        token: concurrentRawToken,
        password: "concurrent-password-one",
      }),
      post(port, "/api/auth/reset-password", {
        token: concurrentRawToken,
        password: "concurrent-password-two",
      }),
    ]);
    assert.deepEqual(
      concurrentResults.map(({ response }) => response.status).sort(),
      [200, 400],
      "exactly one concurrent redemption must claim the token",
    );
  } finally {
    await stopApi(processInfo);
    await adminClient.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await adminClient.end();
  }
});