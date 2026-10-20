import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log('=== 1. Columns on profiles ===');
  const { data: profileSample, error: pErr } = await admin.from('profiles').select('*').limit(1);
  if (profileSample && profileSample[0]) {
    console.log('Profile columns:', Object.keys(profileSample[0]));
    console.log('Profile sample row:', profileSample[0]);
  } else {
    console.log('Profile error or empty:', pErr);
  }

  console.log('\n=== 2. Columns on documents ===');
  const { data: docSample, error: dErr } = await admin.from('documents').select('*').limit(1);
  if (docSample && docSample[0]) {
    console.log('Document columns:', Object.keys(docSample[0]));
  }

  console.log('\n=== 3. Querying pg_policies for profiles and documents ===');
  // We can query pg_policies via RPC if available, or inspect migrations/system views
  // Let's test if we can run an RPC or query system tables
  const { data: policies, error: polErr } = await admin.rpc('get_policies_for_tables', {
    table_names: ['profiles', 'documents']
  });

  if (polErr) {
    console.log('No helper RPC for policies:', polErr.message);
  } else {
    console.log('Policies from RPC:', policies);
  }
}

main().catch(console.error);
