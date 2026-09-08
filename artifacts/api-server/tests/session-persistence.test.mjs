import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { request as httpRequest } from "node:http";
import { createRequire } from "node:module";

const artifactDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = path.join(artifactDir, "dist", "index.mjs");
const sessionSecret = "session-persistence-test-secret";
const requireFromDbPackage = createRequire(path.join(artifactDir, "../../lib/db/package.json"));
const { Client } = requireFromDbPackage("pg");

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function createIsolatedSchema(client, schemaName) {
  const schema = quoteIdentifier(schemaName);
  await client.query(`CREATE SCHEMA ${schema}`);

  const tables = await client.query(`
    SELECT tablename
    FROM pg_tables
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
    WHERE table_schema = 'public'
      AND column_default LIKE 'nextval(%'
    ORDER BY table_name, column_name
  `);
  for (const [index, { table_name: tableName, column_name: columnName }] of serialColumns.rows.entries()) {
    const table = quoteIdentifier(tableName);
    const column = quoteIdentifier(columnName);
    const sequenceName = `test_sequence_${index}`;
    const sequence = quoteIdentifier(sequenceName);
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
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

function startApi(port, databaseUrl) {
  const child = spawn(process.execPath, ["--enable-source-maps", serverEntry], {
    cwd: artifactDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      SESSION_SECRET: sessionSecret,
      DATABASE_URL: databaseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return { child, getOutput: () => output };
}

async function waitForApi(port, processInfo) {
  const url = `http://127.0.0.1:${port}/api/healthz`;
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (processInfo.child.exitCode !== null) {
      throw new Error(`API exited before becoming ready:\n${processInfo.getOutput()}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server may still be running migrations or starting its listener.
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

function sessionCookie(response) {
  const cookies = response.headers["set-cookie"] ?? [];
  const cookie = cookies.find((value) => value.startsWith("connect.sid="));
  assert.ok(cookie, "login response should issue a connect.sid cookie");
  return cookie.split(";", 1)[0];
}

async function request(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port,
      path: pathname,
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        "x-forwarded-proto": "https",
        ...options.headers,
      },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        resolve({
          response,
          body: text ? JSON.parse(text) : null,
        });
      });
    });
    request.on("error", reject);
    request.end(options.body);
  });
}

test("keeps an authenticated session valid after an API restart", async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required to create an isolated test schema");

  const port = await getFreePort();
  const schemaName = `session_test_${process.pid}_${Date.now()}`;
  const adminClient = new Client({ connectionString: process.env.DATABASE_URL });
  await adminClient.connect();
  await createIsolatedSchema(adminClient, schemaName);

  const testDatabaseUrl = new URL(process.env.DATABASE_URL);
  testDatabaseUrl.searchParams.set("options", `-c search_path=${schemaName}`);

  const email = `session-persistence-${process.pid}-${Date.now()}@example.com`;
  const password = "session-persistence-password";
  let processInfo;

  try {
    processInfo = startApi(port, testDatabaseUrl.toString());
    await waitForApi(port, processInfo);

    const registration = await request(port, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Session Persistence Test", email, password }),
    });
    assert.equal(registration.response.statusCode, 201);

    await request(port, "/api/auth/logout", {
      method: "POST",
      headers: { cookie: sessionCookie(registration.response) },
    });

    const login = await request(port, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    assert.equal(login.response.statusCode, 200);
    const cookie = sessionCookie(login.response);

    const beforeRestart = await request(port, "/api/auth/me", {
      headers: { cookie },
    });
    assert.equal(beforeRestart.response.statusCode, 200);
    assert.equal(beforeRestart.body.email, email);

    await stopApi(processInfo);
    processInfo = startApi(port, testDatabaseUrl.toString());
    await waitForApi(port, processInfo);

    const afterRestart = await request(port, "/api/auth/me", {
      headers: { cookie },
    });
    assert.equal(afterRestart.response.statusCode, 200);
    assert.equal(afterRestart.body.email, email);
  } finally {
    await stopApi(processInfo);
    await adminClient.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await adminClient.end();
  }
});