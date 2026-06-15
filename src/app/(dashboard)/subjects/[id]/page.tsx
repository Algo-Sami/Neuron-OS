import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { FileExplorer } from "@/components/file-explorer/file-explorer";

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
    notFound();
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

  return (
    <div className="max-w-5xl mx-auto w-full pb-10 px-4 md:px-0 animate-in fade-in duration-300">
      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-5 mb-6">
        <div className="flex items-center gap-2.5">
          <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${subject.color || 'bg-blue-500'} opacity-75`} />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground select-none">
            {subject.name}
          </h1>
          {subject.code && (
            <span className="px-2 py-0.5 rounded-md bg-secondary text-[9px] font-bold text-muted-foreground uppercase tracking-wider border border-border/60 shrink-0">
              {subject.code}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">All your study materials and AI summaries for this course.</p>
      </div>

      <FileExplorer
        initialSubjects={subjects || []}
        initialFolders={folders || []}
        initialDocuments={documents || []}
        activeRoute="subjects"
        preFocusedSubjectId={subjectId}
      />
    </div>
  );
}
