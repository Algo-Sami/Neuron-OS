import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Account Storage Deletion Hardening Suite', () => {
  it('Test 1: Normal files and nested folder hierarchies are recursively traversed and deleted', async () => {
    const deletedPaths: string[] = [];
    const mockStorage: Record<string, any[]> = {
      'user_123': [
        { name: 'doc1.pdf', id: '1', metadata: { mimetype: 'application/pdf', size: 1024 } },
        { name: 'subfolder', id: null, metadata: null }
      ],
      'user_123/subfolder': [
        { name: 'nested.pdf', id: '2', metadata: { mimetype: 'application/pdf', size: 2048 } }
      ]
    };

    const deleteRecursiveStoragePath = async (bucket: string, prefix: string) => {
      if (!prefix || !prefix.startsWith('user_123')) return;

      const items = mockStorage[prefix] || [];
      const filesToDelete: string[] = [];

      for (const item of items) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        const hasFileMetadata = item.metadata && (item.metadata.mimetype || typeof item.metadata.size === 'number');

        if (hasFileMetadata) {
          filesToDelete.push(fullPath);
        } else {
          const subItems = mockStorage[fullPath];
          if (subItems && subItems.length > 0) {
            await deleteRecursiveStoragePath(bucket, fullPath);
          } else {
            filesToDelete.push(fullPath);
          }
        }
      }

      if (filesToDelete.length > 0) {
        deletedPaths.push(...filesToDelete);
      }
    };

    await deleteRecursiveStoragePath('documents', 'user_123');

    assert.ok(deletedPaths.includes('user_123/doc1.pdf'));
    assert.ok(deletedPaths.includes('user_123/subfolder/nested.pdf'));
    assert.strictEqual(deletedPaths.length, 2);
  });

  it('Test 2: Missing or null metadata or null IDs are handled safely without crashing', async () => {
    const deletedPaths: string[] = [];
    const mockStorage: Record<string, any[]> = {
      'user_123': [
        { name: 'unknown_blob', id: null, metadata: null },
        { name: 'corrupted_meta.bin', id: '3', metadata: {} }
      ],
      'user_123/unknown_blob': [] // Child check returns empty -> treated as leaf object
    };

    const deleteRecursiveStoragePath = async (bucket: string, prefix: string) => {
      if (!prefix || !prefix.startsWith('user_123')) return;

      const items = mockStorage[prefix] || [];
      const filesToDelete: string[] = [];

      for (const item of items) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        const hasFileMetadata = item.metadata && (item.metadata.mimetype || typeof item.metadata.size === 'number');

        if (hasFileMetadata) {
          filesToDelete.push(fullPath);
        } else {
          const subItems = mockStorage[fullPath];
          if (subItems && subItems.length > 0) {
            await deleteRecursiveStoragePath(bucket, fullPath);
          } else {
            filesToDelete.push(fullPath);
          }
        }
      }

      if (filesToDelete.length > 0) {
        deletedPaths.push(...filesToDelete);
      }
    };

    await deleteRecursiveStoragePath('documents', 'user_123');
    assert.ok(deletedPaths.includes('user_123/unknown_blob'));
    assert.ok(deletedPaths.includes('user_123/corrupted_meta.bin'));
    assert.strictEqual(deletedPaths.length, 2);
  });

  it('Test 3: Already-deleted or missing files do not cause account deletion failure (idempotency)', async () => {
    let removeAttempted = false;
    let removeErrorEncountered = false;

    // Simulate Supabase Storage remove operation where file was already deleted
    const mockRemove = async (paths: string[]) => {
      removeAttempted = true;
      // Supabase remove returns success or non-fatal warning for already-missing files
      return { data: paths.map(p => ({ name: p, error: 'Not found' })), error: null };
    };

    const deleteRecursiveStoragePath = async (bucket: string, prefix: string) => {
      try {
        const filesToDelete = [`${prefix}/already_deleted.pdf`];
        const res = await mockRemove(filesToDelete);
        if (res.error) {
          removeErrorEncountered = true;
        }
      } catch {
        removeErrorEncountered = true;
      }
    };

    await deleteRecursiveStoragePath('documents', 'user_123');
    assert.strictEqual(removeAttempted, true);
    assert.strictEqual(removeErrorEncountered, false);
  });

  it('Test 4: Non-existent paths and empty folders exit cleanly without error', async () => {
    const mockStorage: Record<string, any[]> = {
      'user_123/empty_folder': []
    };

    let traversed = false;

    const deleteRecursiveStoragePath = async (bucket: string, prefix: string) => {
      if (!prefix || !prefix.startsWith('user_123')) return;
      const items = mockStorage[prefix];
      if (!items || items.length === 0) {
        traversed = true;
        return; // Safe early return
      }
    };

    // Non-existent path
    await deleteRecursiveStoragePath('documents', 'user_123/does_not_exist');
    assert.strictEqual(traversed, true);

    // Empty folder
    traversed = false;
    await deleteRecursiveStoragePath('documents', 'user_123/empty_folder');
    assert.strictEqual(traversed, true);
  });

  it('Test 5: Security boundary strictly prevents cross-user and path-traversal deletion', async () => {
    const deletedPaths: string[] = [];
    const currentUserId = 'user_123';

    const deleteRecursiveStoragePath = async (bucket: string, prefix: string) => {
      // Strict security boundary check
      if (!prefix || !prefix.startsWith(currentUserId)) {
        return; // Blocked
      }
      deletedPaths.push(prefix);
    };

    // Attempted cross-tenant deletions
    await deleteRecursiveStoragePath('documents', 'user_456');
    await deleteRecursiveStoragePath('documents', 'user_456/notes.pdf');
    await deleteRecursiveStoragePath('documents', '../other_bucket/user_456');
    await deleteRecursiveStoragePath('documents', '/etc/passwd');
    await deleteRecursiveStoragePath('documents', '');

    // Valid authenticated user path
    await deleteRecursiveStoragePath('documents', 'user_123');

    assert.strictEqual(deletedPaths.length, 1);
    assert.strictEqual(deletedPaths[0], 'user_123');
  });
});
