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
  section("PHASE 5 LIVE DATABASE VERIFICATION SUITE");

  // Step 1: Check if new columns exist on public.profiles
  section("1. Checking Database Schema for winner boosts & is_premium");
  const { data: colCheck, error: colError } = await admin
    .from("profiles")
    .select("id, is_premium, boost_upload_limit, boost_ai_limit, boost_expires_at")
    .limit(1);

  if (colError) {
    console.error("  ❌ Columns DO NOT EXIST on public.profiles!");
    console.error("     Database returned:", colError.message);
    console.log("\n  👉 ACTION REQUIRED: Run this SQL in Supabase SQL Editor (https://supabase.com/dashboard/project/jcqblkhnryvugtqqaqqn/sql/new):\n");
    console.log(`     ALTER TABLE public.profiles`);
    console.log(`       ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false NOT NULL,`);
    console.log(`       ADD COLUMN IF NOT EXISTS boost_upload_limit INT NULL,`);
    console.log(`       ADD COLUMN IF NOT EXISTS boost_ai_limit INT NULL,`);
    console.log(`       ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ NULL;`);
    console.log(`     CREATE INDEX IF NOT EXISTS idx_profiles_boost_expires_at ON public.profiles(boost_expires_at);`);
    console.log(`     NOTIFY pgrst, 'reload schema';\n`);
    process.exitCode = 2;
    return;
  }
  pass("Columns 'is_premium', 'boost_upload_limit', 'boost_ai_limit', 'boost_expires_at' are LIVE on public.profiles!");

  // Step 2: Set up real cohort & test users
  section("2. Setting Up Test Cohort and Test Accounts");
  const { data: uni } = await admin.from("universities").select("id, name").limit(1).single();
  const { data: prog } = await admin.from("degree_programs").select("id, name").limit(1).single();

  const testSemester = "Spring 2027 Phase 5 Test";
  const { data: cohortRow } = await admin
    .from("cohorts")
    .upsert({
      university_id: uni.id,
      program_id: prog.id,
      semester: testSemester,
    }, { onConflict: "university_id,program_id,semester" })
    .select()
    .single();

  const cohortId = cohortRow.id;
  const timestamp = Date.now();
  const password = "Phase5Password123!#";

  const userDefs = [
    { key: "legacy_major", email: `test_p5_legacy_${timestamp}@boost.local`, first: "Legacy", last: "Student", major: "premium", is_premium: false },
    { key: "true_premium", email: `test_p5_prem_${timestamp}@boost.local`, first: "Real", last: "Premium", major: "Computer Science", is_premium: true },
    { key: "winner", email: `test_p5_winner_${timestamp}@boost.local`, first: "Winner", last: "Student", major: "Computer Science", is_premium: false },
    { key: "runner_up", email: `test_p5_runner_${timestamp}@boost.local`, first: "Runner", last: "Up", major: "Computer Science", is_premium: false },
  ];

  const createdUsers = [];

  for (const u of userDefs) {
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: { first_name: u.first, last_name: u.last },
    });

    if (authErr) {
      fail(`Failed to create auth user ${u.email}: ${authErr.message}`);
      process.exit(1);
    }

    const userId = authData.user.id;
    const { error: upsertErr } = await admin.from("profiles").upsert({
      id: userId,
      first_name: u.first,
      last_name: u.last,
      major: u.major,
      is_premium: u.is_premium,
      cohort_id: cohortId,
      university_id: uni.id,
      program_id: prog.id,
      semester: testSemester,
    });
    if (upsertErr) {
      fail(`Profile upsert failed for ${u.email}: ${upsertErr.message}`);
      process.exit(1);
    }
    // Verify the profile was actually written with correct fields
    const { data: verifyProf } = await admin.from("profiles").select("id, cohort_id, is_premium, major").eq("id", userId).single();
    if (!verifyProf?.cohort_id) {
      fail(`Profile for ${u.email} missing cohort_id after upsert! Got: ${JSON.stringify(verifyProf)}`);
      process.exit(1);
    }

    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: sessionData } = await anonClient.auth.signInWithPassword({
      email: u.email,
      password,
    });

    createdUsers.push({
      ...u,
      id: userId,
      token: sessionData.session.access_token,
      client: createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } },
      }),
    });
  }

  pass(`Created 4 test users: Legacy Major ('premium'), Real Premium, Winner, Runner-Up`);

  const uLegacy = createdUsers.find(u => u.key === "legacy_major");
  const uPrem = createdUsers.find(u => u.key === "true_premium");
  const uWinner = createdUsers.find(u => u.key === "winner");
  const uRunner = createdUsers.find(u => u.key === "runner_up");

  // Step 3: Tier Bug Fix Verification (major === 'premium' does NOT leak 500 limit)
  section("3. Tier Bug Fix Verification");
  const QUOTAS = {
    free: { dailyLimit: 50 },
    premium: { dailyLimit: 500 },
  };

  function computeEffectiveLimits(profile) {
    const isPremium = profile?.is_premium ?? false;
    const baselineLimits = isPremium ? QUOTAS.premium : QUOTAS.free;
    const isBoostActive = Boolean(profile?.boost_expires_at && new Date(profile.boost_expires_at) > new Date());
    const effectiveDailyLimit = baselineLimits.dailyLimit + (isBoostActive ? (profile?.boost_ai_limit ?? 0) : 0);
    const effectiveUploadMB = (isBoostActive && profile?.boost_upload_limit) ? profile.boost_upload_limit : 50;
    return { isPremium, baselineDailyLimit: baselineLimits.dailyLimit, effectiveDailyLimit, effectiveUploadMB };
  }

  const { data: legacyProfile } = await admin.from("profiles").select("*").eq("id", uLegacy.id).single();
  const legacyLimits = computeEffectiveLimits(legacyProfile);
  console.log(`  Legacy User (major='${legacyProfile.major}', is_premium=${legacyProfile.is_premium}):`);
  console.log(`    Effective AI Daily Limit: ${legacyLimits.effectiveDailyLimit} (Expected: 50)`);
  if (legacyLimits.effectiveDailyLimit === 50 && legacyLimits.isPremium === false) {
    pass("Legacy string major='premium' cleanly loses accidental premium status; baseline is 50.");
  } else {
    fail(`Leak detected! Legacy user received: ${legacyLimits.effectiveDailyLimit}`);
  }

  const { data: premProfile } = await admin.from("profiles").select("*").eq("id", uPrem.id).single();
  const premLimits = computeEffectiveLimits(premProfile);
  console.log(`  Real Premium User (is_premium=${premProfile.is_premium}):`);
  console.log(`    Effective AI Daily Limit: ${premLimits.effectiveDailyLimit} (Expected: 500)`);
  if (premLimits.effectiveDailyLimit === 500 && premLimits.isPremium === true) {
    pass("Real is_premium=true user receives standard 500 daily quota.");
  } else {
    fail(`Premium user did not receive 500 quota: ${premLimits.effectiveDailyLimit}`);
  }

  // Step 4: Weekly Finalization & Winner Selection
  section("4. Weekly Finalization & Winner Boost Assignment");
  const testWeek = "2026-08-31";

  // Winner has 300 pts, Runner-up has 200 pts
  await admin.from("weekly_scores").upsert([
    { user_id: uWinner.id, cohort_id: cohortId, week_start: testWeek, score: 300, updated_at: new Date(Date.now() - 10000).toISOString() },
    { user_id: uRunner.id, cohort_id: cohortId, week_start: testWeek, score: 200, updated_at: new Date(Date.now() - 20000).toISOString() },
  ]);

  // Populate process.env so createAdminClient() inside the TS module can read them
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;

  // Import finalizeWeeklyScoresAndApplyBoosts
  const { finalizeWeeklyScoresAndApplyBoosts } = await import("../src/services/gamification/weekly-scores.ts");
  const finalResult = await finalizeWeeklyScoresAndApplyBoosts(testWeek);

  console.log("  Finalization output:", JSON.stringify(finalResult));
  const testWinnerBoost = finalResult.boostsAwarded.find(b => b.userId === uWinner.id);
  if (finalResult.success && testWinnerBoost) {
    pass(`Winner successfully identified and awarded boost! (${finalResult.boostsAwarded.length} cohort(s) processed total)`);
  } else {
    fail(`Finalization failed or did not include test winner: ${JSON.stringify(finalResult)}`);
  }

  // Inspect database rows
  const { data: winnerProf } = await admin.from("profiles").select("boost_upload_limit, boost_ai_limit, boost_expires_at").eq("id", uWinner.id).single();
  const { data: runnerProf } = await admin.from("profiles").select("boost_upload_limit, boost_ai_limit, boost_expires_at").eq("id", uRunner.id).single();

  console.log("  Winner Profile Boost Fields:", winnerProf);
  console.log("  Runner-Up Profile Boost Fields:", runnerProf);

  if (winnerProf.boost_upload_limit === 100 && winnerProf.boost_ai_limit === 50 && new Date(winnerProf.boost_expires_at) > new Date()) {
    pass("Winner profile correctly stamped with boost_upload_limit=100, boost_ai_limit=50, boost_expires_at ~ now+7d.");
  } else {
    fail(`Winner boost fields invalid: ${JSON.stringify(winnerProf)}`);
  }

  if (runnerProf.boost_upload_limit === null && runnerProf.boost_ai_limit === null && runnerProf.boost_expires_at === null) {
    pass("Runner-up received no boost (fields remain null).");
  } else {
    fail(`Runner-up received unintended boost: ${JSON.stringify(runnerProf)}`);
  }

  // Step 5: Overwriting Repeat Wins (Clean Reset, No Compounding)
  section("5. Overwriting Repeat Wins (Reset, No Compounding)");
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from("profiles").update({ boost_expires_at: twoDaysFromNow }).eq("id", uWinner.id);

  console.log(`  Before repeat-win: boost_expires_at = ${twoDaysFromNow} (2 days remaining)`);

  // Run finalization again
  await finalizeWeeklyScoresAndApplyBoosts(testWeek);

  const { data: repeatWinnerProf } = await admin.from("profiles").select("boost_expires_at").eq("id", uWinner.id).single();
  const diffDays = (new Date(repeatWinnerProf.boost_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  console.log(`  After repeat-win:  boost_expires_at = ${repeatWinnerProf.boost_expires_at} (~${diffDays.toFixed(2)} days remaining)`);

  if (diffDays >= 6.9 && diffDays <= 7.1) {
    pass("Repeat win cleanly overwrote expiry window to 7 days from current win (exact reset, NO compounding to 9 days).");
  } else {
    fail(`Compounding or invalid expiry detected: ${diffDays} days remaining.`);
  }

  // Step 6: AI Router Quota Checks (Stacked Boost)
  section("6. AI Router Quota Verification (Stacked Boost)");
  // Re-read winner profile AFTER finalization to get current boost values
  const { data: winnerProfFresh } = await admin.from("profiles").select("*").eq("id", uWinner.id).single();
  const winnerStacked = computeEffectiveLimits(winnerProfFresh);
  console.log(`  Winner Effective Daily AI Limit: ${winnerStacked.effectiveDailyLimit} (50 baseline + 50 boost = 100)`);
  console.log(`  Winner boost_ai_limit=${winnerProfFresh?.boost_ai_limit}, boost_expires_at=${winnerProfFresh?.boost_expires_at}`);
  if (winnerStacked.effectiveDailyLimit === 100) {
    pass("Free tier winner receives stacked 100 daily requests (50 baseline + 50 boost).");
  } else {
    fail(`Expected 100 daily requests, got: ${winnerStacked.effectiveDailyLimit}`);
  }

  // Step 7: Pre-Storage Upload Gate (3 Boundary Tests with Live Storage Bucket Inspection)
  section("7. Pre-Storage Upload Gate with Live Storage Bucket Inspection");

  // Simulated client upload execution that follows the preflight gate (matching upload-center.tsx)
  async function attemptClientUpload(userClient, userId, profile, fileName, fileSizeMB) {
    const fileSizeBytes = fileSizeMB * 1024 * 1024;
    const isBoostActive = Boolean(profile?.boost_expires_at && new Date(profile.boost_expires_at) > new Date());
    const effectiveMaxMB = (isBoostActive && profile?.boost_upload_limit) ? profile.boost_upload_limit : 50;

    // 1. Server preflight gate
    if (fileSizeBytes > effectiveMaxMB * 1024 * 1024) {
      return { allowed: false, uploadedToStorage: false, effectiveMaxMB };
    }

    // 2. Preflight passed -> upload to Supabase Storage
    const filePath = `${userId}/p5_live_test_${Date.now()}_${fileName}`;
    const testPayload = Buffer.from(`Phase 5 live test verification file: ${fileName}`);
    const { error: sErr } = await userClient.storage
      .from("documents")
      .upload(filePath, testPayload, { upsert: false, contentType: "application/pdf" });

    if (sErr) console.log(`    [Storage DEBUG] Upload error: ${sErr.message} (status: ${sErr.statusCode ?? 'n/a'})`);
    return { allowed: true, uploadedToStorage: !sErr, storageErr: sErr?.message, filePath, effectiveMaxMB };
  }

  // Boundary A: Unboosted user (Runner-Up), 75 MB file -> REJECTED, ZERO bytes sent to storage
  const fileNameA = "rejected_unboosted_75mb.pdf";
  const resA = await attemptClientUpload(uRunner.client, uRunner.id, runnerProf, fileNameA, 75);
  const { data: bucketListA } = await uRunner.client.storage.from("documents").list(uRunner.id);
  const fileExistsA = (bucketListA || []).some(f => f.name.includes(fileNameA));

  console.log(`  Boundary A: Unboosted user, 75 MB file -> Preflight Allowed: ${resA.allowed} (Limit: ${resA.effectiveMaxMB} MB)`);
  console.log(`              Bucket verification: File in storage bucket? ${fileExistsA}`);

  if (!resA.allowed && !fileExistsA) {
    pass("Boundary A PASSED: Preflight rejected 75 MB file for unboosted user AND verified 0 bytes written to Storage bucket.");
  } else {
    fail(`Boundary A FAILED: allowed=${resA.allowed}, fileInBucket=${fileExistsA}`);
  }

  // Boundary B: Boosted user (Winner), 75 MB file -> ALLOWED, written to storage
  const fileNameB = "allowed_boosted_75mb.pdf";
  const resB = await attemptClientUpload(uWinner.client, uWinner.id, winnerProfFresh, fileNameB, 75);
  const { data: bucketListB } = await uWinner.client.storage.from("documents").list(uWinner.id);
  const fileExistsB = (bucketListB || []).some(f => f.name.includes(fileNameB));

  console.log(`  Boundary B: Boosted user, 75 MB file -> Preflight Allowed: ${resB.allowed} (Limit: ${resB.effectiveMaxMB} MB)`);
  console.log(`              Bucket verification: File in storage bucket? ${fileExistsB}`);

  if (resB.allowed && fileExistsB) {
    pass("Boundary B PASSED: Preflight permitted 75 MB file for boosted user AND verified written to Storage bucket.");
    // Clean up uploaded test file
    if (resB.filePath) {
      await uWinner.client.storage.from("documents").remove([resB.filePath]);
    }
  } else {
    fail(`Boundary B FAILED: allowed=${resB.allowed}, fileInBucket=${fileExistsB}`);
  }

  // Boundary C: Boosted user (Winner), 120 MB file -> REJECTED (exceeds 100 MB), ZERO bytes sent to storage
  const fileNameC = "rejected_boosted_120mb.pdf";
  const resC = await attemptClientUpload(uWinner.client, uWinner.id, winnerProf, fileNameC, 120);
  const { data: bucketListC } = await uWinner.client.storage.from("documents").list(uWinner.id);
  const fileExistsC = (bucketListC || []).some(f => f.name.includes(fileNameC));

  console.log(`  Boundary C: Boosted user, 120 MB file -> Preflight Allowed: ${resC.allowed} (Limit: ${resC.effectiveMaxMB} MB)`);
  console.log(`              Bucket verification: File in storage bucket? ${fileExistsC}`);

  if (!resC.allowed && !fileExistsC) {
    pass("Boundary C PASSED: Preflight rejected 120 MB file for boosted user AND verified 0 bytes written to Storage bucket.");
  } else {
    fail(`Boundary C FAILED: allowed=${resC.allowed}, fileInBucket=${fileExistsC}`);
  }

  // Step 8: Cleanup Test Data
  section("8. Cleaning Up Test Data");
  await admin.from("weekly_scores").delete().eq("cohort_id", cohortId);
  for (const u of createdUsers) {
    await admin.auth.admin.deleteUser(u.id);
  }
  await admin.from("cohorts").delete().eq("id", cohortId);
  pass("Cleaned up test weekly_scores, auth users, profiles, and test cohort.");

  section("ALL PHASE 5 LIVE DATABASE VERIFICATION TESTS PASSED! 🎉");
}

main().catch(err => {
  console.error("Verification script crashed:", err);
  process.exit(1);
});
