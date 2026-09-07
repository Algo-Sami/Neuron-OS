/**
 * Run both migration SQL files against the live Supabase DB
 * using the pg REST endpoint available via service-role key.
 *
 * Supabase exposes /rest/v1/rpc/exec_sql only on self-hosted.
 * For hosted projects we use the management API:
 *   POST https://api.supabase.com/v1/projects/{ref}/database/query
 * But that requires a personal access token, not service role.
 *
 * Alternative: use the supabase-js admin client's .rpc() to call
 * pg_execute_statement via a service_role call, or use the
 * postgres.js / node-postgres client with the direct DB URL.
 *
 * We'll use node-postgres (pg) if available, or fall back to
 * fetching the DB connection string from env.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

import { config } from "dotenv";
config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jcqblkhnryvugtqqaqqn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Extract the project ref from the URL
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

async function runSqlViaManagementApi(sql) {
  // Supabase management API requires a personal access token (PAT), not service role.
  // Instead, use the supabase-js RPC workaround via a stored procedure,
  // or use fetch to the /sql endpoint if available on this tier.
  
  // Try the direct SQL via PostgREST's hidden /rpc/query endpoint
  // Actually the cleanest approach for hosted projects without PAT is
  // to create a helper function via RPC. Let's use pg-based direct connection.
  throw new Error("Management API requires PAT — use direct pg connection instead");
}

// Check if we can find a DB_URL in env files
import { existsSync } from "fs";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const content = readFileSync(path, "utf8");
  const result = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    result[key] = val;
  }
  return result;
}

const env = loadEnvFile(".env.local");
const DB_URL = env.DATABASE_URL || env.DIRECT_URL || env.SUPABASE_DB_URL ||
  // Supabase standard pooler format
  `postgresql://postgres:${env.SUPABASE_DB_PASSWORD || ""}@db.${PROJECT_REF}.supabase.co:5432/postgres`;

console.log("Checking for pg package...");
let pg;
try {
  pg = await import("pg");
  console.log("pg available");
} catch {
  console.log("pg not available, trying postgres...");
  pg = null;
}

if (!pg) {
  console.error("No direct DB access available (no pg package, no DIRECT_URL)");
  console.log("\nMigrations must be run via:\n  npx supabase db push\nor via the Supabase dashboard SQL editor.\n");
  process.exit(1);
}

const { Client } = pg.default || pg;

// Supabase connection pooler (session mode, port 5432)
const DB_CONN_URL = `postgresql://postgres.${PROJECT_REF}:${env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD || ""}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;

async function runMigration(label, sqlPath) {
  console.log(`\nRunning migration: ${label}`);
  const sql = readFileSync(resolve(sqlPath), "utf8");
  
  const client = new Client({ connectionString: DB_CONN_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(sql);
    console.log(`  ✅ ${label} applied successfully`);
  } finally {
    await client.end();
  }
}

await runMigration(
  "20260906_add_university_program_tables.sql",
  "supabase/migrations/20260906_add_university_program_tables.sql"
);
await runMigration(
  "20260906_add_cohorts_system.sql",
  "supabase/migrations/20260906_add_cohorts_system.sql"
);

console.log("\nAll migrations applied. Run the verification tests now.");
