"use client";

import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle,
  Lightbulb,
  FileText,
  RotateCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { evaluateConceptAction } from "@/actions/study-coach";

interface ConceptEvaluation {
  score: number;
  understandingLevel: string;
  strengths: string[];
  weakAreas: string[];
  missingConcepts: string[];
  suggestions: string[];
}

interface ConceptEvaluationModeProps {
  documentId: string;
  documentTitle: string;
  topicName: string;
  onBack: () => void;
  onReward: (xp: number) => void;
}

export function ConceptEvaluationMode({ 
  documentId, 
  documentTitle, 
  topicName, 
  onBack,
  onReward
}: ConceptEvaluationModeProps) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [customQuestion, setCustomQuestion] = useState<string>("");
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [evaluation, setEvaluation] = useState<ConceptEvaluation | null>(null);

  // Generate 3 practice conceptual questions when entering
  useEffect(() => {
    async function loadQuestions() {
      setIsLoadingQuestions(true);
      try {
        // We will call a simple prompt via Gemini to get 3 conceptual questions based on document
        const response = await fetch("/api/summarize", {
          method: "POST",
          body: JSON.stringify({ 
            documentId,
            customPrompt: `Generate exactly 3 highly challenging conceptual, essay-style questions testing deep understanding of the core lecture topic: "${topicName || "General Study"}". Return ONLY a raw JSON string array, like: ["Question 1", "Question 2", "Question 3"].` 
          })
        });
        
        const data = await response.json();
        if (data?.summary) {
          // Clean json tags
          let cleaned = data.summary.trim();
          if (cleaned.startsWith("```json")) {
            cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
          } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
          }
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setQuestions(parsed);
          } else {
            throw new Error("Invalid format");
          }
        } else {
          throw new Error("API error");
        }
      } catch {
        // Fallback standard conceptual questions
        setQuestions([
          `Explain the primary tradeoffs and architectural goals related to: "${topicName || "the core concepts"}".`,
          `Analyze a concrete real-world scenario where the main process of "${topicName || "this subject"}" could fail, and how to prevent it.`,
          `Compare the classical design patterns of "${topicName || "this lecture notes"}" to modern alternative solutions.`
        ]);
      } finally {
        setIsLoadingQuestions(false);
      }
    }
    loadQuestions();
  }, [documentId, topicName]);

  const activeQuestion = isCustomMode ? customQuestion : questions[selectedQuestionIndex] || "";

  const handleSubmit = async () => {
    if (!activeQuestion.trim()) {
      alert("Please choose or type a practice question first.");
      return;
    }
    if (userAnswer.trim().length < 15) {
      alert("Please write a more detailed explanation (minimum 15 characters).");
      return;
    }

    setIsSubmitting(true);
    setEvaluation(null);
    try {
      const res = await evaluateConceptAction(documentId, activeQuestion, userAnswer);
      if (res.success && res.evaluation) {
        setEvaluation(res.evaluation.feedback as unknown as ConceptEvaluation);
        onReward(res.evaluation.feedback.score >= 80 ? 100 : 50);
      } else {
        alert(res.error || "Failed to submit concept answer.");
      }
    } catch {
      alert("Submission timed out. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Button 
            onClick={onBack}
            variant="ghost" 
            size="icon-sm"
            className="rounded-xl hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-black tracking-tight text-foreground flex gap-2 items-center">
              Concept Evaluation Canvas
            </h2>
            <p className="text-muted-foreground text-xs font-semibold mt-0.5">
              Lecture: {documentTitle}
            </p>
          </div>
        </div>
        <span className="text-xs bg-indigo-500/10 text-indigo-400 font-bold px-3 py-1 rounded-xl flex gap-1 items-center shadow-sm">
          <Sparkles className="h-3 w-3 animate-spin-slow" />
          Tutor Engine Active
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Question Picker */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <Card className="rounded-2xl border-border/40 shadow-sm bg-card/50">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-sm font-bold flex gap-1.5 items-center">
                <HelpCircle className="h-4 w-4 text-primary" />
                Select Practice Question
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex flex-col gap-3">
              {isLoadingQuestions ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-muted-foreground font-semibold">Generating concept prompts...</span>
                </div>
              ) : (
                <>
                  {/* Standard Questions */}
                  {!isCustomMode && questions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedQuestionIndex(idx);
                        setEvaluation(null);
                      }}
                      className={`w-full text-left p-3 rounded-xl text-xs font-semibold leading-relaxed border transition-all duration-200 cursor-pointer ${
                        selectedQuestionIndex === idx && !isCustomMode
                          ? "bg-primary/10 border-primary text-foreground"
                          : "border-border/40 hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {q}
                    </button>
                  ))}

                  {/* Custom mode button toggle */}
                  <div className="h-px bg-border/40 my-1" />
                  
                  <button
                    onClick={() => {
                      setIsCustomMode(!isCustomMode);
                      setEvaluation(null);
                    }}
                    className={`w-full text-center py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      isCustomMode
                        ? "bg-indigo-500/10 border-indigo-400 text-indigo-400"
                        : "border-dashed border-border/50 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCustomMode ? "← Use AI generated questions" : "✍️ Write my own custom question"}
                  </button>

                  {/* Custom question text field */}
                  {isCustomMode && (
                    <input
                      type="text"
                      value={customQuestion}
                      onChange={(e) => setCustomQuestion(e.target.value)}
                      placeholder="Type your own conceptual question here..."
                      className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-medium focus:border-primary focus:outline-none"
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Answer Area & Results */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-sm font-bold flex gap-1.5 items-center">
                <FileText className="h-4 w-4 text-primary" />
                Active Question prompt:
              </CardTitle>
              <p className="text-foreground text-sm font-semibold italic mt-1 bg-muted/30 p-3 rounded-xl border border-border/20 leading-relaxed">
                {isLoadingQuestions ? "Generating conceptual evaluation topics..." : activeQuestion || "Please write a custom question above."}
              </p>
            </CardHeader>
            <CardContent className="pt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Explanation Response</label>
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  disabled={isSubmitting}
                  rows={8}
                  placeholder="Write your academic explanation here. Focus on defining terms, citing examples, and detailing processes to maximize your AI concept evaluation score..."
                  className="w-full p-4 rounded-xl border border-border bg-background text-sm font-medium focus:border-primary focus:outline-none resize-none disabled:opacity-50"
                />
                <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                  <span>Aim for depth and structural vocabulary.</span>
                  <span className="font-semibold">{userAnswer.length} chars</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || isLoadingQuestions || !activeQuestion}
                  size="lg"
                  className="font-bold rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-all w-full md:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <RotateCw className="h-4 w-4 animate-spin shrink-0" />
                      Tutor is evaluating...
                    </>
                  ) : (
                    <>
                      Submit Answer
                      <Send className="h-4 w-4 shrink-0" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AI EVALUATION REPORT SCROLL AREA */}
          {evaluation && (
            <div className="animate-in slide-in-from-top duration-500">
              <Card className="rounded-2xl border-indigo-500/20 shadow-md bg-gradient-to-br from-indigo-500/[0.02] via-card to-transparent border">
                <CardHeader className="border-b border-border/30 pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-foreground flex gap-1.5 items-center">
                      <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
                      AI Coach Evaluation Report
                    </CardTitle>
                    <p className="text-muted-foreground text-xs mt-0.5">Evaluation compiled dynamically by Gemini Coach</p>
                  </div>
                  
                  {/* Score Indicator Dial */}
                  <div className="flex flex-col items-center">
                    <div className={`h-14 w-14 rounded-full border-4 flex items-center justify-center shadow-inner ${
                      evaluation.score >= 80 
                        ? "border-emerald-500/30 text-emerald-500" 
                        : evaluation.score >= 50 
                          ? "border-orange-500/30 text-orange-500" 
                          : "border-red-500/30 text-red-500"
                    }`}>
                      <span className="text-lg font-black tracking-tighter">{evaluation.score}%</span>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-6 flex flex-col gap-6">
                  
                  {/* Level & Understanding */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Understanding Level:</span>
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                      evaluation.understandingLevel === "Strong" 
                        ? "bg-emerald-500/10 text-emerald-500" 
                        : evaluation.understandingLevel === "Moderate" 
                          ? "bg-orange-500/10 text-orange-500" 
                          : "bg-red-500/10 text-red-500"
                    }`}>
                      {evaluation.understandingLevel}
                    </span>
                  </div>

                  {/* Strengths & Weaknesses Grids */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Strengths */}
                    <div className="p-4 rounded-xl bg-emerald-500/[0.02] border border-emerald-500/10 space-y-2">
                      <h4 className="text-xs font-bold text-emerald-500 flex gap-1 items-center uppercase tracking-wider">
                        <CheckCircle2 className="h-3.5 w-3.5 fill-emerald-500/10" />
                        Key Conceptual Strengths
                      </h4>
                      <ul className="space-y-1.5">
                        {evaluation.strengths.map((str: string, idx: number) => (
                          <li key={idx} className="text-xs leading-relaxed text-foreground/90 flex gap-1.5 items-start">
                            <span className="text-emerald-500 font-bold">•</span>
                            {str}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Weaknesses */}
                    <div className="p-4 rounded-xl bg-orange-500/[0.02] border border-orange-500/10 space-y-2">
                      <h4 className="text-xs font-bold text-orange-500 flex gap-1 items-center uppercase tracking-wider">
                        <AlertTriangle className="h-3.5 w-3.5 fill-orange-500/10" />
                        Gaps & Weak Areas
                      </h4>
                      <ul className="space-y-1.5">
                        {evaluation.weakAreas.map((weak: string, idx: number) => (
                          <li key={idx} className="text-xs leading-relaxed text-foreground/90 flex gap-1.5 items-start">
                            <span className="text-orange-500 font-bold">•</span>
                            {weak}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Missing Terms & Improvement Tips */}
                  <div className="space-y-4">
                    {/* Missing Concepts */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Missing Core Terminology & Chunks:</h4>
                      <div className="flex flex-wrap gap-2">
                        {evaluation.missingConcepts.map((term: string, idx: number) => (
                          <span key={idx} className="text-xs bg-muted/60 border border-border/40 px-2.5 py-1 rounded-lg text-foreground/90 font-medium">
                            {term}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Next Steps */}
                    <div className="p-4 rounded-xl bg-primary/[0.02] border border-primary/10 space-y-2">
                      <h4 className="text-xs font-bold text-primary flex gap-1 items-center uppercase tracking-wider">
                        <Lightbulb className="h-3.5 w-3.5 fill-primary/10" />
                        Coach Revision Suggestions
                      </h4>
                      <ul className="space-y-1.5">
                        {evaluation.suggestions.map((sug: string, idx: number) => (
                          <li key={idx} className="text-xs leading-relaxed text-foreground/90 flex gap-1.5 items-start">
                            <span className="text-primary font-bold">•</span>
                            {sug}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                </CardContent>
              </Card>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
