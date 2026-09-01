import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

// ── Types ───────────────────────────────────────────────────────────────────

export interface StorageFileMetadata {
  exists: boolean;
  sizeBytes: number | null;
  mimeType: string | null;
  storagePath: string | null;
  error?: string;
}

export interface SyncDocumentMetadataResult {
  success: boolean;
  documentId: string;
  sizeBytes: number | null;
  mimeType: string | null;
  repaired: boolean;
  error?: string;
}

export interface ReconciliationReport {
  checkedCount: number;
  repairedCount: number;
  missingCount: number;
  skippedCount: number;
  errors: Array<{ documentId: string; title: string; error: string }>;
}

// ── Canonical Size Formatter ────────────────────────────────────────────────

/**
 * Format bytes into standard human-readable sizes:
 * - null / undefined -> "—"
 * - 0 -> "0 B"
 * - < 1024 -> "X B"
 * - < 1 MB -> "X.X KB"
 * - < 1 GB -> "X.XX MB"
 * - >= 1 GB -> "X.XX GB"
 */
export function formatFileSize(bytes?: number | null): string {
  if (bytes === undefined || bytes === null) {
    return '—';
  }
  if (bytes === 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format Explorer item size respecting the Folder Size Invariant:
 * - Folders and Subjects ALWAYS return "—"
 * - Files return formatted size
 */
export function formatExplorerItemSize(
  itemType: 'subject' | 'folder' | 'file',
  fileSize?: number | null
): string {
  if (itemType === 'folder' || itemType === 'subject') {
    return '—';
  }
  return formatFileSize(fileSize);
}

// ── Storage Path Utilities ──────────────────────────────────────────────────

/**
 * Normalizes and extracts the Supabase Storage object path from a storage URL or raw path.
 *
 * Handles:
 * - Full public URL: `https://<proj>.supabase.co/storage/v1/object/public/documents/<user>/<file>`
 * - Authenticated URL: `https://<proj>.supabase.co/storage/v1/object/authenticated/documents/<user>/<file>`
 * - Relative storage path: `<user>/<file>` or `documents/<user>/<file>`
 */
export function extractStoragePath(fileUrl: string | null | undefined, userId?: string): string | null {
  if (!fileUrl || typeof fileUrl !== 'string') {
    return null;
  }

  const trimmed = fileUrl.trim();
  if (!trimmed) {
    return null;
  }

  // Case 1: URL containing `/documents/` bucket prefix
  if (trimmed.includes('/documents/')) {
    const afterBucket = trimmed.split('/documents/')[1];
    if (afterBucket) {
      const clean = afterBucket.split('?')[0];
      return decodeURIComponent(clean);
    }
  }

  // Case 2: Full HTTP URL without `/documents/` in standard position
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split('/').filter(Boolean);
      // Look for 'documents' in segments
      const bucketIdx = segments.indexOf('documents');
      if (bucketIdx !== -1 && bucketIdx < segments.length - 1) {
        return decodeURIComponent(segments.slice(bucketIdx + 1).join('/'));
      }
      // If user ID provided and last segment looks like file
      if (userId && segments.length > 0) {
        const last = decodeURIComponent(segments[segments.length - 1]);
        return `${userId}/${last}`;
      }
    } catch {
      // Fall through to fallback below
    }
  }

  // Case 3: Already relative path
  let relative = trimmed.replace(/^\/+/, '');
  if (relative.startsWith('documents/')) {
    relative = relative.substring('documents/'.length);
  }

  if (relative.includes('/')) {
    return relative;
  }

  // Case 4: Just a filename with userId
  if (userId) {
    return `${userId}/${relative}`;
  }

  return relative;
}

// ── Storage Metadata API ────────────────────────────────────────────────────

/**
 * Retrieves physical object metadata directly from Supabase Storage.
 *
 * Source of truth for physical file size and existence.
 */
export async function getStorageFileMetadata(
  supabase: SupabaseClient,
  storagePath: string
): Promise<StorageFileMetadata> {
  if (!storagePath) {
    return { exists: false, sizeBytes: null, mimeType: null, storagePath: null, error: 'Empty storage path' };
  }

  try {
    const cleanPath = storagePath.replace(/^\/+/, '');
    const lastSlashIdx = cleanPath.lastIndexOf('/');
    const folder = lastSlashIdx !== -1 ? cleanPath.substring(0, lastSlashIdx) : '';
    const filename = lastSlashIdx !== -1 ? cleanPath.substring(lastSlashIdx + 1) : cleanPath;

    const { data: files, error: listErr } = await supabase.storage
      .from('documents')
      .list(folder, { search: filename, limit: 20 });

    if (listErr) {
      logger.warn(`[FileMetadata] Storage list error for folder "${folder}":`, listErr.message);
      return { exists: false, sizeBytes: null, mimeType: null, storagePath: cleanPath, error: listErr.message };
    }

    const match = (files || []).find((f) => f.name === filename);
    if (!match) {
      return { exists: false, sizeBytes: null, mimeType: null, storagePath: cleanPath, error: 'Object not found in storage' };
    }

    // Extract size and mime type safely across Supabase storage versions
    const metadata = match.metadata as { size?: number; mimetype?: string } | undefined;
    let size: number | null = null;
    if (typeof metadata?.size === 'number') {
      size = metadata.size;
    } else if (typeof (match as any).size === 'number') {
      size = (match as any).size;
    }

    const mimeType = metadata?.mimetype || null;

    return {
      exists: true,
      sizeBytes: size,
      mimeType,
      storagePath: cleanPath,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[FileMetadata] Unexpected error inspecting storage path "${storagePath}":`, msg);
    return { exists: false, sizeBytes: null, mimeType: null, storagePath, error: msg };
  }
}

/**
 * Verifies that a storage object exists and has valid physical size.
 */
export async function verifyStorageFile(
  supabase: SupabaseClient,
  storagePath: string,
  expectedMinSize: number = 1
): Promise<{ verified: boolean; sizeBytes: number | null; mimeType: string | null; error?: string }> {
  const meta = await getStorageFileMetadata(supabase, storagePath);

  if (!meta.exists) {
    return { verified: false, sizeBytes: null, mimeType: null, error: meta.error || 'Object does not exist in storage' };
  }

  if (meta.sizeBytes === null) {
    return { verified: false, sizeBytes: null, mimeType: meta.mimeType, error: 'Object size could not be determined' };
  }

  if (meta.sizeBytes < expectedMinSize) {
    return {
      verified: false,
      sizeBytes: meta.sizeBytes,
      mimeType: meta.mimeType,
      error: `Object size ${meta.sizeBytes} bytes is less than expected minimum ${expectedMinSize} bytes`,
    };
  }

  return { verified: true, sizeBytes: meta.sizeBytes, mimeType: meta.mimeType };
}

// ── Database Synchronization ────────────────────────────────────────────────

/**
 * Synchronizes physical Storage metadata for a single document to the database.
 *
 * Reads actual size from Supabase Storage and updates `documents.size` and `uploads.file_size`.
 */
export async function syncDocumentMetadata(
  supabase: SupabaseClient,
  documentId: string,
  options?: { force?: boolean }
): Promise<SyncDocumentMetadataResult> {
  try {
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, user_id, title, file_url, file_type, size, upload_id')
      .eq('id', documentId)
      .maybeSingle();

    if (docErr || !doc) {
      return {
        success: false,
        documentId,
        sizeBytes: null,
        mimeType: null,
        repaired: false,
        error: docErr ? docErr.message : 'Document not found',
      };
    }

    // Skip local editor files that don't have storage URLs
    if (!doc.file_url || doc.file_url.trim() === '') {
      return {
        success: true,
        documentId,
        sizeBytes: doc.size ?? 0,
        mimeType: doc.file_type || null,
        repaired: false,
      };
    }

    const storagePath = extractStoragePath(doc.file_url, doc.user_id);
    if (!storagePath) {
      return {
        success: false,
        documentId,
        sizeBytes: null,
        mimeType: null,
        repaired: false,
        error: 'Unable to resolve storage path from file_url',
      };
    }

    const meta = await getStorageFileMetadata(supabase, storagePath);
    if (!meta.exists || meta.sizeBytes === null) {
      return {
        success: false,
        documentId,
        sizeBytes: null,
        mimeType: null,
        repaired: false,
        error: meta.error || 'Storage object not found',
      };
    }

    const needsRepair = options?.force || doc.size === null || doc.size === undefined || doc.size !== meta.sizeBytes;

    if (needsRepair) {
      // 1. Update documents record
      const { error: updErr } = await supabase
        .from('documents')
        .update({
          size: meta.sizeBytes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (updErr) {
        logger.error(`[FileMetadata] Failed to update document ${documentId} size:`, updErr.message);
        return {
          success: false,
          documentId,
          sizeBytes: meta.sizeBytes,
          mimeType: meta.mimeType,
          repaired: false,
          error: updErr.message,
        };
      }

      // 2. Update uploads audit record if linked
      if (doc.upload_id) {
        await supabase
          .from('uploads')
          .update({
            file_size: meta.sizeBytes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', doc.upload_id);
      }

      logger.info(
        `[FileMetadata] Repaired metadata for "${doc.title}" (id=${documentId}): size=${doc.size ?? 'null'} -> ${meta.sizeBytes} B`
      );
      return {
        success: true,
        documentId,
        sizeBytes: meta.sizeBytes,
        mimeType: meta.mimeType,
        repaired: true,
      };
    }

    return {
      success: true,
      documentId,
      sizeBytes: meta.sizeBytes,
      mimeType: meta.mimeType,
      repaired: false,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[FileMetadata] syncDocumentMetadata exception for ${documentId}:`, msg);
    return {
      success: false,
      documentId,
      sizeBytes: null,
      mimeType: null,
      repaired: false,
      error: msg,
    };
  }
}

// ── Bulk Reconciliation ─────────────────────────────────────────────────────

/**
 * Reconciles metadata for all active user documents where size is missing or zero.
 *
 * Lightweight, non-blocking background repair service.
 */
export async function reconcileUserDocumentMetadata(
  supabase: SupabaseClient,
  userId: string
): Promise<ReconciliationReport> {
  const report: ReconciliationReport = {
    checkedCount: 0,
    repairedCount: 0,
    missingCount: 0,
    skippedCount: 0,
    errors: [],
  };

  if (!userId) {
    return report;
  }

  try {
    // Find active documents with null or 0 size that have a file_url
    const { data: candidates, error: fetchErr } = await supabase
      .from('documents')
      .select('id, title, file_url, size')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .or('size.is.null,size.eq.0');

    if (fetchErr || !candidates) {
      logger.warn('[FileMetadata] Failed to fetch candidates for reconciliation:', fetchErr?.message);
      return report;
    }

    report.checkedCount = candidates.length;

    for (const doc of candidates) {
      if (!doc.file_url || doc.file_url.trim() === '') {
        report.skippedCount++;
        continue;
      }

      const res = await syncDocumentMetadata(supabase, doc.id, { force: true });
      if (res.success) {
        if (res.repaired) {
          report.repairedCount++;
        } else {
          report.skippedCount++;
        }
      } else {
        if (res.error?.includes('not found') || res.error?.includes('missing')) {
          report.missingCount++;
        }
        report.errors.push({
          documentId: doc.id,
          title: doc.title,
          error: res.error || 'Unknown sync failure',
        });
      }
    }

    if (report.repairedCount > 0) {
      logger.info(
        `[FileMetadata] Reconciled metadata for user ${userId}: checked=${report.checkedCount}, repaired=${report.repairedCount}, missing=${report.missingCount}`
      );
    }

    // Self-healing: automatically reconcile and clean up orphaned AI Generated folders
    await reconcileOrphanedAiGeneratedFolders(supabase, userId).catch((orphanErr) => {
      logger.warn('[FileMetadata] Orphaned AI folder reconciliation warning:', orphanErr);
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[FileMetadata] Exception during user reconciliation for ${userId}:`, msg);
  }

  return report;
}

/**
 * Scans all document-level subfolders under "AI Generated / <Category>"
 * and automatically prunes or synchronizes orphaned folders whose source lecture
 * has been permanently deleted or moved to the Recycle Bin.
 */
export async function reconcileOrphanedAiGeneratedFolders(
  supabase: SupabaseClient,
  userId: string
): Promise<{ prunedFoldersCount: number; syncedDocsCount: number }> {
  let prunedFoldersCount = 0;
  let syncedDocsCount = 0;

  if (!userId) return { prunedFoldersCount, syncedDocsCount };

  try {
    // 1. Fetch all user folders
    const { data: allFolders, error: foldersErr } = await supabase
      .from('folders')
      .select('id, name, parent_folder_id, subject_id')
      .eq('user_id', userId);

    if (foldersErr || !allFolders || allFolders.length === 0) {
      return { prunedFoldersCount, syncedDocsCount };
    }

    // 2. Identify AI Generated root folders
    const aiRootFolderIds = new Set(
      allFolders
        .filter((f) => f.parent_folder_id === null && f.name.trim().toLowerCase() === 'ai generated')
        .map((f) => f.id)
    );

    if (aiRootFolderIds.size === 0) {
      return { prunedFoldersCount, syncedDocsCount };
    }

    // 3. Identify AI category folders (Lectures, Assignments, etc.)
    const aiCategoryFolderIds = new Set(
      allFolders
        .filter((f) => f.parent_folder_id !== null && aiRootFolderIds.has(f.parent_folder_id))
        .map((f) => f.id)
    );

    // 4. Identify document-level AI subfolders (depth 2 under AI Generated)
    const docSubfolders = allFolders.filter(
      (f) => f.parent_folder_id !== null && aiCategoryFolderIds.has(f.parent_folder_id)
    );

    if (docSubfolders.length === 0) {
      return { prunedFoldersCount, syncedDocsCount };
    }

    // 5. Fetch all user documents (both active and soft-deleted)
    const { data: allDocs, error: docsErr } = await supabase
      .from('documents')
      .select('id, title, subject_id, folder_id, ai_doc_type, deleted_at, tags, file_url')
      .eq('user_id', userId);

    if (docsErr || !allDocs) {
      return { prunedFoldersCount, syncedDocsCount };
    }

    for (const subfolder of docSubfolders) {
      const cleanSubName = subfolder.name.trim().toLowerCase();
      const docsInSubfolder = allDocs.filter((d) => d.folder_id === subfolder.id);

      // Look for a corresponding source document in this subject (excluding ai_generated)
      const matchingSourceDocs = allDocs.filter((d) => {
        if (d.subject_id !== subfolder.subject_id) return false;
        if (d.ai_doc_type === 'ai_generated') return false;
        const cleanTitle = d.title.replace(/\.[^/.]+$/, '').trim().toLowerCase();
        return cleanTitle === cleanSubName;
      });

      const activeSourceDoc = matchingSourceDocs.find((d) => d.deleted_at === null);
      const recycledSourceDoc = matchingSourceDocs.find((d) => d.deleted_at !== null);

      if (!activeSourceDoc && !recycledSourceDoc) {
        // Case 1: Source document was permanently deleted or never existed.
        const hasActiveNonAiDoc = docsInSubfolder.some((d) => d.ai_doc_type !== 'ai_generated' && d.deleted_at === null);
        if (!hasActiveNonAiDoc) {
          // Delete storage files if any
          for (const d of docsInSubfolder) {
            if (d.file_url) {
              try {
                let storagePath = '';
                if (d.file_url.includes('/documents/')) {
                  storagePath = decodeURIComponent(d.file_url.split('/documents/')[1]?.split('?')[0] || '');
                } else {
                  const parts = d.file_url.split('/');
                  storagePath = `${userId}/${parts[parts.length - 1]}`;
                }
                if (storagePath) {
                  await supabase.storage.from('documents').remove([storagePath]);
                }
              } catch {
                // ignore
              }
            }
          }

          // Delete docs in subfolder
          if (docsInSubfolder.length > 0) {
            await supabase
              .from('documents')
              .delete()
              .eq('folder_id', subfolder.id)
              .eq('user_id', userId);
          }

          // Delete the subfolder itself
          await supabase
            .from('folders')
            .delete()
            .eq('id', subfolder.id)
            .eq('user_id', userId);

          prunedFoldersCount++;
          logger.info(`[FileMetadata] Pruned orphaned AI Generated subfolder "${subfolder.name}" (id=${subfolder.id})`);
        }
      } else if (!activeSourceDoc && recycledSourceDoc) {
        // Case 2: Source document is in Recycle Bin.
        for (const doc of docsInSubfolder) {
          if (doc.deleted_at === null) {
            await supabase
              .from('documents')
              .update({ deleted_at: recycledSourceDoc.deleted_at || new Date().toISOString() })
              .eq('id', doc.id)
              .eq('user_id', userId);
            syncedDocsCount++;
          }
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('[FileMetadata] Exception in reconcileOrphanedAiGeneratedFolders:', msg);
  }

  return { prunedFoldersCount, syncedDocsCount };
}
