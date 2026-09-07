/**
 * Cohort Trigger Verification — uses REAL profile rows from the live DB.
 *
 * Strategy:
 *   1. Fetch 2+ existing profile rows (real auth.users IDs).
 *   2. Snapshot their current state.
 *   3. Run the concurrent-race and clear-field tests against those rows.
 *   4. Restore every row to its exact original state when done.
 *
 * This avoids the profiles_id_fkey violation that occurs when inserting
 * fake UUIDs that don't exist in auth.users.
 */

import { createClient } from "@supabase/supabase-js";

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jcqblkhnryvugtqqaqqn.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ───────────────────────────────────────────────────────────────
function pass(msg)    { console.log(`  ✅ PASS  ${msg}`); }
function fail(msg)    { console.error(`  ❌ FAIL  ${msg}`); process.exitCode = 1; }
function section(t)   { console.log(`\n${"─".repeat(60)}\n${t}\n${"─".repeat(60)}`); }
function sleep(ms)    { return new Promise(r => setTimeout(r, ms)); }

async function getUniversityAndProgram() {
  const { data: uni, error: uE } = await admin
    .from("universities").select("id,name").limit(1).single();
  if (uE || !uni) throw new Error(`No universities: ${uE?.message}`);

  const { data: prog, error: pE } = await admin
    .from("degree_programs").select("id,name")
    .eq("university_id", uni.id).limit(1).single();
  if (pE || !prog) throw new Error(`No programs: ${pE?.message}`);

  return { universityId: uni.id, programId: prog.id, uniName: uni.name, progName: prog.name };
}

/** Snapshot a profile's mutable fields so we can restore exactly. */
async function snapshot(userId) {
  const { data, error } = await admin
    .from("profiles")
    .select("university_id, program_id, semester, cohort_id")
    .eq("id", userId)
    .single();
  if (error) throw new Error(`snapshot(${userId}): ${error.message}`);
  return data;
}

/** Hard-restore a profile row to its snapshotted state (bypass trigger where possible). */
async function restore(userId, snap) {
  // We update with the original values. If the original had a valid cohort triple,
  // the trigger will re-assign cohort_id. If original had nulls, trigger clears it.
  // Either way the final state will match what the user originally had.
  const { error } = await admin.from("profiles").update({
    university_id: snap.university_id,
    program_id:    snap.program_id,
    semester:      snap.semester,
    // cohort_id is trigger-managed, no need to explicitly set it
  }).eq("id", userId);
  if (error) console.warn(`  ⚠️  restore(${userId}) error: ${error.message}`);
}

async function setFields(userId, universityId, programId, semester) {
  const { error } = await admin.from("profiles")
    .update({ university_id: universityId, program_id: programId, semester })
    .eq("id", userId);
  if (error) throw new Error(`setFields(${userId}): ${error.message}`);
}

async function fetchProfile(userId) {
  const { data, error } = await admin.from("profiles")
    .select("university_id, program_id, semester, cohort_id")
    .eq("id", userId).single();
  if (error) throw new Error(`fetch(${userId}): ${error.message}`);
  return data;
}

async function cleanupCohort(uId, pId, sem) {
  // Only delete test-created cohort rows (those with our test semester string)
  await admin.from("cohorts").delete()
    .eq("university_id", uId).eq("program_id", pId).eq("semester", sem);
}

// ─── TEST 1: Concurrent save race ──────────────────────────────────────────
async function testConcurrentRace(idA, idB) {
  section("TEST 1 — Concurrent Save Race");
  const { universityId, programId, uniName, progName } = await getUniversityAndProgram();
  const SEM = `race-verify-${Date.now()}`;

  console.log(`  University:  ${uniName}`);
  console.log(`  Program:     ${progName}`);
  console.log(`  Semester:    ${SEM}`);
  console.log(`  Profile A:   ${idA}`);
  console.log(`  Profile B:   ${idB}`);

  // Ensure no stale cohort row for this unique test semester
  await cleanupCohort(universityId, programId, SEM);

  // Clear both profiles' cohort fields first so we start from a known state
  await admin.from("profiles")
    .update({ university_id: null, program_id: null, semester: null })
    .in("id", [idA, idB]);

  console.log("\n  Firing two simultaneous profile.update() calls...");

  const start = Date.now();
  const [rA, rB] = await Promise.allSettled([
    setFields(idA, universityId, programId, SEM),
    setFields(idB, universityId, programId, SEM),
  ]);
  console.log(`  Both returned in ${Date.now() - start}ms`);

  if (rA.status === "rejected") {
    fail(`Profile A update rejected: ${rA.reason}`); return { universityId, programId, SEM };
  }
  if (rB.status === "rejected") {
    fail(`Profile B update rejected: ${rB.reason}`); return { universityId, programId, SEM };
  }
  pass("Both concurrent updates completed — no unique-violation (23505) thrown");

  const profA = await fetchProfile(idA);
  const profB = await fetchProfile(idB);
  console.log(`\n  cohort_id A: ${profA.cohort_id}`);
  console.log(`  cohort_id B: ${profB.cohort_id}`);

  if (!profA.cohort_id) { fail("Profile A cohort_id is NULL — trigger did not fire"); }
  else                   { pass(`Profile A assigned cohort_id`); }

  if (!profB.cohort_id) { fail("Profile B cohort_id is NULL — trigger did not fire"); }
  else                   { pass(`Profile B assigned cohort_id`); }

  if (profA.cohort_id && profB.cohort_id) {
    if (profA.cohort_id === profB.cohort_id) {
      pass("Both profiles share IDENTICAL cohort_id — ON CONFLICT resolved to single row ✓");
    } else {
      fail(`Cohort IDs DIFFER — race condition created two separate rows!\n      A: ${profA.cohort_id}\n      B: ${profB.cohort_id}`);
    }
  }

  // Confirm exactly one cohort row was created
  const { count } = await admin.from("cohorts")
    .select("id", { count: "exact", head: true })
    .eq("university_id", universityId)
    .eq("program_id", programId)
    .eq("semester", SEM);

  count === 1
    ? pass(`Exactly 1 cohort row in DB for this (uni, prog, semester) — no ghost duplicates`)
    : fail(`Expected 1 cohort row, found ${count} — possible race duplicate`);

  return { universityId, programId, SEM };
}

// ─── TEST 2: Clear field → NULL cohort_id ──────────────────────────────────
async function testClearFieldNullsCohort(idC) {
  section("TEST 2 — Clear-Field Nulls cohort_id");
  const { universityId, programId } = await getUniversityAndProgram();
  const SEM = `clear-verify-${Date.now()}`;

  // Start clean
  await admin.from("profiles")
    .update({ university_id: null, program_id: null, semester: null })
    .eq("id", idC);
  await cleanupCohort(universityId, programId, SEM);

  // Establish a valid cohort first
  console.log("  Step 1: Set all 3 fields — expect cohort_id assigned...");
  await setFields(idC, universityId, programId, SEM);
  const baseline = await fetchProfile(idC);
  if (!baseline.cohort_id) {
    fail("Baseline cohort_id is NULL — trigger not firing, cannot test clearing");
    return;
  }
  pass(`Baseline cohort_id assigned: ${baseline.cohort_id}`);

  // ── 2a: empty string (how a cleared <input> submits) ──
  console.log("\n  Step 2a: UPDATE semester = '' (empty string, simulates cleared form input)...");
  await admin.from("profiles").update({ semester: "" }).eq("id", idC);
  const afterEmpty = await fetchProfile(idC);
  console.log(`  cohort_id after '': ${afterEmpty.cohort_id}`);
  afterEmpty.cohort_id === null
    ? pass("cohort_id → NULL when semester is empty string '' ✓")
    : fail(`cohort_id NOT nulled — still ${afterEmpty.cohort_id} after semester=''`);

  // Restore cohort for next sub-test
  await setFields(idC, universityId, programId, SEM);
  const r1 = await fetchProfile(idC);
  if (!r1.cohort_id) { fail("Could not restore cohort for 2b — aborting sub-tests"); return; }

  // ── 2b: NULL directly ──
  console.log("\n  Step 2b: UPDATE semester = NULL...");
  await admin.from("profiles").update({ semester: null }).eq("id", idC);
  const afterNull = await fetchProfile(idC);
  console.log(`  cohort_id after NULL: ${afterNull.cohort_id}`);
  afterNull.cohort_id === null
    ? pass("cohort_id → NULL when semester is NULL ✓")
    : fail(`cohort_id NOT nulled — still ${afterNull.cohort_id} after semester=NULL`);

  // Restore
  await setFields(idC, universityId, programId, SEM);
  const r2 = await fetchProfile(idC);
  if (!r2.cohort_id) { fail("Could not restore cohort for 2c — aborting sub-tests"); return; }

  // ── 2c: whitespace-only (tests the trim() branch) ──
  console.log("\n  Step 2c: UPDATE semester = '   ' (whitespace only — tests trim() guard)...");
  await admin.from("profiles").update({ semester: "   " }).eq("id", idC);
  const afterWS = await fetchProfile(idC);
  console.log(`  cohort_id after '   ': ${afterWS.cohort_id}`);
  afterWS.cohort_id === null
    ? pass("cohort_id → NULL for whitespace-only semester (trim guard works) ✓")
    : fail(`cohort_id NOT nulled — still ${afterWS.cohort_id} after semester='   '`);

  return { universityId, programId, SEM };
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("  Cohort Trigger Verification  (live DB, real profiles)");
  console.log("=".repeat(60));

  // ── Fetch real profile IDs (need at least 2) ──
  section("SETUP: Fetching real profile IDs");
  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id, university_id, program_id, semester, cohort_id")
    .limit(3);

  if (pErr || !profiles || profiles.length < 2) {
    console.error(`  ❌ Need at least 2 profiles in the DB, found ${profiles?.length ?? 0}. Error: ${pErr?.message}`);
    process.exit(1);
  }

  const [rowA, rowB, rowC] = profiles;
  // If we only have 2 profiles, reuse rowA as rowC for test 2
  const rowCfinal = rowC ?? rowA;

  console.log(`  Using profile A: ${rowA.id}`);
  console.log(`  Using profile B: ${rowB.id}`);
  console.log(`  Using profile C: ${rowCfinal.id} (test 2)`);

  // Snapshot all original states before touching anything
  const snapA = await snapshot(rowA.id);
  const snapB = await snapshot(rowB.id);
  const snapC = await snapshot(rowCfinal.id);

  let race_meta, clear_meta;
  let allClean = false;

  try {
    race_meta  = await testConcurrentRace(rowA.id, rowB.id);
    clear_meta = await testClearFieldNullsCohort(rowCfinal.id);
    allClean = true;
  } catch (err) {
    fail(`Unexpected throw during tests: ${err.message}`);
  } finally {
    section("CLEANUP — Restoring original profile state");
    await restore(rowA.id, snapA);
    await restore(rowB.id, snapB);
    await restore(rowCfinal.id, snapC);
    console.log("  Profile rows restored to original state.");

    // Remove test-only cohort rows created during testing
    if (race_meta) {
      await cleanupCohort(race_meta.universityId, race_meta.programId, race_meta.SEM);
    }
    if (clear_meta) {
      await cleanupCohort(clear_meta.universityId, clear_meta.programId, clear_meta.SEM);
    }
    console.log("  Test cohort rows removed.");
  }

  section("FINAL RESULT");
  if (process.exitCode === 1) {
    console.error("  ❌ One or more tests FAILED — see output above");
  } else {
    console.log("  ✅ All tests PASSED — trigger is behaving correctly in production");
  }
}

main().catch(err => { console.error(err); process.exit(1); });
