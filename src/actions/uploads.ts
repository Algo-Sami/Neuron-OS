"use server"

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { awardXP } from '@/services/gamification/rewards'
import { classifyFilename, normalizeSubjectName } from '@/services/upload-routing'
import { createFolderAction, scaffoldSubjectFoldersAction } from '@/actions/folders'

export async function saveUploadMetadata({
  fileName,
  fileUrl,
  fileType,
  fileSize,
  subjectId
}: {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  subjectId?: string;
}) {
  const t0 = performance.now();
  console.log(`[UploadTiming] saveUploadMetadata START for "${fileName}"`);
  const supabase = await createClient()

  // 1. Authenticate Request
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // 2. Classify filename
  const classification = classifyFilename(fileName)
  console.log(`[Upload Routing] File: "${fileName}" -> Classified Subject: "${classification.subjectName}", Folder: "${classification.folderName}", Confidence: ${classification.confidence}`);

  let resolvedSubjectId: string | null = null
  let resolvedFolderId: string | null = null
  let classificationStatus: 'auto_applied' | 'needs_review' = classification.confidence >= 0.80 || subjectId ? 'auto_applied' : 'needs_review'

  // Fetch all existing active subjects to perform double normalization matching
  const { data: existingSubjects } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('user_id', user.id)
    .is('deleted_at', null)

  if (classification.confidence >= 0.80) {
    const extractedNormalized = normalizeSubjectName(classification.subjectName).toLowerCase()

    // Match case-insensitively using double normalization
    const matchedSubject = (existingSubjects || []).find((s) => {
      return normalizeSubjectName(s.name).toLowerCase() === extractedNormalized
    })

    if (matchedSubject) {
      resolvedSubjectId = matchedSubject.id
      console.log(`[Upload Routing] Reusing existing subject: "${matchedSubject.name}" (id=${resolvedSubjectId}) for extracted "${classification.subjectName}"`);
    } else {
      // Create new subject
      const { data: newSubject, error: subjectError } = await supabase
        .from('subjects')
        .insert({
          user_id: user.id,
          name: classification.subjectName,
          color: '#F4C542' // Default Windows folder yellow
        })
        .select('id')
        .single()

      if (subjectError) {
        throw new Error(`Failed to create subject: ${subjectError.message}`)
      }
      resolvedSubjectId = newSubject.id
      console.log(`[Upload Routing] Created new subject: "${classification.subjectName}" (id=${resolvedSubjectId})`);
    }
  } else {
    // If classification confidence is low, fallback to subjectId chosen during upload
    if (subjectId) {
      resolvedSubjectId = subjectId
      classificationStatus = 'auto_applied' // Manually routed by user choice
    } else {
      // Find or create general study subject
      const defaultSubjectName = 'General Study'
      const matchedDefault = (existingSubjects || []).find((s) => {
        return normalizeSubjectName(s.name).toLowerCase() === normalizeSubjectName(defaultSubjectName).toLowerCase()
      })

      if (matchedDefault) {
        resolvedSubjectId = matchedDefault.id
      } else {
        const { data: newDefault, error: defaultSubjectError } = await supabase
          .from('subjects')
          .insert({
            user_id: user.id,
            name: defaultSubjectName,
            color: '#F4C542'
          })
          .select('id')
          .single()

        if (defaultSubjectError) {
          throw new Error(`Failed to create default subject: ${defaultSubjectError.message}`)
        }
        resolvedSubjectId = newDefault.id
      }
      classificationStatus = 'needs_review'
    }
  }

  // 3. Resolve Folder (with parent-child nesting for Lab materials)
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
      ai_subject: classification.confidence >= 0.80 ? classification.subjectName : null,
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

  // 6. Log a background task record (task_type: 'study_pack' aligns with AIProcessingCenter
  //    and the idempotency check inside /api/generate-study-pack).
  //    Non-throwing: a failure here must never abort a successful upload.
  //    After Phase 2B-2, the unique constraint on (user_id, document_id, task_type)
  //    may reject this insert if a concurrent request already created the same task.
  //    That is a benign race condition — the /api/generate-study-pack route will find
  //    the existing pending task and transition it to Queued before dispatching.
  try {
    const { error: taskError } = await supabase
      .from('background_tasks')
      .insert({
        user_id: user.id,
        document_id: docResult.id,
        task_type: 'study_pack',
        status: 'pending'
      });
    if (taskError) {
      // PostgreSQL unique_violation — another concurrent request already created
      // the same logical task. This is expected and harmless; the dispatcher will
      // pick up the existing record.
      if (taskError.code === '23505') {
        console.info(
          `[Upload Routing] background_tasks unique conflict (23505) for document ${docResult.id} — ` +
          'a concurrent request already registered this task. Upload continues normally.'
        );
      } else {
        // Unexpected database error — log clearly but do not throw.
        console.warn(
          `[Upload Routing] Unexpected error creating background task record for document ${docResult.id}: ` +
          `${taskError.message} (code: ${taskError.code ?? 'unknown'})`
        );
      }
    }
  } catch (err) {
    // Structural/network-level exception — log but do not abort the upload.
    console.warn('[Upload Routing] Exception while creating background task record:', err);
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

export async function confirmAIClassification(documentId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // 1. Fetch document suggested fields
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, title, ai_subject, ai_topic')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single();

  if (docError || !doc) {
    throw new Error('Document not found');
  }

  const suggestedSubject = doc.ai_subject || 'General Study';
  const suggestedTopic = doc.ai_topic || 'General Notes';

  // 2. Resolve Subject (Find or Create)
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
        color: '#F4C542'
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

  revalidatePath('/uploads');
  revalidatePath('/subjects');
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

  const cleanSubject = customSubject.trim() || 'General Study';
  const cleanTopic = customTopic.trim() || 'General Notes';

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

  revalidatePath('/uploads');
  revalidatePath('/subjects');
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


