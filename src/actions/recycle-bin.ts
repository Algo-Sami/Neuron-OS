"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { deleteSubjectPermanently } from "@/actions/subjects";
import { deleteDocumentPermanently, restoreAssociatedAiDocuments } from "@/actions/uploads";
import { createFolderAction } from "@/actions/folders";

export async function restoreRecycleBinItemAction(
  id: string,
  type: "subject" | "file",
  options?: {
    recreateFolderName?: string | null;
    targetSubjectId?: string | null;
    targetFolderId?: string | null;
    toRoot?: boolean;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  if (type === "subject") {
    // Restore subject
    const { error } = await supabase
      .from("subjects")
      .update({ deleted_at: null })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);

    // Cascade restore all documents in this subject
    await supabase
      .from("documents")
      .update({ deleted_at: null })
      .eq("subject_id", id)
      .eq("user_id", user.id);

    // Cascade restore all folders in this subject
    await supabase
      .from("folders")
      .update({ deleted_at: null })
      .eq("subject_id", id)
      .eq("user_id", user.id);
  } else {
    // Restore document
    const targetSubjectId = options?.targetSubjectId;
    let targetFolderId = options?.targetFolderId;

    // Fetch existing document to get metadata
    const { data: doc } = await supabase
      .from("documents")
      .select("id, title, subject_id, folder_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (options?.recreateFolderName && targetSubjectId) {
      // Recreate missing folder
      const result = await createFolderAction(
        options.recreateFolderName,
        targetSubjectId,
        null
      );
      if (result.success && result.folder) {
        targetFolderId = result.folder.id;
      } else {
        throw new Error("Failed to recreate missing folder");
      }
    } else if (options?.toRoot && targetSubjectId) {
      targetFolderId = null;
    }

    const updateData: Record<string, any> = { deleted_at: null };
    if (targetSubjectId !== undefined) updateData.subject_id = targetSubjectId;
    if (targetFolderId !== undefined) updateData.folder_id = targetFolderId;

    const { error } = await supabase
      .from("documents")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);

    // Lockstep restore for all associated AI generated documents & folders
    const effectiveSubjectId = targetSubjectId !== undefined ? targetSubjectId : doc?.subject_id;
    await restoreAssociatedAiDocuments(
      supabase,
      user.id,
      id,
      doc?.title,
      effectiveSubjectId
    );
  }

  revalidatePath("/subjects");
  revalidatePath("/uploads");
  revalidatePath("/recycle-bin");
  return { success: true };
}

export async function restoreMultipleItemsAction(
  items: { id: string; type: "subject" | "file" }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  for (const item of items) {
    if (item.type === "subject") {
      await supabase
        .from("subjects")
        .update({ deleted_at: null })
        .eq("id", item.id)
        .eq("user_id", user.id);

      await supabase
        .from("documents")
        .update({ deleted_at: null })
        .eq("subject_id", item.id)
        .eq("user_id", user.id);

      await supabase
        .from("folders")
        .update({ deleted_at: null })
        .eq("subject_id", item.id)
        .eq("user_id", user.id);
    } else {
      const { data: doc } = await supabase
        .from("documents")
        .select("id, title, subject_id")
        .eq("id", item.id)
        .eq("user_id", user.id)
        .maybeSingle();

      await supabase
        .from("documents")
        .update({ deleted_at: null })
        .eq("id", item.id)
        .eq("user_id", user.id);

      await restoreAssociatedAiDocuments(
        supabase,
        user.id,
        item.id,
        doc?.title,
        doc?.subject_id
      );
    }
  }

  revalidatePath("/subjects");
  revalidatePath("/uploads");
  revalidatePath("/recycle-bin");
  return { success: true };
}

export async function deleteMultipleItemsAction(
  items: { id: string; type: "subject" | "file" }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  for (const item of items) {
    if (item.type === "subject") {
      await deleteSubjectPermanently(item.id);
    } else {
      // Calls authoritative permanent deletion helper that always removes physical storage file
      // and cleans up all AI-generated physical PDFs, folders, and metadata
      await deleteDocumentPermanently(item.id);
    }
  }

  revalidatePath("/subjects");
  revalidatePath("/uploads");
  revalidatePath("/summaries");
  revalidatePath("/recycle-bin");
  return { success: true };
}

export async function emptyRecycleBinAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // 1. Permanently delete recycled subjects
  const { data: recycledSubjects } = await supabase
    .from("subjects")
    .select("id")
    .eq("user_id", user.id)
    .not("deleted_at", "is", null);

  if (recycledSubjects && recycledSubjects.length > 0) {
    for (const sub of recycledSubjects) {
      await deleteSubjectPermanently(sub.id);
    }
  }

  // 2. Permanently delete recycled documents (calls deleteDocumentPermanently for physical storage and AI cleanup)
  const { data: recycledDocs } = await supabase
    .from("documents")
    .select("id")
    .eq("user_id", user.id)
    .not("deleted_at", "is", null);

  if (recycledDocs && recycledDocs.length > 0) {
    for (const doc of recycledDocs) {
      await deleteDocumentPermanently(doc.id);
    }
  }

  revalidatePath("/subjects");
  revalidatePath("/uploads");
  revalidatePath("/summaries");
  revalidatePath("/recycle-bin");
  return { success: true };
}

