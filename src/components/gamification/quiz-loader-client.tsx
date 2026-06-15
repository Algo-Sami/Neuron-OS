"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateQuizAction } from "@/actions/quiz";
import { QuizSessionClient, QuestionItem } from "./quiz-session-client";
import {
  Brain,
  Sparkles,
  Loader2,
  AlertTriangle,
  Zap,
  BookOpen,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuizData {
  id: string;
  title: string;
  questions: QuestionItem[];
  total_questions: number;
  document_id: string;
}

interface UserProgress {
  total_xp: number;
  current_level: number;
  first_name: string;
  last_name: string;
}

interface QuizLoaderClientProps {
  documentId: string;
  documentTitle: string;
  existingQuiz: QuizData | null;
  userProgress: UserProgress;
  isPractice: boolean;
}

export function QuizLoaderClient({
  documentId,
  documentTitle,
  existingQuiz,
  userProgress,
  isPractice,
}: QuizLoaderClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedQuiz, setGeneratedQuiz] = useState<QuizData | null>(existingQuiz);

  // If quiz already exists, render the session client directly
  if (generatedQuiz) {
    return (
      <QuizSessionClient
        quiz={generatedQuiz}
        userProgress={userProgress}
        isPractice={isPractice}
      />
    );
  }

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateQuizAction(documentId);
      if (result.success && result.quizId) {
        // Refresh the page so the server re-fetches the now-generated quiz
        startTransition(() => {
          router.refresh();
        });
      } else {
        setError(result.error || "Quiz generation failed. Please try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error occurred.");
    } finally {
      setGenerating(false);
    }
  };

  // No quiz exists yet — show the generate screen
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] max-w-xl mx-auto text-center px-6 py-12 gap-8 animate-in fade-in duration-300">

      {/* Icon hero */}
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
        <div className="relative h-24 w-24 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
          <Brain className="h-12 w-12 text-primary" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-1.5 bg-primary/5 border border-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
          <Sparkles className="h-3 w-3" />
          AI Quiz Generation
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Ready to Test Your Knowledge?
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
          Neuron AI will generate a personalized quiz based on{" "}
          <span className="font-semibold text-foreground">{documentTitle}</span>.
          Difficulty is adapted to your current rank.
        </p>
      </div>

      {/* Feature badges */}
      <div className="flex flex-wrap justify-center gap-2">
        {[
          { icon: Zap, label: "10 Questions" },
          { icon: Target, label: "Adaptive Difficulty" },
          { icon: BookOpen, label: "From Your Notes" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground bg-muted/40 border border-border/60 px-3 py-1.5 rounded-lg"
          >
            <Icon className="h-3 w-3 text-primary" />
            {label}
          </div>
        ))}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-left max-w-sm w-full">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-destructive">Generation Failed</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={generating || isPending}
        className="h-12 px-8 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/25 transition-all cursor-pointer gap-2"
      >
        {generating || isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating your quiz...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate AI Quiz
          </>
        )}
      </Button>

      {generating && (
        <div className="space-y-3 w-full max-w-sm">
          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full animate-pulse w-full" />
          </div>
          <p className="text-[11px] text-muted-foreground font-medium animate-pulse">
            Neuron AI is reading your lecture and crafting questions... This takes 10–20 seconds.
          </p>
        </div>
      )}
    </div>
  );
}
