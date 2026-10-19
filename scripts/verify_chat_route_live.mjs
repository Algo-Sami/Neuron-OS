import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '../.env.local'), 'utf8');
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

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function runLiveTest() {
  console.log("──────────────────────────────────────────────────────────────────────");
  console.log("LIVE VERIFICATION: RAG ASSISTANT CHAT ROUTE HARDENING");
  console.log("──────────────────────────────────────────────────────────────────────");

  const testEmail = `chat_test_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  console.log(`\n1. Creating test student: ${testEmail}`);
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true
  });
  if (authErr) throw authErr;
  const userId = authData.user.id;
  console.log(`   ✅ Student created with ID: ${userId}`);

  // Create profile
  await admin.from('profiles').insert({
    id: userId,
    first_name: 'Test',
    last_name: 'Student',
    is_premium: false // Free tier baseline
  });

  // Sign in to get session tokens
  const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });
  if (signInErr) throw signInErr;
  const session = signInData.session;
  console.log(`   ✅ Signed in, acquired session tokens.`);

  const { createServerClient } = await import('@supabase/ssr');
  const cookieJar = {};
  const ssrClient = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return Object.entries(cookieJar).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          cookieJar[name] = value;
        });
      }
    }
  });

  await ssrClient.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  });

  const cookieHeader = Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');
  console.log(`   ✅ Generated SSR cookies: ${Object.keys(cookieJar).join(', ')}`);

  try {
    // ── TEST 1: PRE-FLIGHT QUOTA BLOCK (429) ─────────────────────────────────
    console.log(`\n2. Testing Pre-Flight Quota Exhaustion...`);
    console.log(`   Injecting 60 usage logs to exceed daily request limit (50 req/day)...`);
    const logs = Array.from({ length: 60 }).map(() => ({
      user_id: userId,
      model_name: 'gemini-3.8-flash',
      prompt_tokens: 100,
      completion_tokens: 100,
      estimated_cost: 0.005,
      created_at: new Date().toISOString()
    }));
    await admin.from('ai_usage_logs').insert(logs);

    console.log(`   Sending chat request to http://localhost:3000/api/assistant/chat...`);
    const resOverQuota = await fetch('http://localhost:3000/api/assistant/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ message: "Hello assistant!" })
    });

    console.log(`   HTTP Status: ${resOverQuota.status} (Expected 429)`);
    const bodyOverQuota = await resOverQuota.json();
    console.log(`   Response Body:`, bodyOverQuota);

    if (resOverQuota.status === 429 && bodyOverQuota.error?.includes('quota or budget limit exceeded')) {
      console.log(`   ✅ PASS: Pre-flight check successfully BLOCKED exhausted student with HTTP 429!`);
    } else {
      console.error(`   ❌ FAIL: Expected 429 with quota error message! Got:`, resOverQuota.status, bodyOverQuota);
    }

    // ── TEST 2: NORMAL CHAT & PER-TURN LOGGING ───────────────────────────────
    console.log(`\n3. Testing Normal Execution & Per-Turn Usage Logging...`);
    console.log(`   Clearing injected logs...`);
    await admin.from('ai_usage_logs').delete().eq('user_id', userId);

    console.log(`   Sending legitimate chat query: "What documents do I have in my workspace?"`);
    const resLegit = await fetch('http://localhost:3000/api/assistant/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ message: "What documents do I have in my workspace?" })
    });

    console.log(`   HTTP Status: ${resLegit.status} (Expected 200)`);
    const bodyLegit = await resLegit.json();
    console.log(`   Response content preview: "${bodyLegit.content?.slice(0, 100)}..."`);

    // Verify usage logs recorded
    const { data: recordedLogs } = await admin
      .from('ai_usage_logs')
      .select('id, prompt_tokens, completion_tokens, estimated_cost, created_at')
      .eq('user_id', userId);

    console.log(`   Usage logs recorded for this query: ${recordedLogs?.length || 0} turn(s)`);
    for (const log of recordedLogs || []) {
      console.log(`     - Turn Log: prompt=${log.prompt_tokens} tokens, resp=${log.completion_tokens} tokens, cost=$${log.estimated_cost}`);
    }

    if (recordedLogs && recordedLogs.length >= 1) {
      console.log(`   ✅ PASS: Per-turn usage logging is actively recording model calls!`);
    } else {
      console.error(`   ❌ FAIL: No usage logs were recorded!`);
    }

  } finally {
    console.log(`\n4. Cleanup Test Student...`);
    await admin.from('ai_usage_logs').delete().eq('user_id', userId);
    await admin.from('chat_conversations').delete().eq('user_id', userId);
    await admin.from('profiles').delete().eq('id', userId);
    await admin.auth.admin.deleteUser(userId);
    console.log(`   ✅ Test student cleaned up cleanly.\n`);
  }
}

runLiveTest().catch(console.error);
