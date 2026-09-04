"use server"

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { awardXP } from '@/services/gamification/rewards'
import { scaffoldSubjectFoldersAction } from '@/actions/folders'
import { dispatchStudyPackGeneration } from '@/services/ai/pipeline/study-pack-dispatcher'
import { SubjectClassifier } from '@/services/classification/classifier'
import { ClassificationLearningService } from '@/services/classification/learning-service'
import { 
  checkDuplicateUpload, 
  findNextAvailableCopyName,
  extractBaseFileName,
} from '@/services/storage/duplicate-detection'

export type SaveUploadMetadataResponse = {
  success: true;
  documentId: string;
  subjectId: string | null;
  subjectName: string | null;
  folderName: string | null;
  labSubfolderName: string | null;
  confidence: number;
  classificationStatus: 'auto_applied' | 'needs_review';
  method?: string;
} | {
  success: false;
  code: 'DUPLICATE_FILE' | 'AUTH_ERROR' | 'VALIDATION_ERROR' | 'STORAGE_ERROR' | 'UNKNOWN_ERROR';
  message: string;
  existingFile?: {
    id: string;
    name: string;
    subjectName?: string | null;
    folderName?: string | null;
    size?: number | null;
    createdAt?: string;
  };
  suggestedCopyName?: string;
};

/**
 * Preflight action to check for duplicate file in the target destination
 * before uploading file bytes to storage.
 */
export async function checkDuplicateUploadAction(params: {
  fileName: string;
  subjectId?: string;
  folderId?: string;
  currentSubjectId?: string;
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      success: false as const,
      code: 'AUTH_ERROR' as const,
      message: 'Please log in to upload files.',
      isDuplicate: false,
    };
  }

  const result = await checkDuplicateUpload(supabase, user.id, params);
  return {
    success: true as const,
    ...result,
  };
}

export async function saveUploadMetadata({
  fileName,
  fileUrl,
  fileType,
  fileSize,
  subjectId,
  folderId,
  currentSubjectId,
}: {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  subjectId?: string;
  folderId?: string;
  currentSubjectId?: string;
}): Promise<SaveUploadMetadataResponse> {
  const t0 = performance.now();
  console.log(`[UploadTiming] saveUploadMetadata START for "${fileName}"`);
  const supabase = await createClient()

  // 1. Authenticate Request
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return {
      success: false,
      code: 'AUTH_ERROR',
      message: 'Unauthorized. Please log in to upload files.',
    };
  }

  // 1b. Application-level Duplicate Preflight Guard
  const duplicateCheck = await checkDuplicateUpload(supabase, user.id, {
    fileName,
    subjectId,
    folderId,
    currentSubjectId,
  });

  if (duplicateCheck.isDuplicate) {
    console.log(`[Upload Routing] Duplicate file detected for "${fileName}" in destination`);
    return {
      success: false,
      code: 'DUPLICATE_FILE',
      message: 'A file with this name already exists in this location.',
      existingFile: duplicateCheck.existingFile,
      suggestedCopyName: duplicateCheck.suggestedCopyName,
    };
  }

  // 2. Resolve destination Subject & Folder (Explicit selection takes priority)
  let resolvedSubjectId: string | null = subjectId || currentSubjectId || null;
  let resolvedFolderId: string | null = folderId || null;
  let classificationStatus: 'auto_applied' | 'needs_review' = resolvedSubjectId ? 'auto_applied' : 'needs_review';

  // Fallback to classifier only if no explicit subject was provided
  const classification = resolvedSubjectId
    ? {
        subjectId: resolvedSubjectId,
        folderName: null,
        confidence: 1.0,
        method: 'explicit_selection',
        reason: 'User selected subject directly',
        subjectName: null,
        labSubfolderName: null,
      }
    : await SubjectClassifier.classify(
        {
          userId: user.id,
          filename: fileName,
          subjectId,
          folderId,
          currentSubjectId,
        },
        { supabase }
      );

  if (!resolvedSubjectId && classification.subjectId) {
    resolvedSubjectId = classification.subjectId;
    classificationStatus = classification.confidence >= 0.90 ? 'auto_applied' : 'needs_review';
  }

  // 3. Resolve Folder if subject is identified
  if (resolvedSubjectId) {
    if (resolvedFolderId) {
      // User explicitly selected destination folder
    } else {
      let targetFolderName = classification.folderName || 'Lectures';

      // If classification did not find an explicit keyword folder (e.g. for receipts, generic documents),
      // check if a base version of this file was previously organized in a specific folder in this subject
      if (!targetFolderName && resolvedSubjectId) {
        const baseTitle = extractBaseFileName(fileName);
        const { data: existingBaseDoc } = await supabase
          .from('documents')
          .select('folder_id, folders(name)')
          .eq('user_id', user.id)
          .eq('subject_id', resolvedSubjectId)
          .is('deleted_at', null)
          .ilike('title', baseTitle)
          .maybeSingle();

        if (existingBaseDoc?.folder_id) {
          resolvedFolderId = existingBaseDoc.folder_id;
          targetFolderName = (existingBaseDoc.folders as any)?.name || null;
        }
      }

      if (!targetFolderName && !resolvedFolderId) {
        targetFolderName = 'Lectures';
      }

      if (!resolvedFolderId) {
        if (targetFolderName === "Lab" && classification.labSubfolderName) {
          let labParentId: string | null = null

          // Check if root-level "Lab" folder exists
          const { data: existingLabParent } = await supabase
            .from('folders')
            .select('id')
            .eq('user_id', user.id)
            .eq('subject_id', resolvedSubjectId)
            .ilike('name', 'Lab')
            .is('parent_folder_id', null)
            .maybeSingle()

          if (existingLabParent) {
            labParentId = existingLabParent.id
          } else {
            const { data: newLabParent, error: parentError } = await supabase
              .from('folders')
              .insert({
                user_id: user.id,
                subject_id: resolvedSubjectId,
                parent_folder_id: null,
                name: "Lab"
              })
              .select('id')
              .single()

            if (!parentError && newLabParent) {
              labParentId = newLabParent.id
              console.log(`[Upload Routing] Created parent "Lab" folder (id=${labParentId})`);
            } else {
              console.error("[Upload Routing] Failed to create Lab parent folder:", parentError)
            }
          }

          // Check if child Lab subfolder exists (e.g. "Lab Tasks", "Lab Manuals", "Other Lab Files")
          if (labParentId) {
            const { data: existingChild } = await supabase
              .from('folders')
              .select('id')
              .eq('user_id', user.id)
              .eq('subject_id', resolvedSubjectId)
              .eq('parent_folder_id', labParentId)
              .ilike('name', classification.labSubfolderName)
              .maybeSingle()

            if (existingChild) {
              resolvedFolderId = existingChild.id
            } else {
              const { data: newChild, error: childError } = await supabase
                .from('folders')
                .insert({
                  user_id: user.id,
                  subject_id: resolvedSubjectId,
                  parent_folder_id: labParentId,
                  name: classification.labSubfolderName
                })
                .select('id')
                .single()

              if (!childError && newChild) {
                resolvedFolderId = newChild.id
                console.log(`[Upload Routing] Created child lab folder "${classification.labSubfolderName}" (id=${resolvedFolderId})`);
              } else if (childError) {
                console.error(`[Upload Routing] Failed to create child lab folder ${classification.labSubfolderName}:`, childError)
              }
            }
          }
        } else if (targetFolderName) {
          // Check if regular root folder exists (e.g. "Lectures", "Assignments", "Presentations")
          const { data: existingFolder } = await supabase
            .from('folders')
            .select('id')
            .eq('user_id', user.id)
            .eq('subject_id', resolvedSubjectId)
            .ilike('name', targetFolderName)
            .is('parent_folder_id', null)
            .maybeSingle()

          if (existingFolder) {
            resolvedFolderId = existingFolder.id
          } else {
            const { data: newFolder, error: folderErr } = await supabase
              .from('folders')
              .insert({
                user_id: user.id,
                subject_id: resolvedSubjectId,
                parent_folder_id: null,
                name: targetFolderName
              })
              .select('id')
              .single()

            if (!folderErr && newFolder) {
              resolvedFolderId = newFolder.id
              console.log(`[Upload Routing] Created folder: "${targetFolderName}" (id=${resolvedFolderId})`);
            } else if (folderErr) {
              console.error(`[Upload Routing] Failed to create folder ${targetFolderName}:`, folderErr)
            }
          }
        }
      }
    }
  }

  // 3b. Scaffold root folders (including "AI Generated") immediately
  if (resolvedSubjectId) {
    try {
      await scaffoldSubjectFoldersAction(resolvedSubjectId);
    } catch (scaffoldErr) {
      console.warn('[Upload Routing] Subject scaffolding warning (non-fatal):', scaffoldErr);
    }
  }

  // 4. Insert into uploads audit table
  // Try with full snapshot columns first; fall back to baseline if migration not yet applied
  let resolvedSubjectName = classification.subjectName || null;
  if (!resolvedSubjectName && resolvedSubjectId) {
    const { data: sub } = await supabase.from('subjects').select('name').eq('id', resolvedSubjectId).maybeSingle();
    resolvedSubjectName = sub?.name || null;
  }
  let resolvedFolderName = classification.folderName || null;
  if (!resolvedFolderName && resolvedFolderId) {
    const { data: fold } = await supabase.from('folders').select('name').eq('id', resolvedFolderId).maybeSingle();
    resolvedFolderName = fold?.name || null;
  }

  const baseUploadPayload = {
    user_id: user.id,
    file_name: fileName,
    file_url: fileUrl,
    file_type: fileType,
    file_size: fileSize,
    status: 'completed',
  };

  let uploadResult: any;
  let uploadError: any;

  // Attempt insert with extended snapshot columns
  const { data: extData, error: extErr } = await supabase
    .from('uploads')
    .insert({
      ...baseUploadPayload,
      subject_id: resolvedSubjectId,
      subject_name: resolvedSubjectName,
      folder_id: resolvedFolderId,
      folder_name: resolvedFolderName,
      ai_subject: resolvedSubjectName,
      ai_topic: classification.labSubfolderName || resolvedFolderName || 'Lectures',
    })
    .select()
    .single();

  if (extErr && (extErr.code === 'PGRST204' || extErr.message?.includes('schema cache') || extErr.message?.includes('column'))) {
    // Migration not yet applied — fall back to baseline columns only
    console.warn('[Upload Routing] Extended upload columns unavailable (migration pending), falling back to baseline insert');
    const { data: baseData, error: baseErr } = await supabase
      .from('uploads')
      .insert(baseUploadPayload)
      .select()
      .single();
    uploadResult = baseData;
    uploadError = baseErr;
  } else {
    uploadResult = extData;
    uploadError = extErr;
  }

  if (uploadError) {
    console.error('[Upload Routing] Failed to log upload:', uploadError);
    return {
      success: false,
      code: 'UNKNOWN_ERROR',
      message: `Failed to log upload: ${uploadError.message}`,
    };
  }

  // 5. Insert into primary documents table
  const { data: docResult, error: docError } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      upload_id: uploadResult.id,
      subject_id: resolvedSubjectId,
      folder_id: resolvedFolderId,
      title: fileName,
      file_url: fileUrl,
      file_type: fileType,
      size: fileSize,
      ai_subject: classification.subjectName || null,
      ai_topic: classification.labSubfolderName || classification.folderName || 'Lectures',
      classification_confidence: classification.confidence,
      classification_status: classificationStatus,
      summary_status: 'pending',
      quiz_status: 'pending'
    })
    .select()
    .single()

  if (docError) {
    // Check if error is due to database unique constraint (race condition or duplicate index)
    if (
      docError.code === '23505' ||
      docError.message?.includes('idx_documents_unique_folder_title') ||
      docError.message?.toLowerCase().includes('unique constraint')
    ) {
      console.warn(`[Upload Routing] Race-condition unique constraint conflict caught for "${fileName}"`);
      const suggestedCopyName = await findNextAvailableCopyName(
        supabase,
        user.id,
        resolvedFolderId,
        fileName
      );

      return {
        success: false,
        code: 'DUPLICATE_FILE',
        message: 'A file with this name already exists in this location.',
        existingFile: {
          id: '',
          name: fileName,
          subjectName: classification.subjectName || null,
          folderName: classification.folderName || null,
          size: fileSize,
        },
        suggestedCopyName,
      };
    }

    console.error(`[Upload Routing] Failed to create document:`, docError);
    return {
      success: false,
      code: 'UNKNOWN_ERROR',
      message: `Failed to create document: ${docError.message}`,
    };
  }

  // 6. Record classification event for audit trail and continuous learning
  ClassificationLearningService.recordEvent(supabase, {
    documentId: docResult.id,
    userId: user.id,
    predictedSubjectId: classification.subjectId,
    finalSubjectId: resolvedSubjectId,
    confidence: classification.confidence,
    method: classification.method,
    userCorrected: false,
    reason: classification.reason,
  }).catch((err) => console.warn('[Upload Routing] Failed to record classification event:', err));

  // 7. Automatically dispatch background study pack generation to BullMQ queue.
  //    Only dispatched when the document is assigned to a "Lectures" folder.
  //    Assignments, Quizzes, Lab, and unclassified documents do NOT trigger AI pipeline.
  const targetFolder = resolvedFolderName || classification.folderName || 'Lectures';
  const isLectureFolder = /lecture/i.test(targetFolder);

  if (resolvedSubjectId && isLectureFolder) {
    try {
      const dispatchRes = await dispatchStudyPackGeneration({
        supabase,
        userId: user.id,
        documentId: docResult.id,
        fileUrl,
        fileType,
        force: false,
      });
      console.log(`[Upload Routing] Auto-dispatched study pack generation: status=${dispatchRes.status}, jobId=${dispatchRes.jobId}`);
    } catch (err) {
      // Non-throwing: a redis/queue glitch must never abort a successful upload
      console.warn('[Upload Routing] Exception while auto-dispatching background study pack task:', err);
    }
  } else if (!resolvedSubjectId) {
    console.log(`[Upload Routing] Skipping study pack dispatch — document "${docResult.id}" has no subject yet. AI processing will start after user assigns a subject.`);
  } else {
    console.log(`[Upload Routing] Skipping study pack dispatch — document "${docResult.id}" is in "${targetFolder}" folder (only Lectures trigger automatic AI study packs).`);
  }

  // Award XP for uploading study materials (non-blocking)
  awardXP(user.id, 'upload_notes').catch((xpError) => {
    console.error("Failed to award upload XP:", xpError);
  });

  // Revalidate views
  revalidatePath('/uploads')
  revalidatePath('/subjects')
  revalidatePath('/dashboard')
  if (resolvedSubjectId) {
    revalidatePath(`/subjects/${resolvedSubjectId}`)
  }
  
  console.log(`[UploadTiming] saveUploadMetadata COMPLETED in ${(performance.now() - t0).toFixed(0)}ms for document ${docResult.id}`);
  return {
    success: true,
    documentId: docResult.id,
    subjectId: resolvedSubjectId,
    subjectName: resolvedSubjectName || classification.subjectName || null,
    folderName: resolvedFolderName || classification.folderName || (resolvedSubjectId ? 'Lectures' : null),
    labSubfolderName: classification.labSubfolderName || null,
    confidence: classification.confidence,
    classificationStatus: classificationStatus,
    method: classification.method,
  };
}

import * as path from 'path'

/**
 * Safely extracts and validates a relative bucket path from a storage URL or path string.
 * Guards against external URLs and directory traversal attacks.
 */
export async function extractTrustedStoragePath(
  fileUrlOrPath: string | null | undefined,
  userId: string,
  bucketName: string = 'documents'
): Promise<string | null> {
  if (!fileUrlOrPath || typeof fileUrlOrPath !== 'string') return null;
  const trimmed = fileUrlOrPath.trim();
  if (!trimmed) return null;

  try {
    // 1. If it's a Supabase storage public URL containing `/${bucketName}/`
    if (trimmed.includes(`/${bucketName}/`)) {
      const parts = trimmed.split(`/${bucketName}/`);
      const relativePart = decodeURIComponent(parts[1]?.split('?')[0] || '').trim();
      // Ensure path begins with the user's directory for multi-tenant isolation
      if (relativePart && (relativePart.startsWith(`${userId}/`) || relativePart.startsWith(userId))) {
        return relativePart;
      }
      if (relativePart && !relativePart.startsWith('http://') && !relativePart.startsWith('https://')) {
        return relativePart;
      }
    }

    // 2. If it's already a relative path starting with userId/
    if (trimmed.startsWith(`${userId}/`)) {
      return trimmed;
    }

    // 3. If it's an external third-party URL (e.g. Google Drive, AWS, Unsplash), never attempt storage deletion
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl) {
        const cleanHost = supabaseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (trimmed.includes(cleanHost)) {
          const urlParts = trimmed.split('/');
          const fileName = decodeURIComponent(urlParts[urlParts.length - 1]?.split('?')[0] || '');
          if (fileName) return `${userId}/${fileName}`;
        }
      }
      // External URL — strictly return null to prevent accidental external calls
      return null;
    }

    // 4. Relative filename fallback: format as userId/filename
    const cleanFileName = path.basename(trimmed).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (cleanFileName) {
      return `${userId}/${cleanFileName}`;
    }
  } catch (err) {
    console.warn('[extractTrustedStoragePath] Path extraction warning:', err);
  }

  return null;
}

/**
 * Centrally and safely deletes an object from Supabase Storage.
 * Validates ownership, checks path integrity, and handles external URLs gracefully.
 */
export async function safelyDeleteStorageObject(
  supabase: any,
  fileUrlOrPath: string | null | undefined,
  userId: string,
  bucketName: string = 'documents'
): Promise<{ deleted: boolean; path?: string; reason?: string }> {
  const storagePath = await extractTrustedStoragePath(fileUrlOrPath, userId, bucketName);
  if (!storagePath) {
    return { deleted: false, reason: 'No trusted local storage path (possibly external URL or invalid path)' };
  }

  try {
    const { error } = await supabase.storage.from(bucketName).remove([storagePath]);
    if (error) {
      console.warn(`[safelyDeleteStorageObject] Storage removal error for "${storagePath}":`, error.message);
      return { deleted: false, path: storagePath, reason: error.message };
    }
    return { deleted: true, path: storagePath };
  } catch (err: any) {
    console.warn(`[safelyDeleteStorageObject] Exception removing "${storagePath}":`, err?.message);
    return { deleted: false, path: storagePath, reason: err?.message || 'Storage exception' };
  }
}

/**
 * Restores all AI-generated assets linked to a source document in lockstep.
 * Idempotent: setting deleted_at = null on already restored assets is a safe no-op.
 */
export async function restoreAssociatedAiDocuments(
  supabase: any,
  userId: string,
  documentId: string,
  docTitle?: string | null,
  subjectId?: string | null
): Promise<void> {
  try {
    const docShortId = documentId.substring(0, 8);
    const cleanDocTitle = docTitle ? docTitle.replace(/\.[^/.]+$/, '').trim() : '';

    let targetFolderIds: string[] = [];
    if (subjectId && cleanDocTitle) {
      const { data: allFolders } = await supabase
        .from('folders')
        .select('id, name, parent_folder_id')
        .eq('user_id', userId)
        .eq('subject_id', subjectId);

      if (allFolders) {
        const aiRootIds = new Set(
          allFolders
            .filter((f: { parent_folder_id: string | null; name: string }) => f.parent_folder_id === null && f.name.trim().toLowerCase() === 'ai generated')
            .map((f: { id: string }) => f.id)
        );
        const aiCatIds = new Set(
          allFolders
            .filter((f: { parent_folder_id: string | null; id: string }) => f.parent_folder_id !== null && aiRootIds.has(f.parent_folder_id))
            .map((f: { id: string }) => f.id)
        );
        targetFolderIds = allFolders
          .filter((f: { parent_folder_id: string | null; name: string; id: string }) => f.parent_folder_id !== null && aiCatIds.has(f.parent_folder_id) && f.name.trim().toLowerCase() === cleanDocTitle.toLowerCase())
          .map((f: { id: string }) => f.id);
      }
    }

    if (targetFolderIds.length > 0) {
      await supabase
        .from('documents')
        .update({ deleted_at: null })
        .in('folder_id', targetFolderIds)
        .eq('user_id', userId);
    }

    // Restore documents tagged with source_doc
    await supabase
      .from('documents')
      .update({ deleted_at: null })
      .eq('user_id', userId)
      .contains('tags', [`source_doc:${documentId}`]);

    // Restore documents with storage path hash
    await supabase
      .from('documents')
      .update({ deleted_at: null })
      .eq('user_id', userId)
      .eq('ai_doc_type', 'ai_generated')
      .ilike('file_url', `%ai-gen-%${docShortId}%`);
  } catch (syncErr) {
    console.warn('[restoreAssociatedAiDocuments] AI document sync restore warning:', syncErr);
  }
}

/**
 * Permanently removes all AI-generated resources linked to a specific document:
 * 1. AI-generated summary/quiz/flashcard/notes document rows in `documents`
 * 2. Generated PDF files in Supabase storage (`documents` bucket)
 * 3. The dedicated document subfolder under `AI Generated / <Category>` in `folders` table
 * 4. AI metadata tables: `ai_summaries`, `knowledge_assets`, `quizzes`, `flashcards`, `document_chunks`, `document_knowledge`, `background_tasks`, `asset_generation_jobs`
 */
export async function cleanupAiGeneratedResources(
  supabase: any,
  userId: string,
  subjectId: string | null | undefined,
  docTitle: string | null | undefined,
  documentId: string
) {
  try {
    const cleanDocTitle = docTitle ? docTitle.replace(/\.[^/.]+$/, '').trim() : '';

    // 1. Find AI-generated documents related to this source document
    const aiDocIds = new Set<string>();
    const storagePathsToDelete: string[] = [];

    // 1a. Query documents with source_doc tag
    const { data: taggedDocs } = await supabase
      .from('documents')
      .select('id, file_url, folder_id')
      .eq('user_id', userId)
      .contains('tags', [`source_doc:${documentId}`]);

    if (taggedDocs) {
      for (const d of taggedDocs) {
        aiDocIds.add(d.id);
        if (d.file_url) storagePathsToDelete.push(d.file_url);
      }
    }

    // 1b. Query documents with storage paths matching document ID short hash
    const docShortId = documentId.substring(0, 8);
    const { data: matchedDocs } = await supabase
      .from('documents')
      .select('id, file_url, folder_id')
      .eq('user_id', userId)
      .eq('ai_doc_type', 'ai_generated')
      .ilike('file_url', `%ai-gen-%${docShortId}%`);

    if (matchedDocs) {
      for (const d of matchedDocs) {
        aiDocIds.add(d.id);
        if (d.file_url) storagePathsToDelete.push(d.file_url);
      }
    }

    // 1c. Query AI Generated folder hierarchy if subjectId is known (or query all AI Generated folders for user)
    let folderQuery = supabase
      .from('folders')
      .select('id, name, parent_folder_id, subject_id')
      .eq('user_id', userId);

    if (subjectId) {
      folderQuery = folderQuery.eq('subject_id', subjectId);
    }

    const { data: allUserFolders } = await folderQuery;

    const docSubfolderIdsToDelete: string[] = [];

    if (allUserFolders && allUserFolders.length > 0) {
      // Find root "AI Generated" folders (parent_folder_id === null)
      const aiRootFolderIds = new Set(
        allUserFolders
          .filter((f: { parent_folder_id: string | null; name: string }) => f.parent_folder_id === null && f.name.trim().toLowerCase() === 'ai generated')
          .map((f: { id: string }) => f.id)
      );

      // Find category folders under AI Generated
      const aiCategoryFolderIds = new Set(
        allUserFolders
          .filter((f: { parent_folder_id: string | null; id: string }) => f.parent_folder_id !== null && aiRootFolderIds.has(f.parent_folder_id))
          .map((f: { id: string }) => f.id)
      );

      // Find document-level subfolders under category folders
      const docSubfolders = allUserFolders.filter(
        (f: { parent_folder_id: string | null }) => f.parent_folder_id !== null && aiCategoryFolderIds.has(f.parent_folder_id)
      );

      for (const sub of docSubfolders) {
        const isNameMatch = cleanDocTitle && sub.name.trim().toLowerCase() === cleanDocTitle.toLowerCase();
        
        if (isNameMatch) {
          docSubfolderIdsToDelete.push(sub.id);
          
          // Find all documents in this subfolder and mark for deletion
          const { data: folderDocs } = await supabase
            .from('documents')
            .select('id, file_url')
            .eq('user_id', userId)
            .eq('folder_id', sub.id);

          if (folderDocs) {
            for (const fd of folderDocs) {
              aiDocIds.add(fd.id);
              if (fd.file_url) storagePathsToDelete.push(fd.file_url);
            }
          }
        }
      }
    }

    // 2. Safely delete storage files using centralized helper
    for (const fileUrl of storagePathsToDelete) {
      await safelyDeleteStorageObject(supabase, fileUrl, userId, 'documents');
    }

    // Also remove any files from storage with docShortId pattern directly
    try {
      const { data: storageList } = await supabase.storage
        .from('documents')
        .list(userId, { search: `ai-gen-` });

      if (storageList && storageList.length > 0) {
        const filesToPurge = storageList
          .filter((item: { name: string }) => item.name.includes(`-${docShortId}-`))
          .map((item: { name: string }) => `${userId}/${item.name}`);

        if (filesToPurge.length > 0) {
          await supabase.storage.from('documents').remove(filesToPurge);
        }
      }
    } catch (storageScanErr) {
      console.warn('[cleanupAiGeneratedResources] Storage scan cleanup warning:', storageScanErr);
    }

    // 3. Delete AI generated document rows
    if (aiDocIds.size > 0) {
      await supabase
        .from('documents')
        .delete()
        .in('id', Array.from(aiDocIds))
        .eq('user_id', userId);
    }

    // 4. Delete the document-level subfolders under AI Generated
    if (docSubfolderIdsToDelete.length > 0) {
      await supabase
        .from('folders')
        .delete()
        .in('id', docSubfolderIdsToDelete)
        .eq('user_id', userId);
    }

    // 5. Delete from all AI metadata tables
    await Promise.allSettled([
      supabase.from('ai_summaries').delete().eq('document_id', documentId),
      supabase.from('knowledge_assets').delete().eq('document_id', documentId),
      supabase.from('quizzes').delete().eq('document_id', documentId),
      supabase.from('flashcards').delete().eq('document_id', documentId),
      supabase.from('document_chunks').delete().eq('document_id', documentId),
      supabase.from('document_knowledge').delete().eq('document_id', documentId),
      supabase.from('background_tasks').delete().eq('document_id', documentId),
      supabase.from('asset_generation_jobs').delete().eq('document_id', documentId),
    ]);
  } catch (err) {
    console.warn('[cleanupAiGeneratedResources] Error during cleanup:', err);
  }
}

export async function deleteUpload(uploadId: string, documentId: string, fileUrl: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Safely remove primary file from storage bucket if present
  if (fileUrl) {
    await safelyDeleteStorageObject(supabase, fileUrl, user.id, 'documents');
  }

  // Explicitly delete AI generated summaries, knowledge assets, subfolders, and documents
  if (documentId) {
    let docTitle: string | null = null;
    let subjectId: string | null = null;
    let folderId: string | null = null;
    let aiSubject: string | null = null;
    let aiTopic: string | null = null;

    try {
      const { data: doc } = await supabase
        .from('documents')
        .select('title, subject_id, folder_id, ai_subject, ai_topic, upload_id')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (doc) {
        docTitle = doc.title;
        subjectId = doc.subject_id;
        folderId = doc.folder_id;
        aiSubject = doc.ai_subject;
        aiTopic = doc.ai_topic;
        if (!uploadId && doc.upload_id) uploadId = doc.upload_id;
      }
    } catch (fetchErr) {
      console.warn('[deleteUpload] Error fetching document info:', fetchErr);
    }

    await cleanupAiGeneratedResources(supabase, user.id, subjectId, docTitle, documentId);

    // Delete primary document row
    await supabase.from('documents').delete().eq('id', documentId).eq('user_id', user.id);

    // PRESERVE the uploads audit row with subject & folder snapshots
    if (uploadId) {
      let subjectName = aiSubject;
      if (!subjectName && subjectId) {
        const { data: sub } = await supabase.from('subjects').select('name').eq('id', subjectId).maybeSingle();
        subjectName = sub?.name || null;
      }
      let folderName = aiTopic;
      if (!folderName && folderId) {
        const { data: fold } = await supabase.from('folders').select('name').eq('id', folderId).maybeSingle();
        folderName = fold?.name || null;
      }

      const { error: updExtErr } = await supabase
        .from('uploads')
        .update({
          status: 'deleted',
          deleted_at: new Date().toISOString(),
          subject_id: subjectId,
          subject_name: subjectName,
          folder_id: folderId,
          folder_name: folderName,
          ai_subject: subjectName,
          ai_topic: folderName,
        })
        .eq('id', uploadId)
        .eq('user_id', user.id);

      if (updExtErr && (updExtErr.code === 'PGRST204' || updExtErr.message?.includes('schema cache') || updExtErr.message?.includes('column'))) {
        // Migration not yet applied — fall back to baseline
        await supabase
          .from('uploads')
          .update({ status: 'deleted', deleted_at: new Date().toISOString() })
          .eq('id', uploadId)
          .eq('user_id', user.id);
      }
    }
  }

  revalidatePath('/uploads')
  revalidatePath('/summaries')
  revalidatePath('/subjects')
  revalidatePath('/recycle-bin')
  return { success: true }
}

/**
 * Permanently deletes a pending classification upload, its storage file, and its metadata.
 * Scoped strictly to the authenticated user.
 */
export async function deletePendingUpload(documentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // 1. Verify document belongs to current user
  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('id, title, subject_id, folder_id, ai_subject, ai_topic, upload_id, file_url, user_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) {
    console.error('[deletePendingUpload] Fetch error:', fetchErr);
  }

  if (!doc) {
    revalidatePath('/uploads');
    revalidatePath('/subjects');
    return { success: true };
  }

  // 2. Safely remove storage object from documents bucket
  if (doc.file_url) {
    await safelyDeleteStorageObject(supabase, doc.file_url, user.id, 'documents');
  }

  // 3. Delete AI generated summaries & knowledge assets & folders
  await cleanupAiGeneratedResources(supabase, user.id, doc.subject_id, doc.title, documentId);

  // 4. Delete from documents table
  const { error: docDeleteError } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('user_id', user.id);

  if (docDeleteError) {
    console.error('[deletePendingUpload] Failed to delete document record:', docDeleteError);
    throw new Error('Unable to delete this upload. Please try again.');
  }

  // 5. PRESERVE the uploads audit row with subject & folder snapshots
  if (doc.upload_id) {
    try {
      let subjectName = doc.ai_subject;
      if (!subjectName && doc.subject_id) {
        const { data: sub } = await supabase.from('subjects').select('name').eq('id', doc.subject_id).maybeSingle();
        subjectName = sub?.name || null;
      }
      let folderName = doc.ai_topic;
      if (!folderName && doc.folder_id) {
        const { data: fold } = await supabase.from('folders').select('name').eq('id', doc.folder_id).maybeSingle();
        folderName = fold?.name || null;
      }

      const { error: updExtErr } = await supabase
        .from('uploads')
        .update({
          status: 'deleted',
          deleted_at: new Date().toISOString(),
          subject_id: doc.subject_id,
          subject_name: subjectName,
          folder_id: doc.folder_id,
          folder_name: folderName,
          ai_subject: subjectName,
          ai_topic: folderName,
        })
        .eq('id', doc.upload_id)
        .eq('user_id', user.id);

      if (updExtErr && (updExtErr.code === 'PGRST204' || updExtErr.message?.includes('schema cache') || updExtErr.message?.includes('column'))) {
        await supabase
          .from('uploads')
          .update({ status: 'deleted', deleted_at: new Date().toISOString() })
          .eq('id', doc.upload_id)
          .eq('user_id', user.id);
      }
    } catch (uploadDelErr) {
      console.warn('[deletePendingUpload] Upload audit record mark-deleted warning:', uploadDelErr);
    }
  }

  revalidatePath('/uploads');
  revalidatePath('/summaries');
  revalidatePath('/subjects');
  revalidatePath('/recycle-bin');
  return { success: true };
}

export async function confirmAIClassification(documentId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // 1. Fetch document suggested fields
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, title, ai_subject, ai_topic, classification_confidence, file_url, file_type, upload_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (docError || !doc) {
    throw new Error('Document not found');
  }

  const suggestedSubject = doc.ai_subject?.trim();
  if (!suggestedSubject) {
    throw new Error('Please select or specify a subject before confirming.');
  }
  const suggestedTopic = doc.ai_topic || 'Lectures';

  // 2. Resolve Subject (Find existing user subject or create)
  let subjectId = null;
  const { data: existingSubject } = await supabase
    .from('subjects')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .ilike('name', suggestedSubject)
    .maybeSingle();

  if (existingSubject) {
    subjectId = existingSubject.id;
  } else {
    const { data: newSubject, error: subjectError } = await supabase
      .from('subjects')
      .insert({
        user_id: user.id,
        name: suggestedSubject,
        color: '#6366F1'
      })
      .select('id')
      .single();

    if (subjectError) throw subjectError;
    subjectId = newSubject.id;
  }

  // 3. Resolve Folder (Find or Create under Subject)
  let folderId = null;
  const { data: existingFolder } = await supabase
    .from('folders')
    .select('id')
    .eq('user_id', user.id)
    .eq('subject_id', subjectId)
    .ilike('name', suggestedTopic)
    .is('parent_folder_id', null)
    .maybeSingle();

  if (existingFolder) {
    folderId = existingFolder.id;
  } else {
    const { data: newFolder, error: folderError } = await supabase
      .from('folders')
      .insert({
        user_id: user.id,
        subject_id: subjectId,
        parent_folder_id: null,
        name: suggestedTopic
      })
      .select('id')
      .single();

    if (folderError) throw folderError;
    folderId = newFolder.id;
  }

  // 4. Update Document & sync Uploads audit record
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      subject_id: subjectId,
      folder_id: folderId,
      classification_status: 'confirmed',
      updated_at: new Date().toISOString()
    })
    .eq('id', documentId)
    .eq('user_id', user.id);

  if (updateError) throw updateError;

  // Sync to uploads audit record if linked
  if (doc.upload_id) {
    await supabase
      .from('uploads')
      .update({
        subject_id: subjectId,
        subject_name: suggestedSubject,
        folder_id: folderId,
        folder_name: suggestedTopic,
        ai_subject: suggestedSubject,
        ai_topic: suggestedTopic,
      })
      .eq('id', doc.upload_id)
      .eq('user_id', user.id);
  }

  // 5. Record classification event & learn confirmed alias
  ClassificationLearningService.recordEvent(supabase, {
    documentId: doc.id,
    userId: user.id,
    predictedSubjectId: subjectId,
    finalSubjectId: subjectId,
    confidence: doc.classification_confidence || 1.0,
    method: 'user_confirmation',
    userCorrected: false,
    reason: `User confirmed classification to "${suggestedSubject}"`,
  }).catch((err) => console.warn('[confirmAIClassification] Error recording event:', err));

  ClassificationLearningService.learnAliasFromDecision(
    supabase,
    subjectId,
    doc.title,
    'confirmed'
  ).catch((err) => console.warn('[confirmAIClassification] Error learning alias:', err));

  // 6. Now that subject is confirmed — trigger AI study pack generation
  //    This is the correct trigger point for previously-unclassified documents.
  dispatchStudyPackGeneration({
    supabase,
    userId: user.id,
    documentId: doc.id,
    fileUrl: doc.file_url,
    fileType: doc.file_type || 'pdf',
    force: false,
  }).then((res) => {
    console.log(`[confirmAIClassification] Study pack dispatched: status=${res.status}, jobId=${res.jobId}`);
  }).catch((err) => {
    console.warn('[confirmAIClassification] Study pack dispatch warning (non-fatal):', err);
  });

  revalidatePath('/uploads');
  revalidatePath('/subjects');
  if (subjectId) revalidatePath(`/subjects/${subjectId}`);
  return { success: true };
}

export async function rejectOrCustomizeClassification(
  documentId: string,
  customSubject: string,
  customTopic: string
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Fetch document for title and original predicted subject
  const { data: doc } = await supabase
    .from('documents')
    .select('id, title, ai_subject, subject_id, classification_confidence, file_url, file_type, upload_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  const cleanSubject = customSubject.trim();
  if (!cleanSubject) {
    throw new Error('Please specify a subject name.');
  }
  const cleanTopic = customTopic.trim() || 'Lectures';

  // 1. Resolve Subject (Find or Create)
  let subjectId = null;
  const { data: existingSubject } = await supabase
    .from('subjects')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .ilike('name', cleanSubject)
    .maybeSingle();

  if (existingSubject) {
    subjectId = existingSubject.id;
  } else {
    const { data: newSubject, error: subjectError } = await supabase
      .from('subjects')
      .insert({
        user_id: user.id,
        name: cleanSubject,
        color: '#F4C542'
      })
      .select('id')
      .single();

    if (subjectError) throw subjectError;
    subjectId = newSubject.id;
  }

  // 2. Resolve Folder (Find or Create under Subject)
  let folderId = null;
  const { data: existingFolder } = await supabase
    .from('folders')
    .select('id')
    .eq('user_id', user.id)
    .eq('subject_id', subjectId)
    .ilike('name', cleanTopic)
    .is('parent_folder_id', null)
    .maybeSingle();

  if (existingFolder) {
    folderId = existingFolder.id;
  } else {
    const { data: newFolder, error: folderError } = await supabase
      .from('folders')
      .insert({
        user_id: user.id,
        subject_id: subjectId,
        parent_folder_id: null,
        name: cleanTopic
      })
      .select('id')
      .single();

    if (folderError) throw folderError;
    folderId = newFolder.id;
  }

  // 3. Update Document & sync Uploads audit record
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      subject_id: subjectId,
      folder_id: folderId,
      ai_subject: cleanSubject,
      ai_topic: cleanTopic,
      classification_status: 'customized',
      updated_at: new Date().toISOString()
    })
    .eq('id', documentId)
    .eq('user_id', user.id);

  if (updateError) throw updateError;

  // Sync to uploads audit record if linked
  if (doc?.upload_id) {
    await supabase
      .from('uploads')
      .update({
        subject_id: subjectId,
        subject_name: cleanSubject,
        folder_id: folderId,
        folder_name: cleanTopic,
        ai_subject: cleanSubject,
        ai_topic: cleanTopic,
      })
      .eq('id', doc.upload_id)
      .eq('user_id', user.id);
  }

  // 4. Record classification event & learn user correction alias
  ClassificationLearningService.recordEvent(supabase, {
    documentId: doc?.id || documentId,
    userId: user.id,
    predictedSubjectId: doc?.subject_id || null,
    finalSubjectId: subjectId,
    confidence: doc?.classification_confidence || 1.0,
    method: 'user_confirmation',
    userCorrected: true,
    reason: `User customized subject to "${cleanSubject}"`,
  }).catch((err) => console.warn('[rejectOrCustomizeClassification] Error recording event:', err));

  if (doc?.title) {
    ClassificationLearningService.learnAliasFromDecision(
      supabase,
      subjectId,
      doc.title,
      'user'
    ).catch((err) => console.warn('[rejectOrCustomizeClassification] Error learning alias:', err));
  }

  // 5. Trigger AI study pack generation — only if confirmed into a Lectures folder
  const isLecture = /lecture/i.test(cleanTopic);
  if (isLecture && doc?.file_url) {
    dispatchStudyPackGeneration({
      supabase,
      userId: user.id,
      documentId: doc.id,
      fileUrl: doc.file_url,
      fileType: doc.file_type || 'pdf',
      force: false,
    }).then((res) => {
      console.log(`[rejectOrCustomizeClassification] Study pack dispatched: status=${res.status}, jobId=${res.jobId}`);
    }).catch((err) => {
      console.warn('[rejectOrCustomizeClassification] Study pack dispatch warning (non-fatal):', err);
    });
  }

  revalidatePath('/uploads');
  revalidatePath('/subjects');
  if (subjectId) revalidatePath(`/subjects/${subjectId}`);
  return { success: true };
}

export async function renameDocument(documentId: string, newTitle: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const trimmed = newTitle.trim();
  const { data: doc, error } = await supabase
    .from("documents")
    .update({ title: trimmed })
    .eq("id", documentId)
    .eq("user_id", user.id)
    .select("upload_id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to rename document");
  }

  if (doc?.upload_id) {
    await supabase
      .from("uploads")
      .update({ file_name: trimmed })
      .eq("id", doc.upload_id)
      .eq("user_id", user.id);
  }

  revalidatePath("/uploads");
  revalidatePath("/subjects");
}

export async function moveDocumentToRecycleBin(documentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, subject_id")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  const now = new Date().toISOString();

  // 1. Soft-delete primary document
  const { error } = await supabase
    .from("documents")
    .update({
      deleted_at: now,
    })
    .eq("id", documentId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Failed to move document to recycle bin");
  }

  // 2. Soft-delete all associated AI generated documents in lockstep
  try {
    const docShortId = documentId.substring(0, 8);
    const cleanDocTitle = doc?.title ? doc.title.replace(/\.[^/.]+$/, '').trim() : '';

    let targetFolderIds: string[] = [];
    if (doc?.subject_id && cleanDocTitle) {
      const { data: allFolders } = await supabase
        .from('folders')
        .select('id, name, parent_folder_id')
        .eq('user_id', user.id)
        .eq('subject_id', doc.subject_id);

      if (allFolders) {
        const aiRootIds = new Set(
          allFolders
            .filter((f: { parent_folder_id: string | null; name: string }) => f.parent_folder_id === null && f.name.trim().toLowerCase() === 'ai generated')
            .map((f: { id: string }) => f.id)
        );
        const aiCatIds = new Set(
          allFolders
            .filter((f: { parent_folder_id: string | null; id: string }) => f.parent_folder_id !== null && aiRootIds.has(f.parent_folder_id))
            .map((f: { id: string }) => f.id)
        );
        targetFolderIds = allFolders
          .filter((f: { parent_folder_id: string | null; name: string; id: string }) => f.parent_folder_id !== null && aiCatIds.has(f.parent_folder_id) && f.name.trim().toLowerCase() === cleanDocTitle.toLowerCase())
          .map((f: { id: string }) => f.id);
      }
    }

    if (targetFolderIds.length > 0) {
      await supabase
        .from("documents")
        .update({ deleted_at: now })
        .in("folder_id", targetFolderIds)
        .eq("user_id", user.id);
    }

    await supabase
      .from("documents")
      .update({ deleted_at: now })
      .eq("user_id", user.id)
      .contains("tags", [`source_doc:${documentId}`]);

    await supabase
      .from("documents")
      .update({ deleted_at: now })
      .eq("user_id", user.id)
      .eq("ai_doc_type", "ai_generated")
      .ilike("file_url", `%ai-gen-%${docShortId}%`);
  } catch (syncErr) {
    console.warn("[moveDocumentToRecycleBin] AI document sync soft-delete warning:", syncErr);
  }

  revalidatePath("/uploads");
  revalidatePath("/subjects");
  revalidatePath("/recycle-bin");
}

export async function restoreDocumentFromRecycleBin(documentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, subject_id")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  // 1. Restore primary document
  const { error } = await supabase
    .from("documents")
    .update({
      deleted_at: null,
    })
    .eq("id", documentId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Failed to restore document");
  }

  // 2. Restore all associated AI generated documents in lockstep
  await restoreAssociatedAiDocuments(supabase, user.id, documentId, doc?.title, doc?.subject_id);

  revalidatePath("/uploads");
  revalidatePath("/subjects");
  revalidatePath("/recycle-bin");
}

export async function deleteDocumentPermanently(documentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, subject_id, folder_id, ai_subject, ai_topic, upload_id, file_url")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  // 1. Cleanup all AI generated folders, files and metadata
  await cleanupAiGeneratedResources(
    supabase,
    user.id,
    doc?.subject_id,
    doc?.title,
    documentId
  );

  // 2. Remove storage object for primary file using centralized helper
  if (doc?.file_url) {
    await safelyDeleteStorageObject(supabase, doc.file_url, user.id, 'documents');
  }

  // 3. Delete primary document row
  await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", user.id);

  // 4. Mark upload audit record as deleted with snapshot preservation
  if (doc?.upload_id) {
    try {
      let subjectName = doc.ai_subject;
      if (!subjectName && doc.subject_id) {
        const { data: sub } = await supabase.from('subjects').select('name').eq('id', doc.subject_id).maybeSingle();
        subjectName = sub?.name || null;
      }
      let folderName = doc.ai_topic;
      if (!folderName && doc.folder_id) {
        const { data: fold } = await supabase.from('folders').select('name').eq('id', doc.folder_id).maybeSingle();
        folderName = fold?.name || null;
      }

      const { error: updExtErr } = await supabase
        .from("uploads")
        .update({
          status: "deleted",
          deleted_at: new Date().toISOString(),
          subject_id: doc.subject_id,
          subject_name: subjectName,
          folder_id: doc.folder_id,
          folder_name: folderName,
          ai_subject: subjectName,
          ai_topic: folderName,
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
      console.warn("[deleteDocumentPermanently] Upload audit mark deleted warning:", uploadDelErr);
    }
  }

  revalidatePath("/uploads");
  revalidatePath("/summaries");
  revalidatePath("/subjects");
  revalidatePath("/recycle-bin");
}

export async function cleanupExpiredRecycledDocuments(userId: string) {
  const supabase = await createClient();
  
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const tenDaysAgoStr = tenDaysAgo.toISOString();

  const { data: expiredDocs } = await supabase
    .from("documents")
    .select("id, upload_id, file_url")
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .lt("deleted_at", tenDaysAgoStr);

  if (expiredDocs && expiredDocs.length > 0) {
    for (const doc of expiredDocs) {
      try {
        await deleteUpload(doc.upload_id, doc.id, doc.file_url);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("Failed to delete expired recycled document storage:", errorMsg);
      }
    }
  }

  // Also clean up any legacy orphaned documents whose subject was deleted permanently
  const { data: userSubjects } = await supabase
    .from("subjects")
    .select("id")
    .eq("user_id", userId);

  const existingSubjectIds = new Set((userSubjects || []).map((s) => s.id));

  const { data: allDocs } = await supabase
    .from("documents")
    .select("id, upload_id, file_url, subject_id")
    .eq("user_id", userId)
    .not("subject_id", "is", null);

  if (allDocs && allDocs.length > 0) {
    for (const d of allDocs) {
      if (d.subject_id && !existingSubjectIds.has(d.subject_id)) {
        try {
          await deleteUpload(d.upload_id, d.id, d.file_url);
        } catch (orphErr) {
          console.warn("[cleanupExpiredRecycledDocuments] Orphaned doc cleanup warning:", orphErr);
        }
      }
    }
  }
}

export async function createFileAction(
  name: string,
  extension: string,
  subjectId: string,
  folderId: string | null
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const trimmedName = name.trim();
  const fullName = trimmedName.endsWith(`.${extension}`) ? trimmedName : `${trimmedName}.${extension}`;

  // 1. Uniqueness check (case-insensitive)
  let query = supabase
    .from("documents")
    .select("id")
    .eq("user_id", user.id)
    .eq("subject_id", subjectId)
    .is("deleted_at", null)
    .ilike("title", fullName);

  if (folderId === null) {
    query = query.is("folder_id", null);
  } else {
    query = query.eq("folder_id", folderId);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    throw new Error("A file with this name already exists in this folder.");
  }

  // 2. Insert document record
  const { data: docResult, error: docError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      subject_id: subjectId,
      folder_id: folderId,
      title: fullName,
      file_url: "", // empty/blank url
      file_type: extension,
      summary_status: "none", // local file, no automatic AI summarization
      quiz_status: "none",
    })
    .select()
    .single();

  if (docError) {
    throw new Error(docError.message || "Failed to create file");
  }

  revalidatePath("/subjects");
  revalidatePath(`/subjects/${subjectId}`);
  revalidatePath("/uploads");

  return { success: true, document: docResult };
}

export async function saveFileAction(documentId: string, content: string, size: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("documents")
    .update({
      content,
      size,
      updated_at: new Date().toISOString()
    })
    .eq("id", documentId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Failed to save file content");
  }

  revalidatePath("/subjects");
  revalidatePath("/uploads");

  return { success: true };
}

export async function getSummaryFileLocationAction(documentId: string): Promise<{
  success: boolean;
  subjectId?: string | null;
  folderId?: string | null;
  fileId?: string | null;
  viewerUrl?: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const defaultViewerUrl = `/uploads/${documentId}/summary`;

  // Helper to verify that a subject exists and is active (not soft deleted)
  const isSubjectActive = async (subjectId: string | null | undefined): Promise<boolean> => {
    if (!subjectId) return false;
    const { data: subject } = await supabase
      .from('subjects')
      .select('id')
      .eq('id', subjectId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();
    return !!subject;
  };

  // Helper to verify that a folder exists
  const isFolderActive = async (folderId: string | null | undefined): Promise<boolean> => {
    if (!folderId) return false;
    const { data: folder } = await supabase
      .from('folders')
      .select('id')
      .eq('id', folderId)
      .eq('user_id', user.id)
      .maybeSingle();
    return !!folder;
  };

  // Fetch parent document details
  const { data: parentDoc } = await supabase
    .from('documents')
    .select('id, title, subject_id, folder_id, summary_status')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  // Strategy 1: Check if an AI generated summary PDF file exists in documents with source_doc tag
  const { data: taggedSummaryDocs } = await supabase
    .from('documents')
    .select('id, title, subject_id, folder_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .contains('tags', [`source_doc:${documentId}`]);

  if (taggedSummaryDocs && taggedSummaryDocs.length > 0) {
    const summaryDoc = taggedSummaryDocs.find(d => /summary/i.test(d.title)) || taggedSummaryDocs[0];
    if (summaryDoc && summaryDoc.id !== documentId) {
      const active = await isSubjectActive(summaryDoc.subject_id);
      if (active) {
        const folderValid = await isFolderActive(summaryDoc.folder_id);
        return {
          success: true,
          subjectId: summaryDoc.subject_id,
          folderId: folderValid ? summaryDoc.folder_id : null,
          fileId: summaryDoc.id,
          viewerUrl: defaultViewerUrl,
        };
      }
    }
  }

  // Strategy 2: Check by storage URL matching document ID short hash
  const docShortId = documentId.substring(0, 8);
  const { data: urlMatchedDocs } = await supabase
    .from('documents')
    .select('id, title, subject_id, folder_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .eq('ai_doc_type', 'ai_generated')
    .ilike('file_url', `%ai-gen-%${docShortId}%`);

  if (urlMatchedDocs && urlMatchedDocs.length > 0) {
    const summaryDoc = urlMatchedDocs.find(d => /summary/i.test(d.title)) || urlMatchedDocs[0];
    if (summaryDoc && summaryDoc.id !== documentId) {
      const active = await isSubjectActive(summaryDoc.subject_id);
      if (active) {
        const folderValid = await isFolderActive(summaryDoc.folder_id);
        return {
          success: true,
          subjectId: summaryDoc.subject_id,
          folderId: folderValid ? summaryDoc.folder_id : null,
          fileId: summaryDoc.id,
          viewerUrl: defaultViewerUrl,
        };
      }
    }
  }

  // Strategy 3: Check folder hierarchy under AI Generated folders
  if (parentDoc) {
    const cleanTitle = parentDoc.title.replace(/\.[^/.]+$/, '').trim().toLowerCase();
    const targetSubjectId = parentDoc.subject_id;

    if (targetSubjectId) {
      const { data: subjectFolders } = await supabase
        .from('folders')
        .select('id, name, parent_folder_id')
        .eq('user_id', user.id)
        .eq('subject_id', targetSubjectId);

      if (subjectFolders && subjectFolders.length > 0) {
        // Find document-specific subfolder matching the clean doc title
        const matchingSubfolder = subjectFolders.find(
          f => f.parent_folder_id !== null && f.name.trim().toLowerCase() === cleanTitle
        );

        if (matchingSubfolder) {
          const { data: subfolderDocs } = await supabase
            .from('documents')
            .select('id, title, subject_id, folder_id')
            .eq('user_id', user.id)
            .eq('folder_id', matchingSubfolder.id)
            .is('deleted_at', null);

          if (subfolderDocs && subfolderDocs.length > 0) {
            const summaryDoc = subfolderDocs.find(d => /summary/i.test(d.title)) || subfolderDocs[0];
            if (summaryDoc && summaryDoc.id !== documentId) {
              const active = await isSubjectActive(targetSubjectId);
              if (active) {
                return {
                  success: true,
                  subjectId: targetSubjectId,
                  folderId: matchingSubfolder.id,
                  fileId: summaryDoc.id,
                  viewerUrl: defaultViewerUrl,
                };
              }
            }
          }
        }
      }
    }
  }

  // Strategy 4: Fallback to the Summary Studio Viewer
  // If no generated summary PDF exists in the file tree, we NEVER return the parent document file/folder.
  // Instead we direct the user to the interactive Summary Studio.
  return {
    success: true,
    viewerUrl: defaultViewerUrl,
  };
}


