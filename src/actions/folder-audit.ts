"use server";

import { createClient } from "@/lib/supabase/server";

export interface DuplicateReport {
  subjectId: string;
  subjectName: string;
  duplicates: {
    folderName: string;
    count: number;
    folderIds: string[];
    fileCountsPerFolder: Record<string, number>;
    mergeRecommendation: string;
  }[];
}

/**
 * Audit all subjects for duplicate root-level folders.
 * READ-ONLY — does not delete or modify anything.
 */
export async function auditDuplicateFoldersAction(): Promise<{
  success: boolean;
  reports: DuplicateReport[];
  totalDuplicateFolders: number;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Fetch all subjects
  const { data: subjects, error: subjectsError } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("name");

  if (subjectsError) throw new Error(subjectsError.message);
  if (!subjects || subjects.length === 0) return { success: true, reports: [], totalDuplicateFolders: 0 };

  // Fetch all root-level folders
  const { data: folders, error: foldersError } = await supabase
    .from("folders")
    .select("id, name, subject_id")
    .eq("user_id", user.id)
    .is("parent_folder_id", null)
    .order("name");

  if (foldersError) throw new Error(foldersError.message);

  // Fetch all documents to count files per folder
  const { data: documents } = await supabase
    .from("documents")
    .select("id, folder_id")
    .eq("user_id", user.id)
    .is("deleted_at", null);

  // Build file count map: folderId → count
  const fileCountMap: Record<string, number> = {};
  for (const doc of documents || []) {
    if (doc.folder_id) {
      fileCountMap[doc.folder_id] = (fileCountMap[doc.folder_id] || 0) + 1;
    }
  }

  const reports: DuplicateReport[] = [];
  let totalDuplicateFolders = 0;

  for (const subject of subjects) {
    const subjectFolders = (folders || []).filter((f) => f.subject_id === subject.id);

    // Group by lowercase name
    const grouped: Record<string, typeof subjectFolders> = {};
    for (const folder of subjectFolders) {
      const key = folder.name.toLowerCase().trim();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(folder);
    }

    // Find groups with duplicates
    const duplicateGroups = Object.entries(grouped).filter(([, group]) => group.length > 1);

    if (duplicateGroups.length === 0) continue;

    const duplicates = duplicateGroups.map(([, group]) => {
      const folderIds = group.map((f) => f.id);
      const fileCountsPerFolder: Record<string, number> = {};
      for (const id of folderIds) {
        fileCountsPerFolder[id] = fileCountMap[id] || 0;
      }
      const totalFiles = Object.values(fileCountsPerFolder).reduce((a, b) => a + b, 0);

      return {
        folderName: group[0].name,
        count: group.length,
        folderIds,
        fileCountsPerFolder,
        mergeRecommendation: totalFiles > 0
          ? `Merge ${group.length - 1} duplicate(s) into the first folder (${totalFiles} files total to preserve)`
          : `Delete ${group.length - 1} empty duplicate(s) safely`,
      };
    });

    totalDuplicateFolders += duplicates.reduce((sum, d) => sum + d.count - 1, 0);

    reports.push({
      subjectId: subject.id,
      subjectName: subject.name,
      duplicates,
    });
  }

  return { success: true, reports, totalDuplicateFolders };
}

/**
 * Merge duplicate folders for a specific subject.
 * Moves all files from duplicate folders into the first (oldest) instance,
 * then deletes empty duplicates.
 * FILES ARE NEVER DELETED. Only empty duplicate folders are removed after merge.
 */
export async function mergeDuplicateFoldersAction(
  subjectId: string,
  folderName: string
): Promise<{ success: boolean; mergedCount: number; filesPreserved: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Fetch all root-level folders with this name for this subject
  const { data: duplicates, error: fetchError } = await supabase
    .from("folders")
    .select("id, name, created_at")
    .eq("user_id", user.id)
    .eq("subject_id", subjectId)
    .is("parent_folder_id", null)
    .ilike("name", folderName.trim())
    .order("created_at", { ascending: true }); // oldest first

  if (fetchError) throw new Error(fetchError.message);
  if (!duplicates || duplicates.length <= 1) {
    return { success: true, mergedCount: 0, filesPreserved: 0 };
  }

  const [primary, ...dupes] = duplicates;
  const dupeIds = dupes.map((d) => d.id);
  let filesPreserved = 0;

  // Move all files from duplicates into the primary folder
  for (const dupeId of dupeIds) {
    const { data: moved, error: moveError } = await supabase
      .from("documents")
      .update({ folder_id: primary.id })
      .eq("folder_id", dupeId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select("id");

    if (moveError) {
      console.error(`[merge] Failed to move files from folder ${dupeId}:`, moveError.message);
    } else {
      filesPreserved += moved?.length || 0;
    }
  }

  // Delete the now-empty duplicate folders
  const { error: deleteError } = await supabase
    .from("folders")
    .delete()
    .in("id", dupeIds)
    .eq("user_id", user.id);

  if (deleteError) {
    throw new Error(`Failed to delete duplicate folders: ${deleteError.message}`);
  }

  console.log(`[merge] Subject ${subjectId}: merged "${folderName}" — kept ${primary.id}, removed ${dupeIds.length} dupes, preserved ${filesPreserved} files`);

  return { success: true, mergedCount: dupeIds.length, filesPreserved };
}
