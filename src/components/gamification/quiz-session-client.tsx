"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  HelpCircle, 
  ArrowLeft, 
  Zap, 
  Award,
  Clock, 
  Flame,
  Sparkles, 
  Key, 
  BookOpen, 
  RefreshCw,
  SkipForward
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { submitQuizAction } from "@/actions/quiz";
import Link from "next/link";

export interface QuestionItem {
  id: string;
  type: string;
  questionText: string;
  correctAnswer: string | number;
  options: string[];
  difficulty: string;
  keyPoints?: string[];
  explanation?: string;
}

interface QuizResults {
  perfectBonus: number;
  challengeAlert: string;
  correctCount: number;
  totalQuestions: number;
  baseXP: number;
  completionXP: number;
  speedBonus: number;
  comboBonus: number;
  streakBonus: number;
  dailyChallengeXP: number;
  totalQuizXP: number;
  newLevel: number;
  levelUp: boolean;
  unlockedAchievements: string[];
}

interface QuizSessionClientProps {
  quiz: {
    id: string;
    title: string;
    questions: QuestionItem[];
    total_questions: number;
    document_id: string;
  };
  userProgress: {
    total_xp: number;
    current_level: number;
    first_name: string;
    last_name: string;
  };
  isPractice?: boolean;
}

/** Marks the gamified daily quiz as completed right now (24-hour lock). */
const markDailyQuizCompleted = (userId: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`neuron_daily_quiz_${userId}`, JSON.stringify({ completedAt: Date.now() }));
};

/** Returns true if the 24-hour quiz lock is still active for this user. */
const getDailyQuizIsLocked = (userId: string): boolean => {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(`neuron_daily_quiz_${userId}`);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return Date.now() - (parsed.completedAt || 0) < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

export function QuizSessionClient({ quiz, isPractice = false }: QuizSessionClientProps) {
  const [currentStep, setCurrentStep] = useState<"intro" | "playing" | "results">("intro");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ id: string; answer: string; selfGrade?: boolean }[]>([]);
  
  // Answering states
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [isCheckedCorrect, setIsCheckedCorrect] = useState(false);
  const [checkedPoints, setCheckedPoints] = useState<Record<number, boolean>>({});
  
  // Scoring results state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<QuizResults | null>(null);
  
  // Timer & Streaks
  const [timeTaken, setTimeTaken] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Anti-Cheat question timer & user ID state
  const [questionTimeLeft, setQuestionTimeLeft] = useState(8);
  const [userId, setUserId] = useState<string>("guest");

  // Auto-advance countdown after MCQ answer is revealed (counts down from 1 to 0)
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);

  // Sandbox study answers
  const [sandboxAnswers, setSandboxAnswers] = useState<Record<number, string>>({});
  const [sandboxRevealed, setSandboxRevealed] = useState<Record<number, boolean>>({});
  const [sandboxCheckedPoints, setSandboxCheckedPoints] = useState<Record<number, Record<number, boolean>>>({});

  const questions = quiz.questions.filter(q => q.type === "mcq" || q.type === "true_false");
  const studyQuestions = quiz.questions.filter(q => q.type === "short_answer");
  const currentQuestion = questions[currentQuestionIndex];

  const resetQuestionState = useCallback(() => {
    setSelectedOption(null);
    setTypedAnswer("");
    setIsAnswerRevealed(false);
    setIsCheckedCorrect(false);
    setCheckedPoints({});
    setAutoAdvanceCountdown(null);
  }, []);

  const submitFullQuiz = useCallback(async () => {
    setLoading(true);
    setCurrentStep("results");
    
    // In case answers are still in-flight
    const finalAnswers = [...userAnswers];
    if (currentQuestion && currentQuestion.type === "short_answer" && finalAnswers.length < questions.length) {
      // safe fallback if skipped
      finalAnswers.push({ id: currentQuestion.id, answer: typedAnswer, selfGrade: isCheckedCorrect });
    }

    const res = await submitQuizAction(quiz.id, finalAnswers, timeTaken, isPractice);
    if (res.success) {
      setResults(res as unknown as QuizResults);
      // Lock the gamified daily quiz slot for 24 hours after a successful XP submission
      if (!isPractice) markDailyQuizCompleted(userId);
    } else {
      alert("Failed to submit quiz score. Please check your connection.");
    }
    setLoading(false);
  }, [quiz.id, userAnswers, currentQuestion, questions.length, typedAnswer, isCheckedCorrect, timeTaken, isPractice, userId]);

  const goToNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      resetQuestionState();
    } else {
      setTimerActive(false);
      submitFullQuiz();
    }
  }, [currentQuestionIndex, questions.length, resetQuestionState, submitFullQuiz]);

  const startQuiz = () => {
    setCurrentStep("playing");
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setTimeTaken(0);
    setTimerActive(true);
    resetQuestionState();
    
    // Reset Sandbox States
    setSandboxAnswers({});
    setSandboxRevealed({});
    setSandboxCheckedPoints({});
  };

  // Skip the current question (records it as wrong / unanswered)
  const skipQuestion = () => {
    if (isAnswerRevealed) return;
    setUserAnswers(prev => [
      ...prev,
      { id: currentQuestion.id, answer: "-1" }
    ]);
    goToNextQuestion();
  };

  // Submit multiple choice or true/false answer
  const handleSelectOption = (idx: number) => {
    if (isAnswerRevealed) return;
    setSelectedOption(idx);
  };

  const verifyObjectiveAnswer = () => {
    if (selectedOption === null) return;
    setIsAnswerRevealed(true);
    
    const isCorrect = String(selectedOption) === String(currentQuestion.correctAnswer) ||
                     (currentQuestion.type === "true_false" && currentQuestion.options[selectedOption] === currentQuestion.correctAnswer);
                     
    setIsCheckedCorrect(isCorrect);

    // Save answer
    const answerVal = currentQuestion.type === "true_false" 
      ? currentQuestion.options[selectedOption] 
      : String(selectedOption);

    setUserAnswers(prev => [
      ...prev,
      { id: currentQuestion.id, answer: answerVal }
    ]);
  };

  // Verify short conceptual answer
  const verifyConceptualAnswer = () => {
    // Support auto-timeout even if empty
    const text = typedAnswer.toLowerCase();
    setIsAnswerRevealed(true);
    
    // Automatically match keywords for assistive visual tips
    const kp = currentQuestion.keyPoints || [];
    const initialCheckState: Record<number, boolean> = {};
    kp.forEach((p: string, idx: number) => {
      if (text.includes(p.toLowerCase())) {
        initialCheckState[idx] = true;
      }
    });
    setCheckedPoints(initialCheckState);
  };

  const handleTogglePoint = (idx: number) => {
    setCheckedPoints(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const submitConceptualSelfGrade = (isStudentCorrect: boolean) => {
    setUserAnswers(prev => [
      ...prev,
      { id: currentQuestion.id, answer: typedAnswer, selfGrade: isStudentCorrect }
    ]);
    setIsCheckedCorrect(isStudentCorrect);
    
    // Proceed to navigation step
    goToNextQuestion();
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error("QuizSessionClient getUser error:", error.message);
          return;
        }
        const user = data?.user;
        if (user) {
          setUserId(user.id);
        }
      } catch {
        // Safe check-in catch block
      }
    };
    fetchUser();
  }, []);

  // 1. Reset timer based on question order (first 10 MCQs: 15s, next 10: 40s, others: 8s)
  useEffect(() => {
    if (currentStep !== "playing" || isAnswerRevealed || isPractice) return;
    
    // Determine time limit by question index
    const timeLimit = currentQuestionIndex < 10 ? 15 : currentQuestionIndex < 20 ? 40 : 8;
    const t = setTimeout(() => {
      setQuestionTimeLeft(timeLimit);
    }, 0);
    return () => clearTimeout(t);
  }, [currentQuestionIndex, currentStep, isAnswerRevealed, isPractice]);

  // 2. Countdown tick per question
  useEffect(() => {
    if (currentStep !== "playing" || isAnswerRevealed || isPractice) return;
    
    if (questionTimeLeft <= 0) {
      // Time's up! Auto-submit
      if (currentQuestion?.type === "mcq" || currentQuestion?.type === "true_false") {
        const t = setTimeout(() => {
          setSelectedOption(-1);
          setIsAnswerRevealed(true);
          setIsCheckedCorrect(false);
          setUserAnswers(prev => [
            ...prev,
            { id: currentQuestion.id, answer: "-1" }
          ]);
        }, 0);
        return () => clearTimeout(t);
      }
      return;
    }

    const timer = setTimeout(() => {
      setQuestionTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [questionTimeLeft, currentStep, isAnswerRevealed, currentQuestion, isPractice]);

  // 1. Solving duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerActive) {
      interval = setInterval(() => {
        setTimeTaken(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive]);

  // 2. Self-contained canvas confetti animation
  useEffect(() => {
    if (currentStep === "results" && (results?.perfectBonus ?? 0) > 0 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const colors = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];
      interface ConfettiParticle {
        x: number;
        y: number;
        r: number;
        d: number;
        color: string;
        tilt: number;
        tiltAngleIncremental: number;
        tiltAngle: number;
      }
      const particles: ConfettiParticle[] = [];

      for (let i = 0; i < 120; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height - canvas.height,
          r: Math.random() * 6 + 4,
          d: Math.random() * canvas.height,
          color: colors[Math.floor(Math.random() * colors.length)],
          tilt: Math.random() * 10 - 5,
          tiltAngleIncremental: Math.random() * 0.07 + 0.02,
          tiltAngle: 0
        });
      }

      let animationFrameId: number;
      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((p, idx) => {
          p.tiltAngle += p.tiltAngleIncremental;
          p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
          p.tilt = Math.sin(p.tiltAngle - idx / 3) * 15;

          ctx.beginPath();
          ctx.lineWidth = p.r;
          ctx.strokeStyle = p.color;
          ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
          ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
          ctx.stroke();

          if (p.y > canvas.height) {
            particles[idx] = {
              x: Math.random() * canvas.width,
              y: -20,
              r: p.r,
              d: p.d,
              color: p.color,
              tilt: p.tilt,
              tiltAngleIncremental: p.tiltAngleIncremental,
              tiltAngle: p.tiltAngle
            };
          }
        });
        animationFrameId = requestAnimationFrame(draw);
      };

      draw();
      const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      window.addEventListener("resize", handleResize);

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [currentStep, results]);

  // Auto-advance: after MCQ/TF answer is revealed, wait 1.5s then move to next
  useEffect(() => {
    if (!isAnswerRevealed) return;
    if (!currentQuestion) return;
    if (currentQuestion.type !== "mcq" && currentQuestion.type !== "true_false") return;

    const t = setTimeout(() => {
      setAutoAdvanceCountdown(2);
    }, 0);
    return () => clearTimeout(t);
  }, [isAnswerRevealed, currentQuestion]);

  useEffect(() => {
    if (autoAdvanceCountdown === null) return;
    if (autoAdvanceCountdown <= 0) {
      const timer = setTimeout(() => {
        // Inline navigation to avoid stale closure on goToNextQuestion
        setCurrentQuestionIndex(prev => {
          if (prev < questions.length - 1) {
            resetQuestionState();
            return prev + 1;
          } else {
            // Last question — trigger submit
            setTimerActive(false);
            submitFullQuiz();
            return prev;
          }
        });
      }, 0);
      return () => clearTimeout(timer);
    }
    const t = setTimeout(() => setAutoAdvanceCountdown(prev => (prev !== null ? prev - 1 : null)), 750);
    return () => clearTimeout(t);
  }, [autoAdvanceCountdown, questions.length, resetQuestionState, submitFullQuiz]);

  // Progress Bar Width
  const progressPercentage = Math.round(((currentQuestionIndex + (isAnswerRevealed ? 1 : 0)) / questions.length) * 100);

  return (
    <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto px-4 py-6 relative">
      {/* Absolute fullscreen canvas for perfect scores */}
      {currentStep === "results" && (results?.perfectBonus ?? 0) > 0 && (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-50" />
      )}

      {/* INTRO STEP */}
      {currentStep === "intro" && (
        <Card className="glass-panel border-border/60 rounded-3xl overflow-hidden shadow-xl bg-gradient-to-b from-card to-background">
          <div className="h-2.5 bg-gradient-to-r from-primary via-indigo-500 to-primary"></div>
          <CardHeader className="text-center pt-8 pb-4">
            <div className="mx-auto h-16 w-16 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-inner mb-4">
              <BookOpen className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <CardTitle className="text-2xl font-black bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
              AI Dynamic Lecture Quiz
            </CardTitle>
            <CardDescription className="text-sm mt-2">
              Verify your comprehension and retrieve concepts from your uploaded lecture file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-6 sm:px-10 pb-10">
            <div className="bg-muted/40 rounded-2xl border p-4 space-y-3.5">
              <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Study Material Title
              </h4>
              <p className="text-sm font-bold text-foreground truncate">{quiz.title.replace("AI Quiz: ", "")}</p>
            </div>


            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-t pt-6">
              <Link href="/uploads">
                <Button variant="ghost" className="rounded-xl gap-1.5 text-xs font-semibold shrink-0">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Uploads
                </Button>
              </Link>
              
              {!isPractice && getDailyQuizIsLocked(userId) ? (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 leading-relaxed text-left max-w-md shadow-sm shrink-0">
                  🔒 Daily quiz already completed! Come back in 24 hours to earn more XP.
                </div>
              ) : (
                <Button 
                  onClick={startQuiz} 
                  className="w-full sm:w-auto bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-700 font-bold rounded-xl px-8 shadow-lg shadow-primary/25"
                >
                  Begin AI Quiz
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PLAYING INTERFACE */}
      {currentStep === "playing" && (
        <div className="space-y-6">
          {/* Header Progress Panel */}
          <div className="flex items-center justify-between gap-4 bg-card p-3 rounded-2xl border shadow-sm">
            <span className="text-xs font-bold text-muted-foreground shrink-0">
              Q. {currentQuestionIndex + 1} of {questions.length}
            </span>
            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden p-0.5 border">
              <div 
                className="h-full bg-gradient-to-r from-primary via-indigo-500 to-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-primary shrink-0 bg-primary/5 px-2.5 py-1 rounded-xl border border-primary/10">
              <Clock className="h-3.5 w-3.5 text-primary animate-spin" />
              <span className="font-mono">{Math.floor(timeTaken / 60)}:{(timeTaken % 60).toString().padStart(2, "0")}</span>
            </div>
          </div>

          {/* Question Card Slide */}
          <Card className="glass-panel border-border/60 rounded-3xl overflow-hidden shadow-lg bg-card">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-[10px] font-black uppercase px-3 py-0.5 rounded-full border ${
                  currentQuestion.type === "mcq" 
                    ? "bg-blue-500/10 text-blue-600 border-blue-500/20" 
                    : currentQuestion.type === "true_false"
                    ? "bg-green-500/10 text-green-600 border-green-500/20"
                    : "bg-purple-500/10 text-purple-600 border-purple-500/20"
                }`}>
                  {currentQuestion.type === "mcq" ? "Multiple Choice" : currentQuestion.type === "true_false" ? "True / False" : "Short Conceptual"}
                </span>
                <span className="text-[10px] font-black uppercase text-muted-foreground">
                  Difficulty: <span className="text-foreground">{currentQuestion.difficulty}</span>
                </span>
              </div>
              <h2 className="text-md sm:text-lg font-black leading-snug text-foreground">
                {currentQuestion.questionText}
              </h2>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Active Question Countdown Timer */}
              {!isAnswerRevealed && !isPractice && (
                <div className="space-y-2 animate-in fade-in-50 duration-200">
                  <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 shrink-0" /> Time Remaining</span>
                    <span className={`font-black uppercase tracking-wider ${questionTimeLeft > 5 ? 'text-emerald-500' : questionTimeLeft > 2 ? 'text-amber-500' : 'text-red-500 animate-pulse'}`}>{questionTimeLeft}s</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden p-0.5 border">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        questionTimeLeft > 5 ? 'bg-emerald-500' : questionTimeLeft > 2 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${(questionTimeLeft / (currentQuestionIndex < 10 ? 15 : currentQuestionIndex < 20 ? 40 : 8)) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* OBJECTIVE: MCQ & TRUE/FALSE RENDERS */}
              {(currentQuestion.type === "mcq" || currentQuestion.type === "true_false") && (
                <div className="grid gap-3 grid-cols-1">
                  {currentQuestion.options.map((opt: string, idx: number) => {
                    const isSelected = selectedOption === idx;
                    const isCorrectOption = String(idx) === String(currentQuestion.correctAnswer) || 
                                          (currentQuestion.type === "true_false" && opt === currentQuestion.correctAnswer);
                    
                    let btnStyle = "bg-card border-border/75 text-foreground hover:bg-muted/30";
                    if (isSelected) {
                      btnStyle = "bg-primary/5 border-primary text-primary shadow-xs shadow-primary/5";
                    }
                    if (isAnswerRevealed) {
                      if (isCorrectOption) {
                        btnStyle = "bg-emerald-500/10 border-emerald-500/50 text-emerald-500 dark:text-emerald-400 font-extrabold";
                      } else if (isSelected) {
                        btnStyle = "bg-red-500/10 border-red-500/50 text-red-500 dark:text-red-400";
                      } else {
                        btnStyle = "bg-card border-border/40 text-muted-foreground opacity-60";
                      }
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectOption(idx)}
                        disabled={isAnswerRevealed}
                        className={`flex items-center text-left p-4 text-sm font-semibold rounded-2xl border transition-all cursor-pointer ${btnStyle}`}
                      >
                        <span className={`inline-flex h-6 w-6 border text-[10px] font-black rounded-full items-center justify-center shrink-0 mr-3 ${
                          isSelected 
                            ? 'bg-primary border-primary text-primary-foreground' 
                            : 'bg-muted border-border/80 text-muted-foreground'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {isAnswerRevealed && isCorrectOption && (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 ml-2 animate-bounce" />
                        )}
                        {isAnswerRevealed && isSelected && !isCorrectOption && (
                          <XCircle className="h-5 w-5 text-red-500 shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* SUBJECTIVE: SHORT CONCEPTUAL RENDER */}
              {currentQuestion.type === "short_answer" && (
                <div className="space-y-4">
                  <textarea
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    onPaste={(e) => {
                      e.preventDefault();
                      alert("🔒 Anti-Cheat Active: Copy-pasting is disabled! Please type out your explanation manually to retrieve concepts.");
                    }}
                    disabled={isAnswerRevealed}
                    placeholder="Type your explanation here. Be concise and cover core academic concepts..."
                    className="w-full h-32 p-4 text-sm font-medium border border-border/80 rounded-2xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none disabled:bg-muted/20 disabled:text-muted-foreground"
                  />

                  {/* Checklist & Explanation revealed */}
                  {isAnswerRevealed && (
                    <div className="space-y-4 animate-in fade-in-50 duration-300">
                      
                      {/* Interactive Key Concepts verification checklist */}
                      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4.5 space-y-3 shadow-inner">
                        <h4 className="text-xs font-black uppercase text-primary tracking-wider flex items-center gap-1">
                          <Key className="h-4 w-4" /> Self-Grading Concepts checklist
                        </h4>
                        <p className="text-xs text-muted-foreground leading-normal">
                          Did your explanation successfully address the following academic concepts? Check all that apply to receive accuracy points:
                        </p>
                        
                        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 pt-1.5">
                          {currentQuestion.keyPoints?.map((pt: string, idx: number) => {
                            const isChecked = checkedPoints[idx] === true;
                            return (
                              <button
                                key={idx}
                                onClick={() => handleTogglePoint(idx)}
                                className={`flex items-center gap-2 p-2.5 text-xs font-bold rounded-xl border text-left transition-all ${
                                  isChecked 
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400' 
                                    : 'bg-card border-border hover:bg-muted/40 text-muted-foreground'
                                }`}
                              >
                                <span className={`h-4.5 w-4.5 rounded border flex items-center justify-center shrink-0 ${
                                  isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border/80 bg-muted'
                                }`}>
                                  {isChecked && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                                </span>
                                <span className="truncate">{pt}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Model Answer Showcase */}
                      <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-2">
                        <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider">
                          Model Answer Reference
                        </h4>
                        <p className="text-xs font-medium text-foreground leading-relaxed">
                          {currentQuestion.correctAnswer}
                        </p>
                      </div>

                    </div>
                  )}
                </div>
              )}

              {/* Explanatory Panel shown after submitting */}
              {isAnswerRevealed && (
                <div className={`p-4.5 rounded-2xl border transition-all animate-in slide-in-from-bottom-2 duration-300 ${
                  isCheckedCorrect 
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500 dark:text-emerald-400' 
                    : currentQuestion.type === 'short_answer'
                    ? 'bg-primary/5 border-primary/10 text-foreground'
                    : 'bg-red-500/5 border-red-500/20 text-red-500 dark:text-red-400'
                }`}>
                  <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1">
                    <HelpCircle className="h-4 w-4 shrink-0" /> Conceptual Explanation
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed font-semibold">
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}

              {/* ACTION FOOTER */}
              <div className="flex items-center justify-between border-t border-border/50 pt-5">

                {/* Skip button — visible only before answer is revealed on objective questions */}
                {!isAnswerRevealed && (currentQuestion.type === "mcq" || currentQuestion.type === "true_false") ? (
                  <Button
                    variant="ghost"
                    onClick={skipQuestion}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5 rounded-xl"
                  >
                    <SkipForward className="h-3.5 w-3.5" /> Skip
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-3">

                  {/* 1. Objective Questions verification action */}
                  {!isAnswerRevealed && (currentQuestion.type === "mcq" || currentQuestion.type === "true_false") && (
                    <Button
                      onClick={verifyObjectiveAnswer}
                      disabled={selectedOption === null}
                      className="bg-primary hover:bg-primary/95 text-xs font-black px-6 rounded-xl"
                    >
                      Check Answer
                    </Button>
                  )}

                  {/* 2. Auto-advance countdown after MCQ answer revealed */}
                  {isAnswerRevealed && (currentQuestion.type === "mcq" || currentQuestion.type === "true_false") && (
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/40 px-4 py-2 rounded-xl border">
                      <ChevronRight className="h-3.5 w-3.5 animate-pulse text-primary" />
                      <span>
                        {currentQuestionIndex === questions.length - 1
                          ? "Submitting..."
                          : `Next in ${autoAdvanceCountdown ?? "…"}s`}
                      </span>
                    </div>
                  )}

                  {/* 3. Short answer verification action */}
                  {!isAnswerRevealed && currentQuestion.type === "short_answer" && (
                    <Button
                      onClick={verifyConceptualAnswer}
                      disabled={!typedAnswer.trim()}
                      className="bg-primary hover:bg-primary/95 text-xs font-black px-6 rounded-xl"
                    >
                      Verify Concept
                    </Button>
                  )}

                  {/* 4. Short answer self-grading evaluation buttons */}
                  {isAnswerRevealed && currentQuestion.type === "short_answer" && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => submitConceptualSelfGrade(false)}
                        className="text-red-500 border-red-500/30 hover:bg-red-500/5 text-xs font-black px-5 rounded-xl"
                      >
                        I Was Incorrect
                      </Button>
                      <Button
                        onClick={() => submitConceptualSelfGrade(true)}
                        className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-xs font-black px-5 rounded-xl"
                      >
                        Concept Addressed!
                      </Button>
                    </div>
                  )}

                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      )}

      {/* RESULTS DISPLAY PANEL */}
      {currentStep === "results" && (
        <Card className="glass-panel border-border/60 rounded-3xl overflow-hidden shadow-xl bg-gradient-to-b from-card to-background">
          <div className="h-2.5 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 animate-pulse"></div>
          
          <CardHeader className="text-center pt-8 pb-4">
            <div className="mx-auto h-16 w-16 bg-yellow-400/10 border border-yellow-400/20 rounded-full flex items-center justify-center text-yellow-500 mb-4 animate-bounce">
              <Award className="h-9 w-9 text-yellow-400 fill-yellow-400/20" />
            </div>
            
            {loading ? (
              <div className="space-y-2">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
                <CardTitle className="text-lg font-bold">Scoring Quiz Attempts...</CardTitle>
              </div>
            ) : (
              <div>
                <CardTitle className="text-2xl font-black bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                  {isPractice ? "Self-Study Mode Completed!" : ((results?.perfectBonus ?? 0) > 0 ? "Perfect Lecture Master!" : "AI Quiz Completed!")}
                </CardTitle>
                <CardDescription className="text-xs mt-1.5 leading-relaxed">
                  {isPractice 
                    ? "Great job! This was a practice session for exam preparation and learning. No XP was recorded." 
                    : "Congratulations! You processed the study materials successfully and earned XP."
                  }
                </CardDescription>
              </div>
            )}
          </CardHeader>

          {results && !loading && (
            <CardContent className="space-y-6 px-6 sm:px-10 pb-10">
              
              {/* Daily challenge completed banner */}
              {results.challengeAlert && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 dark:text-emerald-400 p-4 rounded-2xl flex items-center gap-2.5 shadow-sm animate-pulse">
                  <Sparkles className="h-5 w-5 shrink-0" />
                  <div className="text-left">
                    <p className="text-xs font-black">{results.challengeAlert}</p>
                    <p className="text-[10px] opacity-95">Daily challenge checklist rewards claimed successfully!</p>
                  </div>
                </div>
              )}

              {/* Accuracy Badge */}
              <div className="flex flex-col items-center p-5 bg-muted/20 border border-border/80 rounded-2xl text-center">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Accuracy Rating</span>
                <span className="text-3xl font-black text-foreground mt-1.5">
                  {results.correctCount} / {results.totalQuestions}
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full mt-2.5">
                  {Math.round((results.correctCount / results.totalQuestions) * 100)}% Accuracy
                </span>
              </div>

              {isPractice ? (
                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 p-5 rounded-3xl text-left space-y-2">
                  <h4 className="text-sm font-bold flex items-center gap-1.5">
                    <Sparkles className="h-4.5 w-4.5 text-blue-500 animate-pulse" /> Self-Study Practice Session
                  </h4>
                  <p className="text-xs leading-normal opacity-90">
                    This quiz was completed in **Practice / Self-Study mode**. No XP points or daily challenges were modified for your account. Use this mode to test your understanding of your uploaded lectures as much as you like!
                  </p>
                </div>
              ) : (
                <>
                  {/* Gamification XP Breakdown Grid */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider text-left pl-1">XP Reward breakdowns</h4>
                    <div className="grid grid-cols-2 gap-3.5 text-xs font-semibold">
                      
                      {/* Correct Answers */}
                      <div className="flex items-center justify-between p-3.5 bg-card border rounded-2xl">
                        <span className="text-muted-foreground">Correct Answers</span>
                        <span className="text-foreground font-black">+{results.baseXP} XP</span>
                      </div>

                      {/* Completion */}
                      <div className="flex items-center justify-between p-3.5 bg-card border rounded-2xl">
                        <span className="text-muted-foreground">Completion Bonus</span>
                        <span className="text-foreground font-black">+{results.completionXP} XP</span>
                      </div>

                      {/* Speed Bonus */}
                      {results.speedBonus > 0 && (
                        <div className="flex items-center justify-between p-3.5 bg-yellow-400/5 border border-yellow-400/25 rounded-2xl text-yellow-500">
                          <span className="flex items-center gap-1"><Clock className="h-4 w-4 shrink-0" /> Fast Speed Boost</span>
                          <span className="font-black">+{results.speedBonus} XP</span>
                        </div>
                      )}

                      {/* Combo Streak */}
                      {results.comboBonus > 0 && (
                        <div className="flex items-center justify-between p-3.5 bg-orange-500/5 border border-orange-500/25 rounded-2xl text-orange-500">
                          <span className="flex items-center gap-1"><Flame className="h-4 w-4 shrink-0" /> Answer Combo</span>
                          <span className="font-black">+{results.comboBonus} XP</span>
                        </div>
                      )}

                      {/* Streak Multiplier */}
                      {results.streakBonus > 0 && (
                        <div className="flex items-center justify-between p-3.5 bg-red-500/5 border border-red-500/25 rounded-2xl text-red-500">
                          <span className="flex items-center gap-1"><Zap className="h-4 w-4 shrink-0" /> Daily Streak Multiplier</span>
                          <span className="font-black">+{results.streakBonus} XP</span>
                        </div>
                      )}

                      {/* Perfect Score */}
                      {results.perfectBonus > 0 && (
                        <div className="flex items-center justify-between p-3.5 bg-indigo-500/5 border border-indigo-500/25 rounded-2xl text-indigo-500">
                          <span className="flex items-center gap-1"><Award className="h-4 w-4 shrink-0" /> Perfect 5/5 Bonus</span>
                          <span className="font-black">+{results.perfectBonus} XP</span>
                        </div>
                      )}

                      {/* Daily Challenge Bonus */}
                      {results.dailyChallengeXP > 0 && (
                        <div className="flex items-center justify-between p-3.5 bg-emerald-500/5 border border-emerald-500/25 rounded-2xl text-emerald-500 col-span-2">
                          <span className="flex items-center gap-1"><Sparkles className="h-4 w-4 shrink-0" /> Daily Challenge: Quiz Whiz</span>
                          <span className="font-black">+{results.dailyChallengeXP} XP</span>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* Total points card */}
                  <div className="flex items-center justify-between p-5 bg-gradient-to-r from-primary to-indigo-600 text-white rounded-3xl shadow-md">
                    <div className="text-left">
                      <span className="text-[10px] font-black uppercase tracking-wider opacity-85">Total Gained</span>
                      <p className="text-xl font-black mt-0.5">+{results.totalQuizXP} XP</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase tracking-wider opacity-85">Character Status</span>
                      <p className="text-sm font-black mt-0.5">Level {results.newLevel} Scholar</p>
                    </div>
                  </div>
                </>
              )}

              {/* Level Up alert */}
              {results.levelUp && (
                <div className="bg-yellow-400/10 border border-yellow-400/30 text-yellow-500 p-4.5 rounded-2xl text-center space-y-1 shadow-sm">
                  <p className="text-sm font-black flex items-center justify-center gap-1.5 animate-bounce">
                    🎉 LEVEL UP! 🎉
                  </p>
                  <p className="text-xs opacity-90 leading-relaxed font-semibold">
                    Congratulations! You successfully reached **Level {results.newLevel}**! Keep conquering quizzes to claim high-tier Ranks!
                  </p>
                </div>
              )}

              {/* Achievements badge unlocked alerts */}
              {results.unlockedAchievements?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider text-left pl-1">Badges Unlocked</h4>
                  <div className="grid gap-2 grid-cols-1">
                    {results.unlockedAchievements.map((achName: string) => (
                      <div key={achName} className="flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-400/5 to-orange-500/5 border border-yellow-500/25 rounded-2xl text-left">
                        <Award className="h-5 w-5 text-yellow-400 animate-pulse shrink-0" />
                        <div>
                          <p className="text-xs font-black text-foreground">Unlocked Badge: {achName}!</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">You received a massive achievement XP bonus in your progress wallet!</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional Self-Study Sandbox Written Review */}
              {studyQuestions.length > 0 && (
                <div className="border-t border-border/60 pt-6 space-y-4 text-left">
                  <div>
                    <h4 className="text-sm font-black text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-4.5 w-4.5 text-amber-500" /> 💡 Optional Self-Study Preparation Sandbox
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Practice explaining these conceptual topics in your own words. These are unrated, so you can take all the time you need with **no timers, no XP impact, and copy-paste allowed**!
                    </p>
                  </div>

                  <div className="space-y-4">
                    {studyQuestions.map((q, qIdx) => {
                      const isRevealed = sandboxRevealed[qIdx] === true;
                      const currentVal = sandboxAnswers[qIdx] || "";
                      const keyPoints = q.keyPoints || [];
                      const checkedMap = sandboxCheckedPoints[qIdx] || {};

                      const handleCheckConcept = () => {
                        setSandboxRevealed(prev => ({ ...prev, [qIdx]: true }));
                        
                        // Auto keyword matching for help
                        const text = currentVal.toLowerCase();
                        const initialChecks: Record<number, boolean> = {};
                        keyPoints.forEach((kp: string, kpIdx: number) => {
                          if (text.includes(kp.toLowerCase())) {
                            initialChecks[kpIdx] = true;
                          }
                        });
                        setSandboxCheckedPoints(prev => ({ ...prev, [qIdx]: initialChecks }));
                      };

                      const toggleSandboxPoint = (kpIdx: number) => {
                        setSandboxCheckedPoints(prev => ({
                          ...prev,
                          qIdx: {
                            ...prev[qIdx],
                            [kpIdx]: !prev[qIdx]?.[kpIdx]
                          }
                        }));
                      };

                      return (
                        <div key={q.id} className="p-4 bg-muted/20 border border-border/60 rounded-2xl space-y-3.5">
                          <span className="text-[9px] font-black uppercase text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                            Concept Challenge #{qIdx + 1}
                          </span>
                          <p className="text-xs font-bold text-foreground leading-snug">
                            {q.questionText}
                          </p>

                          <textarea
                            value={currentVal}
                            onChange={(e) => setSandboxAnswers(prev => ({ ...prev, [qIdx]: e.target.value }))}
                            disabled={isRevealed}
                            placeholder="Formulate your explanation here to check your preparation..."
                            className="w-full h-24 p-3 text-xs font-medium border border-border/80 rounded-xl bg-card focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none disabled:bg-muted/10 disabled:text-muted-foreground"
                          />

                          {!isRevealed ? (
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                onClick={handleCheckConcept}
                                disabled={!currentVal.trim()}
                                className="h-8 px-4 rounded-xl text-[10px] font-black"
                              >
                                Reveal Concept Checklist
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-3 animate-in fade-in-50 duration-300 pt-1">
                              {/* Concepts checklist */}
                              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2 shadow-inner">
                                <h5 className="text-[10px] font-black uppercase text-primary flex items-center gap-1">
                                  <Key className="h-3.5 w-3.5" /> Concept Review Checklist
                                </h5>
                                <p className="text-[10px] text-muted-foreground">
                                  Select all key points your explanation addressed:
                                </p>
                                <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2 pt-1">
                                  {keyPoints.map((pt: string, kpIdx: number) => {
                                    const isChecked = checkedMap[kpIdx] === true;
                                    return (
                                      <button
                                        key={kpIdx}
                                        onClick={() => toggleSandboxPoint(kpIdx)}
                                        className={`flex items-center gap-2 p-2 text-[10px] font-bold rounded-lg border text-left transition-all ${
                                          isChecked 
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400' 
                                            : 'bg-card border-border hover:bg-muted/30 text-muted-foreground'
                                        }`}
                                      >
                                        <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                                          isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border/80 bg-muted'
                                        }`}>
                                          {isChecked && <CheckCircle2 className="h-3 w-3 text-white" />}
                                        </span>
                                        <span className="truncate">{pt}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Reference Answer */}
                              <div className="bg-card border rounded-xl p-3 space-y-1.5">
                                <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                                  Model Reference Answer
                                </h5>
                                <p className="text-[10px] font-medium text-foreground leading-relaxed">
                                  {q.correctAnswer}
                                </p>
                              </div>

                              {/* Explanation */}
                              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 rounded-xl text-[10px] leading-relaxed font-semibold">
                                <span className="font-black uppercase tracking-wider block mb-1">Teacher&apos;s Insight:</span>
                                {q.explanation}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Navigation Footer */}
              <div className="flex flex-col sm:flex-row gap-3 pt-5 border-t">
                <Button 
                  onClick={startQuiz}
                  variant="outline"
                  className="w-full sm:flex-1 rounded-xl text-xs font-semibold h-10 gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Re-Take Lecture Quiz
                </Button>
                
                <Link href="/uploads" className="w-full sm:flex-1">
                  <Button 
                    className="w-full rounded-xl text-xs font-semibold h-10 bg-primary"
                  >
                    Take Another Material Quiz
                  </Button>
                </Link>
              </div>

            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
