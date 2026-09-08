/**
 * One-time schema migrations that run at server startup before any requests
 * are handled. Each migration is idempotent — safe to re-run on every boot.
 */
import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * M001 — rename the student `sessions` table to `student_sessions`.
 *
 * Background: the original Drizzle schema named the student sessions table
 * "sessions", which collided with the connect-pg-simple auth session store
 * (also "sessions"). The Drizzle schema was updated to "student_sessions" and
 * the auth store was updated to "auth_sessions". This migration applies the
 * corresponding rename to any database that still has the old table name.
 *
 * Detection rules (all three must hold before the rename is attempted):
 *  1. A `sessions` table exists in the public schema with a `student_id` column
 *     (the definitive marker that it is the student-session table, not an auth store).
 *  2. The target table `student_sessions` does not yet exist.
 *
 * Covered states:
 *  - Fresh database (no sessions table):          skipped — source check fails
 *  - Legacy database (sessions = student rows):   renames sessions → student_sessions
 *  - Already-migrated database:                   skipped — target already exists
 *  - Auth-only sessions table (no student_id):    skipped — source check fails
 */
async function m001RenameSessionsToStudentSessions(): Promise<void> {
  // 1. Check source: sessions table must have a student_id column
  const sourceResult = await pool.query<{ cnt: string }>(`
    SELECT COUNT(*) AS cnt
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'sessions'
      AND column_name  = 'student_id'
  `);
  const sourceHasStudentId = parseInt(sourceResult.rows[0]?.cnt ?? "0", 10) > 0;
  if (!sourceHasStudentId) {
    return; // source is not a student-session table — nothing to rename
  }

  // 2. Check target: student_sessions must not already exist
  const targetResult = await pool.query<{ cnt: string }>(`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'student_sessions'
  `);
  const targetExists = parseInt(targetResult.rows[0]?.cnt ?? "0", 10) > 0;
  if (targetExists) {
    return; // already migrated
  }

  // Single atomic DO block: re-check both conditions inside the transaction so
  // concurrent schema changes (e.g. drizzle-kit push) cannot race between the
  // outer guards and the ALTER TABLE statement.
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'sessions'
          AND column_name  = 'student_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name   = 'student_sessions'
      ) THEN
        ALTER TABLE sessions RENAME TO student_sessions;
      END IF;
    END $$;
  `);
  logger.info("Migration M001: sessions → student_sessions rename applied if needed");
}

/**
 * M002 — add nullable password_hash column to users table.
 *
 * Uses ADD COLUMN IF NOT EXISTS so it is safe to re-run on every boot and
 * on databases that already have the column (e.g. after a dev drizzle-kit push).
 */
async function m002AddPasswordHash(): Promise<void> {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_hash text;
  `);
  logger.info("Migration M002: password_hash column ensured on users");
}

/**
 * M003 — drop the orphaned legacy `sessions` table if it is an auth store table.
 *
 * Background: before the table naming conflict was resolved, the auth session
 * store (connect-pg-simple) and the student sessions table both used the name
 * "sessions". After M001 renames the student-session flavour to
 * `student_sessions`, the only remaining `sessions` table that could linger is
 * the connect-pg-simple auth table (identified by the presence of `sid` and
 * `expire` columns). Those auth sessions are permanently orphaned because the
 * store now reads from `auth_sessions` (which is created fresh by
 * connect-pg-simple via createTableIfMissing: true). Keeping the old table
 * around is misleading and wastes space, so we drop it here.
 *
 * Safety conditions (all must hold before the DROP is attempted):
 *  1. A `sessions` table exists in the public schema.
 *  2. It has a `sid` column  — the connect-pg-simple primary key.
 *  3. It does NOT have a `student_id` column — ruling out any remaining
 *     student-session data (M001 should have already renamed that table, but
 *     we double-check to be safe).
 */
async function m003DropOrphanedAuthSessionsTable(): Promise<void> {
  const result = await pool.query<{ has_sid: boolean; has_student_id: boolean }>(`
    SELECT
      bool_or(column_name = 'sid')        AS has_sid,
      bool_or(column_name = 'student_id') AS has_student_id
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'sessions'
  `);

  const row = result.rows[0];
  if (!row || !row.has_sid) {
    return; // no sessions table, or not an auth-store table — nothing to do
  }
  if (row.has_student_id) {
    // Still has student data; M001 guard didn't fire — leave it alone.
    logger.warn(
      "Migration M003: sessions table has student_id — skipping drop to avoid data loss",
    );
    return;
  }

  await pool.query(`DROP TABLE IF EXISTS sessions CASCADE;`);
  logger.info(
    "Migration M003: orphaned auth sessions table dropped (sessions → auth_sessions migration complete)",
  );
}

/**
 * M004 — ensure the `auth_sessions` table exists with the schema expected by
 * connect-pg-simple.
 *
 * connect-pg-simple will create this table via `createTableIfMissing: true`,
 * but only at the moment it first writes a session (i.e. after a successful
 * login). Running this migration at startup guarantees the table is present
 * before any request is handled, which:
 *  - prevents race conditions during high-traffic restarts, and
 *  - provides a clear audit trail that the table is intentionally maintained
 *    separately from the student `student_sessions` table.
 *
 * The DDL is idempotent (IF NOT EXISTS / DO NOTHING) and matches the schema
 * that connect-pg-simple generates internally.
 */
async function m004EnsureAuthSessionsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      sid   varchar      NOT NULL,
      sess  json         NOT NULL,
      expire timestamp(6) NOT NULL,
      CONSTRAINT auth_sessions_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS auth_sessions_expire_idx ON auth_sessions (expire);
  `);
  logger.info("Migration M004: auth_sessions table ensured");
}

/**
 * M005 — ensure the `password_reset_tokens` table exists.
 *
 * Stores hashed one-time tokens used for email-based password recovery.
 * Token hashes are SHA-256 of the raw token sent to the user's email.
 * Tokens expire after 1 hour and are single-use (usedAt is set on redemption).
 */
async function m005EnsurePasswordResetTokensTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          serial      PRIMARY KEY,
      user_id     int         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  text        NOT NULL UNIQUE,
      expires_at  timestamptz NOT NULL,
      used_at     timestamptz,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS prt_user_id_idx   ON password_reset_tokens (user_id);
    CREATE INDEX IF NOT EXISTS prt_expires_at_idx ON password_reset_tokens (expires_at);
  `);
  logger.info("Migration M005: password_reset_tokens table ensured");
}

/**
 * Run all startup migrations in order. Called once during server boot before
 * the HTTP server begins accepting connections.
 */
export async function runMigrations(): Promise<void> {
  await m001RenameSessionsToStudentSessions();
  await m002AddPasswordHash();
  await m003DropOrphanedAuthSessionsTable();
  await m004EnsureAuthSessionsTable();
  await m005EnsurePasswordResetTokensTable();
}
