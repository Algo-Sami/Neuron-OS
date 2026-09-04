import { SupabaseClient } from '@supabase/supabase-js';
import { SubjectClassifier } from '@/services/classification/classifier';

export interface ExistingFileInfo {
  id: string;
  name: string;
  subjectName?: string | null;
  folderName?: string | null;
  size?: number | null;
  createdAt?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingFile?: ExistingFileInfo;
  suggestedCopyName?: string;
  resolvedSubjectId?: string | null;
  resolvedFolderId?: string | null;
}

/**
 * Normalizes a filename for case-insensitive and whitespace-resilient comparison.
 * Collapses multiple spaces and trims outer whitespace.
 */
export function normalizeFilename(filename: string): string {
  if (!filename) return '';
  return filename
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Extracts base filename removing any copy numbering suffixes.
 * E.g. "Payment Receipt - KHADIJA BIBI (1).pdf" -> "Payment Receipt - KHADIJA BIBI.pdf"
 */
export function extractBaseFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDotIndex = trimmed.lastIndexOf('.');

  let baseName = trimmed;
  let extension = '';

  if (lastDotIndex > 0) {
    baseName = trimmed.slice(0, lastDotIndex);
    extension = trimmed.slice(lastDotIndex);
  }

  // Remove copy pattern "(1)", "(2)", etc.
  const copyMatch = baseName.match(/^(.*?)\s*\(\d+\)$/);
  if (copyMatch && copyMatch[1]) {
    baseName = copyMatch[1].trim();
  }

  return `${baseName}${extension}`;
}

/**
 * Generates a numbered copy filename preserving the original extension.
 * E.g. "Lecture 1.pdf" + 1 -> "Lecture 1 (1).pdf"
 * E.g. "Lecture 1 (1).pdf" + 2 -> "Lecture 1 (2).pdf"
 */
export function generateCopyFilename(originalName: string, copyIndex: number): string {
  const trimmed = originalName.trim();
  const lastDotIndex = trimmed.lastIndexOf('.');

  let baseName = trimmed;
  let extension = '';

  if (lastDotIndex > 0) {
    baseName = trimmed.slice(0, lastDotIndex);
    extension = trimmed.slice(lastDotIndex);
  }

  // If baseName already ends with a pattern like " (1)", extract the root
  const existingCopyMatch = baseName.match(/^(.*?)\s*\(\d+\)$/);
  if (existingCopyMatch && existingCopyMatch[1]) {
    baseName = existingCopyMatch[1].trim();
  }

  return `${baseName} (${copyIndex})${extension}`;
}

/**
 * Finds the next available safe copy filename in the target folder or subject.
 * Incrementally checks "(1)", "(2)", "(3)" until a name is not taken.
 */
export async function findNextAvailableCopyName(
  supabase: SupabaseClient,
  userId: string,
  folderId: string | null,
  originalFileName: string,
  subjectId?: string | null
): Promise<string> {
  let copyIndex = 1;
  const maxAttempts = 100;

  while (copyIndex <= maxAttempts) {
    const candidateName = generateCopyFilename(originalFileName, copyIndex);
    const normalizedCandidate = normalizeFilename(candidateName);

    let query = supabase
      .from('documents')
      .select('id, title')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .ilike('title', candidateName);

    if (folderId) {
      query = query.eq('folder_id', folderId);
    } else if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }

    const { data: existing } = await query;

    const hasMatch = (existing || []).some(
      (d: { title: string }) => normalizeFilename(d.title) === normalizedCandidate
    );

    if (!hasMatch) {
      return candidateName;
    }

    copyIndex++;
  }

  // Fallback if somehow 100 copies exist
  return `${originalFileName} (${Date.now()})`;
}

/**
 * Checks whether a document with the same normalized name already exists
 * for the authenticated user anywhere in the destination folder, subject, or workspace.
 */
export async function checkDuplicateUpload(
  supabase: SupabaseClient,
  userId: string,
  params: {
    fileName: string;
    subjectId?: string;
    folderId?: string;
    currentSubjectId?: string;
  }
): Promise<DuplicateCheckResult> {
  const { fileName, subjectId, folderId, currentSubjectId } = params;

  if (!fileName || !fileName.trim()) {
    return { isDuplicate: false };
  }

  // 1. Resolve Subject & Folder (Explicit selection takes priority, bypassing classification layers)
  let resolvedSubjectId = subjectId || currentSubjectId || null;
  let resolvedFolderId: string | null = folderId || null;

  // Run classification only if no explicit subject was provided
  const classification = resolvedSubjectId
    ? null
    : await SubjectClassifier.classify(
        {
          userId,
          filename: fileName,
          subjectId,
          folderId,
          currentSubjectId,
        },
        { supabase }
      );

  if (!resolvedSubjectId && classification) {
    resolvedSubjectId = classification.subjectId;
  }

  if (resolvedSubjectId && !resolvedFolderId) {
    const targetFolderName = classification?.folderName || 'Lectures';

      if (targetFolderName === 'Lab' && classification?.labSubfolderName) {
        // Resolve Lab root
        const { data: labParent } = await supabase
          .from('folders')
          .select('id')
          .eq('user_id', userId)
          .eq('subject_id', resolvedSubjectId)
          .ilike('name', 'Lab')
          .is('parent_folder_id', null)
          .maybeSingle();

        if (labParent) {
          const { data: labChild } = await supabase
            .from('folders')
            .select('id')
            .eq('user_id', userId)
            .eq('subject_id', resolvedSubjectId)
            .eq('parent_folder_id', labParent.id)
            .ilike('name', classification.labSubfolderName)
            .maybeSingle();

          if (labChild) {
            resolvedFolderId = labChild.id;
          }
        }
      } else {
        // Non-lab folder
        const { data: existingFolder } = await supabase
          .from('folders')
          .select('id')
          .eq('user_id', userId)
          .eq('subject_id', resolvedSubjectId)
          .ilike('name', targetFolderName)
          .is('parent_folder_id', null)
          .maybeSingle();

        if (existingFolder) {
          resolvedFolderId = existingFolder.id;
        }
      }
    }

  // 2. Comprehensive Workspace & Subject Duplicate Query
  // Query all active documents for this user matching the target filename.
  // This catches:
  //   - Files in the exact destination folder
  //   - Files in another folder of the same subject (e.g. In Assignments instead of Lectures)
  //   - Files in the user's workspace
  const normalizedTarget = normalizeFilename(fileName);

  const { data: existingDocs, error } = await supabase
    .from('documents')
    .select('id, title, size, file_type, created_at, subject_id, folder_id, subjects(name), folders(name)')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .ilike('title', fileName.trim());

  if (error) {
    console.warn('[DuplicateDetection] Error querying existing documents:', error.message);
    return { isDuplicate: false, resolvedSubjectId, resolvedFolderId };
  }

  const matchingDocs = (existingDocs || []).filter((d: any) => {
    return normalizeFilename(d.title) === normalizedTarget;
  });

  if (matchingDocs.length > 0) {
    // Priority 1: Match in the exact target folder (if folder was explicitly specified or resolved)
    let duplicateDoc = resolvedFolderId
      ? matchingDocs.find((d: any) => d.folder_id === resolvedFolderId)
      : null;

    // Priority 2: Match in the resolved subject (even if located in another folder like Assignments)
    if (!duplicateDoc && resolvedSubjectId) {
      duplicateDoc = matchingDocs.find((d: any) => d.subject_id === resolvedSubjectId) || null;
    }

    // Priority 3: Any match in workspace
    if (!duplicateDoc) {
      duplicateDoc = matchingDocs[0];
    }

    if (duplicateDoc) {
      // If the duplicate file is already organized in a specific folder/subject and caller didn't pass explicit target,
      // preserve that folder context so the user gets accurate feedback and consistent copy placement!
      if (!folderId && duplicateDoc.folder_id) {
        resolvedFolderId = duplicateDoc.folder_id;
      }
      if (!subjectId && duplicateDoc.subject_id) {
        resolvedSubjectId = duplicateDoc.subject_id;
      }

      const suggestedCopyName = await findNextAvailableCopyName(
        supabase,
        userId,
        resolvedFolderId,
        fileName,
        resolvedSubjectId
      );

      const subjectName = Array.isArray(duplicateDoc.subjects)
        ? duplicateDoc.subjects[0]?.name
        : (duplicateDoc.subjects as any)?.name || classification?.subjectName || null;

      const folderName = Array.isArray(duplicateDoc.folders)
        ? duplicateDoc.folders[0]?.name
        : (duplicateDoc.folders as any)?.name || classification?.folderName || null;

      return {
        isDuplicate: true,
        existingFile: {
          id: duplicateDoc.id,
          name: duplicateDoc.title,
          subjectName,
          folderName,
          size: duplicateDoc.size,
          createdAt: duplicateDoc.created_at,
        },
        suggestedCopyName,
        resolvedSubjectId,
        resolvedFolderId,
      };
    }
  }

  return {
    isDuplicate: false,
    resolvedSubjectId,
    resolvedFolderId,
  };
}
