/**
 * apply_gamification_rls_migration.mjs
 *
 * Applies migration 20261008_harden_gamification_rls.sql directly to the
 * remote Supabase database using the service-role key (bypasses RLS, runs
 * as the postgres role via the Supabase Management REST endpoint).
 *
 * Usage:
 *   npx tsx scripts/apply_gamification_rls_migration.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Read env ──────────────────────────────────────────────────────────────────
const envPath = resolve(__dirname, '../.env.local');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// ── Read migration SQL ────────────────────────────────────────────────────────
const migrationPath = resolve(__dirname, '../supabase/migrations/20261008_harden_gamification_rls.sql');
const migrationSQL = readFileSync(migrationPath, 'utf8');

// ── Split into statements (skip empty / comment-only lines) ──────────────────
// We execute each statement individually via supabase.rpc or raw REST.
// Since supabase-js doesn't expose raw SQL execution on the data API,
// we use the Supabase Management API's /query endpoint.
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌ Could not parse project ref from SUPABASE_URL:', SUPABASE_URL);
  process.exit(1);
}

console.log(`\n🚀 Applying migration to project: ${projectRef}`);
console.log(`   Migration: 20261008_harden_gamification_rls.sql\n`);

// Use Supabase's pg_query RPC (available via the "exec_sql" helper or direct REST)
// The supabase-js admin client can call rpc('exec_sql', {sql}) if the function exists.
// Alternatively, we apply each statement via the REST Management API.
const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

// Note: The Management API requires a Personal Access Token, not a service-role key.
// Since we don't have a PAT, we'll use the supabase-js client with an RPC fallback.
// The standard workaround is to use a helper Postgres function.

// ── Approach: exec statements via admin client + rpc exec_sql ─────────────────
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Split SQL into individual statements
const statements = migrationSQL
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith('--') && !/^--/.test(s.replace(/\n/g, '')));

console.log(`📋 ${statements.length} SQL statements to execute\n`);

let passed = 0;
let failed = 0;

for (const stmt of statements) {
  // Skip pure comment blocks
  const nonCommentLines = stmt.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim();
  if (!nonCommentLines) continue;

  const preview = nonCommentLines.replace(/\s+/g, ' ').slice(0, 80);
  process.stdout.write(`  ▶ ${preview}… `);

  const { error } = await admin.rpc('exec_sql', { sql: stmt + ';' }).single();

  if (error) {
    // Try the alternative function name
    const { error: error2 } = await admin.rpc('execute_sql', { query: stmt + ';' }).single();
    if (error2) {
      console.log(`❌ FAILED`);
      console.error(`     Error: ${error.message}`);
      failed++;
      continue;
    }
  }

  console.log(`✅`);
  passed++;
}

console.log(`\n${'─'.repeat(60)}`);
if (failed === 0) {
  console.log(`✅ Migration applied successfully (${passed} statements)\n`);
} else {
  console.log(`⚠️  Migration partially applied: ${passed} passed, ${failed} failed\n`);
  console.log(`   NOTE: If exec_sql/execute_sql RPCs don't exist, apply the migration`);
  console.log(`   manually via the Supabase Dashboard SQL editor:\n`);
  console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new\n`);
  process.exit(1);
}
