// Applies pending SQL migrations from lib/db/migrations.
//
// Databases created before migrations existed were built with `drizzle-kit push`,
// so they already contain everything in 0000_baseline.sql. For those, the baseline
// is recorded as applied (not run) before migrating. Fresh databases run it normally.
//
// Usage: DATABASE_URL=... node lib/db/scripts/migrate.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";
const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function adoptPushedDatabase() {
  const { rows } = await pool.query(
    `select to_regclass('public.user_profiles') is not null as has_tables,
            to_regclass('${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}') is not null as has_journal`,
  );
  const { has_tables: hasTables, has_journal: hasJournal } = rows[0];
  if (!hasTables || hasJournal) return;

  const [baseline] = readMigrationFiles({ migrationsFolder });
  console.log("Existing database without migration history: recording 0000_baseline as applied.");
  await pool.query(`create schema if not exists "${MIGRATIONS_SCHEMA}"`);
  await pool.query(
    `create table if not exists "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
       id serial primary key, hash text not null, created_at bigint)`,
  );
  await pool.query(
    `insert into "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (hash, created_at) values ($1, $2)`,
    [baseline.hash, baseline.folderMillis],
  );
}

try {
  await adoptPushedDatabase();
  await migrate(drizzle(pool), {
    migrationsFolder,
    migrationsSchema: MIGRATIONS_SCHEMA,
    migrationsTable: MIGRATIONS_TABLE,
  });
  console.log("Migrations up to date.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
