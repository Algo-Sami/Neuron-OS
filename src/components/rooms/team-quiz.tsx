"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Award, 
  CheckCircle, 
  XCircle, 
  Users
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  submitRoomQuizAnswersAction, 
  getRoomQuizScoreboardAction 
} from "@/actions/study-rooms";
import { createClient } from "@/lib/supabase/client";

interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

interface ActiveQuiz {
  id: string;
  room_id: string;
  questions: QuizQuestion[];
  status: string;
}

interface ScoreboardItem {
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  score: number;
}

interface TeamQuizProps {
  roomId: string;
}

export function TeamQuiz({ roomId }: TeamQuizProps) {
  const supabase = createClient();
  
  // Quiz state
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Game states
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState<number>(0);
  
  // Scoreboard
  const [scoreboard, setScoreboard] = useState<ScoreboardItem[]>([]);
  const [quizDone, setQuizDone] = useState<boolean>(false);

  const loadScoreboard = useCallback(async (quizId: string) => {
    const res = await getRoomQuizScoreboardAction(quizId);
    if (res.success && res.scoreboard) {
      setScoreboard(res.scoreboard as unknown as ScoreboardItem[]);
    }
  }, []);

  // Load active quiz details from database
  const loadActiveQuiz = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const { data } = await supabase
        .from("room_quizzes")
        .select("*")
        .eq("room_id", roomId)
        .eq("status", "in_progress")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setActiveQuiz(data as unknown as ActiveQuiz);
        
        // Check if current user already has submitted an attempt
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: myAttempt } = await supabase
            .from("room_quiz_attempts")
            .select("*")
            .eq("room_quiz_id", data.id)
            .eq("user_id", user.id)
            .maybeSingle();
            
          if (myAttempt) {
            setQuizDone(true);
            setScore(myAttempt.score);
            loadScoreboard(data.id);
          }
        }
      } else {
        setActiveQuiz(null);
      }
    } catch {
      // no-op
    } finally {
      setIsLoading(false);
    }
  }, [roomId, supabase, loadScoreboard]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadActiveQuiz();
    }, 0);

    // Listen for quiz additions or scoreboard updates dynamically
    const channel = supabase.channel(`quizzes_${roomId}`);
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_quizzes" }, () => {
        loadActiveQuiz(true);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_quiz_attempts" }, (payload: { new: { room_quiz_id: string } }) => {
        if (activeQuiz && payload.new.room_quiz_id === activeQuiz.id) {
          loadScoreboard(activeQuiz.id);
        }
      })
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [roomId, activeQuiz, loadActiveQuiz, loadScoreboard, supabase]);

  const handleSelectOption = (optString: string) => {
    if (!activeQuiz || selectedOpt !== null) return;
    setSelectedOpt(optString);

    const activeQuestion = activeQuiz.questions[currentIdx];
    const isCorrect = optString === activeQuestion.correctAnswer;
    if (isCorrect) setScore(prev => prev + 1);

    setUserAnswers(prev => ({
      ...prev,
      [activeQuestion.id]: optString
    }));

    // Auto-advance to subsequent slides
    setTimeout(() => {
      setSelectedOpt(null);
      if (currentIdx + 1 < activeQuiz.questions.length) {
        setCurrentIdx(prev => prev + 1);
      } else {
        handleSubmitQuiz();
      }
    }, 1800);
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    try {
      const finalScore = score + (selectedOpt === activeQuiz.questions[currentIdx]?.correctAnswer ? 1 : 0);
      const res = await submitRoomQuizAnswersAction(
        activeQuiz.id,
        userAnswers,
        finalScore,
        activeQuiz.questions.length
      );
      if (res.success) {
        setQuizDone(true);
        setScore(finalScore);
        loadScoreboard(activeQuiz.id);
      }
    } catch {
      alert("Submission error.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground font-semibold">Tuning multiplayer arena...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0 justify-between">
      
      {!activeQuiz ? (
        /* Room Quiz Empty/Host view */
        <div className="h-[300px] bg-muted/20 border border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center p-6 gap-2">
          <Award className="h-8 w-8 text-muted-foreground animate-pulse" />
          <h4 className="text-xs font-bold text-foreground">No Group Battle active</h4>
          <p className="text-[10px] text-muted-foreground max-w-[260px] leading-relaxed">
            Cooperative quiz battles are not active. Type <span className="underline font-bold">/quiz</span> in the room chat to launch a challenges loop generated from notes!
          </p>
        </div>
      ) : quizDone ? (
        /* Scoreboard leaderboard screen */
        <div className="space-y-4 h-[300px] overflow-y-auto animate-in zoom-in duration-300">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl text-center space-y-1">
            <CheckCircle className="h-6 w-6 mx-auto stroke-[3]" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Assessment successfully completed!</h4>
            <span className="text-[10px] font-black">Your Score: {score} / {activeQuiz.questions.length} • Syncing scoreboards...</span>
          </div>

          <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60">
            <CardHeader className="py-2.5 px-4 border-b border-border/30 bg-muted/20">
              <CardTitle className="text-xs font-black uppercase tracking-wider flex gap-1.5 items-center">
                <Users className="h-4 w-4 text-primary" />
                Live Room Scoreboard Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {scoreboard.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`flex justify-between items-center p-2.5 rounded-xl border leading-relaxed text-xs shadow-sm ${
                    idx === 0 
                      ? "bg-yellow-500/10 border-yellow-500/30 text-foreground" 
                      : "bg-muted/30 border-border/30"
                  }`}
                >
                  <div className="flex gap-2 items-center">
                    <span className="font-black text-muted-foreground">#{idx + 1}</span>
                    <span className="font-bold">{item.profiles?.first_name} {item.profiles?.last_name}</span>
                  </div>
                  
                  <span className="font-black text-primary bg-card border px-2.5 py-0.5 rounded-lg">
                    {item.score} / {activeQuiz.questions.length} correct
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Active MCQ Quiz Question screen */
        <div className="space-y-4 max-w-md mx-auto w-full flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-black uppercase tracking-wider border-b border-border/20 pb-2">
            <span>Question {currentIdx + 1} of {activeQuiz.questions.length}</span>
            <span className="text-primary font-bold">Group Battle Active</span>
          </div>

          <Card className="rounded-2xl border-border/40 bg-card/60 shadow-sm">
            <CardContent className="pt-5">
              <h3 className="text-xs font-bold leading-relaxed text-foreground select-none">
                {activeQuiz.questions[currentIdx]?.questionText}
              </h3>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2.5">
            {activeQuiz.questions[currentIdx]?.options.map((opt: string, idx: number) => {
              const optionString = idx.toString();
              const isSelected = selectedOpt === optionString;
              const isCorrect = optionString === activeQuiz.questions[currentIdx].correctAnswer;
              
              let buttonStyle = "border-border/40 hover:bg-muted text-muted-foreground";
              if (selectedOpt !== null) {
                if (isCorrect) {
                  buttonStyle = "bg-emerald-500 border-transparent text-white font-bold shadow-md shadow-emerald-500/20 scale-[1.01]";
                } else if (isSelected) {
                  buttonStyle = "bg-red-500 border-transparent text-white font-bold shadow-md shadow-red-500/20";
                } else {
                  buttonStyle = "opacity-50 border-border/20 text-muted-foreground";
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(optionString)}
                  disabled={selectedOpt !== null}
                  className={`w-full text-left p-3 rounded-xl text-xs font-semibold leading-relaxed border transition-all duration-150 flex items-center justify-between cursor-pointer ${buttonStyle}`}
                >
                  <span>{opt}</span>
                  {selectedOpt !== null && isCorrect && <CheckCircle className="h-3.5 w-3.5 shrink-0" />}
                  {selectedOpt !== null && isSelected && !isCorrect && <XCircle className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>

          {selectedOpt !== null && (
            <div className="p-3 rounded-xl bg-primary/[0.02] border border-primary/10 text-[10px] text-muted-foreground leading-relaxed animate-in slide-in-from-top duration-300">
              {activeQuiz.questions[currentIdx]?.explanation}
            </div>
          )}
        </div>
      )}

      {activeQuiz && !quizDone && (
        <div className="text-[9px] text-muted-foreground leading-relaxed italic bg-muted/20 p-2.5 rounded-xl border border-border/20">
          ✓ Quiz score boards are dynamic. Answers solved are logged immediately.
        </div>
      )}

    </div>
  );
}
