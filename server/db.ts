import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../shared/schema";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_URL || path.join(__dirname, "..", "local.db");

// A mounted disk (e.g. /data) exists, but a nested path under it might not.
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

const sqlite = new Database(dbPath);

/**
 * Creates the tables if they're missing.
 *
 * `local.db` is gitignored — correctly, it holds user rows — so a fresh deploy starts
 * with no database file at all. `npm run db:push` is a manual step that never runs on
 * the host, which left the server with an empty database: every sign-in failed because
 * the sessions and users tables didn't exist.
 *
 * Kept in sync with shared/schema.ts by hand. It's IF NOT EXISTS, so it's a no-op on an
 * existing database and never touches data; `db:push` still handles real migrations.
 */
const ensureSchema = () => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY NOT NULL,
      sess TEXT NOT NULL,
      expire INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions (expire);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT UNIQUE,
      first_name TEXT,
      last_name TEXT,
      profile_image_url TEXT,
      allergies TEXT,
      dietary_preferences TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
  `);
};

ensureSchema();

export const db = drizzle(sqlite, { schema });
