import { createClient } from "@/lib/supabase/server";
import { cleanupExpiredRecycledDocuments } from "@/actions/uploads";
import { ClassificationCard, PendingDoc } from "@/components/shared/classification-card";
import { UploadCenter } from "@/components/uploads/upload-center";

export const dynamic = 'force-dynamic';

export default async function UploadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Run automated 10-day document/recycled storage cleanup dynamically
    await cleanupExpiredRecycledDocuments(user.id);
  }

  // Fetch only genuine user-uploaded documents (explicitly excluding AI-generated resources at the database layer)
  const { data: userUploadedDocs } = await supabase
    .from('documents')
    .select('*, uploads(file_size)')
    .eq('user_id', user?.id)
    .not('upload_id', 'is', null)
    .or('ai_doc_type.is.null,ai_doc_type.neq.ai_generated')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Fetch all active subjects (for upload subject selector & history display)
  const { data: subjects } = await supabase
    .from('subjects')
    .select('*')
    .eq('user_id', user?.id)
    .is('deleted_at', null)
    .order('name');

  // Extract documents that are pending classification approval / review (low confidence)
  const pendingDocs: PendingDoc[] = (userUploadedDocs || [])
    .filter(
      (d) =>
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
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-10 animate-in fade-in duration-300">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground select-none">
            Uploads
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload academic files and track your complete upload history.
          </p>
        </div>
      </div>

      {/* AI Auto-Classification fallback prompts */}
      {pendingDocs.length > 0 && (
        <ClassificationCard pendingDocs={pendingDocs} subjects={subjects || []} />
      )}

      {/* Upload Center — Upload Area + History */}
      <UploadCenter
        documents={userUploadedDocs || []}
        subjects={subjects || []}
      />
    </div>
  );
}
