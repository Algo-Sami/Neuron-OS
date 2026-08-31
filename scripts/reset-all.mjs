/**
 * ============================================================
 *  reset-all.mjs
 *  One-command reset for Neuron-OS:
 *  1. Deletes all files from Supabase Storage via Storage API
 *  2. Deletes all data from database tables (retaining schema)
 *
 *  Usage:
 *    node scripts/reset-all.mjs --confirm
 * ============================================================
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");

let SUPABASE_URL = "";
let SERVICE_ROLE_KEY = "";

try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=").trim();
    if (key.trim() === "NEXT_PUBLIC_SUPABASE_URL") SUPABASE_URL = value;
    if (key.trim() === "SUPABASE_SERVICE_ROLE_KEY") SERVICE_ROLE_KEY = value;
  }
} catch {
  console.error("Could not read .env.local");
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BUCKET = "documents";
const BATCH_SIZE = 100;

// List all files recursively
async function listAllFiles(prefix = "") {
  const allFiles = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error || !data || data.length === 0) break;
    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.metadata === null || item.id === null) {
        const nested = await listAllFiles(fullPath);
        allFiles.push(...nested);
      } else {
        allFiles.push(fullPath);
      }
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return allFiles;
}

// Database tables to clean
const TABLES_TO_CLEAN = [
  "classification_events",
  "subject_aliases",
  "subject_profiles",
  "asset_generation_jobs",
  "knowledge_asset_versions",
  "knowledge_assets",
  "document_knowledge",
  "background_tasks",
  "semantic_cache",
  "knowledge_graph",
  "ai_usage_logs",
  "ai_meeting_summaries",
  "room_quiz_attempts",
  "room_quizzes",
  "collaborative_notes",
  "room_messages",
  "room_members",
  "room_analytics",
  "study_rooms",
  "study_plans",
  "concept_evaluations",
  "weakness_tracking",
  "exam_readiness",
  "productivity_insights",
  "chat_messages",
  "chat_conversations",
  "shared_notes",
  "notifications",
  "study_sessions",
  "user_achievements",
  "reminders",
  "flashcards",
  "quizzes",
  "ai_summaries",
  "document_chunks",
  "documents",
  "uploads",
  "folders",
  "subjects",
];

async function main() {
  console.log("\n==========================================================");
  console.log("  Neuron-OS · Full Environment Reset");
  console.log("  Action : Clean Storage Files + Clean Database Tables");
  console.log("==========================================================\n");

  const args = process.argv.slice(2);
  if (!args.includes("--confirm")) {
    console.log("WARNING: This will wipe all files and database table data.");
    console.log("         Your database schema and user account will remain intact.\n");
    console.log("  To proceed, run: node scripts/reset-all.mjs --confirm\n");
    process.exit(0);
  }

  // 1. Storage purge
  console.log("1. Cleaning Storage files from 'documents' bucket...");
  const files = await listAllFiles("");
  if (files.length > 0) {
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      await supabase.storage.from(BUCKET).remove(batch);
    }
    console.log(`   ✓ Deleted ${files.length} file(s) from storage.`);
  } else {
    console.log("   ✓ Storage is already empty.");
  }

  // 2. Database tables purge
  console.log("\n2. Cleaning Database tables...");
  for (const table of TABLES_TO_CLEAN) {
    try {
      const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (!error) {
        console.log(`   ✓ Cleaned table: ${table}`);
      }
    } catch (e) {
      // ignore tables that don't exist in active schema
    }
  }

  // 3. Reset progress counters
  console.log("\n3. Resetting user progress stats...");
  await supabase
    .from("user_progress")
    .update({ xp: 0, current_streak: 0, longest_streak: 0, total_study_time: 0 })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("\n==========================================================");
  console.log("  DONE! Your environment is completely fresh and clean.");
  console.log("==========================================================\n");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
