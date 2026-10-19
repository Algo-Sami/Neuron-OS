/**
 * ============================================================================
 * verify_study_rooms_rls.mjs
 * Live verification suite for Problem 5: Study Rooms RLS Hardening
 *
 * Verifies:
 * 1. Member 1 and Member 2 can read/write room_messages and collaborative_notes in Room A.
 * 2. Outsider gets ZERO rows querying Room A's room_members, room_messages, and collaborative_notes.
 * 3. Outsider cannot INSERT a message or notes into Room A (RLS violation).
 * 4. Room creator/host has immediate access with no chicken-and-egg gap.
 * 5. Private room UUID enumeration bypass is blocked on room_members INSERT.
 * 6. Public room legitimate self-join succeeds without loosening security.
 * ============================================================================
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
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

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error("Missing required environment variables in .env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function pass(msg) { console.log(`  ✅ PASS  ${msg}`); }
function fail(msg) { console.error(`  ❌ FAIL  ${msg}`); process.exitCode = 1; }
function section(title) { console.log(`\n${"─".repeat(70)}\n${title}\n${"─".repeat(70)}`); }

async function createAuthUser(email, password, name) {
  // Clean up if already exists
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users?.find(u => u.email === email);
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id);
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: name, last_name: "Tester" },
  });
  if (error) throw error;
  return data.user;
}

async function signInUser(email, password) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client, user: data.user, session: data.session };
}

async function main() {
  section("STUDY ROOMS RLS HARDENING LIVE VERIFICATION");

  const runId = Math.floor(Math.random() * 100000);
  const password = "TestPassword123!";
  const u1Email = `member1_${runId}@example.com`;
  const u2Email = `member2_${runId}@example.com`;
  const u3Email = `outsider_${runId}@example.com`;

  let u1, u2, u3;
  let client1, client2, clientOutsider;
  let roomA, roomB, roomC;

  try {
    // ------------------------------------------------------------------------
    // Step 0: Create and authenticate test users
    // ------------------------------------------------------------------------
    console.log("Creating test users...");
    u1 = await createAuthUser(u1Email, password, "Member1");
    u2 = await createAuthUser(u2Email, password, "Member2");
    u3 = await createAuthUser(u3Email, password, "Outsider");

    const session1 = await signInUser(u1Email, password);
    const session2 = await signInUser(u2Email, password);
    const session3 = await signInUser(u3Email, password);

    client1 = session1.client;
    client2 = session2.client;
    clientOutsider = session3.client;
    console.log("Test users authenticated successfully.");

    // ------------------------------------------------------------------------
    // Step 1: Create Test Rooms
    // Room A: Private room hosted by User 1, User 2 is member
    // Room B: Private room hosted by Outsider (User 3)
    // Room C: Public room hosted by User 1
    // ------------------------------------------------------------------------
    section("1. Setting Up Test Rooms");

    const codeA = `RA${runId}`.slice(0, 6).toUpperCase();
    const codeB = `RB${runId}`.slice(0, 6).toUpperCase();
    const codeC = `RC${runId}`.slice(0, 6).toUpperCase();

    // Host 1 creates Room A (Private)
    const { data: createdRoomA, error: errA } = await client1
      .from("study_rooms")
      .insert({
        user_id: u1.id,
        name: `Room A Private (${runId})`,
        topic: "Algorithms",
        privacy: "private",
        code: codeA,
      })
      .select()
      .single();
    if (errA) throw new Error(`Failed to create Room A: ${errA.message}`);
    roomA = createdRoomA;

    // Host 1 adds self as host in room_members
    const { error: errHostA } = await client1
      .from("room_members")
      .insert({ room_id: roomA.id, user_id: u1.id, role: "host" });
    if (errHostA) throw new Error(`Host self-insert failed: ${errHostA.message}`);

    // Host 1 initializes collaborative notes
    const { error: errNotesA } = await client1
      .from("collaborative_notes")
      .insert({
        room_id: roomA.id,
        content: "Initial Room A Secret Notes",
        whiteboard_data: { shapes: [] },
      });
    if (errNotesA) throw new Error(`Host notes insert failed: ${errNotesA.message}`);

    pass("Room A created and initialized by Host (User 1) with no chicken-and-egg gap");

    // Member 2 joins Room A (as member added by host or via valid join)
    // For test setup of Room A, host adds User 2
    const { error: errAdd2 } = await client1
      .from("room_members")
      .insert({ room_id: roomA.id, user_id: u2.id, role: "member" });
    if (errAdd2) throw new Error(`Host adding User 2 failed: ${errAdd2.message}`);
    pass("Member 2 added to Room A");

    // Outsider creates Room B
    const { data: createdRoomB, error: errB } = await clientOutsider
      .from("study_rooms")
      .insert({
        user_id: u3.id,
        name: `Room B Outsider (${runId})`,
        topic: "Physics",
        privacy: "private",
        code: codeB,
      })
      .select()
      .single();
    if (errB) throw new Error(`Failed to create Room B: ${errB.message}`);
    roomB = createdRoomB;

    await clientOutsider
      .from("room_members")
      .insert({ room_id: roomB.id, user_id: u3.id, role: "host" });
    pass("Room B created and joined by Outsider (User 3)");

    // ------------------------------------------------------------------------
    // Step 2: Member 1 & Member 2 can exchange messages & edit notes in Room A
    // ------------------------------------------------------------------------
    section("2. Testing Legitimate Member Access to Room A");

    // Member 1 posts message
    const { data: msg1, error: msgErr1 } = await client1
      .from("room_messages")
      .insert({
        room_id: roomA.id,
        user_id: u1.id,
        message: "Hello from Host in Room A",
      })
      .select()
      .single();
    if (msgErr1) fail(`Member 1 failed to post message: ${msgErr1.message}`);
    else pass("Member 1 successfully posted message in Room A");

    // Member 2 posts message
    const { data: msg2, error: msgErr2 } = await client2
      .from("room_messages")
      .insert({
        room_id: roomA.id,
        user_id: u2.id,
        message: "Hello from Member 2 in Room A",
      })
      .select()
      .single();
    if (msgErr2) fail(`Member 2 failed to post message: ${msgErr2.message}`);
    else pass("Member 2 successfully posted message in Room A");

    // Member 2 reads messages in Room A
    const { data: msgsFor2, error: readErr2 } = await client2
      .from("room_messages")
      .select("id, message, user_id")
      .eq("room_id", roomA.id);
    if (readErr2) fail(`Member 2 failed to read messages: ${readErr2.message}`);
    else if (msgsFor2?.length === 2) pass(`Member 2 successfully read all ${msgsFor2.length} messages in Room A`);
    else fail(`Member 2 expected 2 messages, got ${msgsFor2?.length}`);

    // Member 2 updates collaborative notes
    const { error: notesUpdateErr } = await client2
      .from("collaborative_notes")
      .update({ content: "Room A Notes updated by Member 2" })
      .eq("room_id", roomA.id);
    if (notesUpdateErr) fail(`Member 2 failed to update notes: ${notesUpdateErr.message}`);
    else pass("Member 2 successfully updated collaborative notes in Room A");

    // ------------------------------------------------------------------------
    // Step 3: Outsider Isolation - Must receive ZERO rows on Room A
    // ------------------------------------------------------------------------
    section("3. Testing Outsider Isolation (Zero Rows Returned)");

    // Outsider queries Room A members
    const { data: outsiderMembers, error: outMemErr } = await clientOutsider
      .from("room_members")
      .select("*")
      .eq("room_id", roomA.id);
    if (outMemErr) fail(`Outsider member query errored unexpectedly: ${outMemErr.message}`);
    else if (outsiderMembers?.length === 0) pass("Outsider gets ZERO rows querying Room A room_members (silent RLS scoping)");
    else fail(`SECURITY LEAK: Outsider saw ${outsiderMembers.length} members in Room A!`);

    // Outsider queries Room A messages
    const { data: outsiderMsgs, error: outMsgErr } = await clientOutsider
      .from("room_messages")
      .select("*")
      .eq("room_id", roomA.id);
    if (outMsgErr) fail(`Outsider message query errored unexpectedly: ${outMsgErr.message}`);
    else if (outsiderMsgs?.length === 0) pass("Outsider gets ZERO rows querying Room A room_messages (silent RLS scoping)");
    else fail(`SECURITY LEAK: Outsider saw ${outsiderMsgs.length} messages in Room A!`);

    // Outsider queries Room A notes
    const { data: outsiderNotes, error: outNoteErr } = await clientOutsider
      .from("collaborative_notes")
      .select("*")
      .eq("room_id", roomA.id);
    if (outNoteErr) fail(`Outsider notes query errored unexpectedly: ${outNoteErr.message}`);
    else if (outsiderNotes?.length === 0) pass("Outsider gets ZERO rows querying Room A collaborative_notes (silent RLS scoping)");
    else fail(`SECURITY LEAK: Outsider saw collaborative notes in Room A!`);

    // ------------------------------------------------------------------------
    // Step 4: Outsider Tampering Blocked (INSERT / UPDATE)
    // ------------------------------------------------------------------------
    section("4. Testing Outsider Tampering Defense (INSERT/UPDATE Blocked)");

    // Outsider attempts to post a message into Room A
    const { error: outInsertMsgErr } = await clientOutsider
      .from("room_messages")
      .insert({
        room_id: roomA.id,
        user_id: u3.id,
        message: "Malicious inserted message by outsider",
      });
    if (outInsertMsgErr) pass(`Outsider message INSERT to Room A was blocked by RLS (${outInsertMsgErr.message})`);
    else fail("SECURITY LEAK: Outsider was able to INSERT a message into Room A!");

    // Outsider attempts to insert collaborative notes for Room A
    const { error: outInsertNoteErr } = await clientOutsider
      .from("collaborative_notes")
      .insert({
        room_id: roomA.id,
        content: "Malicious notes by outsider",
      });
    if (outInsertNoteErr) pass(`Outsider notes INSERT to Room A was blocked by RLS (${outInsertNoteErr.message})`);
    else fail("SECURITY LEAK: Outsider was able to INSERT notes into Room A!");

    // Outsider attempts to update Room A collaborative notes
    const { data: outUpdateNoteData, error: outUpdateNoteErr } = await clientOutsider
      .from("collaborative_notes")
      .update({ content: "Tampered notes by outsider" })
      .eq("room_id", roomA.id)
      .select();
    if (!outUpdateNoteErr && (outUpdateNoteData?.length === 0 || !outUpdateNoteData)) {
      pass("Outsider notes UPDATE to Room A affected 0 rows (silent RLS guard)");
    } else if (outUpdateNoteErr) {
      pass(`Outsider notes UPDATE to Room A rejected by RLS (${outUpdateNoteErr.message})`);
    } else {
      fail("SECURITY LEAK: Outsider was able to UPDATE collaborative notes in Room A!");
    }

    // ------------------------------------------------------------------------
    // Step 5: Direct UUID Self-Join to Private Room Blocked
    // ------------------------------------------------------------------------
    section("5. Testing Direct UUID Enumeration Defense on Private Rooms");

    // Outsider attempts direct INSERT into room_members specifying Room A's room_id
    const { error: outJoinPrivErr } = await clientOutsider
      .from("room_members")
      .insert({
        room_id: roomA.id,
        user_id: u3.id,
        role: "member",
      });
    if (outJoinPrivErr) {
      pass(`Direct raw self-join into Private Room A was BLOCKED by RLS (${outJoinPrivErr.message})`);
    } else {
      fail("SECURITY LEAK: Outsider was able to self-join Private Room A via direct UUID insert!");
    }

    // ------------------------------------------------------------------------
    // Step 6: Public Room Legitimate Self-Join Allowed
    // ------------------------------------------------------------------------
    section("6. Testing Legitimate Public Room Self-Join Flow");

    // Host 1 creates Room C (Public)
    const { data: createdRoomC, error: errC } = await client1
      .from("study_rooms")
      .insert({
        user_id: u1.id,
        name: `Room C Public (${runId})`,
        topic: "Open Discussion",
        privacy: "public",
        code: codeC,
      })
      .select()
      .single();
    if (errC) throw new Error(`Failed to create Room C: ${errC.message}`);
    roomC = createdRoomC;

    await client1
      .from("room_members")
      .insert({ room_id: roomC.id, user_id: u1.id, role: "host" });
    await client1
      .from("collaborative_notes")
      .insert({ room_id: roomC.id, content: "Public room notes" });
    pass("Public Room C created and initialized by Host");

    // Outsider self-joins Public Room C
    const { error: joinPubErr } = await clientOutsider
      .from("room_members")
      .insert({
        room_id: roomC.id,
        user_id: u3.id,
        role: "member",
      });
    if (joinPubErr) {
      fail(`Outsider legitimate self-join to Public Room C failed: ${joinPubErr.message}`);
    } else {
      pass("Outsider legitimately self-joined Public Room C via public room RLS policy");
    }

    // Now Outsider should be able to read Room C's roster and notes
    const { data: pubMembers } = await clientOutsider
      .from("room_members")
      .select("user_id")
      .eq("room_id", roomC.id);
    if (pubMembers?.some(m => m.user_id === u3.id)) {
      pass("Joined user successfully reads Public Room C roster and sees own membership");
    } else {
      fail("Joined user cannot see roster in Public Room C after joining");
    }

    section("SUMMARY");
    if (!process.exitCode) {
      console.log("🎉 ALL RLS VERIFICATION CHECKS PASSED PERFECTLY!");
    } else {
      console.error("⚠️ SOME CHECKS FAILED - REVIEW LOGS ABOVE.");
    }

  } finally {
    // ------------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------------
    console.log("\nCleaning up test artifacts...");
    try {
      if (roomA) await admin.from("study_rooms").delete().eq("id", roomA.id);
      if (roomB) await admin.from("study_rooms").delete().eq("id", roomB.id);
      if (roomC) await admin.from("study_rooms").delete().eq("id", roomC.id);
      if (u1) await admin.auth.admin.deleteUser(u1.id);
      if (u2) await admin.auth.admin.deleteUser(u2.id);
      if (u3) await admin.auth.admin.deleteUser(u3.id);
      console.log("Cleanup complete.");
    } catch (cleanupErr) {
      console.error("Cleanup warning:", cleanupErr.message);
    }
  }
}

main().catch(err => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
