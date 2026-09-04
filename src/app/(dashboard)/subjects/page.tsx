import { createClient } from "@/lib/supabase/server";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { cleanupExpiredRecycledItems } from "@/actions/subjects";
import { reconcileUserDocumentMetadata } from "@/services/storage/file-metadata";
import { getServerPreferences } from "@/lib/preferences-server";

export const dynamic = 'force-dynamic';

export default async function SubjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Fire-and-forget: do NOT await — never block page render for background maintenance
    cleanupExpiredRecycledItems(user.id).catch(() => {});
    reconcileUserDocumentMetadata(supabase, user.id).catch(() => {});
  }

  // Parallel fetch all three independent queries
  const [subjectsResult, foldersResult, documentsResult, preferences] = await Promise.all([
    supabase
      .from('subjects')
      .select('id, name, code, color, created_at, deleted_at')
      .eq('user_id', user?.id)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('folders')
      .select('id, name, subject_id, parent_folder_id, created_at')
      .eq('user_id', user?.id)
      .order('name'),
    supabase
      .from('documents')
      .select('id, title, file_type, file_url, size, created_at, summary_status, quiz_status, ai_subject, ai_topic, ai_doc_type, subject_id, folder_id, deleted_at, uploads(file_size)')
      .eq('user_id', user?.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    getServerPreferences(user?.id),
  ]);

  // Format documents structure to resolve Supabase relation array mapping to DocumentItem
  const initialDocuments = (documentsResult.data || []).map((doc) => ({
    ...doc,
    uploads: Array.isArray(doc.uploads)
      ? doc.uploads[0] || null
      : doc.uploads || null
  }));

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden">
      <FileExplorer
        key={user?.id}
        initialSubjects={subjectsResult.data || []}
        initialFolders={foldersResult.data || []}
        initialDocuments={initialDocuments}
        activeRoute="subjects"
        userId={user?.id}
        initialPreferences={preferences}
      />
    </div>
  );
}
