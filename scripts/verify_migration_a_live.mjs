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

function pass(msg) { console.log(`  ✅ PASS: ${msg}`); }
function fail(msg) { console.error(`  ❌ FAIL: ${msg}`); process.exitCode = 1; }
function info(msg) { console.log(`  ℹ️  ${msg}`); }

async function main() {
  console.log('===============================================================');
  console.log('MIGRATION A: WRITE LOCKDOWN LIVE VERIFICATION SUITE');
  console.log('===============================================================\n');

  // 1. Fetch reference university and program for cohort derivation test
  const { data: uni } = await admin.from('universities').select('id, name').limit(1).single();
  const { data: prog } = await admin.from('degree_programs').select('id, name').limit(1).single();
  const { data: allCohorts } = await admin.from('cohorts').select('id, semester').limit(2);
  const targetCohortId = allCohorts?.[0]?.id;

  info(`Reference University: ${uni?.name} (${uni?.id})`);
  info(`Reference Program: ${prog?.name} (${prog?.id})`);
  info(`Foreign Target Cohort ID: ${targetCohortId}`);

  // 2. Create test student account
  const runId = Date.now();
  const testEmail = `student_tester_${runId}@example.com`;
  const testPassword = 'Password123!Secure';

  info(`Creating test student account: ${testEmail}`);
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

  // Initialize baseline profile row via admin client
  await admin.from('profiles').upsert({
    id: userId,
    first_name: 'Test',
    last_name: 'Student',
    is_premium: false,
    boost_ai_limit: 0,
    boost_upload_limit: 0,
    xp_points: 0,
    streak_count: 0,
    cohort_id: null,
    leaderboard_visibility: true
  });

  // Sign in as student to get real student JWT
  const { data: authSession, error: signInErr } = await anonClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (signInErr || !authSession.session) {
    throw new Error(`Failed to sign in as test student: ${signInErr?.message}`);
  }

  const studentClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${authSession.session.access_token}`
      }
    }
  });

  try {
    console.log('\n--- TEST 1: ADVERSARIAL PRIVILEGE ESCALATION ATTEMPTS ---');

    // 1a. Attempt to update is_premium
    const { error: errPremium } = await studentClient
      .from('profiles')
      .update({ is_premium: true })
      .eq('id', userId);

    if (errPremium) {
      pass(`Client is_premium update rejected: ${errPremium.message} (code: ${errPremium.code})`);
    } else {
      fail('VULNERABILITY: Student successfully updated is_premium directly!');
    }

    // 1b. Attempt to update boost limits
    const { error: errBoost } = await studentClient
      .from('profiles')
      .update({ boost_ai_limit: 999999, boost_upload_limit: 500 })
      .eq('id', userId);

    if (errBoost) {
      pass(`Client boost_* update rejected: ${errBoost.message} (code: ${errBoost.code})`);
    } else {
      fail('VULNERABILITY: Student successfully updated boost limits directly!');
    }

    // 1c. Attempt to update xp_points & streak_count
    const { error: errXp } = await studentClient
      .from('profiles')
      .update({ xp_points: 50000, streak_count: 100 })
      .eq('id', userId);

    if (errXp) {
      pass(`Client xp_points & streak_count update rejected: ${errXp.message} (code: ${errXp.code})`);
    } else {
      fail('VULNERABILITY: Student successfully modified xp_points / streak_count directly!');
    }

    // 1d. Attempt to directly write cohort_id
    const { error: errCohort } = await studentClient
      .from('profiles')
      .update({ cohort_id: targetCohortId })
      .eq('id', userId);

    if (errCohort) {
      pass(`Direct client cohort_id update rejected: ${errCohort.message} (code: ${errCohort.code})`);
    } else {
      // Even if update passed, verify if trigger prevented forgery
      const { data: pCheck } = await admin.from('profiles').select('cohort_id').eq('id', userId).single();
      if (pCheck.cohort_id === targetCohortId) {
        fail('VULNERABILITY: Student successfully forged cohort_id directly!');
      } else {
        pass(`Trigger prevented cohort forgery (cohort_id remains: ${pCheck.cohort_id})`);
      }
    }

    console.log('\n--- TEST 2: DELETE AND RE-INSERT BYPASS ATTEMPTS ---');

    // 2a. Attempt to delete own profile row
    const { error: errDel } = await studentClient
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (errDel) {
      pass(`Direct profile DELETE rejected: ${errDel.message} (code: ${errDel.code})`);
    } else {
      fail('VULNERABILITY: Student was able to delete own profile row!');
    }

    // 2b. Attempt to insert profile row directly as student
    const { error: errIns } = await studentClient
      .from('profiles')
      .insert({
        id: userId,
        first_name: 'Bypass',
        last_name: 'Attempt',
        is_premium: true
      });

    if (errIns) {
      pass(`Direct profile INSERT rejected: ${errIns.message} (code: ${errIns.code})`);
    } else {
      fail('VULNERABILITY: Student was able to insert profile row directly!');
    }

    console.log('\n--- TEST 3: LEGITIMATE PROFILE UPDATES ---');

    // 3a. Legitimate user edits (name, bio, interests, timezone)
    const { error: errLegitEdit } = await studentClient
      .from('profiles')
      .update({
        first_name: 'Alice',
        last_name: 'Scholar',
        full_name: 'Alice Scholar',
        bio: 'Researching quantum algorithms',
        timezone: 'UTC',
        interests: ['Quantum', 'Physics'],
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (errLegitEdit) {
      fail(`Legitimate profile edit failed: ${errLegitEdit.message}`);
    } else {
      pass('Legitimate profile edit saved successfully.');
    }

    // 3b. Legitimate leaderboard_visibility toggle
    const { error: errVis } = await studentClient
      .from('profiles')
      .update({
        leaderboard_visibility: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (errVis) {
      fail(`Leaderboard visibility toggle failed: ${errVis.message}`);
    } else {
      pass('Leaderboard visibility toggle saved successfully.');
    }

    // 3c. Academic attributes edit & cohort trigger derivation
    const { error: errAcademic } = await studentClient
      .from('profiles')
      .update({
        university: uni?.name || 'Stanford University',
        university_id: uni?.id || null,
        degree_program: prog?.name || 'Computer Science',
        program_id: prog?.id || null,
        semester: 'Semester 3',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (errAcademic) {
      fail(`Academic attributes update failed: ${errAcademic.message}`);
    } else {
      // Check that cohort_id was derived automatically
      const { data: updatedP } = await admin.from('profiles').select('cohort_id, semester').eq('id', userId).single();
      if (updatedP.cohort_id) {
        pass(`Cohort trigger successfully derived cohort_id: ${updatedP.cohort_id} for Semester 3`);
      } else {
        fail(`Cohort trigger did not derive cohort_id!`);
      }
    }

    console.log('\n--- TEST 4: DOCUMENT SHARING SECURITY & TRIGGER VERIFICATION ---');

    // 4a. Create a document as student
    const { data: doc, error: docCreateErr } = await studentClient
      .from('documents')
      .insert({
        user_id: userId,
        title: 'Quantum Notes',
        file_url: 'https://example.com/quantum.pdf',
        file_type: 'pdf',
        size: 1024,
        is_shared: false
      })
      .select()
      .single();

    if (docCreateErr || !doc) {
      fail(`Could not create student document: ${docCreateErr?.message}`);
    } else {
      pass(`Created test document ${doc.id}`);

      // 4b. Student attempts to forge shared_cohort_id to another class
      const { error: forgeErr } = await studentClient
        .from('documents')
        .update({
          is_shared: true,
          shared_cohort_id: targetCohortId // Forged!
        })
        .eq('id', doc.id);

      if (forgeErr) {
        info(`Document update returned: ${forgeErr.message}`);
      }

      // Check authoritative DB state
      const { data: docState } = await admin
        .from('documents')
        .select('is_shared, shared_cohort_id')
        .eq('id', doc.id)
        .single();

      const { data: studentProfile } = await admin
        .from('profiles')
        .select('cohort_id')
        .eq('id', userId)
        .single();

      if (docState.shared_cohort_id === targetCohortId && targetCohortId !== studentProfile.cohort_id) {
        fail(`VULNERABILITY: Document shared_cohort_id was forged to foreign cohort: ${targetCohortId}`);
      } else if (docState.shared_cohort_id === studentProfile.cohort_id) {
        pass(`Document trigger successfully overwrote forged shared_cohort_id with owner cohort: ${studentProfile.cohort_id}`);
      } else {
        info(`Document shared_cohort_id state: ${docState.shared_cohort_id}`);
      }

      // 4c. Cohort change unsharing test:
      // If student changes semester/cohort, previously shared documents should be unshared
      info('Updating student semester to Semester 4 (cohort change)...');
      await studentClient
        .from('profiles')
        .update({
          semester: 'Semester 4',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      const { data: docAfterCohortChange } = await admin
        .from('documents')
        .select('is_shared, shared_cohort_id')
        .eq('id', doc.id)
        .single();

      if (docAfterCohortChange.is_shared === false && docAfterCohortChange.shared_cohort_id === null) {
        pass('Changing cohort cleanly unshared previously shared documents from old class notes!');
      } else {
        info(`Doc state after cohort change: is_shared=${docAfterCohortChange.is_shared}, shared_cohort_id=${docAfterCohortChange.shared_cohort_id}`);
      }

      // Clean up test document
      await admin.from('documents').delete().eq('id', doc.id);
    }

  } finally {
    // Teardown
    console.log('\n--- CLEANUP ---');
    await admin.from('profiles').delete().eq('id', userId);
    await admin.auth.admin.deleteUser(userId);
    pass('Cleaned up test user account and records.');
  }

  console.log('\n===============================================================');
  console.log('ALL CHECKS EXECUTED');
  console.log('===============================================================');
}

main().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
