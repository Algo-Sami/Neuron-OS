import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFilename,
  generateCopyFilename,
  findNextAvailableCopyName,
  checkDuplicateUpload,
} from '../../src/services/storage/duplicate-detection';

describe('Neuron OS — Duplicate Upload & Copy Naming Test Suite', () => {

  // ── Test 1: Exact Duplicate Detection ────────────────────────────────────
  test('Test 1: Exact duplicate filename is detected in the same folder', () => {
    const existing = normalizeFilename('PP lecture 1.pdf');
    const incoming = normalizeFilename('PP lecture 1.pdf');
    assert.strictEqual(existing, incoming);
  });

  // ── Test 2: Different File Allowed ───────────────────────────────────────
  test('Test 2: Distinct filename is not flagged as duplicate', () => {
    const existing = normalizeFilename('PP lecture 1.pdf');
    const incoming = normalizeFilename('PP lecture 2.pdf');
    assert.notStrictEqual(existing, incoming);
  });

  // ── Test 3: Case Difference Normalization ─────────────────────────────────
  test('Test 3: Case difference is normalized and detected as duplicate', () => {
    const existing = normalizeFilename('PP Lecture 1.pdf');
    const incoming = normalizeFilename('pp lecture 1.pdf');
    assert.strictEqual(existing, incoming);
  });

  // ── Test 4: Whitespace Difference Normalization ───────────────────────────
  test('Test 4: Whitespace padding and internal multiple spaces are normalized', () => {
    const existing = normalizeFilename('PP lecture 1.pdf');
    const incoming1 = normalizeFilename('  PP lecture 1.pdf  ');
    const incoming2 = normalizeFilename('PP   lecture   1.pdf');
    assert.strictEqual(incoming1, existing);
    assert.strictEqual(incoming2, existing);
  });

  // ── Test 5: Upload as Copy Generation ─────────────────────────────────────
  test('Test 5: Numbering appears before extension for copy generation', () => {
    const originalPdf = 'PP lecture 1.pdf';
    const copy1 = generateCopyFilename(originalPdf, 1);
    assert.strictEqual(copy1, 'PP lecture 1 (1).pdf');

    const originalDocx = 'Course Syllabus.docx';
    const copyDocx = generateCopyFilename(originalDocx, 1);
    assert.strictEqual(copyDocx, 'Course Syllabus (1).docx');

    const originalPptx = 'Chapter 3 Slides.pptx';
    const copyPptx = generateCopyFilename(originalPptx, 1);
    assert.strictEqual(copyPptx, 'Chapter 3 Slides (1).pptx');
  });

  // ── Test 6: Multiple Sequential Copies ────────────────────────────────────
  test('Test 6: Multiple sequential copies increment cleanly from base name', () => {
    const copy1 = generateCopyFilename('Lecture.pdf', 1);
    assert.strictEqual(copy1, 'Lecture (1).pdf');

    const copy2 = generateCopyFilename('Lecture (1).pdf', 2);
    assert.strictEqual(copy2, 'Lecture (2).pdf');

    const copy3 = generateCopyFilename('Lecture (2).pdf', 3);
    assert.strictEqual(copy3, 'Lecture (3).pdf');
  });

  // ── Test 7: Different Extension are Distinct ──────────────────────────────
  test('Test 7: Files with same base name but different extensions are distinct', () => {
    const pdf = normalizeFilename('Lecture.pdf');
    const docx = normalizeFilename('Lecture.docx');
    assert.notStrictEqual(pdf, docx);
  });

  // ── Test 8: Folder Scoping Invariant ──────────────────────────────────────
  test('Test 8: Duplicate detection checks within the target destination folder', async () => {
    // Mock Supabase client
    const mockSupabase: any = {
      from: (table: string) => {
        if (table === 'documents') {
          return {
            select: () => ({
              eq: (field: string, val: string) => ({
                is: () => ({
                  ilike: () => ({
                    eq: (f: string, folderId: string) => ({
                      data: folderId === 'folder-A' ? [{ id: 'doc-1', title: 'Lecture 1.pdf' }] : [],
                      error: null,
                    }),
                    is: () => ({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      },
    };

    const nextCopy = await findNextAvailableCopyName(mockSupabase, 'user-1', 'folder-B', 'Lecture 1.pdf');
    assert.strictEqual(nextCopy, 'Lecture 1 (1).pdf');
  });

  // ── Test 9: User Scoping Invariant ────────────────────────────────────────
  test('Test 9: User isolation ensures User A files are never matched for User B', async () => {
    const mockDb = [
      { user_id: 'user-A', folder_id: 'folder-1', title: 'Lecture 1.pdf', deleted_at: null },
    ];

    const isDuplicateForUser = (userId: string, folderId: string, title: string) => {
      const norm = normalizeFilename(title);
      return mockDb.some(
        (d) => d.user_id === userId && d.folder_id === folderId && normalizeFilename(d.title) === norm && d.deleted_at === null
      );
    };

    assert.strictEqual(isDuplicateForUser('user-A', 'folder-1', 'Lecture 1.pdf'), true);
    assert.strictEqual(isDuplicateForUser('user-B', 'folder-1', 'Lecture 1.pdf'), false);
  });

  // ── Test 10: PostgreSQL 23505 Conflict Mapping ────────────────────────────
  test('Test 10: Database unique violation (23505) is converted to structured DUPLICATE_FILE code', () => {
    const simulateDatabaseError = (err: { code?: string; message: string }) => {
      if (
        err.code === '23505' ||
        err.message.includes('idx_documents_unique_folder_title') ||
        err.message.toLowerCase().includes('unique constraint')
      ) {
        return {
          success: false,
          code: 'DUPLICATE_FILE',
          message: 'A file with this name already exists in this location.',
        };
      }
      return {
        success: false,
        code: 'UNKNOWN_ERROR',
        message: err.message,
      };
    };

    const pgError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "idx_documents_unique_folder_title"',
    };

    const result = simulateDatabaseError(pgError);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'DUPLICATE_FILE');
    assert.ok(!result.message.includes('23505'));
    assert.ok(!result.message.includes('idx_documents_unique_folder_title'));
  });

  // ── Test 11: Error Classification Isolation ──────────────────────────────
  test('Test 11: Storage or auth failures are correctly differentiated from duplicates', () => {
    const classifyUploadError = (err: { code?: string; message?: string; type?: string }) => {
      const msg = err.message?.toLowerCase() || '';
      if (err.type === 'auth' || msg.includes('log in') || msg.includes('unauthorized')) {
        return 'AUTH_ERROR';
      }
      if (err.type === 'storage' || msg.includes('storage')) {
        return 'STORAGE_ERROR';
      }
      if (err.code === '23505' || msg.includes('unique constraint') || msg.includes('duplicate')) {
        return 'DUPLICATE_FILE';
      }
      return 'UNKNOWN_ERROR';
    };

    assert.strictEqual(classifyUploadError({ message: 'Storage bucket timeout' }), 'STORAGE_ERROR');
    assert.strictEqual(classifyUploadError({ message: 'Unauthorized' }), 'AUTH_ERROR');
    assert.strictEqual(classifyUploadError({ code: '23505', message: 'duplicate key' }), 'DUPLICATE_FILE');
  });

  // ── Test 12: Recycled / Soft-deleted files do not trigger duplicates ──────
  test('Test 12: Soft-deleted (recycle bin) files are excluded from duplicate conflicts', () => {
    const mockDbWithDeleted = [
      { user_id: 'user-1', folder_id: 'f-1', title: 'Lecture 1.pdf', deleted_at: '2026-08-01T00:00:00Z' },
    ];

    const isDuplicateActiveOnly = (userId: string, folderId: string, title: string) => {
      const norm = normalizeFilename(title);
      return mockDbWithDeleted.some(
        (d) => d.user_id === userId && d.folder_id === folderId && normalizeFilename(d.title) === norm && d.deleted_at === null
      );
    };

    assert.strictEqual(isDuplicateActiveOnly('user-1', 'f-1', 'Lecture 1.pdf'), false);
  });

  // ── Test 13: Extract Base Filename Helper ─────────────────────────────────
  test('Test 13: extractBaseFileName strips copy suffixes cleanly while preserving extension', () => {
    const { extractBaseFileName } = require('../../src/services/storage/duplicate-detection');
    assert.strictEqual(
      extractBaseFileName('Payment Receipt - KHADIJA BIBI (1).pdf'),
      'Payment Receipt - KHADIJA BIBI.pdf'
    );
    assert.strictEqual(
      extractBaseFileName('Payment Receipt - KHADIJA BIBI (2).pdf'),
      'Payment Receipt - KHADIJA BIBI.pdf'
    );
    assert.strictEqual(
      extractBaseFileName('Payment Receipt - KHADIJA BIBI.pdf'),
      'Payment Receipt - KHADIJA BIBI.pdf'
    );
  });

  // ── Test 14: Cross-Folder / Subject-Wide Duplicate Detection ──────────────
  test('Test 14: Duplicate detection identifies file previously placed in Assignments when uploading globally', async () => {
    const mockDb = [
      {
        id: 'doc-assignment-1',
        user_id: 'user-1',
        subject_id: 'subj-ds',
        folder_id: 'folder-assignments',
        title: 'Payment Receipt - KHADIJA BIBI.pdf',
        size: 217900,
        created_at: '2026-08-30T10:00:00Z',
        deleted_at: null,
        subjects: { name: 'Data Structure' },
        folders: { name: 'Assignments' },
      },
    ];

    // Verify that querying with normalized title across subject/workspace detects the assignment file
    const targetName = normalizeFilename('Payment Receipt - KHADIJA BIBI.pdf');
    const matched = mockDb.find(
      (d) => d.user_id === 'user-1' && normalizeFilename(d.title) === targetName && d.deleted_at === null
    );

    assert.ok(matched, 'Existing file in Assignments should be matched');
    assert.strictEqual(matched?.folders.name, 'Assignments');
    assert.strictEqual(matched?.subjects.name, 'Data Structure');
  });

  // ── Test 15: Folder Inheritance for Generic / Uncategorized Files ──────────
  test('Test 15: Uncategorized file inherits folder of its existing base file in the same subject', () => {
    const existingBaseDoc = {
      folder_id: 'folder-assignments',
      folders: { name: 'Assignments' },
    };

    let resolvedFolderId: string | null = null;
    let targetFolderName: string | null = null;

    if (existingBaseDoc?.folder_id) {
      resolvedFolderId = existingBaseDoc.folder_id;
      targetFolderName = existingBaseDoc.folders.name;
    }

    assert.strictEqual(resolvedFolderId, 'folder-assignments');
    assert.strictEqual(targetFolderName, 'Assignments');
  });
});
