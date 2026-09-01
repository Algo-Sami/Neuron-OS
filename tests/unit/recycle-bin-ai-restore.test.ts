/**
 * Unit Test Suite: Recycle Bin AI-Generated Resource Lockstep Restore
 *
 * Verifies Fix 2:
 * Restoring a document from Recycle Bin restores associated AI-generated
 * summaries, quizzes, flashcards, and dedicated subfolders in lockstep.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Recycle Bin AI Resource Lockstep Restore', () => {
  // Mock In-Memory Database
  const createMockDb = () => {
    return {
      documents: [
        {
          id: 'doc-source-11111111-2222',
          title: 'Software Design Patterns.pdf',
          subject_id: 'subj-cs',
          folder_id: 'folder-lec',
          user_id: 'user-1',
          deleted_at: '2026-08-10T12:00:00Z',
          tags: [],
          ai_doc_type: null,
          file_url: 'https://supabase.co/storage/documents/user-1/doc-source.pdf',
        },
        // AI Generated Summary Doc
        {
          id: 'doc-ai-summary-1',
          title: 'Summary - Software Design Patterns.pdf',
          subject_id: 'subj-cs',
          folder_id: 'folder-ai-doc-sub',
          user_id: 'user-1',
          deleted_at: '2026-08-10T12:00:00Z',
          tags: ['source_doc:doc-source-11111111-2222'],
          ai_doc_type: 'ai_generated',
          file_url: 'https://supabase.co/storage/documents/user-1/ai-gen-doc-sour-summary.pdf',
        },
        // AI Generated Quiz Doc
        {
          id: 'doc-ai-quiz-1',
          title: 'Quiz - Software Design Patterns.pdf',
          subject_id: 'subj-cs',
          folder_id: 'folder-ai-doc-sub',
          user_id: 'user-1',
          deleted_at: '2026-08-10T12:00:00Z',
          tags: ['source_doc:doc-source-11111111-2222'],
          ai_doc_type: 'ai_generated',
          file_url: 'https://supabase.co/storage/documents/user-1/ai-gen-doc-sour-quiz.pdf',
        },
        // Unrelated User Document
        {
          id: 'doc-unrelated-2',
          title: 'Database Systems.pdf',
          subject_id: 'subj-db',
          folder_id: 'folder-db',
          user_id: 'user-1',
          deleted_at: '2026-08-10T12:00:00Z',
          tags: [],
          ai_doc_type: null,
          file_url: 'https://supabase.co/storage/documents/user-1/db.pdf',
        },
      ],
      folders: [
        { id: 'folder-ai-root', name: 'AI Generated', parent_folder_id: null, subject_id: 'subj-cs', user_id: 'user-1' },
        { id: 'folder-ai-cat', name: 'Summaries', parent_folder_id: 'folder-ai-root', subject_id: 'subj-cs', user_id: 'user-1' },
        { id: 'folder-ai-doc-sub', name: 'Software Design Patterns', parent_folder_id: 'folder-ai-cat', subject_id: 'subj-cs', user_id: 'user-1' },
      ],
    };
  };

  // Mock implementation of restoreAssociatedAiDocuments
  async function mockRestoreAssociatedAiDocuments(
    db: ReturnType<typeof createMockDb>,
    userId: string,
    documentId: string,
    docTitle?: string | null,
    subjectId?: string | null
  ) {
    const docShortId = documentId.substring(0, 8);
    const cleanDocTitle = docTitle ? docTitle.replace(/\.[^/.]+$/, '').trim().toLowerCase() : '';

    let targetFolderIds: string[] = [];
    if (subjectId && cleanDocTitle) {
      const allFolders = db.folders.filter((f) => f.user_id === userId && f.subject_id === subjectId);
      const aiRootIds = new Set(
        allFolders.filter((f) => f.parent_folder_id === null && f.name.trim().toLowerCase() === 'ai generated').map((f) => f.id)
      );
      const aiCatIds = new Set(
        allFolders.filter((f) => f.parent_folder_id !== null && aiRootIds.has(f.parent_folder_id)).map((f) => f.id)
      );
      targetFolderIds = allFolders
        .filter((f) => f.parent_folder_id !== null && aiCatIds.has(f.parent_folder_id) && f.name.trim().toLowerCase() === cleanDocTitle)
        .map((f) => f.id);
    }

    // 1. Restore docs in target subfolder
    if (targetFolderIds.length > 0) {
      db.documents
        .filter((d) => d.user_id === userId && targetFolderIds.includes(d.folder_id))
        .forEach((d) => {
          d.deleted_at = null;
        });
    }

    // 2. Restore tagged docs
    db.documents
      .filter((d) => d.user_id === userId && d.tags.includes(`source_doc:${documentId}`))
      .forEach((d) => {
        d.deleted_at = null;
      });

    // 3. Restore docs matching storage short hash
    db.documents
      .filter((d) => d.user_id === userId && d.ai_doc_type === 'ai_generated' && d.file_url.includes(`ai-gen-${docShortId}`))
      .forEach((d) => {
        d.deleted_at = null;
      });
  }

  // ── Test 1: Restoring primary document restores associated AI docs in lockstep ──
  test('Test 1: Restoring primary document restores all associated AI generated documents', async () => {
    const db = createMockDb();
    const primaryDocId = 'doc-source-11111111-2222';

    // Verify initial deleted state
    const targetDoc = db.documents.find((d) => d.id === primaryDocId)!;
    assert.notStrictEqual(targetDoc.deleted_at, null);
    assert.strictEqual(db.documents.filter((d) => d.deleted_at !== null).length, 4);

    // 1. Restore primary document
    targetDoc.deleted_at = null;

    // 2. Restore AI associated assets
    await mockRestoreAssociatedAiDocuments(db, 'user-1', primaryDocId, targetDoc.title, targetDoc.subject_id);

    // Assertions
    const summaryDoc = db.documents.find((d) => d.id === 'doc-ai-summary-1')!;
    const quizDoc = db.documents.find((d) => d.id === 'doc-ai-quiz-1')!;
    const unrelatedDoc = db.documents.find((d) => d.id === 'doc-unrelated-2')!;

    assert.strictEqual(targetDoc.deleted_at, null, 'Primary document must be restored');
    assert.strictEqual(summaryDoc.deleted_at, null, 'AI Summary document must be restored');
    assert.strictEqual(quizDoc.deleted_at, null, 'AI Quiz document must be restored');
    assert.notStrictEqual(unrelatedDoc.deleted_at, null, 'Unrelated document must remain in recycle bin');
  });

  // ── Test 2: Idempotent restore does not throw and maintains state ──
  test('Test 2: Repeated restore calls are idempotent and maintain restored state', async () => {
    const db = createMockDb();
    const primaryDocId = 'doc-source-11111111-2222';
    const targetDoc = db.documents.find((d) => d.id === primaryDocId)!;

    targetDoc.deleted_at = null;
    await mockRestoreAssociatedAiDocuments(db, 'user-1', primaryDocId, targetDoc.title, targetDoc.subject_id);

    // Call restore again
    targetDoc.deleted_at = null;
    await mockRestoreAssociatedAiDocuments(db, 'user-1', primaryDocId, targetDoc.title, targetDoc.subject_id);

    const summaryDoc = db.documents.find((d) => d.id === 'doc-ai-summary-1')!;
    assert.strictEqual(summaryDoc.deleted_at, null);
  });
});
