"use client";

import React, { useState } from "react";
import { 
  Sparkles, 
  Compass, 
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getExamReadinessAction } from "@/actions/study-coach";

interface ReadinessData {
  readiness_score: number;
  rapid_revision_plan: string[] | null;
  predicted_topics: string[] | null;
  missing_topics: string[] | null;
}

interface ExamReadinessTabProps {
  subjects: { id: string; name: string; code: string; color: string }[];
}

export function ExamReadinessTab({ subjects }: ExamReadinessTabProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [readinessData, setReadinessData] = useState<ReadinessData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Local checklists representing their active sprint review
  const [sprintChecklist, setSprintChecklist] = useState<{ id: number; text: string; completed: boolean }[]>([]);

  const handleSubjectChange = async (subjId: string) => {
    setSelectedSubject(subjId);
    if (!subjId) {
      setReadinessData(null);
      return;
    }

    setIsLoading(true);
    try {
      const res = await getExamReadinessAction(subjId);
      if (res.success && res.readiness) {
        const readiness = res.readiness as unknown as ReadinessData;
        setReadinessData(readiness);
        // Build initial local sprint checklist based on rapid revision plan
        const plan = readiness.rapid_revision_plan || [];
        setSprintChecklist(
          plan.map((item: string, idx: number) => ({
            id: idx,
            text: item,
            completed: false
          }))
        );
      }
    } catch {
      alert("Failed to estimate exam readiness.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCheck = (id: number) => {
    setSprintChecklist(prev => 
      prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item)
    );
  };

  const getComputedReadiness = () => {
    if (!readinessData) return 0;
    const base = readinessData.readiness_score || 50;
    
    // Add bonus readiness for checked sprint items
    const finishedCount = sprintChecklist.filter(c => c.completed).length;
    const bonus = finishedCount * 5; // +5% per finished revision task
    return Math.min(base + bonus, 100);
  };

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-bottom duration-300">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex gap-1.5 items-center">
            <Compass className="h-5 w-5 text-emerald-500 animate-spin-slow" />
            AI Exam Readiness System
          </h2>
          <p className="text-muted-foreground text-xs font-semibold mt-0.5">
            Auto-assess your exam preparation rates and discover predicted important topics.
          </p>
        </div>

        {/* Subject selector */}
        <div className="relative w-full md:w-64 shrink-0">
          <select
            value={selectedSubject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="w-full h-10 px-3 pr-8 rounded-xl border border-border bg-background text-sm font-semibold focus:border-primary focus:outline-none appearance-none cursor-pointer"
          >
            <option value="">-- Select Subject --</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="absolute right-3 top-3.5 pointer-events-none w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-muted-foreground" />
        </div>
      </div>

      {!selectedSubject ? (
        /* Empty Subject prompt */
        <div className="max-w-md mx-auto w-full text-center py-10 space-y-4">
          <Compass className="h-10 w-10 text-primary mx-auto animate-pulse" />
          <h3 className="text-lg font-bold tracking-tight">Select Subject to Load Analytics</h3>
          <p className="text-muted-foreground text-xs font-semibold leading-relaxed">
            Choose an active university course subject from the menu to let the AI Coach run predictions, estimate readiness percentages, and formulate your custom revision sprint.
          </p>
        </div>
      ) : isLoading ? (
        /* Loading Screen */
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground font-semibold">AI is analyzing lecture files and predicting exam yields...</span>
        </div>
      ) : readinessData ? (
        /* Diagnostic Panel */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Dial Gauge Card */}
          <Card className="lg:col-span-5 rounded-3xl border-border/40 bg-card/60 shadow-sm flex flex-col p-6 items-center text-center justify-between min-h-[380px]">
            <div className="w-full text-left">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider flex gap-1 items-center">
                <Compass className="h-3.5 w-3.5 text-emerald-400" />
                Readiness Scorecard
              </span>
            </div>

            <div className="relative h-40 w-40 my-6 flex items-center justify-center">
              <svg className="absolute w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r="68" className="stroke-muted fill-none stroke-[10]" />
                <circle 
                  cx="80" cy="80" r="68" 
                  className="stroke-emerald-500 fill-none stroke-[10] transition-all duration-700 ease-out"
                  strokeDasharray={`${2 * Math.PI * 68}`}
                  strokeDashoffset={`${2 * Math.PI * 68 * (1 - getComputedReadiness() / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="flex flex-col items-center select-none animate-pulse">
                <span className="text-3xl font-black tracking-tight text-emerald-500">{getComputedReadiness()}%</span>
                <span className="text-[9px] text-muted-foreground font-black uppercase">PREPARED</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-semibold block">
                Estimated Confidence:{" "}
                <strong className="text-foreground">High Confidence</strong>
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed px-4">
                Score derived dynamically from quiz accuracies. Check off checklist items to increase confidence rates!
              </p>
            </div>
          </Card>

          {/* Revision checklists and predictions */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Revision Checklist */}
            <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60">
              <CardHeader className="pb-3 border-b border-border/30">
                <CardTitle className="text-sm font-bold flex gap-1.5 items-center">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  3-Step Rapid Revision Sprint Checklist
                </CardTitle>
                <p className="text-xs text-muted-foreground">Checking off revision sprints actively increases readiness metrics by +5%</p>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {sprintChecklist.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => handleToggleCheck(item.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border leading-relaxed shadow-sm transition-all duration-150 cursor-pointer ${
                      item.completed 
                        ? "bg-emerald-500/[0.02] border-emerald-500/20 opacity-80" 
                        : "border-border/40 hover:bg-muted bg-card"
                    }`}
                  >
                    <div className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      item.completed ? "bg-emerald-500 border-transparent text-white" : "border-border"
                    }`}>
                      {item.completed && <CheckCircle className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                    <span className={`text-xs font-semibold ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Predicted Exam Topics */}
            <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60">
              <CardHeader className="pb-3 border-b border-border/30">
                <CardTitle className="text-sm font-bold flex gap-1.5 items-center">
                  <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
                  AI High-Yield Exam Topic Predictions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 flex flex-wrap gap-2">
                {readinessData.predicted_topics?.map((topic: string, idx: number) => (
                  <span 
                    key={idx}
                    className="text-xs bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-xl text-indigo-400 font-bold shadow-sm"
                  >
                    🔥 {topic}
                  </span>
                ))}
              </CardContent>
            </Card>

            {/* Missing Topics */}
            {readinessData.missing_topics && readinessData.missing_topics.length > 0 && (
              <Card className="rounded-2xl border-border/40 shadow-sm bg-card/60">
                <CardHeader className="pb-3 border-b border-border/30">
                  <CardTitle className="text-sm font-bold flex gap-1.5 items-center">
                    <AlertTriangle className="h-4 w-4 text-orange-500 animate-bounce" />
                    Detected Important Gaps to Review
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                  {readinessData.missing_topics?.map((topic: string, idx: number) => (
                    <div key={idx} className="text-xs text-foreground/90 leading-relaxed font-semibold flex gap-2 items-start">
                      <span className="text-orange-500 font-bold">•</span>
                      {topic}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

          </div>

        </div>
      ) : (
        <div className="max-w-md mx-auto w-full text-center py-10 space-y-4">
          <AlertTriangle className="h-10 w-10 text-orange-500 mx-auto" />
          <h3 className="text-lg font-bold tracking-tight">No Readiness Logs Available</h3>
          <p className="text-muted-foreground text-xs font-semibold leading-relaxed">
            Please solve active MCQ quizzes or written concept answers in the study panels first! The AI will automatically formulate your custom readiness score based on performance.
          </p>
        </div>
      )}

    </div>
  );
}
