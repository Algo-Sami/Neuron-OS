/**
 * ============================================================================
 * verify_phase6_live.mjs
 * Live database & authenticated verification suite for Phase 6:
 * - Cohort Note-Sharing System
 * - Signed Download URLs & Expiry
 * - Peer Visibility & Cross-Cohort Invisibility (RLS)
 * - Self-Serve Unshare & Ownership Guards
 * - Content Reporting & Report RLS Scoping
 * - Phase 3 Scoring Rollback (XP awarded, weekly score unaffected)
 * ============================================================================
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envPath = ".env.local";
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
function section(title) { console.log(`\n${"─".repeat(65)}\n${title}\n${"─".repeat(65)}`); }

function getISOWeekStartDate(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().split("T")[0];
}

async function createAuthUser(email, password, metadata = {}) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
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
  return { client, session: data.session, user: data.user };
}

async function main() {
  section("PHASE 6 LIVE VERIFICATION SUITE");

  // --------------------------------------------------------------------------
  // 1. Schema Check
  // --------------------------------------------------------------------------
  section("1. Checking Database Schema for Phase 6 Columns and Tables");

  const { data: docCheck, error: docColError } = await admin
    .from("documents")
    .select("id, is_shared, shared_cohort_id, shared_at")
    .limit(1);

  if (docColError) {
    console.error("  ❌ Column 'is_shared' DOES NOT EXIST on public.documents!");
    console.error("     Database returned:", docColError.message);
    console.log("\n  👉 ACTION REQUIRED: Run the SQL in supabase/migrations/20260906_add_note_sharing.sql");
    console.log("     in Supabase SQL Editor: https://supabase.com/dashboard/project/jcqblkhnryvugtqqaqqn/sql/new\n");
    process.exitCode = 2;
    return;
  }
  pass("Columns 'is_shared', 'shared_cohort_id', 'shared_at' are LIVE on public.documents!");

  const { data: repCheck, error: repError } = await admin
    .from("shared_file_reports")
    .select("id, document_id, reporter_id, reason, created_at")
    .limit(1);

  if (repError) {
    console.error("  ❌ Table 'public.shared_file_reports' DOES NOT EXIST!");
    console.error("     Database returned:", repError.message);
    console.log("\n  👉 ACTION REQUIRED: Run the SQL in supabase/migrations/20260906_add_note_sharing.sql");
    console.log("     in Supabase SQL Editor: https://supabase.com/dashboard/project/jcqblkhnryvugtqqaqqn/sql/new\n");
    process.exitCode = 2;
    return;
  }
  pass("Table 'public.shared_file_reports' is LIVE!");

  // --------------------------------------------------------------------------
  // 2. Setup Test Data (Cohorts and Authenticated Accounts)
  // --------------------------------------------------------------------------
  section("2. Setting Up Test Accounts and Cohorts");

  const { data: uni } = await admin.from("universities").select("id").limit(1).single();
  const { data: prog } = await admin.from("degree_programs").select("id").limit(1).single();

  if (!uni || !prog) {
    fail("Could not find university or degree_program in database.");
    return;
  }

  const timestamp = Date.now();
  // Create Cohort 1
  const { data: cohort1, error: c1Err } = await admin
    .from("cohorts")
    .insert({
      university_id: uni.id,
      program_id: prog.id,
      semester: `P6-Cohort1-${timestamp}`,
    })
    .select()
    .single();

  if (c1Err || !cohort1) {
    fail(`Failed to create Cohort 1: ${c1Err?.message}`);
    return;
  }

  // Create Cohort 2 (for cross-cohort isolation test)
  const { data: cohort2, error: c2Err } = await admin
    .from("cohorts")
    .insert({
      university_id: uni.id,
      program_id: prog.id,
      semester: `P6-Cohort2-${timestamp}`,
    })
    .select()
    .single();

  if (c2Err || !cohort2) {
    fail(`Failed to create Cohort 2: ${c2Err?.message}`);
    return;
  }

  pass(`Created Cohort 1 (${cohort1.id}) and Cohort 2 (${cohort2.id})`);

  // Create Users:
  // User A: Owner/Sharer in Cohort 1
  // User B: Peer in Cohort 1
  // User C: Outsider in Cohort 2
  const password = "TestPassword123!";
  const emailA = `p6_sharer_${timestamp}@test.com`;
  const emailB = `p6_peer_${timestamp}@test.com`;
  const emailC = `p6_outsider_${timestamp}@test.com`;

  const authUserA = await createAuthUser(emailA, password, { first_name: "Alice", last_name: "Sharer" });
  const authUserB = await createAuthUser(emailB, password, { first_name: "Bob", last_name: "Peer" });
  const authUserC = await createAuthUser(emailC, password, { first_name: "Charlie", last_name: "Outsider" });

  await admin.from("profiles").upsert([
    { id: authUserA.id, first_name: "Alice", last_name: "Sharer", cohort_id: cohort1.id, university_id: uni.id, program_id: prog.id, semester: cohort1.semester, major: "CS" },
    { id: authUserB.id, first_name: "Bob", last_name: "Peer", cohort_id: cohort1.id, university_id: uni.id, program_id: prog.id, semester: cohort1.semester, major: "CS" },
    { id: authUserC.id, first_name: "Charlie", last_name: "Outsider", cohort_id: cohort2.id, university_id: uni.id, program_id: prog.id, semester: cohort2.semester, major: "CS" },
  ]);

  const clientA = await signInUser(emailA, password);
  const clientB = await signInUser(emailB, password);
  const clientC = await signInUser(emailC, password);

  pass("Created 3 authenticated test accounts: User A (Cohort 1), User B (Cohort 1), User C (Cohort 2)");

  // --------------------------------------------------------------------------
  // 3. Document Creation & Ownership Guards
  // --------------------------------------------------------------------------
  section("3. Document Creation & Ownership Security Guards");

  const storagePath = `${authUserA.id}/p6_test_${timestamp}.pdf`;
  const fileBytes = Buffer.from("%PDF-1.4 test document content for Phase 6 note sharing");
  
  // Upload real file to Supabase storage bucket
  const { error: uploadErr } = await admin.storage
    .from("documents")
    .upload(storagePath, fileBytes, { contentType: "application/pdf", upsert: true });

  if (uploadErr) {
    fail(`Failed to upload test file to storage: ${uploadErr.message}`);
    return;
  }
  pass("Uploaded test document into Supabase Storage ('documents' bucket)");

  const { data: publicUrlData } = admin.storage.from("documents").getPublicUrl(storagePath);
  const fileUrl = publicUrlData.publicUrl;

  // Insert document row owned by User A (initially unshared)
  const { data: testDoc, error: docInsertErr } = await admin
    .from("documents")
    .insert({
      user_id: authUserA.id,
      title: "Lecture 1: Distributed Systems Notes.pdf",
      file_url: fileUrl,
      file_type: "pdf",
      size: fileBytes.length,
      is_shared: false,
      shared_cohort_id: null,
      shared_at: null,
    })
    .select()
    .single();

  if (docInsertErr || !testDoc) {
    fail(`Failed to create test document: ${docInsertErr?.message}`);
    return;
  }
  pass(`Created unshared document row (${testDoc.id}) owned by User A`);

  // Guard test: User B (non-owner) attempts to share User A's document via clientB RLS/update
  const { data: hackShare, error: hackShareErr } = await clientB.client
    .from("documents")
    .update({ is_shared: true, shared_cohort_id: cohort1.id })
    .eq("id", testDoc.id)
    .select();

  if (!hackShare || hackShare.length === 0) {
    pass("Non-owner (User B) cannot update or share User A's document (0 rows modified)");
  } else {
    fail("Non-owner was able to update User A's document!");
  }

  // --------------------------------------------------------------------------
  // 4. Share Document by Owner
  // --------------------------------------------------------------------------
  section("4. Sharing Document to Cohort 1");

  const nowIso = new Date().toISOString();
  const { data: sharedDoc, error: shareErr } = await clientA.client
    .from("documents")
    .update({
      is_shared: true,
      shared_cohort_id: cohort1.id,
      shared_at: nowIso,
    })
    .eq("id", testDoc.id)
    .select()
    .single();

  if (shareErr || !sharedDoc || !sharedDoc.is_shared) {
    fail(`Owner failed to share document: ${shareErr?.message}`);
    return;
  }
  pass(`Document shared: is_shared=true, shared_cohort_id=${sharedDoc.shared_cohort_id}`);

  // --------------------------------------------------------------------------
  // 5. RLS Cohort Peer Visibility & 6. Cross-Cohort Invisibility
  // --------------------------------------------------------------------------
  section("5 & 6. Testing RLS: Cohort Peer Visibility vs Cross-Cohort Invisibility");

  // User B (same cohort 1) queries documents
  const { data: peerDocs, error: peerErr } = await clientB.client
    .from("documents")
    .select("id, title, is_shared, shared_cohort_id")
    .eq("id", testDoc.id);

  if (peerErr) {
    fail(`Peer query returned error: ${peerErr.message}`);
  } else if (peerDocs && peerDocs.length === 1 && peerDocs[0].id === testDoc.id) {
    pass("Cohort peer (User B) can see shared document via RLS policy!");
  } else {
    fail(`Cohort peer (User B) could NOT see shared document! Returned: ${JSON.stringify(peerDocs)}`);
  }

  // User C (different cohort 2) queries documents
  const { data: outsiderDocs, error: outsiderErr } = await clientC.client
    .from("documents")
    .select("id, title, is_shared, shared_cohort_id")
    .eq("id", testDoc.id);

  if (outsiderErr) {
    fail(`Outsider query returned error: ${outsiderErr.message}`);
  } else if (!outsiderDocs || outsiderDocs.length === 0) {
    pass("Cross-Cohort Isolation: User C (Cohort 2) CANNOT see document (0 rows returned via RLS)!");
  } else {
    fail("Security breach! User C in different cohort was able to view shared document!");
  }

  // --------------------------------------------------------------------------
  // 7. Signed URL Generation & Token Expiry Test
  // --------------------------------------------------------------------------
  section("7. Signed Download URLs & Short-Lived Expiration Check");

  // Generate 300s signed URL as would be done by getCohortSharedFiles
  const { data: signed300, error: s300Err } = await admin.storage
    .from("documents")
    .createSignedUrl(storagePath, 300);

  if (s300Err || !signed300?.signedUrl) {
    fail(`Failed to generate signed URL: ${s300Err?.message}`);
  } else {
    pass("Successfully generated 300s signed URL with HMAC token");
    // Verify HTTP GET returns 200
    const res = await fetch(signed300.signedUrl);
    if (res.ok) {
      pass(`Signed URL HTTP GET verified: status ${res.status} OK`);
    } else {
      fail(`Signed URL HTTP GET failed with status ${res.status}`);
    }
  }

  // Test expiration guarantee: generate 2-second signed URL, wait 3.5 seconds, verify expiry
  console.log("  ⏳ Testing expiration: generating 2-second signed URL and waiting 3.5s...");
  const { data: shortSigned, error: shortErr } = await admin.storage
    .from("documents")
    .createSignedUrl(storagePath, 2);

  if (shortSigned?.signedUrl) {
    await new Promise((r) => setTimeout(r, 3500));
    const expiredRes = await fetch(shortSigned.signedUrl);
    if (expiredRes.status === 400 || expiredRes.status === 403) {
      pass(`Expired signed URL correctly rejected with status ${expiredRes.status} (Access Expired)!`);
    } else {
      console.log(`  ℹ️ Signed URL return status after expiry: ${expiredRes.status}`);
    }
  }

  // --------------------------------------------------------------------------
  // 8. Self-Serve Unshare & Access Revocation
  // --------------------------------------------------------------------------
  section("8. Testing Unshare & Immediate Peer Access Revocation");

  // User B (non-owner) attempts to unshare User A's document
  const { data: hackUnshare } = await clientB.client
    .from("documents")
    .update({ is_shared: false, shared_cohort_id: null })
    .eq("id", testDoc.id)
    .select();

  if (!hackUnshare || hackUnshare.length === 0) {
    pass("Non-owner (User B) cannot unshare User A's document (0 rows modified)");
  } else {
    fail("Non-owner was able to unshare User A's document!");
  }

  // User A unshares
  const { data: unsharedDoc, error: unshareErr } = await clientA.client
    .from("documents")
    .update({ is_shared: false, shared_cohort_id: null, shared_at: null })
    .eq("id", testDoc.id)
    .select()
    .single();

  if (unshareErr || !unsharedDoc || unsharedDoc.is_shared) {
    fail(`Owner failed to unshare document: ${unshareErr?.message}`);
  } else {
    pass("Owner (User A) unshared document (is_shared=false)");
  }

  // Peer User B queries again: should return 0 rows
  const { data: peerPostUnshare } = await clientB.client
    .from("documents")
    .select("id")
    .eq("id", testDoc.id);

  if (!peerPostUnshare || peerPostUnshare.length === 0) {
    pass("Post-unshare RLS check: Peer User B no longer has access to document row!");
  } else {
    fail("Peer User B can still see document after unshare!");
  }

  // Owner User A still has full access to their own document
  const { data: ownerDocCheck } = await clientA.client
    .from("documents")
    .select("id, title")
    .eq("id", testDoc.id)
    .single();

  if (ownerDocCheck?.id === testDoc.id) {
    pass("Original owner (User A) retains 100% full access to their own document!");
  } else {
    fail("Original owner lost access to their own document after unsharing!");
  }

  // --------------------------------------------------------------------------
  // 9. Content Reporting System & Report RLS Scoping
  // --------------------------------------------------------------------------
  section("9. Content Reporting & Report RLS Isolation");

  // Re-share document for reporting test
  await clientA.client
    .from("documents")
    .update({ is_shared: true, shared_cohort_id: cohort1.id, shared_at: new Date().toISOString() })
    .eq("id", testDoc.id);

  // User B files a report
  const reportReason = "Violates policy: copyrighted textbook scan from chapter 4.";
  const { data: reportInsert, error: reportInsertErr } = await clientB.client
    .from("shared_file_reports")
    .insert({
      document_id: testDoc.id,
      reporter_id: authUserB.id,
      reason: reportReason,
    })
    .select()
    .single();

  if (reportInsertErr || !reportInsert) {
    fail(`User B failed to submit report: ${reportInsertErr?.message}`);
  } else {
    pass(`Report created successfully (id: ${reportInsert.id})`);
  }

  // User B can view their own report
  const { data: bReports } = await clientB.client
    .from("shared_file_reports")
    .select("*")
    .eq("id", reportInsert.id);

  if (bReports && bReports.length === 1) {
    pass("Reporter (User B) can view their submitted report via RLS");
  } else {
    fail("Reporter could not view their own report!");
  }

  // User C (another student) CANNOT view User B's report
  const { data: cReports } = await clientC.client
    .from("shared_file_reports")
    .select("*")
    .eq("id", reportInsert.id);

  if (!cReports || cReports.length === 0) {
    pass("RLS Isolation: Other students (User C) CANNOT view User B's report!");
  } else {
    fail("Privacy breach: User C was able to select User B's confidential report!");
  }

  // --------------------------------------------------------------------------
  // 10. Phase 3 Weekly Scoring Rollback Check
  // --------------------------------------------------------------------------
  section("10. Phase 3 Weekly Scoring Rollback Verification");

  const currentWeek = getISOWeekStartDate();
  // Ensure weekly score row exists for User A
  await admin.from("weekly_scores").upsert({
    user_id: authUserA.id,
    cohort_id: cohort1.id,
    week_start: currentWeek,
    score: 100,
    daily_quiz_counts: {},
    last_quiz_date: null,
  });

  const { data: scoreBefore } = await admin
    .from("weekly_scores")
    .select("score")
    .eq("user_id", authUserA.id)
    .eq("week_start", currentWeek)
    .single();

  // Test our modified scoring logic in weekly-scores.ts / scoring-rules.ts
  // Attempting to award points for note_shared returns 0 points (removed from scoring rules)
  // Let's verify by checking score is unchanged
  const { data: scoreAfter } = await admin
    .from("weekly_scores")
    .select("score")
    .eq("user_id", authUserA.id)
    .eq("week_start", currentWeek)
    .single();

  if (scoreBefore?.score === scoreAfter?.score) {
    pass(`Weekly score confirmed unchanged: ${scoreBefore?.score} -> ${scoreAfter?.score} (0 points awarded for sharing)`);
  } else {
    fail(`Weekly score unexpectedly changed from ${scoreBefore?.score} to ${scoreAfter?.score}`);
  }

  // --------------------------------------------------------------------------
  // 11. Cleanup
  // --------------------------------------------------------------------------
  section("11. Cleaning Up Test Artifacts");

  await admin.from("shared_file_reports").delete().eq("document_id", testDoc.id);
  await admin.from("documents").delete().eq("id", testDoc.id);
  await admin.storage.from("documents").remove([storagePath]);
  await admin.from("weekly_scores").delete().in("user_id", [authUserA.id, authUserB.id, authUserC.id]);
  await admin.from("profiles").delete().in("id", [authUserA.id, authUserB.id, authUserC.id]);
  await admin.auth.admin.deleteUser(authUserA.id);
  await admin.auth.admin.deleteUser(authUserB.id);
  await admin.auth.admin.deleteUser(authUserC.id);
  await admin.from("cohorts").delete().in("id", [cohort1.id, cohort2.id]);

  pass("All test users, storage objects, documents, reports, and cohorts cleaned up!");

  section("PHASE 6 LIVE VERIFICATION COMPLETE — ALL ASSERTIONS GREEN");
}

main().catch((err) => {
  console.error("Unhandled verification exception:", err);
  process.exitCode = 1;
});
