import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Sparkles, Calendar, Zap, Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

interface SummaryItem {
  id: string;
  document_id: string;
  summary_text: string;
  key_points: string[] | null;
  created_at: string;
  documents: {
    title: string;
    file_type: string;
    user_id: string;
  };
}

const getModeDetails = (summaryText: string) => {
  const text = summaryText || '';
  if (text.includes('<!-- MODE: beginner -->')) {
    return { label: 'Beginner Mode', color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' };
  }
  if (text.includes('<!-- MODE: concise -->')) {
    return { label: 'Concise Summary', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
  }
  if (text.includes('<!-- MODE: detailed -->')) {
    return { label: 'Detailed Synthesis', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
  }
  if (text.includes('<!-- MODE: exam-focused -->')) {
    return { label: 'Exam Guide', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' };
  }
  if (text.includes('<!-- MODE: bullet -->')) {
    return { label: 'Bullet Notes', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
  }
  if (text.includes('<!-- MODE: key-concepts -->')) {
    return { label: 'Key Concepts', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
  }
  return { label: 'General Study Guide', color: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' };
};

const getSummarySnippet = (summaryText: string) => {
  const clean = (summaryText || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/#+\s+/g, '')
    .replace(/[-\*]\s+/g, '')
    .replace(/\*\*/g, '')
    .trim();
  
  if (clean.length > 180) {
    return clean.substring(0, 180) + '...';
  }
  return clean || 'No summary text available.';
};

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return dateStr;
  }
};

export default async function AISummariesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch all generated AI summaries for this user
  const { data: rawSummaries } = await supabase
    .from('ai_summaries')
    .select(`
      id,
      document_id,
      summary_text,
      key_points,
      created_at,
      documents!inner(title, file_type, user_id)
    `)
    .eq('documents.user_id', user.id)
    .is('documents.deleted_at', null)
    .order('created_at', { ascending: false });

  const summaries = (rawSummaries as unknown as SummaryItem[]) || [];

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            AI Summary Library
          </h1>
          <p className="text-muted-foreground mt-1">
            Access and review the chronological history of all auto-generated academic study summaries.
          </p>
        </div>
      </div>

      {summaries.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {summaries.map((item) => {
            const mode = getModeDetails(item.summary_text);
            return (
              <Card key={item.id} className="group hover:border-primary/50 transition-all bg-card/60 backdrop-blur-sm border-border/85 overflow-hidden flex flex-col hover:shadow-md duration-200">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${mode.color}`}>
                        {mode.label}
                      </span>
                      <CardTitle className="text-base font-bold mt-2 truncate text-foreground group-hover:text-primary transition-colors" title={item.documents?.title}>
                        {item.documents?.title}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 flex flex-col flex-1">
                  <p className="text-xs text-muted-foreground leading-relaxed italic mb-4">
                    &ldquo;{getSummarySnippet(item.summary_text)}&rdquo;
                  </p>

                  {/* Render Key Takeaways preview if present */}
                  {item.key_points && item.key_points.length > 0 && (
                    <div className="mb-4 bg-muted/40 border border-border/40 p-3 rounded-lg mt-auto">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-purple-500 animate-pulse" />
                        Key Takeaways Preview
                      </h4>
                      <ul className="space-y-1.5">
                        {item.key_points.slice(0, 2).map((point, index) => (
                          <li key={index} className="text-[11px] text-muted-foreground flex items-start gap-1.5 leading-tight">
                            <Check className="h-3 w-3 text-purple-500 shrink-0 mt-0.5" />
                            <span className="truncate">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(item.created_at)}
                    </div>

                    <Link href={`/uploads/${item.document_id}/summary`}>
                      <Button size="sm" className="h-8 text-xs font-semibold bg-gradient-to-r from-primary to-purple-600 hover:from-primary/95 hover:to-purple-600/95 text-white flex items-center gap-1.5 shadow-sm">
                        Open Study Guide
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 border rounded-xl bg-card/40 backdrop-blur-md text-muted-foreground border-dashed max-w-2xl mx-auto flex flex-col items-center justify-center p-6 gap-3">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
            <Zap className="h-7 w-7 animate-pulse" />
          </div>
          <h3 className="font-bold text-foreground text-lg">No AI summaries generated yet</h3>
          <p className="text-sm max-w-md">
            Once you upload a document in the **Uploads** page and generate your first study guide, your complete summaries and notes history will appear in this library.
          </p>
          <Link href="/uploads" className="mt-2">
            <Button size="sm" className="bg-primary text-white font-semibold text-xs shadow-md">
              Upload study material
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
