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

const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  console.log('===============================================================');
  console.log('STEP 1.2: LIVE PRIVILEGE ESCALATION ATTACKS (AUTHENTICATED USER)');
  console.log('===============================================================\n');

  // 1. Set up a real authenticated student session
  const testEmail = `attack_test_${Date.now()}@teststudent.com`;
  const testPassword = 'AttackTestPassword123!';

  console.log('1. Creating test student account:', testEmail);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true
  });

  if (createErr || !created?.user) {
    throw new Error(`Failed to create test user: ${createErr?.message}`);
  }
  const testUser = created.user;
  const userId = testUser.id;
  console.log(`   User ID: ${userId}`);

  // Create baseline profile using admin
  await admin.from('profiles').insert({
    id: userId,
    first_name: 'Attacker',
    last_name: 'Student',
    is_premium: false,
    boost_ai_limit: 0,
    boost_upload_limit: 0,
    cohort_id: null
  });

  // Get a real cohort from the database to use as target cohort
  const { data: cohorts } = await admin.from('cohorts').select('id, semester').limit(2);
  const targetCohortId = cohorts?.[0]?.id;
  console.log(`   Real Target Cohort ID: ${targetCohortId} (${cohorts?.[0]?.semester})`);

  // 2. Sign in as the student using the ANON client to get a real student JWT
  console.log('\n2. Signing in as student to acquire student JWT...');
  const { data: authSession, error: signInErr } = await anonClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (signInErr || !authSession.session) {
    throw new Error(`Failed to sign in as student: ${signInErr?.message}`);
  }

  // Create a client with ONLY the student's JWT token
  const studentClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${authSession.session.access_token}`
      }
    }
  });

  const attackResults = {};

  try {
    // ── ATTACK 2A: Set is_premium = true ────────────────────────────────────
    console.log('\n3. Attack 2a: Attempting UPDATE profiles SET is_premium = true...');
    const { data: res2a, error: err2a } = await studentClient
      .from('profiles')
      .update({ is_premium: true })
      .eq('id', userId)
      .select('id, is_premium')
      .single();

    if (err2a) {
      console.log(`   ❌ BLOCKED by DB: ${err2a.message} (code: ${err2a.code})`);
      attackResults.is_premium = { success: false, error: err2a.message };
    } else if (res2a?.is_premium === true) {
      console.log(`   🚨 EXPLOIT SUCCEEDED! Student modified own is_premium to TRUE:`, res2a);
      attackResults.is_premium = { success: true, result: res2a };
    } else {
      console.log(`   ⚠️ Silent no-op:`, res2a);
      attackResults.is_premium = { success: false, result: res2a };
    }

    // ── ATTACK 2B: Set boost_ai_limit = 999999 ───────────────────────────────
    console.log('\n4. Attack 2b: Attempting UPDATE profiles SET boost_ai_limit = 999999...');
    const { data: res2b, error: err2b } = await studentClient
      .from('profiles')
      .update({ boost_ai_limit: 999999 })
      .eq('id', userId)
      .select('id, boost_ai_limit')
      .single();

    if (err2b) {
      console.log(`   ❌ BLOCKED by DB: ${err2b.message} (code: ${err2b.code})`);
      attackResults.boost_ai_limit = { success: false, error: err2b.message };
    } else if (res2b?.boost_ai_limit === 999999) {
      console.log(`   🚨 EXPLOIT SUCCEEDED! Student inflated boost_ai_limit to 999999:`, res2b);
      attackResults.boost_ai_limit = { success: true, result: res2b };
    } else {
      console.log(`   ⚠️ Silent no-op:`, res2b);
      attackResults.boost_ai_limit = { success: false, result: res2b };
    }

    // ── ATTACK 2C: Set cohort_id = targetCohortId ────────────────────────────
    console.log(`\n5. Attack 2c: Attempting UPDATE profiles SET cohort_id = '${targetCohortId}'...`);
    const { data: res2c, error: err2c } = await studentClient
      .from('profiles')
      .update({ cohort_id: targetCohortId })
      .eq('id', userId)
      .select('id, cohort_id')
      .single();

    if (err2c) {
      console.log(`   ❌ BLOCKED by DB: ${err2c.message} (code: ${err2c.code})`);
      attackResults.cohort_id = { success: false, error: err2c.message };
    } else if (res2c?.cohort_id === targetCohortId) {
      console.log(`   🚨 EXPLOIT SUCCEEDED! Student forged cohort_id to target cohort:`, res2c);
      attackResults.cohort_id = { success: true, result: res2c };
    } else {
      console.log(`   ⚠️ Silent no-op:`, res2c);
      attackResults.cohort_id = { success: false, result: res2c };
    }

    // ── ATTACK 2D: Document forge is_shared=true, shared_cohort_id=targetCohortId ──
    console.log('\n6. Attack 2d: Creating student document and attempting forged sharing...');
    // Create document as student
    const { data: testDoc, error: docErr } = await studentClient
      .from('documents')
      .insert({
        user_id: userId,
        title: 'Attacker Note',
        file_url: 'https://example.com/exploit.pdf',
        file_type: 'pdf',
        size: 512,
        is_shared: false,
        shared_cohort_id: null
      })
      .select()
      .single();

    if (docErr || !testDoc) {
      console.log(`   Could not create test doc as student:`, docErr);
      attackResults.document_shared_cohort_id = { success: false, error: docErr?.message };
    } else {
      console.log(`   Created document ${testDoc.id}. Now attempting forged UPDATE...`);
      const { data: res2d, error: err2d } = await studentClient
        .from('documents')
        .update({
          is_shared: true,
          shared_cohort_id: targetCohortId,
          shared_at: new Date().toISOString()
        })
        .eq('id', testDoc.id)
        .select('id, is_shared, shared_cohort_id')
        .single();

      if (err2d) {
        console.log(`   ❌ BLOCKED by DB: ${err2d.message} (code: ${err2d.code})`);
        attackResults.document_shared_cohort_id = { success: false, error: err2d.message };
      } else if (res2d?.is_shared === true && res2d?.shared_cohort_id === targetCohortId) {
        console.log(`   🚨 EXPLOIT SUCCEEDED! Student forced is_shared=true and shared_cohort_id='${targetCohortId}':`, res2d);
        attackResults.document_shared_cohort_id = { success: true, result: res2d };
      } else {
        console.log(`   ⚠️ Silent no-op:`, res2d);
        attackResults.document_shared_cohort_id = { success: false, result: res2d };
      }

      // Cleanup test doc
      await admin.from('documents').delete().eq('id', testDoc.id);
    }

    // ── ATTACK 2E: Reading another user's sensitive profile data ──────────────
    console.log('\n7. Attack 2e: Attempting to SELECT other students sensitive fields...');
    const { data: allProfiles, error: readErr } = await studentClient
      .from('profiles')
      .select('id, email, country, timezone, interests, study_goals, is_premium, cohort_id')
      .neq('id', userId)
      .limit(3);

    if (readErr) {
      console.log(`   ❌ BLOCKED by DB: ${readErr.message}`);
      attackResults.read_other_profiles = { success: false, error: readErr.message };
    } else if (allProfiles && allProfiles.length > 0) {
      console.log(`   🚨 EXPLOIT SUCCEEDED! Student read ${allProfiles.length} other profiles with email & private data:`);
      allProfiles.forEach(p => {
        console.log(`      User ${p.id.slice(0, 8)}: email=${p.email}, country=${p.country}, is_premium=${p.is_premium}`);
      });
      attackResults.read_other_profiles = { success: true, count: allProfiles.length, sample: allProfiles[0] };
    } else {
      console.log(`   0 rows returned for other profiles.`);
      attackResults.read_other_profiles = { success: false, count: 0 };
    }

  } finally {
    // 8. Revert / cleanup
    console.log('\n8. Cleaning up test student account and test data...');
    await admin.from('profiles').delete().eq('id', userId);
    await admin.auth.admin.deleteUser(userId);
    console.log('   Cleaned up test account completely.');
  }

  console.log('\n===============================================================');
  console.log('ATTACK SUMMARY REPORT:');
  console.log(JSON.stringify(attackResults, null, 2));
  console.log('===============================================================');
}

main().catch(console.error);
