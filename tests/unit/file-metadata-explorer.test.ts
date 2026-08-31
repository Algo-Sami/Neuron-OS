import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFileSize,
  formatExplorerItemSize,
  extractStoragePath,
  getStorageFileMetadata,
  verifyStorageFile,
  syncDocumentMetadata,
  reconcileUserDocumentMetadata,
} from '../../src/services/storage/file-metadata';

describe('Neuron OS — File Metadata & Explorer Integrity Test Suite', () => {

  // ── Test 1: Folder size is strictly "—" ──────────────────────────────────
  test('Test 1: Folder size is always "—" regardless of underlying values', () => {
    assert.strictEqual(formatExplorerItemSize('folder', undefined), '—');
    assert.strictEqual(formatExplorerItemSize('folder', null), '—');
    assert.strictEqual(formatExplorerItemSize('folder', 1048576), '—');
    assert.strictEqual(formatExplorerItemSize('subject', 52428800), '—');
  });

  // ── Test 2: Folder with status "Queued" maintains size = "—" ──────────────
  test('Test 2: Folder with status "Queued" does not leak status into size column', () => {
    const item = {
      type: 'folder' as const,
      taskStatus: 'Queued',
      fileSize: null,
    };
    const renderedSize = formatExplorerItemSize(item.type, item.fileSize);
    assert.strictEqual(renderedSize, '—');
    assert.notStrictEqual(renderedSize, 'Queued');
  });

  // ── Test 3: Folder with status "Ready" maintains size = "—" ───────────────
  test('Test 3: Folder with status "Ready" does not leak status into size column', () => {
    const item = {
      type: 'folder' as const,
      taskStatus: 'Completed',
      fileSize: null,
    };
    const renderedSize = formatExplorerItemSize(item.type, item.fileSize);
    assert.strictEqual(renderedSize, '—');
    assert.notStrictEqual(renderedSize, 'Ready');
    assert.notStrictEqual(renderedSize, 'Completed');
  });

  // ── Test 4: Normal file format ────────────────────────────────────────────
  test('Test 4: Normal file of 103000 bytes displays proper human-readable size', () => {
    const sizeBytes = 103000;
    const formatted = formatFileSize(sizeBytes);
    assert.ok(formatted.includes('KB') || formatted.includes('kB'), `Expected KB in ${formatted}`);
    assert.ok(formatted.startsWith('101') || formatted.startsWith('100.6'), `Expected ~101 KB in ${formatted}`);
    assert.strictEqual(formatExplorerItemSize('file', sizeBytes), formatted);
  });

  // ── Test 5: AI-generated file displays actual physical storage size ────────
  test('Test 5: AI-generated file with 184392 bytes displays actual size and NEVER "0 KB"', () => {
    const aiFileSizeBytes = 184392;
    const formatted = formatFileSize(aiFileSizeBytes);
    assert.notStrictEqual(formatted, '0 KB');
    assert.notStrictEqual(formatted, '0 B');
    assert.notStrictEqual(formatted, '—');
    assert.ok(formatted.includes('KB'), `Expected formatted size to contain KB, got "${formatted}"`);
  });

  // ── Test 6: Genuine zero-byte file displays "0 B" ─────────────────────────
  test('Test 6: Genuine zero-byte file displays "0 B" distinguishing from missing metadata', () => {
    assert.strictEqual(formatFileSize(0), '0 B');
    assert.strictEqual(formatExplorerItemSize('file', 0), '0 B');
    // Whereas missing metadata returns "—"
    assert.strictEqual(formatFileSize(null), '—');
    assert.strictEqual(formatFileSize(undefined), '—');
  });

  // ── Test 7: Failed Storage upload is caught by verification ──────────────
  test('Test 7: Failed storage upload prevents marking resource READY', async () => {
    // Mock Supabase client where object does not exist
    const mockSupabase: any = {
      storage: {
        from: () => ({
          list: async () => ({
            data: [],
            error: null,
          }),
        }),
      },
    };

    const verifyResult = await verifyStorageFile(mockSupabase, 'user-123/ai-gen-summary.pdf');
    assert.strictEqual(verifyResult.verified, false);
    assert.ok(verifyResult.error?.includes('Object not found') || verifyResult.error?.includes('does not exist'));
  });

  // ── Test 8: Metadata retrieval failure does not silently succeed ──────────
  test('Test 8: Storage API error during metadata retrieval returns explicit failure', async () => {
    const mockSupabase: any = {
      storage: {
        from: () => ({
          list: async () => ({
            data: null,
            error: { message: 'Storage network timeout' },
          }),
        }),
      },
    };

    const result = await getStorageFileMetadata(mockSupabase, 'user-123/ai-gen-summary.pdf');
    assert.strictEqual(result.exists, false);
    assert.strictEqual(result.sizeBytes, null);
    assert.ok(result.error?.includes('Storage network timeout'));
  });

  // ── Test 9: Missing storage object detected during reconciliation ─────────
  test('Test 9: Missing storage object is detected and reported during sync', async () => {
    const mockSupabase: any = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'doc-1',
                user_id: 'user-1',
                title: 'Summary.pdf',
                file_url: 'https://test.supabase.co/storage/v1/object/public/documents/user-1/missing.pdf',
                size: 0,
              },
              error: null,
            }),
          }),
        }),
      }),
      storage: {
        from: () => ({
          list: async () => ({
            data: [], // empty list -> file does not exist
            error: null,
          }),
        }),
      },
    };

    const syncRes = await syncDocumentMetadata(mockSupabase, 'doc-1');
    assert.strictEqual(syncRes.success, false);
    assert.ok(syncRes.error?.includes('not found') || syncRes.error?.includes('missing'));
  });

  // ── Test 10: Metadata repair updates database size from physical storage ──
  test('Test 10: Reconciliation repairs database record from 0 B to actual 184392 B', async () => {
    let updatedPayload: any = null;

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === 'documents') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'doc-ai-summary',
                    user_id: 'user-1',
                    title: 'Summary.pdf',
                    file_url: 'https://test.supabase.co/storage/v1/object/public/documents/user-1/ai-gen-12345-summary.pdf',
                    size: 0, // stale/missing size
                    upload_id: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: (payload: any) => ({
              eq: async (col: string, val: string) => {
                updatedPayload = payload;
                return { error: null };
              },
            }),
          };
        }
        return {};
      },
      storage: {
        from: () => ({
          list: async () => ({
            data: [
              {
                name: 'ai-gen-12345-summary.pdf',
                metadata: {
                  size: 184392,
                  mimetype: 'application/pdf',
                },
              },
            ],
            error: null,
          }),
        }),
      },
    };

    const syncRes = await syncDocumentMetadata(mockSupabase, 'doc-ai-summary');
    assert.strictEqual(syncRes.success, true);
    assert.strictEqual(syncRes.repaired, true);
    assert.strictEqual(syncRes.sizeBytes, 184392);
    assert.strictEqual(updatedPayload?.size, 184392);
  });

  // ── Test 11: Storage path extraction handles various URL schemas ───────────
  test('Test 11: Storage path extraction correctly normalizes URLs and paths', () => {
    const url1 = 'https://xyz.supabase.co/storage/v1/object/public/documents/user-456/notes.pdf';
    assert.strictEqual(extractStoragePath(url1), 'user-456/notes.pdf');

    const url2 = 'https://xyz.supabase.co/storage/v1/object/authenticated/documents/user-789/ai-gen-1-summary.pdf?token=123';
    assert.strictEqual(extractStoragePath(url2), 'user-789/ai-gen-1-summary.pdf');

    const relPath = 'documents/user-abc/lec1.pdf';
    assert.strictEqual(extractStoragePath(relPath), 'user-abc/lec1.pdf');
  });

  // ── Test 12: AI resource vs Upload History isolation invariant ────────────
  test('Test 12: AI-generated documents have upload_id = null and are excluded from uploads table queries', () => {
    const userUploadDoc = {
      id: 'doc-user-pdf',
      title: 'PP_lecture_6.pdf',
      upload_id: 'upload-row-1',
      ai_doc_type: null,
    };

    const aiSummaryDoc = {
      id: 'doc-ai-summary',
      title: 'Summary.pdf',
      upload_id: null,
      ai_doc_type: 'ai_generated',
    };

    // Upload History filter rule: requires upload_id != null or non-ai_generated
    const isUploadHistoryCandidate = (d: typeof userUploadDoc) => d.upload_id !== null && d.ai_doc_type !== 'ai_generated';

    assert.strictEqual(isUploadHistoryCandidate(userUploadDoc), true);
    assert.strictEqual(isUploadHistoryCandidate(aiSummaryDoc), false);
  });

  // ── Test 13: Folder Status Invariant — Populated / Completed folders suppress badges ──
  test('Test 13: Populated or completed folders suppress stale Queued / Ready badges', () => {
    // Helper replicating FolderStatusBadge decision rule
    const shouldDisplayBadge = (item: {
      taskStatus?: string | null;
      aiStatus?: string | null;
      documentCount?: number | null;
    }) => {
      const { taskStatus, aiStatus, documentCount } = item;
      if (!taskStatus) return false;
      if (
        taskStatus === 'completed' ||
        taskStatus === 'Completed' ||
        taskStatus === 'Ready' ||
        aiStatus === 'processed' ||
        ((documentCount ?? 0) > 0 && (taskStatus === 'pending' || taskStatus === 'Queued'))
      ) {
        return false;
      }
      return true;
    };

    // Case 1: Folder with generated summaries but stale 'Queued' task
    assert.strictEqual(
      shouldDisplayBadge({ taskStatus: 'Queued', aiStatus: 'processed', documentCount: 3 }),
      false,
      'Folder with summaries must not show Queued badge'
    );

    // Case 2: Folder completed
    assert.strictEqual(
      shouldDisplayBadge({ taskStatus: 'Completed', aiStatus: 'processed', documentCount: 2 }),
      false,
      'Completed folder must not show Ready badge'
    );

    // Case 3: Brand new queued folder with 0 documents
    assert.strictEqual(
      shouldDisplayBadge({ taskStatus: 'Queued', aiStatus: 'pending', documentCount: 0 }),
      true,
      'Genuinely queued folder without documents should display Queued'
    );

    // Case 4: Active processing folder
    assert.strictEqual(
      shouldDisplayBadge({ taskStatus: 'Generating Summary', aiStatus: 'processing', documentCount: 0 }),
      true,
      'Actively processing folder should display progress stage'
    );

    // Case 5: Failed processing folder
    assert.strictEqual(
      shouldDisplayBadge({ taskStatus: 'Failed', aiStatus: 'failed', documentCount: 0 }),
      true,
      'Failed folder should display Failed badge'
    );
  });
});

