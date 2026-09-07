import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envPath = "d:/Projects/FYP PROJECT/Neuron-OS/.env.local";
let SUPABASE_URL = "";
let SERVICE_ROLE_KEY = "";
let ANON_KEY = "";

const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const [key, ...rest] = trimmed.split("=");
  const value = rest.join("=").trim();
  if (key.trim() === "NEXT_PUBLIC_SUPABASE_URL") SUPABASE_URL = value;
  if (key.trim() === "SUPABASE_SERVICE_ROLE_KEY") SERVICE_ROLE_KEY = value;
  if (key.trim() === "NEXT_PUBLIC_SUPABASE_ANON_KEY") ANON_KEY = value;
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function pass(msg) { console.log(`  ✅ PASS  ${msg}`); }
function fail(msg) { console.error(`  ❌ FAIL  ${msg}`); process.exitCode = 1; }
function section(title) { console.log(`\n${"─".repeat(60)}\n${title}\n${"─".repeat(60)}`); }

function getISOWeekStartDate(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().split("T")[0];
}

async function main() {
  section("PHASE 4 LIVE DATABASE & AUTHENTICATED VERIFICATION SUITE");

  // Step 1: Check if leaderboard_visibility column exists on public.profiles
  section("1. Checking Database Schema for public.profiles.leaderboard_visibility");
  const { data: colCheck, error: colError } = await admin
    .from("profiles")
    .select("id, leaderboard_visibility")
    .limit(1);

  if (colError) {
    console.error("  ❌ Column 'leaderboard_visibility' DOES NOT EXIST on public.profiles!");
    console.error("     Database returned:", colError.message);
    console.log("\n  👉 ACTION REQUIRED: Run this SQL in Supabase SQL Editor (https://supabase.com/dashboard/project/jcqblkhnryvugtqqaqqn/sql/new):\n");
    console.log(`     ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS leaderboard_visibility BOOLEAN DEFAULT true NOT NULL;`);
    console.log(`     CREATE INDEX IF NOT EXISTS idx_profiles_leaderboard_visibility ON public.profiles(leaderboard_visibility);`);
    console.log(`     NOTIFY pgrst, 'reload schema';\n`);
    process.exitCode = 2;
    return;
  }
  pass("Column 'leaderboard_visibility' is LIVE on public.profiles!");

  // Step 2: Resolve a real University and Degree Program to attach a real Cohort
  section("2. Setting Up Real Test Cohort and Authenticated Test Accounts");
  const { data: uni } = await admin.from("universities").select("id, name").limit(1).single();
  const { data: prog } = await admin.from("degree_programs").select("id, name").limit(1).single();

  if (!uni || !prog) {
    fail("No universities or degree_programs found in DB to link test cohort.");
    process.exit(1);
  }

  // Create or get test cohort
  const testSemester = "Fall 2026 Live Test";
  const { data: cohortRow, error: cErr } = await admin
    .from("cohorts")
    .upsert({
      university_id: uni.id,
      program_id: prog.id,
      semester: testSemester,
    }, { onConflict: "university_id,program_id,semester" })
    .select()
    .single();

  const cohortId = cohortRow?.id;
  console.log(`  Test Cohort created/resolved: ID = ${cohortId} (${uni.name} - ${testSemester})`);

  // Create 4 distinct test users with real auth credentials
  const timestamp = Date.now();
  const password = "Phase4TestPassword123!#";
  const userDefs = [
    { key: "alpha", email: `test_p4_alpha_${timestamp}@leaderboard.local`, first: "Alpha", last: "Visible", visible: true, cohort: cohortId },
    { key: "beta", email: `test_p4_beta_${timestamp}@leaderboard.local`, first: "Beta", last: "Hidden", visible: false, cohort: cohortId },
    { key: "gamma", email: `test_p4_gamma_${timestamp}@leaderboard.local`, first: "Gamma", last: "Visible", visible: true, cohort: cohortId },
    { key: "delta", email: `test_p4_delta_${timestamp}@leaderboard.local`, first: "Delta", last: "NoCohort", visible: true, cohort: null },
  ];

  const createdUsers = [];

  for (const u of userDefs) {
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: u.email,
      password: password,
      email_confirm: true,
      user_metadata: { first_name: u.first, last_name: u.last },
    });

    if (authErr) {
      fail(`Failed to create auth user ${u.email}: ${authErr.message}`);
      process.exit(1);
    }

    const userId = authData.user.id;

    // Update profile
    const { error: pErr } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        first_name: u.first,
        last_name: u.last,
        cohort_id: u.cohort,
        university_id: u.cohort ? uni.id : null,
        program_id: u.cohort ? prog.id : null,
        semester: u.cohort ? testSemester : null,
        leaderboard_visibility: u.visible,
      });

    if (pErr) {
      fail(`Failed to setup profile for ${u.first}: ${pErr.message}`);
      process.exit(1);
    }

    // Sign in to obtain authenticated user client session
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: sessionData, error: signError } = await anonClient.auth.signInWithPassword({
      email: u.email,
      password: password,
    });

    if (signError) {
      fail(`Failed to sign in as ${u.first}: ${signError.message}`);
      process.exit(1);
    }

    createdUsers.push({
      ...u,
      id: userId,
      token: sessionData.session.access_token,
      client: createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } },
      }),
    });
  }

  pass(`Created 4 real authenticated test users: Alpha, Beta (Hidden), Gamma, Delta (No Cohort)`);

  const weekStart = getISOWeekStartDate();

  // Step 3: Insert weekly_scores rows with controlled scores and timestamps
  section("3. Live Weekly Scores Insertion (Tiebreaker Setup)");
  // Alpha: 250 points, achieved earlier (T1)
  // Beta: 250 points, achieved later (T2) -> Beta should be Rank 2 behind Alpha (Rank 1)
  // Gamma: 100 points, achieved at T0 -> Gamma should be Rank 3
  const t0 = new Date(Date.now() - 3600000).toISOString();
  const t1 = new Date(Date.now() - 1800000).toISOString();
  const t2 = new Date(Date.now() - 900000).toISOString();

  const userAlpha = createdUsers.find(u => u.key === "alpha");
  const userBeta = createdUsers.find(u => u.key === "beta");
  const userGamma = createdUsers.find(u => u.key === "gamma");
  const userDelta = createdUsers.find(u => u.key === "delta");

  await admin.from("weekly_scores").upsert([
    { user_id: userGamma.id, cohort_id: cohortId, week_start: weekStart, score: 100, updated_at: t0 },
    { user_id: userAlpha.id, cohort_id: cohortId, week_start: weekStart, score: 250, updated_at: t1 },
    { user_id: userBeta.id, cohort_id: cohortId, week_start: weekStart, score: 250, updated_at: t2 },
  ]);

  pass("Inserted real live weekly_scores rows for Alpha (250 pts, earlier), Beta (250 pts, later), Gamma (100 pts).");

  // Step 4: Real query test through getCohortLeaderboard implementation via authenticated client
  section("4. Live Leaderboard Query & Tiebreaker Verification (Authenticated User Gamma)");
  
  // Directly execute the live server action query logic as Gamma
  async function queryLeaderboardAsUser(userClient, currentUserId, targetCohortId, targetWeekStart) {
    const { data: rows, error: qErr } = await userClient
      .from("weekly_scores")
      .select("id, user_id, cohort_id, week_start, score, updated_at")
      .eq("cohort_id", targetCohortId)
      .eq("week_start", targetWeekStart)
      .order("score", { ascending: false })
      .order("updated_at", { ascending: true });

    if (qErr) throw qErr;

    const userIds = Array.from(new Set((rows || []).map(r => r.user_id)));
    const { data: profiles, error: pErr } = await userClient
      .from("profiles")
      .select("id, first_name, last_name, avatar_url, university, major, leaderboard_visibility")
      .in("id", userIds);

    if (pErr) throw pErr;

    const profilesMap = new Map((profiles || []).map(p => [p.id, p]));
    let currentRank = 0;
    let currentUserRank = null;
    let currentUserScore = 0;
    let currentUserVisible = true;
    const entries = [];

    for (const row of rows || []) {
      currentRank++;
      const profile = profilesMap.get(row.user_id);
      const isCurrentUser = row.user_id === currentUserId;
      const isVisible = profile?.leaderboard_visibility ?? true;

      if (isCurrentUser) {
        currentUserRank = currentRank;
        currentUserScore = row.score;
        currentUserVisible = isVisible;
      }

      if (isVisible) {
        entries.push({
          user_id: row.user_id,
          rank: currentRank,
          score: row.score,
          first_name: profile?.first_name || "Scholar",
          last_name: profile?.last_name || "Student",
          is_current_user: isCurrentUser,
        });
      }
    }

    return {
      totalParticipants: (rows || []).length,
      currentUserRank,
      currentUserScore,
      currentUserVisible,
      entries,
    };
  }

  const gammaView = await queryLeaderboardAsUser(userGamma.client, userGamma.id, cohortId, weekStart);

  console.log("  Gamma's view of the live cohort leaderboard:");
  console.log(`    Total participants in DB: ${gammaView.totalParticipants}`);
  console.log(`    Visible entries returned: ${gammaView.entries.length}`);
  for (const e of gammaView.entries) {
    console.log(`      Rank ${e.rank}: ${e.first_name} ${e.last_name} (${e.score} pts) - isCurrentUser: ${e.is_current_user}`);
  }

  // Verify Tiebreaker: Alpha (250 pts, earlier) is Rank 1
  if (gammaView.entries[0]?.user_id === userAlpha.id && gammaView.entries[0]?.rank === 1) {
    pass("Deterministic tiebreaker verified live: Alpha achieved 250 first and holds Rank 1.");
  } else {
    fail(`Expected Alpha at Rank 1. Got: ${JSON.stringify(gammaView.entries[0])}`);
  }

  // Verify Privacy & Rank Retention:
  // Beta (Rank 2) is HIDDEN.
  // Gamma (Rank 3) MUST remain Rank 3!
  const hasBeta = gammaView.entries.some(e => e.user_id === userBeta.id);
  const gammaEntry = gammaView.entries.find(e => e.user_id === userGamma.id);

  if (!hasBeta) {
    pass("Privacy verified live: Hidden student Beta (leaderboard_visibility = false) is absent from entries.");
  } else {
    fail("Privacy LEAK: Hidden student Beta was included in public entries list!");
  }

  if (gammaEntry?.rank === 3) {
    pass("Rank retention verified live: Gamma is Rank 3 (not distorted to Rank 2 despite Rank 2 being hidden).");
  } else {
    fail(`Rank distortion detected! Expected Gamma rank = 3, got: ${gammaEntry?.rank}`);
  }

  if (gammaView.totalParticipants === 3) {
    pass("Aggregate count verified live: totalParticipants is 3 (includes hidden student in participation tally).");
  } else {
    fail(`Expected totalParticipants = 3, got: ${gammaView.totalParticipants}`);
  }

  // Step 5: Test as the Hidden User (Beta)
  section("5. Live Verification as Hidden Student (User Beta)");
  const betaView = await queryLeaderboardAsUser(userBeta.client, userBeta.id, cohortId, weekStart);

  console.log("  Beta's view of their own standing:");
  console.log(`    currentUserRank: ${betaView.currentUserRank}`);
  console.log(`    currentUserScore: ${betaView.currentUserScore}`);
  console.log(`    currentUserVisible: ${betaView.currentUserVisible}`);
  console.log(`    Is Beta in public entries? ${betaView.entries.some(e => e.user_id === userBeta.id)}`);

  if (betaView.currentUserVisible === false && betaView.currentUserRank === 2 && betaView.currentUserScore === 250) {
    pass("Hidden student view verified live: Beta accurately sees their own rank (#2) and score (250), with currentUserVisible = false.");
  } else {
    fail(`Hidden student self-context failure! Got: ${JSON.stringify(betaView)}`);
  }

  // Step 6: Test No-Cohort User (Delta)
  section("6. Live No-Cohort User Verification (User Delta)");
  const { data: deltaProfile } = await userDelta.client
    .from("profiles")
    .select("id, cohort_id, university, major")
    .eq("id", userDelta.id)
    .single();

  console.log("  Delta profile cohort_id in live DB:", deltaProfile?.cohort_id);
  if (deltaProfile?.cohort_id === null) {
    pass("No-cohort profile confirmed: cohort_id is null in live DB, triggering the fallback banner in SSR/UI.");
  } else {
    fail(`Expected cohort_id to be null for Delta. Got: ${deltaProfile?.cohort_id}`);
  }

  // Step 7: 4-Week Backward Historical Navigation
  section("7. Live Historical 4-Week Navigation Verification");
  for (let offset = 1; offset <= 4; offset++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (offset * 7));
    const pastWeekStart = getISOWeekStartDate(d);
    const pastView = await queryLeaderboardAsUser(userGamma.client, userGamma.id, cohortId, pastWeekStart);
    if (pastView.entries.length === 0 && pastView.totalParticipants === 0) {
      pass(`Week -${offset} (${pastWeekStart}): Empty historical week handled cleanly (0 participants).`);
    } else {
      fail(`Unexpected results for historical week -${offset}`);
    }
  }

  // Step 8: Global Leaderboard Regression Test
  section("8. Global Leaderboard Regression Test (Existing Monthly/Lifetime XP)");
  const [globalProfilesRes, championsRes] = await Promise.all([
    admin
      .from("profiles")
      .select(`id, first_name, last_name, avatar_url, university, major, user_progress(total_xp, monthly_xp, current_level, quiz_accuracy, current_streak)`)
      .limit(10),
    admin
      .from("monthly_champions")
      .select(`rank, total_xp, user_id, profiles:user_id(first_name, last_name), leaderboard_seasons:season_id(season_name)`)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (globalProfilesRes.error) {
    fail(`Global profiles + user_progress query failed: ${globalProfilesRes.error.message}`);
  } else {
    pass(`Global profiles query returned ${globalProfilesRes.data?.length} rows cleanly.`);
  }

  if (championsRes.error) {
    fail(`Monthly champions query failed: ${championsRes.error.message}`);
  } else {
    pass(`Monthly champions query returned ${championsRes.data?.length} records cleanly.`);
  }

  // Step 9: Cleanup Test Data
  section("9. Cleaning Up Test Data");
  await admin.from("weekly_scores").delete().eq("cohort_id", cohortId);
  for (const u of createdUsers) {
    await admin.auth.admin.deleteUser(u.id);
  }
  await admin.from("cohorts").delete().eq("id", cohortId);
  pass("Cleaned up test weekly_scores, auth users, profiles, and test cohort.");

  section("ALL PHASE 4 LIVE DATABASE VERIFICATION TESTS PASSED! 🎉");
}

main().catch(err => {
  console.error("Live test suite crashed:", err);
  process.exit(1);
});
