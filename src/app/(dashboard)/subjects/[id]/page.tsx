import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { getServerPreferences } from "@/lib/preferences-server";
import { reconcileUserDocumentMetadata } from "@/services/storage/file-metadata";

interface SubjectPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function SubjectDetailsPage({ params }: SubjectPageProps) {
  const resolvedParams = await params;
  const subjectId = resolvedParams.id;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Non-blocking background metadata reconciliation
  reconcileUserDocumentMetadata(supabase, user.id).catch(() => {});

  // Fetch subject details — try with deleted_at filter first, fall back if column doesn't exist
  let subject = null;
  const { data: subjectWithFilter, error: subjectError } = await supabase
    .from('subjects')
    .select('*')
    .eq('id', subjectId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (subjectError) {
    const { data: subjectFallback } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', subjectId)
      .eq('user_id', user.id)
      .maybeSingle();
    subject = subjectFallback;
  } else {
    subject = subjectWithFilter;
  }

  if (!subject) {
    redirect("/subjects");
  }

  // Fetch all active subjects
  const { data: subjects } = await supabase
    .from('subjects')
    .select('*')
    .eq('user_id', user?.id)
    .is('deleted_at', null)
    .order('name');

  // Fetch all active folders
  const { data: folders } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', user?.id)
    .order('name');

  // Fetch all active documents
  const { data: documents } = await supabase
    .from('documents')
    .select('*, uploads(file_size)')
    .eq('user_id', user?.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Fetch user preferences
  const preferences = await getServerPreferences(user.id);

  // Format documents structure to resolve Supabase relation array mapping to DocumentItem
  const initialDocuments = (documents || []).map((doc) => ({
    ...doc,
    uploads: Array.isArray(doc.uploads)
      ? doc.uploads[0] || null
      : doc.uploads || null
  }));

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden p-3">
      <FileExplorer
        key={user.id}
        initialSubjects={subjects || []}
        initialFolders={folders || []}
        initialDocuments={initialDocuments}
        activeRoute="subjects"
        preFocusedSubjectId={subjectId}
        userId={user.id}
        initialPreferences={preferences}
      />
    </div>
  );
}
