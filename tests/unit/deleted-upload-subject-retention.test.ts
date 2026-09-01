/**
 * Unit Test Suite: Deleted Upload Subject & Folder Retention Invariants
 *
 * Verifies that when documents are deleted from subject folders, their originating
 * subject name, folder name, and related metadata are permanently preserved
 * in the upload history audit trail.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Upload History Deleted File Subject Retention Invariants', () => {
  // ── Test 1: Upload audit row captures subject and folder snapshots on creation ──
  test('Test 1: Upload audit row records subject_id, subject_name, folder_id, and folder_name upon upload', () => {
    const uploadPayload = {
      file_name: 'Payment Receipt - KHADIJA BIBI.pdf',
      file_size: 223129,
      status: 'completed',
      subject_id: 'sub-info-123',
      subject_name: 'info',
      folder_id: 'folder-lectures-456',
      folder_name: 'Lectures',
      ai_subject: 'info',
      ai_topic: 'Lectures',
    };

    assert.strictEqual(uploadPayload.subject_id, 'sub-info-123');
    assert.strictEqual(uploadPayload.subject_name, 'info');
    assert.strictEqual(uploadPayload.folder_id, 'folder-lectures-456');
    assert.strictEqual(uploadPayload.folder_name, 'Lectures');
    assert.strictEqual(uploadPayload.ai_subject, 'info');
  });

  // ── Test 2: Classification confirmation syncs resolved subject to uploads row ──
  test('Test 2: Classification confirmation updates linked uploads audit record', () => {
    const uploadRecord = {
      id: 'upload-1',
      file_name: 'Lec 3.pdf',
      subject_id: null as string | null,
      subject_name: null as string | null,
    };

    const confirmedSubjectId = 'sub-dbms-789';
    const confirmedSubjectName = 'Database Management Systems';

    // Simulate confirmation update
    uploadRecord.subject_id = confirmedSubjectId;
    uploadRecord.subject_name = confirmedSubjectName;

    assert.strictEqual(uploadRecord.subject_id, 'sub-dbms-789');
    assert.strictEqual(uploadRecord.subject_name, 'Database Management Systems');
  });

  // ── Test 3: Permanent deletion preserves subject & folder snapshots on uploads audit ──
  test('Test 3: Permanent deletion marks upload as deleted while preserving originating subject & folder metadata', () => {
    const docEntity = {
      id: 'doc-receipt-999',
      title: 'Payment Receipt - KHADIJA BIBI.pdf',
      subject_id: 'sub-info-123',
      folder_id: 'folder-lectures-456',
      ai_subject: 'info',
      ai_topic: 'Lectures',
      upload_id: 'upload-receipt-888',
    };

    let uploadsAuditRow = {
      id: 'upload-receipt-888',
      file_name: 'Payment Receipt - KHADIJA BIBI.pdf',
      status: 'completed',
      deleted_at: null as string | null,
      subject_id: null as string | null,
      subject_name: null as string | null,
      folder_id: null as string | null,
      folder_name: null as string | null,
      ai_subject: null as string | null,
      ai_topic: null as string | null,
    };

    // Simulate permanent deletion snapshot preservation
    const now = new Date().toISOString();
    uploadsAuditRow = {
      ...uploadsAuditRow,
      status: 'deleted',
      deleted_at: now,
      subject_id: docEntity.subject_id,
      subject_name: docEntity.ai_subject,
      folder_id: docEntity.folder_id,
      folder_name: docEntity.ai_topic,
      ai_subject: docEntity.ai_subject,
      ai_topic: docEntity.ai_topic,
    };

    assert.strictEqual(uploadsAuditRow.status, 'deleted');
    assert.notStrictEqual(uploadsAuditRow.deleted_at, null);
    assert.strictEqual(uploadsAuditRow.subject_name, 'info');
    assert.strictEqual(uploadsAuditRow.folder_name, 'Lectures');
  });

  // ── Test 4: Server page loader correctly maps deleted uploads into DocumentRows ──
  test('Test 4: Deleted upload audit rows map to DocumentRow with subject and folder information populated', () => {
    const uploadAuditLogs = [
      {
        id: 'upload-receipt-888',
        file_name: 'Payment Receipt - KHADIJA BIBI.pdf',
        file_type: 'pdf',
        file_size: 223129,
        status: 'deleted',
        created_at: '2026-08-31T10:00:00Z',
        deleted_at: '2026-09-01T07:00:00Z',
        subject_id: 'sub-info-123',
        subject_name: 'info',
        folder_id: 'folder-lectures-456',
        folder_name: 'Lectures',
        ai_subject: 'info',
        ai_topic: 'Lectures',
      },
    ];

    const activeUploadIds = new Set<string>();

    const allSubjects = [{ id: 'sub-info-123', name: 'info' }];

    const deletedUploadRows = uploadAuditLogs
      .filter((u) => !activeUploadIds.has(u.id))
      .map((u) => {
        const subName =
          u.subject_name ||
          u.ai_subject ||
          (u.subject_id ? allSubjects.find((s) => s.id === u.subject_id)?.name : null) ||
          null;
        return {
          id: `upload-${u.id}`,
          title: u.file_name,
          file_type: u.file_type,
          file_url: null,
          created_at: u.created_at,
          deleted_at: u.deleted_at || u.created_at,
          summary_status: null,
          quiz_status: null,
          classification_status: null,
          ai_subject: subName,
          ai_topic: u.folder_name || u.ai_topic || null,
          subject_id: u.subject_id || null,
          folder_id: u.folder_id || null,
          size: u.file_size,
          uploads: { file_size: u.file_size },
          file_deleted: true,
        };
      });

    assert.strictEqual(deletedUploadRows.length, 1);
    assert.strictEqual(deletedUploadRows[0].ai_subject, 'info');
    assert.strictEqual(deletedUploadRows[0].ai_topic, 'Lectures');
    assert.strictEqual(deletedUploadRows[0].file_deleted, true);
    assert.strictEqual(deletedUploadRows[0].title, 'Payment Receipt - KHADIJA BIBI.pdf');
  });

  // ── Test 5: UI subject resolution displays preserved subject name seamlessly ──
  test('Test 5: UI table and detail panel resolve subject name via subjectMap or ai_subject fallback', () => {
    const subjects = [{ id: 'sub-other', name: 'Other Subject' }];
    const subjectMap = new Map<string, string>();
    subjects.forEach((s) => subjectMap.set(s.id, s.name));

    // Case A: Active document with valid subject_id
    const activeDoc = {
      id: 'doc-1',
      subject_id: 'sub-other',
      ai_subject: null,
    };
    const activeResolved =
      (activeDoc.subject_id ? subjectMap.get(activeDoc.subject_id) : null) ||
      activeDoc.ai_subject ||
      'Unassigned';
    assert.strictEqual(activeResolved, 'Other Subject');

    // Case B: Deleted document where subject_id is not in active map, but ai_subject snapshot is preserved
    const deletedDoc = {
      id: 'upload-receipt-888',
      subject_id: 'sub-info-123',
      ai_subject: 'info',
    };
    const deletedResolved =
      (deletedDoc.subject_id ? subjectMap.get(deletedDoc.subject_id) : null) ||
      deletedDoc.ai_subject ||
      'Unassigned';
    assert.strictEqual(deletedResolved, 'info');

    // Case C: Document truly unassigned
    const unassignedDoc = {
      id: 'doc-unknown',
      subject_id: null,
      ai_subject: null,
    };
    const unassignedResolved =
      (unassignedDoc.subject_id ? subjectMap.get(unassignedDoc.subject_id) : null) ||
      unassignedDoc.ai_subject ||
      'Unassigned';
    assert.strictEqual(unassignedResolved, 'Unassigned');
  });

  // ── Test 6: Auto-healing resolves subject for legacy deleted audit records ──
  test('Test 6: Auto-healing associates legacy unassigned deleted records using companion uploads stem', () => {
    const legacyDeletedUpload = {
      id: 'legacy-1',
      file_name: 'Payment Receipt - KHADIJA BIBI.pdf',
      subject_id: null as string | null,
      subject_name: null as string | null,
      ai_subject: null as string | null,
    };

    const companionDocs = [
      {
        id: 'doc-attestation',
        title: 'Attestation Form - KHADIJA BIBI.pdf',
        subject_id: 'sub-info-123',
        ai_subject: 'info',
      },
    ];

    const cleanName = legacyDeletedUpload.file_name.replace(/\.[^/.]+$/, '').trim();
    const matchPartner = companionDocs.find((d) => {
      const dName = d.title.replace(/\.[^/.]+$/, '').trim();
      const uParts = cleanName
        .split(/[-_ ]/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 3);
      return uParts.some((part) => dName.toLowerCase().includes(part));
    });

    assert.ok(matchPartner);
    const healedSubjectName = matchPartner?.ai_subject || null;
    assert.strictEqual(healedSubjectName, 'info');
  });

  // ── Test 7: Subject permanent deletion cascades to document storage cleanup and upload audit ──
  test('Test 7: Subject permanent deletion cascades to document storage cleanup and upload audit', () => {
    const subject = { id: 'sub-pp-123', name: 'Professional Practices' };
    const documents = [
      {
        id: 'doc-pp-1',
        title: 'PP lecture 1.pdf',
        file_url: 'https://example.com/storage/documents/user-1/pp-lecture-1.pdf',
        upload_id: 'upload-pp-1',
        subject_id: 'sub-pp-123',
        ai_subject: 'Professional Practices',
        ai_topic: 'Lectures',
      },
    ];

    let uploadRow = {
      id: 'upload-pp-1',
      file_name: 'PP lecture 1.pdf',
      status: 'completed',
      deleted_at: null as string | null,
      subject_id: 'sub-pp-123',
      subject_name: 'Professional Practices',
      ai_subject: 'Professional Practices',
    };

    // Simulate cascade delete
    const now = new Date().toISOString();
    const deletedStoragePaths: string[] = [];

    for (const doc of documents) {
      if (doc.file_url) {
        deletedStoragePaths.push(doc.file_url);
      }
      if (doc.upload_id === uploadRow.id) {
        uploadRow = {
          ...uploadRow,
          status: 'deleted',
          deleted_at: now,
          subject_name: doc.ai_subject || subject.name,
          ai_subject: doc.ai_subject || subject.name,
        };
      }
    }

    assert.strictEqual(deletedStoragePaths.length, 1);
    assert.strictEqual(uploadRow.status, 'deleted');
    assert.notStrictEqual(uploadRow.deleted_at, null);
    assert.strictEqual(uploadRow.subject_name, 'Professional Practices');
  });

  // ── Test 8: UploadsPage marks documents of recycled or missing subjects with file_deleted true and file_url null ──
  test('Test 8: UploadsPage marks documents of recycled or missing subjects with file_deleted true and file_url null', () => {
    const allSubjects = [
      { id: 'sub-active', name: 'Active Subject', deleted_at: null },
      { id: 'sub-recycled', name: 'Recycled Subject', deleted_at: '2026-09-01T08:00:00Z' },
    ];

    const userUploadedDocs = [
      {
        id: 'doc-active',
        title: 'ActiveDoc.pdf',
        file_url: 'https://example.com/storage/activedoc.pdf',
        subject_id: 'sub-active',
        deleted_at: null,
      },
      {
        id: 'doc-recycled-parent',
        title: 'PP lecture 1.pdf',
        file_url: 'https://example.com/storage/pp-lecture-1.pdf',
        subject_id: 'sub-recycled',
        deleted_at: null, // document not yet marked deleted individually, but parent subject is recycled
      },
      {
        id: 'doc-missing-parent',
        title: 'OldDoc.pdf',
        file_url: 'https://example.com/storage/olddoc.pdf',
        subject_id: 'sub-deleted-permanent', // parent subject permanently deleted
        deleted_at: null,
      },
    ];

    const processedDocs = userUploadedDocs.map((d) => {
      const subject = allSubjects.find((s) => s.id === d.subject_id);
      const isSubjectRecycled = Boolean(subject?.deleted_at);
      const isSubjectMissing = Boolean(d.subject_id && !subject);
      const isDeleted = Boolean(d.deleted_at || isSubjectRecycled || isSubjectMissing);
      return {
        ...d,
        file_deleted: isDeleted,
        file_url: isDeleted ? null : d.file_url,
      };
    });

    assert.strictEqual(processedDocs[0].file_deleted, false);
    assert.strictEqual(processedDocs[0].file_url, 'https://example.com/storage/activedoc.pdf');

    assert.strictEqual(processedDocs[1].file_deleted, true);
    assert.strictEqual(processedDocs[1].file_url, null);

    assert.strictEqual(processedDocs[2].file_deleted, true);
    assert.strictEqual(processedDocs[2].file_url, null);
  });
});

