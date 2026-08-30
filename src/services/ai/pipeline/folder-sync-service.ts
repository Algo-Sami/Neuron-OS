import { SupabaseClient } from '@supabase/supabase-js';
import { GeneratedPdfResult } from './pdf-generator-service';
import { logger } from '@/lib/logger';
import { classifyFilename } from '@/services/upload-routing';

export class FolderSyncService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Resolve or create a folder with a given name under a given parent.
   *
   * Concurrency-safe pattern:
   *   1. SELECT existing folder (fast common path — finds it in most calls)
   *   2. If found → return existing ID
   *   3. If not found → attempt INSERT
   *   4. INSERT succeeds → return new ID
   *   5. INSERT returns 23505 → another concurrent scheduler created it first;
   *      re-fetch the race-winner record and return its ID
   *   6. INSERT returns any other error → throw (not swallowed)
   *
   * The existing partial expression indexes on folders
   * (idx_folders_unique_parent_name, idx_folders_unique_root_name, etc.)
   * enforce uniqueness at the DB level. Supabase/PostgREST cannot target
   * expression-based indexes via onConflict, so we handle 23505 manually.
   *
   * Returns the id of the existing or newly created folder.
   */
  private async resolveOrCreateFolder(
    userId: string,
    subjectId: string,
    parentFolderId: string | null,
    folderName: string
  ): Promise<string> {
    // ── Step 1: Check if folder already exists ────────────────────────────────
    const { data: list, error: listErr } = parentFolderId
      ? await this.supabase
          .from('folders')
          .select('id, name')
          .eq('user_id', userId)
          .eq('subject_id', subjectId)
          .eq('parent_folder_id', parentFolderId)
      : await this.supabase
          .from('folders')
          .select('id, name')
          .eq('user_id', userId)
          .eq('subject_id', subjectId)
          .is('parent_folder_id', null);

    if (listErr) {
      throw new Error(`[FolderSync] Failed to list folders (parent=${parentFolderId ?? 'null'}): ${listErr.message}`);
    }

    const existing = (list || []).find(
      (f: { name: string }) => f.name.trim().toLowerCase() === folderName.toLowerCase()
    );

    if (existing) {
      logger.info(`[FolderSync] Reusing folder "${folderName}" (id=${existing.id})`);
      return existing.id as string;
    }

    // ── Step 2: Folder does not exist — attempt atomic INSERT ────────────────
    logger.info(`[FolderSync] Creating folder "${folderName}" under parent=${parentFolderId ?? 'root'}...`);

    const { data: created, error: createErr } = await this.supabase
      .from('folders')
      .insert({
        user_id: userId,
        subject_id: subjectId,
        parent_folder_id: parentFolderId,
        name: folderName,
      })
      .select('id')
      .single();

    if (!createErr && created) {
      logger.info(`[FolderSync] Created folder "${folderName}" (id=${created.id})`);
      return created.id as string;
    }

    // ── Step 3: Handle concurrent creation (23505 unique violation) ──────────
    if (createErr.code === '23505') {
      logger.info(
        `[FolderSync] Concurrent folder creation detected for "${folderName}"; re-fetching winner...`
      );

      const { data: winner, error: refetchErr } = parentFolderId
        ? await this.supabase
            .from('folders')
            .select('id, name')
            .eq('user_id', userId)
            .eq('subject_id', subjectId)
            .eq('parent_folder_id', parentFolderId)
            .ilike('name', folderName)
            .maybeSingle()
        : await this.supabase
            .from('folders')
            .select('id, name')
            .eq('user_id', userId)
            .eq('subject_id', subjectId)
            .is('parent_folder_id', null)
            .ilike('name', folderName)
            .maybeSingle();

      if (refetchErr) {
        throw new Error(
          `[FolderSync] Failed to re-fetch folder "${folderName}" after 23505 conflict: ${refetchErr.message}`
        );
      }

      if (!winner) {
        // DB reported a uniqueness conflict but the winning row cannot be located.
        // This should not happen under normal conditions — surface clearly.
        throw new Error(
          `[FolderSync] 23505 conflict on folder "${folderName}" but re-fetch returned no record. ` +
          'Database may be in an inconsistent state.'
        );
      }

      logger.info(`[FolderSync] Reusing race winner folder "${folderName}" (id=${winner.id})`);
      return winner.id as string;
    }

    // ── Step 4: Any other database error — do not swallow ────────────────────
    throw new Error(`[FolderSync] Could not create folder "${folderName}": ${createErr.message}`);
  }

  async run(
    userId: string,
    subjectId: string,
    docTitle: string,
    pdfs: GeneratedPdfResult[],
    subjectName: string
  ): Promise<string> {
    logger.info(`[FolderSync] Synchronizing generated PDFs for user ${userId}, subject: ${subjectId}`);

    // ── 1. Resolve or create root "AI Generated" folder ──────────────────────
    const rootFolderId = await this.resolveOrCreateFolder(userId, subjectId, null, 'AI Generated');

    // ── 2. Classify doc title into a category (Lectures, Assignments, Lab, etc.) ──
    //    The hierarchy is always:
    //      AI Generated/
    //      └── <Category>/          e.g. Lectures, Assignments, Lab, Quizzes
    //          └── <Document Name>/ e.g. PP Lecture 6, Lecture 2, Assignment 1
    //              └── Summary.pdf
    const classification = classifyFilename(docTitle);
    // Use the classified folder name if found, fall back to 'Lectures'
    // so file-explorer labels remain clean and professional.
    const categoryName = classification.folderName ?? 'Lectures';

    const categoryFolderId = await this.resolveOrCreateFolder(
      userId, subjectId, rootFolderId, categoryName
    );

    // ── 3. Resolve or create the document-specific subfolder ─────────────────
    // Strip the file extension to use only the document name as the folder label,
    // e.g. "PP lecture 6.pdf" → "PP lecture 6"
    const cleanDocTitle = docTitle.replace(/\.[^/.]+$/, '');
    const subFolderId = await this.resolveOrCreateFolder(
      userId, subjectId, categoryFolderId, cleanDocTitle
    );

    // ── 4. Register generated PDF documents under the subfolder ──────────────
    for (const pdf of pdfs) {
      const fileTitle = pdf.customFileName || `${cleanDocTitle} – ${pdf.suffixName}.pdf`;

      try {
        // ── Step 4a: Check if this document link already exists ───────────────
        const { data: existingDoc, error: checkErr } = await this.supabase
          .from('documents')
          .select('id')
          .eq('user_id', userId)
          .eq('folder_id', subFolderId)
          .ilike('title', fileTitle)
          .is('deleted_at', null)
          .maybeSingle();

        if (checkErr) {
          logger.warn(`[FolderSync] Error checking duplicates for "${fileTitle}": ${checkErr.message}`);
        }

        if (existingDoc) {
          logger.info(`[FolderSync] Resource "${fileTitle}" already synced. Skipping.`);
          continue;
        }

        // ── Step 4b: Attempt atomic INSERT ────────────────────────────────────
        logger.info(`[FolderSync] Synchronizing resource "${fileTitle}"...`);
        const { error: insErr } = await this.supabase
          .from('documents')
          .insert({
            user_id: userId,
            subject_id: subjectId,
            folder_id: subFolderId,
            upload_id: null,
            title: fileTitle,
            file_url: pdf.publicUrl,
            file_type: 'pdf',
            ai_subject: subjectName,
            ai_topic: pdf.displayName,
            ai_doc_type: 'ai_generated',
            classification_status: 'auto_applied',
            classification_confidence: 1.00,
            summary_status: 'none',
            quiz_status: 'none',
            size: pdf.size,
          });

        if (!insErr) {
          logger.info(`[FolderSync] ✓ Synced "${fileTitle}"`);
          continue;
        }

        // ── Step 4c: Handle concurrent document creation (23505) ─────────────
        if (insErr.code === '23505') {
          // Another concurrent scheduler created this document link first.
          // The DB unique constraint idx_documents_unique_folder_title prevents
          // a duplicate — treat this as a benign race and continue as success.
          logger.info(
            `[FolderSync] Concurrent document creation detected for "${fileTitle}"; reusing existing document.`
          );
          continue;
        }

        // ── Step 4d: Any other insert error — log but preserve outer-loop behavior
        logger.error(`[FolderSync] Failed to insert "${fileTitle}": ${insErr.message} (code: ${insErr.code ?? 'unknown'})`);
      } catch (err: any) {
        logger.error(`[FolderSync] Exception syncing "${fileTitle}": ${err.message}`);
      }
    }

    logger.info(`[FolderSync] Synchronization completed for "${cleanDocTitle}" (subFolder=${subFolderId})`);
    return subFolderId;
  }
}
