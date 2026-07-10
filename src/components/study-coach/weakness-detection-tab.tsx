"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Activity, 
  AlertTriangle,
  CheckCircle2,
  RotateCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAcademicHealthAction, forceUpdateWeaknessesAction } from "@/actions/study-coach";

interface WeaknessRecord {
  health_score: number;
  subjects?: {
    name: string;
  };
  confidence_levels?: Record<string, number>;
  weak_concepts?: string[];
  strong_concepts?: string[];
}

export function WeaknessDetectionTab() {
  const [weaknesses, setWeaknesses] = useState<WeaknessRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  async function loadData(showLoading = false) {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const res = await getAcademicHealthAction();
      if (res.success && res.weaknesses) {
        setWeaknesses(res.weaknesses as unknown as WeaknessRecord[]);
      }
    } catch {
      // no-op
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleForceCheck = async () => {
    setIsRefreshing(true);
    try {
      await forceUpdateWeaknessesAction();
      await loadData(true);
      alert("Academic Health diagnostics re-evaluated! Dashboard updated successfully.");
    } catch {
      alert("Re-evaluation failed. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground font-semibold">AI is analyzing historical quizzes and concept answers...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-bottom duration-300">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex gap-1.5 items-center">
            <Activity className="h-5 w-5 text-red-500 animate-pulse" />
            Academic Health & Weakness Detection
          </h2>
          <p className="text-muted-foreground text-xs font-semibold mt-0.5">
            Real-time diagnostics mapping conceptual strengths, gaps, and revision urgency.
          </p>
        </div>

        <Button
          onClick={handleForceCheck}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="rounded-xl flex gap-1 items-center font-bold"
        >
          {isRefreshing ? (
            <>
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
              Re-evaluating...
            </>
          ) : (
            <>
              <RotateCw className="h-3.5 w-3.5" />
              Scan Now
            </>
          )}
        </Button>
      </div>

      {weaknesses.length === 0 ? (
        /* Empty State */
        <div className="max-w-md mx-auto w-full text-center py-10 space-y-4">
          <Sparkles className="h-10 w-10 text-primary mx-auto animate-pulse" />
          <h3 className="text-lg font-bold tracking-tight">Diagnostic Database is Empty</h3>
          <p className="text-muted-foreground text-xs font-semibold leading-relaxed">
            Please solve active MCQ quizzes or submit written responses in the Self-Study panel first! The AI will automatically analyze your responses to compile your health rating.
          </p>
        </div>
      ) : (
        /* List of Subject Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {weaknesses.map((item, idx) => {
            const health = item.health_score >= 80 
              ? "Strong" 
              : item.health_score >= 50 
                ? "Moderate" 
                : "Weak";
            
            // Extract confidence score
            const subjName = item.subjects?.name || "";
            const confidence = item.confidence_levels?.[subjName] || item.health_score || 70;

            return (
              <Card 
                key={idx} 
                className="rounded-3xl border-border/40 bg-card/60 shadow-sm overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Subject Header */}
                  <div className="bg-muted/30 border-b border-border/20 py-3.5 px-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-foreground">{subjName}</h3>
                      <span className="text-[10px] text-muted-foreground font-semibold">Subject diagnostics</span>
                    </div>

                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      health === "Strong" 
                        ? "bg-emerald-500/10 text-emerald-500" 
                        : health === "Moderate" 
                          ? "bg-orange-500/10 text-orange-500" 
                          : "bg-red-500/10 text-red-500"
                    }`}>
                      {health} Health
                    </span>
                  </div>

                  <CardContent className="p-5 space-y-4">
                    {/* Confidence Rating Progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold">
                        <span>Confidence Level</span>
                        <span className="font-bold">{confidence}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border/20 shadow-inner">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 shadow-sm ${
                            health === "Strong" 
                              ? "bg-emerald-500" 
                              : health === "Moderate" 
                                ? "bg-orange-500" 
                                : "bg-red-500"
                          }`}
                          style={{ width: `${confidence}%` }}
                        />
                      </div>
                    </div>

                    {/* Strong / Weak Topic list */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      {/* Weak points */}
                      <div className="space-y-1.5">
                        <h4 className="text-[10px] font-black text-red-400 flex gap-1 items-center uppercase tracking-wider">
                          <AlertTriangle className="h-3 w-3" />
                          Weak Areas
                        </h4>
                        {item.weak_concepts?.length === 0 ? (
                          <span className="text-[10px] text-muted-foreground leading-relaxed italic">None detected</span>
                        ) : (
                          <ul className="space-y-1">
                            {item.weak_concepts?.map((c: string, cIdx: number) => (
                              <li key={cIdx} className="text-[11px] font-medium leading-relaxed text-foreground/80 flex gap-1 items-start">
                                <span className="text-red-400 font-bold">•</span>
                                {c}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Strong points */}
                      <div className="space-y-1.5">
                        <h4 className="text-[10px] font-black text-emerald-500 flex gap-1 items-center uppercase tracking-wider">
                          <CheckCircle2 className="h-3 w-3" />
                          Strengths
                        </h4>
                        {item.strong_concepts?.length === 0 ? (
                          <span className="text-[10px] text-muted-foreground leading-relaxed italic">None detected</span>
                        ) : (
                          <ul className="space-y-1">
                            {item.strong_concepts?.map((c: string, cIdx: number) => (
                              <li key={cIdx} className="text-[11px] font-medium leading-relaxed text-foreground/80 flex gap-1 items-start">
                                <span className="text-emerald-500 font-bold">•</span>
                                {c}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                  </CardContent>
                </div>

                {/* Recommendations Footer */}
                <div className="p-4 border-t border-border/20 bg-muted/20 text-xs">
                  <span className="font-bold text-foreground">💡 Revision urgent recommendation:</span>{" "}
                  {health === "Weak" 
                    ? `Review core notes and solve an Adaptive MCQ Quiz on ${item.weak_concepts?.[0] || "foundations"} to recover confidence.` 
                    : health === "Moderate" 
                      ? `Take a Quick Flashcard stack on ${item.weak_concepts?.[0] || "secondary items"} to reinforce details.`
                      : `Excellent work! Maintain streaks and attempt Viva Conversation to challenge limits.`
                  }
                </div>

              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}
