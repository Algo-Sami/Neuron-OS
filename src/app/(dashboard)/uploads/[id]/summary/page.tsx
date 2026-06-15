import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import SummaryViewer from "./summary-viewer";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentSummaryPage({ params }: PageProps) {
  const resolvedParams = await params;
  const documentId = resolvedParams.id;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch document details and subject association
  const { data: document } = await supabase
    .from('documents')
    .select('id, title, file_type, file_url, created_at, summary_status, subjects(name)')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!document) {
    notFound();
  }

  // Fetch all summaries for this document to pre-load history
  const { data: summaries } = await supabase
    .from('ai_summaries')
    .select('id, summary_text, created_at')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false });

  // Parse modes from cached summaries
  const parsedHistory = (summaries || []).map(s => {
    const match = s.summary_text.match(/<!-- MODE:\s*(.+?)\s*-->/);
    const mode = match ? match[1] : 'detailed';
    return {
      id: s.id,
      mode: mode,
      createdAt: s.created_at
    };
  });

  const subjectObj = Array.isArray(document.subjects) 
    ? document.subjects[0] 
    : document.subjects;

  const formattedDoc = {
    id: document.id,
    title: document.title,
    file_type: document.file_type || "",
    file_url: document.file_url || "",
    created_at: document.created_at,
    summary_status: document.summary_status || "pending",
    subjects: subjectObj ? { name: String((subjectObj as Record<string, unknown>).name) } : null
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-10">
      <div className="flex items-center gap-4">
        <Link href="/uploads">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 border border-border/80">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground truncate max-w-2xl">
            {document.title}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">
            {formattedDoc.subjects?.name || "General Notes"} • Study Materials Summary Studio
          </p>
        </div>
      </div>

      <SummaryViewer 
        document={formattedDoc} 
        initialHistory={parsedHistory} 
      />
    </div>
  );
}
