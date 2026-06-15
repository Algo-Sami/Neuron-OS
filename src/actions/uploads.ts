"use server"

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { awardXP } from '@/services/gamification/rewards'

export async function saveUploadMetadata({
  fileName,
  fileUrl,
  fileType,
  fileSize
}: {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}) {
  const supabase = await createClient()

  // 1. Authenticate Request
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // 2. Insert into uploads audit table
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

  // 3. Insert into primary documents table
  const { data: docResult, error: docError } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      upload_id: uploadResult.id,
      title: fileName,
      file_url: fileUrl,
      file_type: fileType,
      summary_status: 'pending',
      quiz_status: 'pending'
    })
    .select()
    .single()

  if (docError) {
    throw new Error(`Failed to create document: ${docError.message}`)
  }

  // Award XP for uploading study materials
  try {
    await awardXP(user.id, 'upload_notes');
  } catch (xpError) {
    console.error("Failed to award upload XP:", xpError);
  }

  // Revalidate the uploads page so Next.js fetches fresh data automatically
  revalidatePath('/uploads')
  
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
        color: 'bg-blue-500'
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
        color: 'bg-blue-500'
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

