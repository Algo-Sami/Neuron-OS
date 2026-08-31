/**
 * ============================================================
 *  purge-storage.mjs
 *  Deletes ALL files inside the Supabase `documents` storage
 *  bucket so you can test in a clean environment.
 *
 *  DATABASE IS NOT TOUCHED — only storage blobs are removed.
 *
 *  Usage:
 *    node scripts/purge-storage.mjs --confirm
 * ============================================================
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env.local manually ──────────────────────────────────────────────────
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
    if (key.trim() === "NEXT_PUBLIC_SUPABASE_URL")   SUPABASE_URL = value;
    if (key.trim() === "SUPABASE_SERVICE_ROLE_KEY") SERVICE_ROLE_KEY = value;
  }
} catch {
  console.error("Could not read .env.local");
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const BUCKET = "documents";
const BATCH_SIZE = 100;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Recursively list every file path in the bucket
async function listAllFiles(prefix = "") {
  const allFiles = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });

    if (error) {
      console.error(`List error at prefix="${prefix}":`, error.message);
      break;
    }
    if (!data || data.length === 0) break;

    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.metadata === null || item.id === null) {
        // folder — recurse
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

// Delete paths in batches of BATCH_SIZE
async function deleteInBatches(paths) {
  let deleted = 0;
  let failed = 0;

  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    const batch = paths.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);

    if (error) {
      console.error(`  Batch delete failed [${i}-${i + batch.length}]:`, error.message);
      failed += batch.length;
    } else {
      deleted += batch.length;
      process.stdout.write(`  Deleted ${deleted} / ${paths.length} files...\r`);
    }
  }

  return { deleted, failed };
}

async function main() {
  console.log("");
  console.log("==========================================================");
  console.log("  Neuron-OS  Storage Purge Script");
  console.log("  Bucket  : documents");
  console.log("  Action  : DELETE ALL FILES  (database untouched)");
  console.log("==========================================================");
  console.log("");

  const args = process.argv.slice(2);
  if (!args.includes("--confirm")) {
    console.log("WARNING: This will permanently delete EVERY file in the");
    console.log("         Neuron-OS 'documents' storage bucket.");
    console.log("         Database rows will NOT be affected.");
    console.log("");
    console.log("  To proceed, run:");
    console.log("  node scripts/purge-storage.mjs --confirm");
    console.log("");
    process.exit(0);
  }

  console.log("Listing all files in bucket...");
  const allFiles = await listAllFiles("");

  if (allFiles.length === 0) {
    console.log("Bucket is already empty — nothing to delete.");
    return;
  }

  console.log(`Found ${allFiles.length} file(s). Starting deletion...`);
  console.log("");

  const { deleted, failed } = await deleteInBatches(allFiles);

  console.log("\n----------------------------------------------------------");
  if (failed === 0) {
    console.log(`DONE! All ${deleted} file(s) deleted from storage.`);
  } else {
    console.log(`Finished: ${deleted} deleted, ${failed} failed.`);
  }
  console.log("Database rows are intact — safe to re-upload fresh files.");
  console.log("----------------------------------------------------------");
  console.log("");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
