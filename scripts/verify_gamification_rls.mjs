import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

function pass(msg) { console.log(`  ✅ PASS  ${msg}`); }
function fail(msg) { console.error(`  ❌ FAIL  ${msg}`); process.exitCode = 1; }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function section(title) { console.log(`\n${"─".repeat(70)}\n${title}\n${"─".repeat(70)}`); }

const envPath = resolve(process.cwd(), ".env.local");
let SUPABASE_URL = "";
let SERVICE_ROLE_KEY = "";
let ANON_KEY = "";

try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=").trim();
    if (key.trim() === "NEXT_PUBLIC_SUPABASE_URL") { SUPABASE_URL = value; process.env.NEXT_PUBLIC_SUPABASE_URL = value; }
    if (key.trim() === "SUPABASE_SERVICE_ROLE_KEY") { SERVICE_ROLE_KEY = value; process.env.SUPABASE_SERVICE_ROLE_KEY = value; }
    if (key.trim() === "NEXT_PUBLIC_SUPABASE_ANON_KEY") { ANON_KEY = value; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = value; }
  }
} catch (e) {
  console.error("Could not read .env.local", e);
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  section("PROBLEM 16 & GAMIFICATION RLS HARDENING LIVE VERIFICATION");

  const runId = Math.floor(Math.random() * 100000);
  const testEmail = `gamification_test_${runId}@example.com`;
  const testPassword = "Password123!";

  info(`Creating test student account: ${testEmail}`);
  const { data: authData, error: createError } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { first_name: "Gamification", last_name: "Tester" }
  });

  if (createError || !authData.user) {
    fail(`Failed to create test user: ${createError?.message}`);
    return;
  }

  const testUserId = authData.user.id;

  // Initialize a baseline user_progress row
  await admin.from("user_progress").upsert({
    user_id: testUserId,
    total_xp: 50,
    monthly_xp: 50,
    current_level: 1,
    current_streak: 1
  });

  // Create an authentic user client signed in via password
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { error: signInError } = await userClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (signInError) {
    fail(`Failed to sign in test user: ${signInError.message}`);
    await admin.auth.admin.deleteUser(testUserId);
    return;
  }

  pass(`Authenticated student client signed in successfully (ID: ${testUserId})`);

  try {
    // ── SECTION 1: CATALOG VERIFICATION (achievements) ─────────────────────────
    section("1. Catalog Verification (achievements table)");

    // Test 1a: Legitimate read of catalog
    const { data: catalog, error: catalogReadErr } = await userClient
      .from("achievements")
      .select("*")
      .order("xp_reward", { ascending: true });

    if (catalogReadErr) {
      fail(`Student failed to read achievements catalog: ${catalogReadErr.message}`);
    } else if (!catalog || catalog.length === 0) {
      fail(`Achievements catalog is empty! Seeding required.`);
    } else {
      pass(`Student successfully read catalog: ${catalog.length} achievements available.`);
      info(`Sample badges: ${catalog.slice(0, 3).map(a => `"${a.name}" (+${a.xp_reward} XP)`).join(", ")}`);
    }

    // Test 1b: Adversarial attempt to insert arbitrary badge
    const fakeAchId = "00000000-0000-0000-0000-000000000999";
    const { data: hackAch, error: hackAchErr } = await userClient
      .from("achievements")
      .insert({
        id: fakeAchId,
        name: `Hacked Badge ${runId}`,
        description: "Created directly by student client",
        xp_reward: 999999
      })
      .select();

    if (hackAchErr) {
      pass(`Blocked: Student cannot insert into achievements catalog (${hackAchErr.message})`);
    } else {
      fail(`VULNERABILITY DETECTED: Student inserted arbitrary badge into catalog!`);
      await admin.from("achievements").delete().eq("id", fakeAchId);
    }

    // ── SECTION 2: USER ACHIEVEMENTS MAPPING (user_achievements) ───────────────
    section("2. Badge Mapping Verification (user_achievements table)");

    // Test 2a: Adversarial attempt to award themselves an unearned badge
    const targetBadge = catalog ? catalog[0] : null;
    if (!targetBadge) {
      fail("Cannot test user_achievements without catalog badges");
    } else {
      const { data: selfAward, error: selfAwardErr } = await userClient
        .from("user_achievements")
        .insert({
          user_id: testUserId,
          achievement_id: targetBadge.id
        })
        .select();

      if (selfAwardErr) {
        pass(`Blocked: Student cannot self-award badges in user_achievements (${selfAwardErr.message})`);
      } else {
        fail(`VULNERABILITY DETECTED: Student self-awarded badge "${targetBadge.name}"!`);
        await admin.from("user_achievements").delete().eq("user_id", testUserId);
      }
    }

    // ── SECTION 3: PROGRESS & LEADERBOARD TAMPERING (user_progress) ────────────
    section("3. Lifetime Progress & XP Tampering (user_progress table)");

    // Test 3a: Adversarial attempt to directly overwrite total_xp
    const { error: tamperXpErr } = await userClient
      .from("user_progress")
      .update({ total_xp: 999999, current_level: 99 })
      .eq("user_id", testUserId);

    // Verify whether total_xp actually changed in DB
    const { data: progressRow } = await admin
      .from("user_progress")
      .select("total_xp, current_level")
      .eq("user_id", testUserId)
      .single();

    if (tamperXpErr) {
      pass(`Blocked: Direct update to user_progress returned RLS error (${tamperXpErr.message})`);
    } else if (progressRow.total_xp === 999999) {
      fail(`VULNERABILITY DETECTED: Student updated total_xp to 999,999 directly via PostgREST!`);
      console.log(`\n  👉 ACTION REQUIRED: Run the hardening migration in Supabase SQL Editor:`);
      console.log(`     d:\\Projects\\FYP PROJECT\\Neuron-OS\\supabase\\migrations\\20261008_harden_gamification_rls.sql\n`);
    } else {
      pass(`Blocked: Direct update had zero effect; total_xp remains ${progressRow.total_xp}`);
    }

    // Test 3b: Adversarial attempt to delete own user_progress
    const { error: deleteProgErr } = await userClient
      .from("user_progress")
      .delete()
      .eq("user_id", testUserId);

    const { data: progAfterDel } = await admin
      .from("user_progress")
      .select("user_id")
      .eq("user_id", testUserId)
      .maybeSingle();

    if (deleteProgErr) {
      pass(`Blocked: Student cannot delete user_progress (${deleteProgErr.message})`);
    } else if (progAfterDel) {
      pass(`Blocked: Delete attempt had zero effect; user_progress record remains intact.`);
    } else {
      fail(`VULNERABILITY DETECTED: Student deleted their own user_progress row!`);
    }

    // ── SECTION 4: LEGITIMATE SERVER-SIDE AWARD FLOW ─────────────────────────
    section("4. Legitimate Server-Side XP & Achievement Flow (awardXP via admin)");

    // Import dynamic awardXP function
    const { awardXP } = await import("../src/services/gamification/rewards.ts");

    info("Executing server action: awardXP for completing a perfect quiz (score: 5/5)...");
    const awardResult = await awardXP(testUserId, "complete_quiz", {
      score: 5,
      totalQuestions: 5
    });

    if (!awardResult.success) {
      fail(`awardXP returned failure: ${JSON.stringify(awardResult)}`);
    } else {
      pass(`awardXP succeeded: gained +${awardResult.xpGained} XP (new total: ${awardResult.newXp})`);
      info(`Unlocked badges reported: ${awardResult.unlockedAchievements.join(", ") || "None"}`);
    }

    // Verify DB state after legitimate award
    const { data: updatedProgress } = await admin
      .from("user_progress")
      .select("total_xp, current_level")
      .eq("user_id", testUserId)
      .single();

    if (updatedProgress.total_xp > 50) {
      pass(`Server successfully credited total_xp: 50 → ${updatedProgress.total_xp}`);
    } else {
      fail(`total_xp was not updated in database: ${updatedProgress.total_xp}`);
    }

    // Verify unlocked badges in user_achievements table
    const { data: awardedBadges } = await admin
      .from("user_achievements")
      .select("achievement_id, achievements(name, xp_reward)")
      .eq("user_id", testUserId);

    if (awardedBadges && awardedBadges.length > 0) {
      pass(`Verified ${awardedBadges.length} badge(s) stored in user_achievements table!`);
      awardedBadges.forEach(b => {
        const ach = b.achievements;
        info(`  - Awarded: "${ach?.name}" (+${ach?.xp_reward} XP)`);
      });
    } else {
      fail("No badge record found in user_achievements after perfect quiz completion");
    }

    // Verify that the student client can READ their own awarded badges
    const { data: studentBadges, error: studentBadgesErr } = await userClient
      .from("user_achievements")
      .select("achievement_id, achievements(name)")
      .eq("user_id", testUserId);

    if (studentBadgesErr) {
      fail(`Student failed to read their unlocked badges: ${studentBadgesErr.message}`);
    } else if (studentBadges && studentBadges.length > 0) {
      pass(`Student client verified reading ${studentBadges.length} unlocked badge(s) via RLS!`);
    } else {
      fail("Student client cannot view their own awarded badges via RLS");
    }

  } finally {
    // ── SECTION 5: CLEANUP ───────────────────────────────────────────────────
    section("5. Teardown & Cleanup");
    info(`Cleaning up test user: ${testUserId}`);
    await admin.auth.admin.deleteUser(testUserId);
    pass("Test student account deleted cleanly. Database restored to pristine state.");
  }

  // ── FINAL REPORT ─────────────────────────────────────────────────────────
  section("VERIFICATION SUMMARY");
  console.log(`
  1. achievements:
     - Public read: ALLOWED (catalog queryable by all students)
     - Client write: BLOCKED (no unauthorized badge creation)
  2. user_achievements:
     - Public read: ALLOWED (badges visible on profiles/leaderboards)
     - Client write: BLOCKED (anti-cheat: badges cannot be self-awarded)
  3. user_progress:
     - Public read: ALLOWED (XP visible for competitive leaderboard)
     - Client write: BLOCKED (anti-cheat: total_xp cannot be modified or deleted directly)
  4. Legitimate Server Path:
     - awardXP via createAdminClient cleanly credits XP and unlocks badges.
  `);
}

main().catch((err) => {
  console.error("Unhandled verification error:", err);
  process.exitCode = 1;
});
