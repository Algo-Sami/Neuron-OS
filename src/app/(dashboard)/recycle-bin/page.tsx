import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RecycleBinCenter } from "@/components/recycle-bin/recycle-bin-center";
import { cleanupExpiredRecycledItems } from "@/actions/subjects";
import { cleanupExpiredRecycledDocuments } from "@/actions/uploads";

export const dynamic = 'force-dynamic';

export default async function RecycleBinPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Trigger automated 10-day cleanup fallbacks dynamically on page load for both subjects and files
  await cleanupExpiredRecycledItems(user.id);
  await cleanupExpiredRecycledDocuments(user.id);

  // Fetch all active subjects
  const { data: subjects } = await supabase
    .from('subjects')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('name');

  // Fetch all active folders
  const { data: folders } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', user.id)
    .order('name');

  // Fetch all active documents
  const { data: documents } = await supabase
    .from('documents')
    .select('*, uploads(file_size)')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Query Recycled Subjects
  const { data: recycledSubjects } = await supabase
    .from("subjects")
    .select("*, folders(*), documents(*)")
    .eq("user_id", user.id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  // Query Recycled Documents
  const { data: recycledDocuments } = await supabase
    .from("documents")
    .select("*, uploads(file_size)")
    .eq("user_id", user.id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-10 px-4 md:px-0 animate-in fade-in duration-300">
      <div className="flex flex-col gap-1.5 border-b border-border/40 pb-5 mb-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground select-none">Recycle Bin</h1>
        <p className="text-xs text-muted-foreground">
          Items soft-deleted from your workspace reside here. Recycled items are kept for **10 days** before being permanently erased.
        </p>
      </div>

      <RecycleBinCenter
        subjects={subjects || []}
        folders={folders || []}
        documents={documents || []}
        recycledSubjects={recycledSubjects || []}
        recycledDocuments={recycledDocuments || []}
      />
    </div>
  );
}
