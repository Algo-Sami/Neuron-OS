"use client";

import React, { useState, useEffect } from "react";
// analytics is a plain const - useState kept for isLoading
import { 
  LineChart, 
  Clock, 
  Award, 
  Calendar,
  CheckCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";

export function AnalyticsTab() {
  const analytics = {
    studyMinutes: 180,
    quizAccuracy: 78,
    consistency: 85,
    streak: 4,
    xpGoal: 1000,
    currentXP: 650,
  };

  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Simple load latency simulation
    const t = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const weeklyData = [
    { day: "Mon", minutes: 30, accuracy: 80 },
    { day: "Tue", minutes: 45, accuracy: 70 },
    { day: "Wed", minutes: 15, accuracy: 90 },
    { day: "Thu", minutes: 60, accuracy: 85 },
    { day: "Fri", minutes: 0, accuracy: 0 },
    { day: "Sat", minutes: 20, accuracy: 65 },
    { day: "Sun", minutes: 10, accuracy: 75 }
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground font-semibold">Compiling study logs and productivity histories...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-bottom duration-300">
      
      <div className="border-b border-border/40 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex gap-1.5 items-center">
          <LineChart className="h-5 w-5 text-cyan-500" />
          Academic Analytics & Growth Metrics
        </h2>
        <p className="text-muted-foreground text-xs font-semibold mt-0.5">
          Track your study loads, quiz success metrics, and consistency timelines.
        </p>
      </div>

      {/* Analytics KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Study Ring Widget */}
        <Card className="rounded-3xl border-border/40 bg-card/60 shadow-sm flex flex-col justify-between p-5 items-center text-center">
          <div className="w-full text-left">
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider flex gap-1 items-center">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              Focus Time Analytics
            </span>
          </div>

          <div className="relative h-28 w-28 my-6 flex items-center justify-center">
            {/* SVG circular progress */}
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle cx="56" cy="56" r="48" className="stroke-muted fill-none stroke-[8]" />
              <circle 
                cx="56" cy="56" r="48" 
                className="stroke-cyan-500 fill-none stroke-[8] transition-all duration-500 ease-out"
                strokeDasharray={`${2 * Math.PI * 48}`}
                strokeDashoffset={`${2 * Math.PI * 48 * (1 - 0.75)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="flex flex-col items-center select-none">
              <span className="text-xl font-black tracking-tight">{analytics.studyMinutes}</span>
              <span className="text-[9px] text-muted-foreground font-black uppercase">minutes</span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground leading-relaxed">
            Target study goal: <strong>240 mins/week</strong>. You are 75% complete for this period.
          </div>
        </Card>

        {/* Quiz Accuracy Widget */}
        <Card className="rounded-3xl border-border/40 bg-card/60 shadow-sm flex flex-col justify-between p-5 items-center text-center">
          <div className="w-full text-left">
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider flex gap-1 items-center">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              Quiz Performance Accuracy
            </span>
          </div>

          <div className="relative h-28 w-28 my-6 flex items-center justify-center">
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle cx="56" cy="56" r="48" className="stroke-muted fill-none stroke-[8]" />
              <circle 
                cx="56" cy="56" r="48" 
                className="stroke-emerald-500 fill-none stroke-[8] transition-all duration-500 ease-out"
                strokeDasharray={`${2 * Math.PI * 48}`}
                strokeDashoffset={`${2 * Math.PI * 48 * (1 - analytics.quizAccuracy / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="flex flex-col items-center select-none">
              <span className="text-xl font-black tracking-tight text-emerald-500">{analytics.quizAccuracy}%</span>
              <span className="text-[9px] text-muted-foreground font-black uppercase">correctness</span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground leading-relaxed">
            Overall accuracy rating is <strong className="text-emerald-500">Exceptional</strong>. Strengths lie in concept retrieval.
          </div>
        </Card>

        {/* XP Growth Milestones */}
        <Card className="rounded-3xl border-border/40 bg-card/60 shadow-sm flex flex-col justify-between p-5 items-center text-center">
          <div className="w-full text-left">
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider flex gap-1 items-center">
              <Award className="h-3.5 w-3.5 text-yellow-400" />
              XP Milestones Level progress
            </span>
          </div>

          <div className="relative h-28 w-28 my-6 flex items-center justify-center">
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle cx="56" cy="56" r="48" className="stroke-muted fill-none stroke-[8]" />
              <circle 
                cx="56" cy="56" r="48" 
                className="stroke-yellow-500 fill-none stroke-[8] transition-all duration-500 ease-out"
                strokeDasharray={`${2 * Math.PI * 48}`}
                strokeDashoffset={`${2 * Math.PI * 48 * (1 - analytics.currentXP / analytics.xpGoal)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="flex flex-col items-center select-none">
              <span className="text-xl font-black tracking-tight text-yellow-500">{analytics.currentXP}</span>
              <span className="text-[9px] text-muted-foreground font-black uppercase">/{analytics.xpGoal} XP</span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground leading-relaxed">
            Need <strong>{analytics.xpGoal - analytics.currentXP} XP</strong> to level up. Complete 1 concept evaluation to trigger badge bonuses!
          </div>
        </Card>

      </div>

      {/* SVG Bar Chart representing Weekly Study Hours */}
      <Card className="rounded-3xl border-border/40 bg-card/60 shadow-sm p-6">
        <h3 className="text-sm font-bold text-foreground mb-4 flex gap-1.5 items-center">
          <Calendar className="h-4 w-4 text-primary" />
          Weekly Study Load Pacing (Minutes)
        </h3>
        
        <div className="h-48 w-full flex items-end justify-between gap-2 pt-6 px-4">
          {weeklyData.map((d, idx) => {
            const barHeight = d.minutes > 0 ? (d.minutes / 60) * 100 : 5;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  {d.minutes}m
                </span>
                <div 
                  className={`w-full rounded-t-lg transition-all duration-500 ease-out min-h-[6px] ${
                    d.minutes > 40 
                      ? "bg-primary" 
                      : d.minutes > 20 
                        ? "bg-cyan-500" 
                        : "bg-muted"
                  }`}
                  style={{ height: `${barHeight}%` }}
                />
                <span className="text-[10px] text-muted-foreground font-bold">{d.day}</span>
              </div>
            );
          })}
        </div>
      </Card>

    </div>
  );
}
