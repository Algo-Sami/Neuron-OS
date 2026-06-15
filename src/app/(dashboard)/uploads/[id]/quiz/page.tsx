import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { QuizLoaderClient } from "@/components/gamification/quiz-loader-client";
import type { QuestionItem } from "@/components/gamification/quiz-session-client";

export const metadata = {
  title: "Lecture AI Study Quiz - Neuron",
  description: "Test your knowledge on uploaded study materials using our interactive AI quiz player."
};

interface QuizPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ earnXP?: string }>;
}

export default async function QuizPage({ params, searchParams }: QuizPageProps) {
  const supabase = await createClient();

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/login");
  }

  // 2. Resolve parameters
  const resolvedParams = await params;
  const documentId = resolvedParams.id;
  const resolvedSearchParams = await searchParams;
  const isPractice = resolvedSearchParams.earnXP !== "true";

  // 3. Parallel fetch: user progress + existing quiz + document title — NO AI generation here
  const [progressResult, quizResult, docResult] = await Promise.all([
    supabase
      .from("user_progress")
      .select("total_xp, current_level")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("quizzes")
      .select("id, title, questions, total_questions, document_id, status")
      .eq("document_id", documentId)
      .eq("user_id", user.id)
      .neq("status", "completed") // only fetch active (not-started) quiz
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("title")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  // 4. Ensure user progress row exists (create if first visit)
  let progress = progressResult.data;
  if (!progress) {
    const { data: newProgress } = await supabase
      .from("user_progress")
      .insert({ user_id: user.id, total_xp: 0, current_level: 1, monthly_xp: 0 })
      .select("total_xp, current_level")
      .single();
    progress = newProgress;
  }

  const quiz = quizResult.data;
  const documentTitle = docResult.data?.title || "Lecture Document";

  const userProgress = {
    total_xp: progress?.total_xp ?? 0,
    current_level: progress?.current_level ?? 1,
    first_name: user.user_metadata?.first_name || "Scholar",
    last_name: user.user_metadata?.last_name || "Student",
  };

  // 5. Render instantly — QuizLoaderClient handles "no quiz" case client-side
  //    with a Generate Quiz button. NO blocking AI call on page load.
  return (
    <QuizLoaderClient
      documentId={documentId}
      documentTitle={documentTitle}
      existingQuiz={
        quiz
          ? {
              id: quiz.id,
              title: quiz.title,
              questions: quiz.questions as unknown as QuestionItem[],
              total_questions: quiz.total_questions,
              document_id: quiz.document_id || "",
            }
          : null
      }
      userProgress={userProgress}
      isPractice={isPractice}
    />
  );
}
