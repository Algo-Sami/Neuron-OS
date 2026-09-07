import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envPath = ".env.local";
let SUPABASE_URL = "";
let SERVICE_ROLE_KEY = "";

const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const [key, ...rest] = trimmed.split("=");
  const value = rest.join("=").trim();
  if (key.trim() === "NEXT_PUBLIC_SUPABASE_URL") SUPABASE_URL = value;
  if (key.trim() === "SUPABASE_SERVICE_ROLE_KEY") SERVICE_ROLE_KEY = value;
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("Checking documents columns...");
const { data: doc, error: docErr } = await admin
  .from("documents")
  .select("id, is_shared, shared_cohort_id, shared_at")
  .limit(1);

console.log("Documents query:", { doc, docErr });

console.log("Checking shared_file_reports table...");
const { data: reports, error: repErr } = await admin
  .from("shared_file_reports")
  .select("*")
  .limit(1);

console.log("Reports query:", { reports, repErr });
