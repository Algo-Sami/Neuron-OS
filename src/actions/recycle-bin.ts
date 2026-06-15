"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { deleteSubjectPermanently } from "@/actions/subjects";
import { deleteUpload } from "@/actions/uploads";
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
  } else {
    // Restore document
    let targetSubjectId = options?.targetSubjectId;
    let targetFolderId = options?.targetFolderId;

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
    } else {
      // For simple bulk restore, set deleted_at to null.
      // If original folder is missing, UI will intercept and use single restore action
      // with location resolution.
      await supabase
        .from("documents")
        .update({ deleted_at: null })
        .eq("id", item.id)
        .eq("user_id", user.id);
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
      const { data: doc } = await supabase
        .from("documents")
        .select("upload_id, file_url")
        .eq("id", item.id)
        .eq("user_id", user.id)
        .single();

      if (doc) {
        if (doc.upload_id) {
          await deleteUpload(doc.upload_id, item.id, doc.file_url);
        } else {
          // Just delete document row if no upload log exists
          await supabase
            .from("documents")
            .delete()
            .eq("id", item.id)
            .eq("user_id", user.id);
        }
      }
    }
  }

  revalidatePath("/subjects");
  revalidatePath("/uploads");
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

  // 2. Permanently delete recycled documents (calls deleteUpload for storage cleanup)
  const { data: recycledDocs } = await supabase
    .from("documents")
    .select("id, upload_id, file_url")
    .eq("user_id", user.id)
    .not("deleted_at", "is", null);

  if (recycledDocs && recycledDocs.length > 0) {
    for (const doc of recycledDocs) {
      if (doc.upload_id) {
        await deleteUpload(doc.upload_id, doc.id, doc.file_url);
      } else {
        await supabase
          .from("documents")
          .delete()
          .eq("id", doc.id)
          .eq("user_id", user.id);
      }
    }
  }

  revalidatePath("/subjects");
  revalidatePath("/uploads");
  revalidatePath("/recycle-bin");
  return { success: true };
}
