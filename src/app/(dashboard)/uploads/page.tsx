import { createClient } from "@/lib/supabase/server";
import { cleanupExpiredRecycledDocuments } from "@/actions/uploads";
import { SubjectClassifier } from "@/services/classification/classifier";
import type { PendingDoc } from "@/components/shared/classification-card";
import { UploadCenter, type DocumentRow } from "@/components/uploads/upload-center";

export const dynamic = 'force-dynamic';

export default async function UploadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Run automated 10-day document/recycled storage cleanup dynamically
    await cleanupExpiredRecycledDocuments(user.id);
  }

  // 1. Fetch user-uploaded documents (including soft-deleted/recycled ones so history persists)
  const { data: userUploadedDocs } = await supabase
    .from('documents')
    .select('*, uploads(file_size), ai_summaries(id)')
    .eq('user_id', user?.id)
    .not('upload_id', 'is', null)
    .or('ai_doc_type.is.null,ai_doc_type.neq.ai_generated')
    .order('created_at', { ascending: false });

  // 2. Fetch upload audit logs where the file/document was permanently deleted (or status is 'deleted')
  const { data: uploadAuditLogs } = await supabase
    .from('uploads')
    .select('*')
    .eq('user_id', user?.id)
    .or('status.eq.deleted,deleted_at.not.is.null')
    .order('created_at', { ascending: false });

  // 3. Fetch all subjects (including soft-deleted for complete name resolution)
  const { data: allSubjects } = await supabase
    .from('subjects')
    .select('*')
    .eq('user_id', user?.id)
    .order('name');

  const activeSubjects = (allSubjects || []).filter((s) => !s.deleted_at);

  // Track existing upload IDs to avoid duplicates if an active document still references an upload
  const activeUploadIds = new Set(
    (userUploadedDocs || []).map((d) => d.upload_id).filter(Boolean)
  );

  // Auto-heal legacy audit rows that were deleted before subject snapshot migration
  if (user && uploadAuditLogs && uploadAuditLogs.length > 0) {
    for (const u of uploadAuditLogs) {
      if (!u.subject_id && !u.subject_name && !u.ai_subject) {
        let healedSubjectName: string | null = null;
        let healedSubjectId: string | null = null;

        // Check if another document from this user shares a matching naming stem/token (e.g. "KHADIJA BIBI")
        const cleanName = (u.file_name || '').replace(/\.[^/.]+$/, '').trim();
        const matchPartner = (userUploadedDocs || []).find((d: any) => {
          const dName = (d.title || '').replace(/\.[^/.]+$/, '').trim();
          const uParts = cleanName.split(/[-_ ]/).map((s: string) => s.trim().toLowerCase()).filter((s: string) => s.length > 3);
          return uParts.some((part: string) => dName.toLowerCase().includes(part));
        });

        if (matchPartner && (matchPartner.subject_id || matchPartner.ai_subject)) {
          healedSubjectId = matchPartner.subject_id || null;
          healedSubjectName = (allSubjects || []).find((s) => s.id === matchPartner.subject_id)?.name || matchPartner.ai_subject || null;
        }

        // If not matched, try heuristic classification
        if (!healedSubjectName) {
          try {
            const cls = await SubjectClassifier.classify(
              { userId: user.id, filename: u.file_name },
              { supabase }
            );
            if (cls.subjectName) {
              healedSubjectName = cls.subjectName;
              healedSubjectId = cls.subjectId;
            }
          } catch {
            // Non-fatal
          }
        }

        if (healedSubjectName) {
          u.subject_name = healedSubjectName;
          u.ai_subject = healedSubjectName;
          if (healedSubjectId) u.subject_id = healedSubjectId;

          // Asynchronously persist healed metadata back to uploads table
          supabase
            .from('uploads')
            .update({
              subject_id: healedSubjectId,
              subject_name: healedSubjectName,
              ai_subject: healedSubjectName,
            })
            .eq('id', u.id)
            .eq('user_id', user.id)
            .then();
        }
      }
    }
  }

  const deletedUploadRows: DocumentRow[] = (uploadAuditLogs || [])
    .filter((u) => !activeUploadIds.has(u.id))
    .map((u) => {
      const subName = u.subject_name || u.ai_subject || (u.subject_id ? (allSubjects || []).find((s) => s.id === u.subject_id)?.name : null) || null;
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

  const allDocuments: DocumentRow[] = [
    ...(userUploadedDocs || []).map((d: any) => {
      const hasAiSummary = Array.isArray(d.ai_summaries)
        ? d.ai_summaries.length > 0
        : Boolean(d.ai_summaries?.id);
      const subject = (allSubjects || []).find((s) => s.id === d.subject_id);
      const isSubjectRecycled = Boolean(subject?.deleted_at);
      const isSubjectMissing = Boolean(d.subject_id && !subject);
      const isDeleted = Boolean(d.deleted_at || isSubjectRecycled || isSubjectMissing);
      return {
        ...d,
        summary_status: hasAiSummary ? 'completed' : d.summary_status,
        file_deleted: isDeleted,
        file_url: isDeleted ? null : d.file_url,
      };
    }),
    ...deletedUploadRows,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Extract documents that are pending classification approval / review (low confidence, not deleted)
  const pendingDocs: PendingDoc[] = (userUploadedDocs || [])
    .filter(
      (d) =>
        !d.deleted_at &&
        (d.classification_status === 'needs_review' || d.classification_status === 'pending') &&
        (d.ai_subject || !d.subject_id)
    )
    .map((d) => ({
      id: d.id,
      title: d.title,
      ai_subject: d.ai_subject,
      ai_topic: d.ai_topic,
      ai_doc_type: d.ai_doc_type,
      classification_confidence: d.classification_confidence,
    }));

  return (
    <div className="flex flex-col gap-6 max-w-[1550px] mx-auto w-full px-4 sm:px-6 pb-10 animate-in fade-in duration-300">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground select-none">
            Uploads
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add study material and manage your uploaded files.
          </p>
        </div>
      </div>

      {/* Upload Center — Upload Area + Needs Your Attention + Upload History */}
      <UploadCenter
        documents={allDocuments}
        subjects={allSubjects || activeSubjects || []}
        pendingDocs={pendingDocs}
      />
    </div>
  );
}
