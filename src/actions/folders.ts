"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function linkFilesToFolder(
  documentIds: string[],
  subjectId: string,
  folderId: string | null
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  if (!documentIds || documentIds.length === 0) {
    return { success: true };
  }

  const { error } = await supabase
    .from("documents")
    .update({
      subject_id: subjectId,
      folder_id: folderId,
      updated_at: new Date().toISOString(),
    })
    .in("id", documentIds)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Failed to link documents");
  }

  revalidatePath(`/subjects/${subjectId}`);
  revalidatePath("/subjects");
  revalidatePath("/uploads");

  return { success: true };
}

export async function createFolderAction(
  name: string,
  subjectId: string,
  parentFolderId: string | null,
  throwOnDuplicate = true
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const trimmedName = name.trim();

  // ── Uniqueness check (case-insensitive) ──
  let query = supabase
    .from("folders")
    .select("id")
    .eq("user_id", user.id)
    .eq("subject_id", subjectId)
    .ilike("name", trimmedName);

  if (parentFolderId === null) {
    query = query.is("parent_folder_id", null);
  } else {
    query = query.eq("parent_folder_id", parentFolderId);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    if (throwOnDuplicate) {
      throw new Error(`A folder named '${trimmedName}' already exists in this location. Please choose a different folder name.`);
    }
    // Folder already exists — skip silently (idempotent)
    return { success: true, folder: existing, skipped: true };
  }

  const { data, error } = await supabase
    .from("folders")
    .insert({
      user_id: user.id,
      subject_id: subjectId,
      parent_folder_id: parentFolderId,
      name: trimmedName
    })
    .select()
    .single();

  if (error) throw new Error(error.message || "Failed to create folder");

  revalidatePath("/subjects");
  revalidatePath(`/subjects/${subjectId}`);
  return { success: true, folder: data, skipped: false };
}

/**
 * Idempotent scaffold action — runs server-side, fetches real DB state first.
 * Creates only the missing standard folders. Safe to call any number of times.
 */
export async function scaffoldSubjectFoldersAction(subjectId: string): Promise<{ success: boolean; created: string[]; skipped: string[] }> {
  // Only the AI Generated folder is created automatically.
  // All academic folders (Lectures, Assignments, Quizzes, Presentations, Lab, etc.)
  // are created on-demand the first time a matching file is uploaded.
  const STANDARD_FOLDERS = [
    "AI Generated",
  ];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Fetch CURRENT root-level folders for this subject directly from DB
  const { data: existingFolders, error: fetchError } = await supabase
    .from("folders")
    .select("id, name")
    .eq("user_id", user.id)
    .eq("subject_id", subjectId)
    .is("parent_folder_id", null);

  if (fetchError) {
    console.error("[scaffold] Failed to fetch existing folders:", fetchError.message);
    throw new Error(fetchError.message);
  }

  const existingNames = new Set(
    (existingFolders || []).map((f) => f.name.toLowerCase().trim())
  );

  const toCreate = STANDARD_FOLDERS.filter(
    (name) => !existingNames.has(name.toLowerCase().trim())
  );

  const skipped = STANDARD_FOLDERS.filter(
    (name) => existingNames.has(name.toLowerCase().trim())
  );

  if (toCreate.length === 0) {
    console.log(`[scaffold] Subject ${subjectId}: all folders already exist, nothing to create`);
    return { success: true, created: [], skipped };
  }

  console.log(`[scaffold] Subject ${subjectId}: creating ${toCreate.length} missing folders:`, toCreate);

  // Insert only the missing folders — sequential to avoid race conditions
  const created: string[] = [];
  for (const name of toCreate) {
    // Double-check existence right before insert (extra safety for concurrent calls)
    const { data: doubleCheck } = await supabase
      .from("folders")
      .select("id")
      .eq("user_id", user.id)
      .eq("subject_id", subjectId)
      .eq("name", name)
      .is("parent_folder_id", null)
      .maybeSingle();

    if (doubleCheck) {
      console.log(`[scaffold] Folder "${name}" appeared concurrently — skipping`);
      skipped.push(name);
      continue;
    }

    const { error: insertError } = await supabase
      .from("folders")
      .insert({
        user_id: user.id,
        subject_id: subjectId,
        parent_folder_id: null,
        name,
      });

    if (insertError) {
      console.error(`[scaffold] Failed to create folder "${name}":`, insertError.message);
      // Don't throw — continue with other folders
    } else {
      created.push(name);
      console.log(`[scaffold] Created folder "${name}" for subject ${subjectId}`);
    }
  }

  console.log(`[scaffold] Subject ${subjectId}: done. Created: ${created.length}, Skipped: ${skipped.length}`);

  // Only revalidate once at the end — not per-folder
  if (created.length > 0) {
    revalidatePath("/subjects");
    revalidatePath(`/subjects/${subjectId}`);
  }

  return { success: true, created, skipped };
}

export async function renameFolderAction(folderId: string, newName: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const trimmedNewName = newName.trim();

  // Fetch current folder state to locate its parent folder context
  const { data: currentFolder, error: fetchError } = await supabase
    .from("folders")
    .select("subject_id, parent_folder_id")
    .eq("id", folderId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !currentFolder) {
    throw new Error(fetchError?.message || "Folder not found");
  }

  // ── Uniqueness check for rename (case-insensitive, exclude self) ──
  let query = supabase
    .from("folders")
    .select("id")
    .eq("user_id", user.id)
    .eq("subject_id", currentFolder.subject_id)
    .neq("id", folderId)
    .ilike("name", trimmedNewName);

  if (currentFolder.parent_folder_id === null) {
    query = query.is("parent_folder_id", null);
  } else {
    query = query.eq("parent_folder_id", currentFolder.parent_folder_id);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    throw new Error(`A folder named '${trimmedNewName}' already exists in this location. Please choose a different folder name.`);
  }

  const { error } = await supabase
    .from("folders")
    .update({ name: trimmedNewName, updated_at: new Date().toISOString() })
    .eq("id", folderId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message || "Failed to rename folder");

  revalidatePath("/subjects");
  if (currentFolder.subject_id) {
    revalidatePath(`/subjects/${currentFolder.subject_id}`);
  }
  return { success: true };
}

export async function deleteFolderAction(folderId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Fetch all folders for the user to compute descendants locally
  const { data: allFolders, error: foldersError } = await supabase
    .from("folders")
    .select("id, parent_folder_id")
    .eq("user_id", user.id);

  if (foldersError) throw new Error(foldersError.message || "Failed to fetch folders");

  const descendantIds = new Set<string>([folderId]);
  let added = true;
  while (added) {
    added = false;
    for (const f of allFolders || []) {
      if (f.parent_folder_id && descendantIds.has(f.parent_folder_id) && !descendantIds.has(f.id)) {
        descendantIds.add(f.id);
        added = true;
      }
    }
  }

  const folderIdsList = Array.from(descendantIds);
  const now = new Date().toISOString();

  // Fetch documents inside these folders to locate associated AI generated docs
  const { data: folderDocs } = await supabase
    .from("documents")
    .select("id, title, subject_id")
    .in("folder_id", folderIdsList)
    .eq("user_id", user.id);

  // 1. Move all documents in these folders to recycle bin (soft delete)
  const { error: docsError } = await supabase
    .from("documents")
    .update({ deleted_at: now })
    .in("folder_id", folderIdsList)
    .eq("user_id", user.id);

  if (docsError) throw new Error(docsError.message || "Failed to delete files inside folder");

  // 1b. Soft-delete associated AI generated documents in lockstep
  if (folderDocs && folderDocs.length > 0) {
    for (const doc of folderDocs) {
      try {
        const docShortId = doc.id.substring(0, 8);
        await supabase
          .from("documents")
          .update({ deleted_at: now })
          .eq("user_id", user.id)
          .contains("tags", [`source_doc:${doc.id}`]);

        await supabase
          .from("documents")
          .update({ deleted_at: now })
          .eq("user_id", user.id)
          .eq("ai_doc_type", "ai_generated")
          .ilike("file_url", `%ai-gen-%${docShortId}%`);
      } catch (aiSyncErr) {
        console.warn("[deleteFolderAction] AI document sync soft-delete warning:", aiSyncErr);
      }
    }
  }

  // 2. Delete the folders permanently from DB
  const { error: deleteFoldersError } = await supabase
    .from("folders")
    .delete()
    .in("id", folderIdsList)
    .eq("user_id", user.id);

  if (deleteFoldersError) throw new Error(deleteFoldersError.message || "Failed to delete folders");

  revalidatePath("/subjects");
  revalidatePath("/recycle-bin");
  return { success: true };
}

export async function moveFolderAction(
  folderId: string,
  targetSubjectId: string,
  targetParentFolderId: string | null
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Fetch all folders to find descendant folders
  const { data: allFolders, error: foldersError } = await supabase
    .from("folders")
    .select("id, parent_folder_id, subject_id")
    .eq("user_id", user.id);

  if (foldersError) throw new Error(foldersError.message || "Failed to fetch folders");

  const descendantIds = new Set<string>([folderId]);
  let added = true;
  while (added) {
    added = false;
    for (const f of allFolders || []) {
      if (f.parent_folder_id && descendantIds.has(f.parent_folder_id) && !descendantIds.has(f.id)) {
        descendantIds.add(f.id);
        added = true;
      }
    }
  }

  const folderIdsList = Array.from(descendantIds);

  // 1. Update subject_id for all descendant folders
  const { error: updateFoldersError } = await supabase
    .from("folders")
    .update({ subject_id: targetSubjectId, updated_at: new Date().toISOString() })
    .in("id", folderIdsList)
    .eq("user_id", user.id);

  if (updateFoldersError) throw new Error(updateFoldersError.message || "Failed to move sub-folders");

  // 2. Update the parent_folder_id of the root moved folder
  const { error: updateParentError } = await supabase
    .from("folders")
    .update({ parent_folder_id: targetParentFolderId, updated_at: new Date().toISOString() })
    .eq("id", folderId)
    .eq("user_id", user.id);

  if (updateParentError) throw new Error(updateParentError.message || "Failed to update parent folder");

  // 3. Update subject_id of all documents in these folders
  const { error: updateDocsError } = await supabase
    .from("documents")
    .update({ subject_id: targetSubjectId, updated_at: new Date().toISOString() })
    .in("folder_id", folderIdsList)
    .eq("user_id", user.id);

  if (updateDocsError) throw new Error(updateDocsError.message || "Failed to update folder documents");

  revalidatePath("/subjects");
  return { success: true };
}

export async function moveDocumentAction(
  documentId: string,
  targetSubjectId: string | null,
  targetFolderId: string | null
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("documents")
    .update({
      subject_id: targetSubjectId,
      folder_id: targetFolderId,
      updated_at: new Date().toISOString()
    })
    .eq("id", documentId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message || "Failed to move document");

  revalidatePath("/subjects");
  revalidatePath("/uploads");
  return { success: true };
}

export async function duplicateDocumentAction(documentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: sourceDoc, error: fetchError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !sourceDoc) {
    throw new Error(fetchError?.message || "Failed to find document to duplicate");
  }

  // Prepare duplicate data, omit id, created_at, updated_at
  const rest = { ...sourceDoc } as Record<string, unknown>;
  delete rest.id;
  delete rest.created_at;
  delete rest.updated_at;
  delete rest.title;
  const title = sourceDoc.title;

  // Append copy suffix to title
  const newTitle = title.includes(" - Copy")
    ? title.replace(/ - Copy( \(\d+\))?$/, (match: string, p1?: string) => {
        if (!p1) return " - Copy (2)";
        const num = parseInt(p1.trim().replace(/[()]/g, "")) + 1;
        return ` - Copy (${num})`;
      })
    : `${title} - Copy`;

  const { error: insertError } = await supabase
    .from("documents")
    .insert({
      ...rest,
      title: newTitle,
      user_id: user.id
    });

  if (insertError) throw new Error(insertError.message || "Failed to duplicate file");

  revalidatePath("/subjects");
  revalidatePath("/uploads");
  return { success: true };
}

interface DbFolder {
  id: string;
  name: string;
  subject_id: string;
  parent_folder_id: string | null;
}

export async function duplicateFolderAction(folderId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const userId = user.id;

  // Fetch original folder
  const { data: folder, error: folderError } = await supabase
    .from("folders")
    .select("*")
    .eq("id", folderId)
    .eq("user_id", userId)
    .single();

  if (folderError || !folder) {
    throw new Error("Folder not found");
  }

  // Local function to duplicate folder recursively
  async function cloneFolder(origFolder: DbFolder, parentId: string | null): Promise<string> {
    const newName = parentId === null
      ? (origFolder.name.includes(" - Copy") ? origFolder.name + " (Copy)" : origFolder.name + " - Copy")
      : origFolder.name;

    const { data: newFolder, error: insFolderError } = await supabase
      .from("folders")
      .insert({
        user_id: userId,
        subject_id: origFolder.subject_id,
        parent_folder_id: parentId,
        name: newName
      })
      .select("id")
      .single();

    if (insFolderError || !newFolder) {
      throw new Error("Failed to clone folder structure");
    }

    const newFolderId = newFolder.id;

    // Duplicate files in this folder
    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .eq("folder_id", origFolder.id)
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (docs && docs.length > 0) {
      const clonedDocs = docs.map(doc => {
        const rest = { ...doc } as Record<string, unknown>;
        delete rest.id;
        delete rest.created_at;
        delete rest.updated_at;
        delete rest.folder_id;
        return {
          ...rest,
          folder_id: newFolderId,
          user_id: userId
        };
      });
      const { error: insDocsError } = await supabase.from("documents").insert(clonedDocs);
      if (insDocsError) throw new Error("Failed to clone documents inside folder");
    }

    // Find sub-folders
    const { data: subFolders } = await supabase
      .from("folders")
      .select("*")
      .eq("parent_folder_id", origFolder.id)
      .eq("user_id", userId);

    if (subFolders && subFolders.length > 0) {
      for (const sub of subFolders as DbFolder[]) {
        await cloneFolder(sub, newFolderId);
      }
    }

    return newFolderId;
  }

  await cloneFolder(folder as DbFolder, folder.parent_folder_id);

  revalidatePath("/subjects");
  return { success: true };
}
