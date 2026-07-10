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

  // Fetch the user's document history including nested upload file size and classification columns
  const { data: documents } = await supabase
    .from('documents')
    .select('*, uploads(file_size)')
    .eq('user_id', user?.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Fetch all active subjects (for upload subject selector & history display)
  const { data: subjects } = await supabase
    .from('subjects')
    .select('*')
    .eq('user_id', user?.id)
    .is('deleted_at', null)
    .order('name');

  // Extract documents that are pending AI classification approval (low confidence)
  const pendingDocs: PendingDoc[] = (documents || [])
    .filter(d => d.classification_status === 'pending' && d.summary_status === 'completed' && d.ai_subject && d.ai_topic)
    .map(d => ({
      id: d.id,
      title: d.title,
      ai_subject: d.ai_subject,
      ai_topic: d.ai_topic,
      ai_doc_type: d.ai_doc_type,
      classification_confidence: d.classification_confidence
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
        <ClassificationCard pendingDocs={pendingDocs} />
      )}

      {/* Upload Center — Upload Area + History */}
      <UploadCenter
        documents={documents || []}
        subjects={subjects || []}
      />
    </div>
  );
}
