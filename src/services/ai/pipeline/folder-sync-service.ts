import { SupabaseClient } from '@supabase/supabase-js';
import { GeneratedPdfResult } from './pdf-generator-service';
import { logger } from '@/lib/logger';
import { classifyFilename } from '@/services/upload-routing';

export class FolderSyncService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Resolve or create a folder with a given name under a given parent.
   * Returns the id of the existing or newly created folder.
   */
  private async resolveOrCreateFolder(
    userId: string,
    subjectId: string,
    parentFolderId: string | null,
    folderName: string
  ): Promise<string> {
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
      throw new Error(`Failed to list folders (parent=${parentFolderId ?? 'null'}): ${listErr.message}`);
    }

    const existing = (list || []).find(
      (f: { name: string }) => f.name.trim().toLowerCase() === folderName.toLowerCase()
    );

    if (existing) {
      logger.info(`[FolderSyncService] Reusing folder "${folderName}" (id=${existing.id})`);
      return existing.id as string;
    }

    logger.info(`[FolderSyncService] Creating folder "${folderName}" under parent=${parentFolderId ?? 'root'}...`);
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

    if (createErr || !created) {
      throw new Error(`Could not create folder "${folderName}": ${createErr?.message}`);
    }
    return created.id as string;
  }

  async run(
    userId: string,
    subjectId: string,
    docTitle: string,
    pdfs: GeneratedPdfResult[],
    subjectName: string
  ): Promise<string> {
    logger.info(`[FolderSyncService] Synchronizing generated PDFs for user ${userId}, subject: ${subjectId}`);

    // ── 1. Resolve or create root "AI Generated" folder ──────────────────────
    const rootFolderId = await this.resolveOrCreateFolder(userId, subjectId, null, 'AI Generated');

    // ── 2. Classify doc title into a category (Lectures, Assignments, Lab, etc.) ──
    //    The hierarchy is always:
    //      AI Generated/
    //      └── <Category>/          e.g. Lectures, Assignments, Lab, Quizzes
    //          └── <Document Name>/ e.g. PP Lecture 6, Lecture 2, Assignment 1
    //              └── Summary.pdf
    const classification = classifyFilename(docTitle);
    // Use the classified folder name if found, fall back to 'Documents' (not 'Others')
    // so file-explorer labels remain clean and professional.
    const categoryName = classification.folderName ?? 'Documents';

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
        // Uniqueness check
        const { data: existingDoc, error: checkErr } = await this.supabase
          .from('documents')
          .select('id')
          .eq('user_id', userId)
          .eq('folder_id', subFolderId)
          .ilike('title', fileTitle)
          .is('deleted_at', null)
          .maybeSingle();

        if (checkErr) {
          logger.warn(`[FolderSyncService] Error checking duplicates for "${fileTitle}": ${checkErr.message}`);
        }

        if (existingDoc) {
          logger.info(`[FolderSyncService] Resource "${fileTitle}" already synced. Skipping.`);
          continue;
        }

        logger.info(`[FolderSyncService] Synchronizing resource "${fileTitle}"...`);
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

        if (insErr) {
          logger.error(`[FolderSyncService] Failed to insert "${fileTitle}": ${insErr.message}`);
        } else {
          logger.info(`[FolderSyncService] ✓ Synced "${fileTitle}"`);
        }
      } catch (err: any) {
        logger.error(`[FolderSyncService] Exception syncing "${fileTitle}": ${err.message}`);
      }
    }

    return subFolderId;
  }
}
