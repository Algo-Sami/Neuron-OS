"use server"

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { awardXP } from '@/services/gamification/rewards'
import { scaffoldSubjectFoldersAction } from '@/actions/folders'
import { dispatchStudyPackGeneration } from '@/services/ai/pipeline/study-pack-dispatcher'
import { SubjectClassifier } from '@/services/classification/classifier'
import { ClassificationLearningService } from '@/services/classification/learning-service'

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
}) {
  const t0 = performance.now();
  console.log(`[UploadTiming] saveUploadMetadata START for "${fileName}"`);
  const supabase = await createClient()

  // 1. Authenticate Request
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // 2. Classify against user's actual subjects using the 8-layer classification pipeline
  const classification = await SubjectClassifier.classify(
    {
      userId: user.id,
      filename: fileName,
      subjectId,
      folderId,
      currentSubjectId,
    },
    { supabase }
  );

  const resolvedSubjectId: string | null = classification.subjectId;
  let resolvedFolderId: string | null = null;
  const isHighConfidence = classification.confidence >= 0.90 || !!subjectId;
  const classificationStatus: 'auto_applied' | 'needs_review' = isHighConfidence
    ? 'auto_applied'
    : 'needs_review';

  // 3. Resolve Folder (with parent-child nesting for Lab materials) if subject is confidently identified
  if (resolvedSubjectId) {
    if (classification.folderName === "Lab" && classification.labSubfolderName) {
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
            console.log(`[Upload Routing] Created child Lab folder: "${classification.labSubfolderName}" (id=${resolvedFolderId})`);
          } else {
            console.error("[Upload Routing] Failed to create Lab child folder:", childError)
          }
        }
      }
    } else if (classification.folderName) {
      // Non-lab root-level folder (Lectures, Assignments, Quizzes, Presentations, Projects)
      const { data: existingFolder } = await supabase
        .from('folders')
        .select('id')
        .eq('user_id', user.id)
        .eq('subject_id', resolvedSubjectId)
        .ilike('name', classification.folderName)
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
            name: classification.folderName
          })
          .select('id')
          .single()

        if (!folderErr && newFolder) {
          resolvedFolderId = newFolder.id
          console.log(`[Upload Routing] Created folder: "${classification.folderName}" (id=${resolvedFolderId})`);
        } else if (folderErr) {
          console.error(`[Upload Routing] Failed to create folder ${classification.folderName}:`, folderErr)
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
  const { data: uploadResult, error: uploadError } = await supabase
    .from('uploads')
    .insert({
      user_id: user.id,
      file_name: fileName,
      file_url: fileUrl,
      file_type: fileType,
      file_size: fileSize,
      status: 'completed'
    })
    .select()
    .single()

  if (uploadError) {
    throw new Error(`Failed to log upload: ${uploadError.message}`)
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
      ai_subject: classification.subjectName || null,
      ai_topic: classification.labSubfolderName || classification.folderName || 'General Notes',
      classification_confidence: classification.confidence,
      classification_status: classificationStatus,
      summary_status: 'pending',
      quiz_status: 'pending'
    })
    .select()
    .single()

  if (docError) {
    throw new Error(`Failed to create document: ${docError.message}`)
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
  //    Only dispatched when the document has been assigned a subject — unclassified
  //    documents that land in "needs_review" must first be confirmed by the user
  //    (via ClassificationCard) before AI processing can start.
  if (resolvedSubjectId) {
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
  } else {
    console.log(`[Upload Routing] Skipping study pack dispatch — document "${docResult.id}" has no subject yet. AI processing will start after user assigns a subject.`);
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
  return { success: true, documentId: docResult.id }
}

export async function deleteUpload(uploadId: string, documentId: string, fileUrl: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Extract relative path from public URL to delete from storage
  // The URL format is roughly: https://<project>.supabase.co/storage/v1/object/public/documents/userId/filename
  const pathParts = fileUrl.split('/')
  const fileName = pathParts[pathParts.length - 1]
  const filePath = `${user.id}/${fileName}`

  // 1. Delete actual file from Supabase Storage bucket
  const { error: storageError } = await supabase.storage.from('documents').remove([filePath])
  if (storageError) console.error("Storage cleanup failed:", storageError.message)

  // 2. Cascade delete from documents table
  if (documentId) {
     await supabase.from('documents').delete().eq('id', documentId).eq('user_id', user.id)
  }
  
  // 3. Delete from uploads audit table
  if (uploadId) {
     await supabase.from('uploads').delete().eq('id', uploadId).eq('user_id', user.id)
  }

  revalidatePath('/uploads')
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
    .select('id, upload_id, file_url, user_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) {
    console.error('[deletePendingUpload] Fetch error:', fetchErr);
  }

  if (!doc) {
    // If document is already deleted or not found, handle gracefully
    revalidatePath('/uploads');
    revalidatePath('/subjects');
    return { success: true };
  }

  // 2. Safely remove storage object from documents bucket
  if (doc.file_url) {
    try {
      let storagePath = '';
      if (doc.file_url.includes('/documents/')) {
        storagePath = decodeURIComponent(doc.file_url.split('/documents/')[1]?.split('?')[0] || '');
      } else {
        const parts = doc.file_url.split('/');
        storagePath = `${user.id}/${parts[parts.length - 1]}`;
      }
      if (storagePath) {
        await supabase.storage.from('documents').remove([storagePath]);
      }
    } catch (storageErr: any) {
      console.warn('[deletePendingUpload] Storage file remove warning:', storageErr?.message);
    }
  }

  // 3. Delete from documents table (foreign-key CASCADE handles chunks, knowledge, summaries)
  const { error: docDeleteError } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('user_id', user.id);

  if (docDeleteError) {
    console.error('[deletePendingUpload] Failed to delete document record:', docDeleteError);
    throw new Error('Unable to delete this upload. Please try again.');
  }

  // 4. Delete corresponding audit log from uploads table if linked
  if (doc.upload_id) {
    try {
      await supabase
        .from('uploads')
        .delete()
        .eq('id', doc.upload_id)
        .eq('user_id', user.id);
    } catch (uploadDelErr) {
      console.warn('[deletePendingUpload] Upload audit record delete warning:', uploadDelErr);
    }
  }

  revalidatePath('/uploads');
  revalidatePath('/subjects');
  return { success: true };
}

export async function confirmAIClassification(documentId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // 1. Fetch document suggested fields
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, title, ai_subject, ai_topic, classification_confidence, file_url, file_type')
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
    .maybeSingle();

  if (existingFolder) {
    folderId = existingFolder.id;
  } else {
    const { data: newFolder, error: folderError } = await supabase
      .from('folders')
      .insert({
        user_id: user.id,
        subject_id: subjectId,
        name: suggestedTopic
      })
      .select('id')
      .single();

    if (folderError) throw folderError;
    folderId = newFolder.id;
  }

  // 4. Update Document
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
    .select('id, title, ai_subject, subject_id, classification_confidence, file_url, file_type')
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
    .maybeSingle();

  if (existingFolder) {
    folderId = existingFolder.id;
  } else {
    const { data: newFolder, error: folderError } = await supabase
      .from('folders')
      .insert({
        user_id: user.id,
        subject_id: subjectId,
        name: cleanTopic
      })
      .select('id')
      .single();

    if (folderError) throw folderError;
    folderId = newFolder.id;
  }

  // 3. Update Document
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

  // 5. Trigger AI study pack generation — subject is now confirmed by the user
  if (doc?.file_url) {
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

  const { error } = await supabase
    .from("documents")
    .update({ title: newTitle.trim() })
    .eq("id", documentId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Failed to rename document");
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

  const { error } = await supabase
    .from("documents")
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Failed to move document to recycle bin");
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
    .select("upload_id, file_url")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .single();

  if (doc) {
    await deleteUpload(doc.upload_id, documentId, doc.file_url);
  }

  revalidatePath("/uploads");
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


