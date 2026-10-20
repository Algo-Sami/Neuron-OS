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
  console.log('MIGRATION B: PUBLIC_PROFILES VIEW & READ LOCKDOWN VERIFICATION');
  console.log('===============================================================\n');

  // Check whether public_profiles view exists in the DB
  const { data: viewCheck, error: viewCheckErr } = await admin.from('public_profiles').select('id').limit(1);
  if (viewCheckErr) {
    console.error('❌ public_profiles view is not yet applied in Supabase database!');
    console.error('   Please run supabase/migrations/20261020_create_public_profiles_view.sql in Supabase SQL Editor.');
    process.exit(1);
  }
  pass('public_profiles view exists in database.');

  // Fetch reference university and program
  const { data: uni } = await admin.from('universities').select('id, name').limit(1).single();
  const { data: prog } = await admin.from('degree_programs').select('id, name').limit(1).single();

  const runId = Date.now();
  const password = 'Password123!Secure';

  // Create User A: Cohort Alpha (Semester 1), leaderboard_visibility = false (HIDDEN)
  const emailA = `user_a_hidden_${runId}@example.com`;
  const { data: authA } = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
  const userAId = authA.user.id;

  // Create User B: Cohort Beta (Semester 2), different cohort, non-peer
  const emailB = `user_b_other_${runId}@example.com`;
  const { data: authB } = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
  const userBId = authB.user.id;

  // Create User C: Cohort Alpha (Semester 1), same cohort as User A (PEER)
  const emailC = `user_c_peer_${runId}@example.com`;
  const { data: authC } = await admin.auth.admin.createUser({ email: emailC, password, email_confirm: true });
  const userCId = authC.user.id;

  // Set up profiles
  await admin.from('profiles').upsert([
    {
      id: userAId,
      first_name: 'AliceHidden',
      last_name: 'Student',
      full_name: 'AliceHidden Student',
      university_id: uni.id,
      program_id: prog.id,
      semester: 'Semester 1',
      leaderboard_visibility: false // HIDDEN
    },
    {
      id: userBId,
      first_name: 'BobOther',
      last_name: 'Student',
      full_name: 'BobOther Student',
      university_id: uni.id,
      program_id: prog.id,
      semester: 'Semester 2', // Different cohort
      leaderboard_visibility: true
    },
    {
      id: userCId,
      first_name: 'CharliePeer',
      last_name: 'Student',
      full_name: 'CharliePeer Student',
      university_id: uni.id,
      program_id: prog.id,
      semester: 'Semester 1', // Same cohort as Alice
      leaderboard_visibility: true
    }
  ]);

  // Sign in as each user to get their JWTs
  const { data: sessA } = await anonClient.auth.signInWithPassword({ email: emailA, password });
  const { data: sessB } = await anonClient.auth.signInWithPassword({ email: emailB, password });
  const { data: sessC } = await anonClient.auth.signInWithPassword({ email: emailC, password });

  const clientA = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${sessA.session.access_token}` } }
  });
  const clientB = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${sessB.session.access_token}` } }
  });
  const clientC = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${sessC.session.access_token}` } }
  });

  try {
    console.log('\n--- TEST 1: ANONYMOUS ACCESS TO PUBLIC_PROFILES ---');
    const { data: anonData, error: anonErr } = await anonClient
      .from('public_profiles')
      .select('*')
      .limit(5);

    if (anonErr) {
      pass(`Anon cannot access public_profiles: ${anonErr.message} (code: ${anonErr.code})`);
    } else if (!anonData || anonData.length === 0) {
      pass('Anon receives 0 rows from public_profiles.');
    } else {
      fail(`VULNERABILITY: Anon was able to read ${anonData.length} rows from public_profiles!`);
    }

    console.log('\n--- TEST 2: EMAIL EXCLUSION ---');
    // Verify that the view schema does NOT include email
    const { data: sampleRow, error: sampleErr } = await clientA
      .from('public_profiles')
      .select('*')
      .eq('id', userAId)
      .single();

    if (sampleErr) {
      fail(`User A failed to read own row in public_profiles: ${sampleErr.message}`);
    } else {
      if ('email' in sampleRow) {
        fail('VULNERABILITY: email column is exposed on public_profiles view!');
      } else {
        pass('email column is strictly EXCLUDED from public_profiles view.');
      }
    }

    console.log('\n--- TEST 3: ROW FILTERING - NON-PEER vs HIDDEN USER ---');
    // User B (different cohort) tries to read User A (leaderboard_visibility=false)
    const { data: bViewsA, error: errBA } = await clientB
      .from('public_profiles')
      .select('id, first_name')
      .eq('id', userAId);

    if (bViewsA && bViewsA.length === 0) {
      pass('Non-peer (User B) CANNOT see hidden User A (0 rows returned).');
    } else {
      fail(`VULNERABILITY: Non-peer was able to see hidden user: ${JSON.stringify(bViewsA)}`);
    }

    console.log('\n--- TEST 4: ROW FILTERING - COHORT PEER vs HIDDEN USER ---');
    // User C (same cohort) tries to read User A
    const { data: cViewsA, error: errCA } = await clientC
      .from('public_profiles')
      .select('id, first_name')
      .eq('id', userAId);

    if (cViewsA && cViewsA.length > 0) {
      pass(`Cohort peer (User C) CAN see classmate User A (Name: ${cViewsA[0].first_name}).`);
    } else {
      fail('Cohort peer was unable to see classmate User A in public_profiles!');
    }

    console.log('\n--- TEST 5: SHARED STUDY ROOM PEER VISIBILITY ---');
    // Create a study room, add User A and User B to the same room
    const { data: testRoom } = await admin.from('study_rooms').insert({
      title: 'Peer Test Room',
      code: `RM${runId.toString().slice(-4)}`,
      host_id: userAId,
      is_private: false
    }).select().single();

    if (testRoom) {
      await admin.from('room_members').insert([
        { room_id: testRoom.id, user_id: userAId, role: 'host' },
        { room_id: testRoom.id, user_id: userBId, role: 'member' }
      ]);

      // Now User B shares a study room with User A! User B should now see User A
      const { data: bViewsRoomPeer } = await clientB
        .from('public_profiles')
        .select('id, first_name')
        .eq('id', userAId);

      if (bViewsRoomPeer && bViewsRoomPeer.length > 0) {
        pass(`Study room peer (User B) can now see roommate User A (Name: ${bViewsRoomPeer[0].first_name}).`);
      } else {
        fail('Study room peer was unable to see roommate User A in public_profiles!');
      }

      // Cleanup room
      await admin.from('room_members').delete().eq('room_id', testRoom.id);
      await admin.from('study_rooms').delete().eq('id', testRoom.id);
    }

    console.log('\n--- TEST 6: LEADERBOARD VISIBILITY COLUMN INCLUDED ---');
    const { data: visColCheck } = await clientC
      .from('public_profiles')
      .select('id, leaderboard_visibility')
      .eq('id', userAId)
      .single();

    if (visColCheck && typeof visColCheck.leaderboard_visibility === 'boolean') {
      pass(`leaderboard_visibility is present for cohort rank retention (value: ${visColCheck.leaderboard_visibility})`);
    } else {
      fail('leaderboard_visibility column is missing from public_profiles view!');
    }

  } finally {
    console.log('\n--- CLEANUP ---');
    await admin.from('profiles').delete().in('id', [userAId, userBId, userCId]);
    await admin.auth.admin.deleteUser(userAId);
    await admin.auth.admin.deleteUser(userBId);
    await admin.auth.admin.deleteUser(userCId);
    pass('Cleaned up all test accounts.');
  }

  console.log('\n===============================================================');
  console.log('MIGRATION B VERIFICATION COMPLETED');
  console.log('===============================================================');
}

main().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
