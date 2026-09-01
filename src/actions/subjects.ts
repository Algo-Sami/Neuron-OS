"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createSubject(name: string, code: string, color: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const trimmedName = name.trim();

  // ── Uniqueness check (case-insensitive) ─────────────────────────────────
  const { data: existing } = await supabase
    .from("subjects")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .ilike("name", trimmedName)
    .maybeSingle();

  if (existing) {
    throw new Error(`A subject named "${trimmedName}" already exists. Please choose a different name.`);
  }
  // ────────────────────────────────────────────────────────────────────────

  const { error } = await supabase
    .from("subjects")
    .insert({
      user_id: user.id,
      name: trimmedName,
      code,
      color,
    });

  if (error) {
    throw new Error(error.message || "Failed to create subject");
  }

  revalidatePath("/subjects");
  revalidatePath("/dashboard");
}

export async function renameSubject(subjectId: string, name: string, code: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const trimmedName = name.trim();

  // ── Uniqueness check (case-insensitive, exclude self) ───────────────────
  const { data: existing } = await supabase
    .from("subjects")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .ilike("name", trimmedName)
    .neq("id", subjectId)
    .maybeSingle();

  if (existing) {
    throw new Error(`A subject named "${trimmedName}" already exists. Please choose a different name.`);
  }
  // ────────────────────────────────────────────────────────────────────────

  const { error } = await supabase
    .from("subjects")
    .update({ name: trimmedName, code: code.trim() || null })
    .eq("id", subjectId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Failed to rename subject");
  }

  revalidatePath("/subjects");
  revalidatePath("/dashboard");
}

import { cleanupAiGeneratedResources } from "@/actions/uploads";

export async function moveToRecycleBin(subjectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const now = new Date().toISOString();

  // 1. Soft-delete the subject
  const { error } = await supabase
    .from("subjects")
    .update({
      deleted_at: now,
    })
    .eq("id", subjectId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Failed to move subject to recycle bin");
  }

  // 2. Cascade soft-delete to all documents in this subject
  await supabase
    .from("documents")
    .update({ deleted_at: now })
    .eq("subject_id", subjectId)
    .eq("user_id", user.id);

  // 3. Cascade soft-delete to all folders in this subject
  await supabase
    .from("folders")
    .update({ deleted_at: now })
    .eq("subject_id", subjectId)
    .eq("user_id", user.id);

  revalidatePath("/subjects");
  revalidatePath("/uploads");
  revalidatePath("/dashboard");
  revalidatePath("/recycle-bin");
}

export async function restoreFromRecycleBin(subjectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // 1. Restore the subject
  const { error } = await supabase
    .from("subjects")
    .update({
      deleted_at: null,
    })
    .eq("id", subjectId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Failed to restore subject");
  }

  // 2. Cascade restore to all documents in this subject
  await supabase
    .from("documents")
    .update({ deleted_at: null })
    .eq("subject_id", subjectId)
    .eq("user_id", user.id);

  // 3. Cascade restore to all folders in this subject
  await supabase
    .from("folders")
    .update({ deleted_at: null })
    .eq("subject_id", subjectId)
    .eq("user_id", user.id);

  revalidatePath("/subjects");
  revalidatePath("/uploads");
  revalidatePath("/dashboard");
  revalidatePath("/recycle-bin");
}

export async function deleteSubjectPermanently(subjectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // 1. Fetch subject details for snapshot retention before deletion
  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("id", subjectId)
    .eq("user_id", user.id)
    .maybeSingle();

  const subjectName = subject?.name || null;

  // 2. Fetch all documents belonging to this subject (active and recycled)
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, file_url, upload_id, folder_id, ai_topic, ai_subject")
    .eq("subject_id", subjectId)
    .eq("user_id", user.id);

  if (docs && docs.length > 0) {
    for (const doc of docs) {
      // 2a. Delete physical storage file if present
      if (doc.file_url) {
        try {
          let storagePath = "";
          if (doc.file_url.includes("/documents/")) {
            storagePath = decodeURIComponent(doc.file_url.split("/documents/")[1]?.split("?")[0] || "");
          } else {
            const parts = doc.file_url.split("/");
            storagePath = `${user.id}/${parts[parts.length - 1]}`;
          }
          if (storagePath) {
            await supabase.storage.from("documents").remove([storagePath]);
          }
        } catch (storageErr) {
          console.warn("[deleteSubjectPermanently] Storage file removal warning:", storageErr);
        }
      }

      // 2b. Clean up AI generated resources
      await cleanupAiGeneratedResources(supabase, user.id, subjectId, doc.title, doc.id);

      // 2c. Delete document row from documents table
      await supabase
        .from("documents")
        .delete()
        .eq("id", doc.id)
        .eq("user_id", user.id);

      // 2d. Update uploads audit record to preserve subject snapshot
      if (doc.upload_id) {
        try {
          const resolvedSubject = doc.ai_subject || subjectName;
          const { error: updExtErr } = await supabase
            .from("uploads")
            .update({
              status: "deleted",
              deleted_at: new Date().toISOString(),
              subject_id: subjectId,
              subject_name: resolvedSubject,
              ai_subject: resolvedSubject,
              folder_name: doc.ai_topic,
              ai_topic: doc.ai_topic,
            })
            .eq("id", doc.upload_id)
            .eq("user_id", user.id);

          if (updExtErr && (updExtErr.code === 'PGRST204' || updExtErr.message?.includes('schema cache') || updExtErr.message?.includes('column'))) {
            await supabase
              .from("uploads")
              .update({ status: "deleted", deleted_at: new Date().toISOString() })
              .eq("id", doc.upload_id)
              .eq("user_id", user.id);
          }
        } catch (uploadDelErr) {
          console.warn("[deleteSubjectPermanently] Upload audit mark deleted warning:", uploadDelErr);
        }
      }
    }
  }

  // 3. Delete all folders belonging to this subject
  await supabase
    .from("folders")
    .delete()
    .eq("subject_id", subjectId)
    .eq("user_id", user.id);

  // 4. Delete the subject itself
  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", subjectId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Failed to delete subject permanently");
  }

  revalidatePath("/subjects");
  revalidatePath("/uploads");
  revalidatePath("/dashboard");
  revalidatePath("/recycle-bin");
  revalidatePath("/summaries");
}

export async function cleanupExpiredRecycledItems(userId: string) {
  const supabase = await createClient();
  
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const tenDaysAgoStr = tenDaysAgo.toISOString();

  const { data: expiredSubjects } = await supabase
    .from("subjects")
    .select("id")
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .lt("deleted_at", tenDaysAgoStr);

  if (expiredSubjects && expiredSubjects.length > 0) {
    for (const sub of expiredSubjects) {
      try {
        await deleteSubjectPermanently(sub.id);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("Failed to delete expired recycled subject:", errorMsg);
      }
    }
  }
}


