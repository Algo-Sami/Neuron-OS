import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupAiGeneratedResources } from '../../src/actions/uploads';
import { reconcileOrphanedAiGeneratedFolders } from '../../src/services/storage/file-metadata';

describe('Neuron OS — Cascade AI Deletion & Synchronization Suite', () => {

  test('Test 1: cleanupAiGeneratedResources removes linked AI docs, storage files, subfolders, and metadata', async () => {
    const deletedDocIds: string[] = [];
    const deletedFolderIds: string[] = [];
    const removedStoragePaths: string[] = [];
    const deletedMetadataTables: string[] = [];

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'documents') {
          return {
            select: () => ({
              eq: () => ({
                contains: (_col: string, val: string[]) => {
                  if (val.some(v => v.includes('doc-source-123'))) {
                    return Promise.resolve({
                      data: [{ id: 'doc-ai-summary-1', file_url: 'https://test.supabase.co/storage/v1/object/public/documents/user-1/ai-gen-123-doc-sour-summary.pdf', folder_id: 'folder-ai-sub-1' }]
                    });
                  }
                  return Promise.resolve({ data: [] });
                },
                eq: () => ({
                  ilike: () => Promise.resolve({
                    data: [{ id: 'doc-ai-summary-1', file_url: 'https://test.supabase.co/storage/v1/object/public/documents/user-1/ai-gen-123-doc-sour-summary.pdf', folder_id: 'folder-ai-sub-1' }]
                  })
                })
              })
            }),
            delete: () => ({
              in: (_col: string, ids: string[]) => ({
                eq: () => {
                  deletedDocIds.push(...ids);
                  return Promise.resolve({ error: null });
                }
              }),
              eq: () => Promise.resolve({ error: null })
            })
          };
        }

        if (table === 'folders') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({
                  data: [
                    { id: 'folder-ai-root', name: 'AI Generated', parent_folder_id: null, subject_id: 'sub-1' },
                    { id: 'folder-ai-lectures', name: 'Lectures', parent_folder_id: 'folder-ai-root', subject_id: 'sub-1' },
                    { id: 'folder-ai-sub-1', name: 'Attestation Form - KHADIJA BIBI', parent_folder_id: 'folder-ai-lectures', subject_id: 'sub-1' },
                  ]
                })
              })
            }),
            delete: () => ({
              in: (_col: string, ids: string[]) => ({
                eq: () => {
                  deletedFolderIds.push(...ids);
                  return Promise.resolve({ error: null });
                }
              })
            })
          };
        }

        // AI metadata tables
        return {
          delete: () => ({
            eq: () => {
              deletedMetadataTables.push(table);
              return Promise.resolve({ error: null });
            }
          })
        };
      },
      storage: {
        from: () => ({
          remove: (paths: string[]) => {
            removedStoragePaths.push(...paths);
            return Promise.resolve({ error: null });
          },
          list: () => Promise.resolve({ data: [] })
        })
      }
    };

    await cleanupAiGeneratedResources(
      mockSupabase,
      'user-1',
      'sub-1',
      'Attestation Form - KHADIJA BIBI.pdf',
      'doc-source-123'
    );

    // Verify AI document was deleted
    assert.ok(deletedDocIds.includes('doc-ai-summary-1'), 'AI summary document should be deleted');

    // Verify AI Generated document subfolder was deleted
    assert.ok(deletedFolderIds.includes('folder-ai-sub-1'), 'AI Generated subfolder should be deleted');

    // Verify storage file was removed
    assert.ok(
      removedStoragePaths.some(p => p.includes('ai-gen-123-doc-sour-summary.pdf')),
      'Storage PDF should be removed'
    );

    // Verify metadata tables cleaned up
    assert.ok(deletedMetadataTables.includes('ai_summaries'));
    assert.ok(deletedMetadataTables.includes('knowledge_assets'));
    assert.ok(deletedMetadataTables.includes('quizzes'));
    assert.ok(deletedMetadataTables.includes('flashcards'));
  });

  test('Test 2: reconcileOrphanedAiGeneratedFolders prunes orphaned AI folder when source doc is permanently gone', async () => {
    let prunedFolderId = '';
    let deletedDocInSub = '';

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'folders') {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [
                  { id: 'f-root', name: 'AI Generated', parent_folder_id: null, subject_id: 'sub-1' },
                  { id: 'f-cat', name: 'Lectures', parent_folder_id: 'f-root', subject_id: 'sub-1' },
                  { id: 'f-orphan-sub', name: 'Attestation Form - KHADIJA BIBI', parent_folder_id: 'f-cat', subject_id: 'sub-1' },
                ],
                error: null
              })
            }),
            delete: () => ({
              eq: (_col: string, id: string) => ({
                eq: () => {
                  prunedFolderId = id;
                  return Promise.resolve({ error: null });
                }
              })
            })
          };
        }

        if (table === 'documents') {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                // Only AI doc exists in subfolder, NO active or recycled source doc
                data: [
                  {
                    id: 'doc-ai-1',
                    title: 'Summary.pdf',
                    subject_id: 'sub-1',
                    folder_id: 'f-orphan-sub',
                    ai_doc_type: 'ai_generated',
                    deleted_at: null,
                    file_url: 'https://test/documents/u1/ai-gen-1.pdf'
                  }
                ],
                error: null
              })
            }),
            delete: () => ({
              eq: (_col: string, fid: string) => ({
                eq: () => {
                  deletedDocInSub = fid;
                  return Promise.resolve({ error: null });
                }
              })
            })
          };
        }

        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
      },
      storage: {
        from: () => ({
          remove: () => Promise.resolve({ error: null })
        })
      }
    };

    const result = await reconcileOrphanedAiGeneratedFolders(mockSupabase as any, 'u1');

    assert.strictEqual(result.prunedFoldersCount, 1, 'Should have pruned 1 orphaned folder');
    assert.strictEqual(prunedFolderId, 'f-orphan-sub', 'Pruned folder ID should match');
    assert.strictEqual(deletedDocInSub, 'f-orphan-sub', 'Documents in pruned folder should be deleted');
  });

  test('Test 3: reconcileOrphanedAiGeneratedFolders syncs soft-deleted status when source doc is in Recycle Bin', async () => {
    let syncedDocId = '';
    let appliedDeletedAt = '';

    const recycledTimestamp = '2026-08-31T08:00:00.000Z';

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'folders') {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [
                  { id: 'f-root', name: 'AI Generated', parent_folder_id: null, subject_id: 'sub-1' },
                  { id: 'f-cat', name: 'Lectures', parent_folder_id: 'f-root', subject_id: 'sub-1' },
                  { id: 'f-doc-sub', name: 'Lecture 1', parent_folder_id: 'f-cat', subject_id: 'sub-1' },
                ],
                error: null
              })
            })
          };
        }

        if (table === 'documents') {
          return {
            select: () => ({
              eq: () => Promise.resolve({
                data: [
                  // Source doc is soft-deleted
                  {
                    id: 'doc-source-1',
                    title: 'Lecture 1.pdf',
                    subject_id: 'sub-1',
                    folder_id: 'f-raw',
                    ai_doc_type: null,
                    deleted_at: recycledTimestamp
                  },
                  // AI generated doc is currently active (needs sync)
                  {
                    id: 'doc-ai-1',
                    title: 'Summary.pdf',
                    subject_id: 'sub-1',
                    folder_id: 'f-doc-sub',
                    ai_doc_type: 'ai_generated',
                    deleted_at: null,
                    file_url: 'https://test/documents/u1/ai-gen-1.pdf'
                  }
                ],
                error: null
              })
            }),
            update: (payload: { deleted_at: string }) => ({
              eq: (_col: string, docId: string) => ({
                eq: () => {
                  syncedDocId = docId;
                  appliedDeletedAt = payload.deleted_at;
                  return Promise.resolve({ error: null });
                }
              })
            })
          };
        }

        return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
      }
    };

    const result = await reconcileOrphanedAiGeneratedFolders(mockSupabase as any, 'u1');

    assert.strictEqual(result.syncedDocsCount, 1, 'Should have synced 1 AI document');
    assert.strictEqual(syncedDocId, 'doc-ai-1');
    assert.strictEqual(appliedDeletedAt, recycledTimestamp);
  });

});
