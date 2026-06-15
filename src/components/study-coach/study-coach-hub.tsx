"use client";

import React, { useState } from "react";
import { 
  Sparkles, 
  Flame, 
  Trophy, 
  Activity, 
  Calendar, 
  Compass, 
  Heart,
  LineChart,
  Brain
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StudyCoachHubData } from "@/actions/study-coach";
import { SelfStudyTab } from "./self-study-tab";
import { StudyPlannerTab } from "./study-planner-tab";
import { WeaknessDetectionTab } from "./weakness-detection-tab";
import { AnalyticsTab } from "./analytics-tab";
import { ExamReadinessTab } from "./exam-readiness-tab";
import { InsightsTab } from "./insights-tab";

interface StudyCoachHubProps {
  initialData: StudyCoachHubData;
}

export function StudyCoachHub({ initialData }: StudyCoachHubProps) {
  const [activeTab, setActiveTab] = useState<
    "self-study" | "planner" | "weaknesses" | "analytics" | "readiness" | "insights"
  >("self-study");

  const [hubStats, setHubStats] = useState({
    streak: initialData.streak,
    totalXP: initialData.totalXP,
    level: initialData.level,
    overallHealthScore: initialData.overallHealthScore,
    overallReadiness: initialData.overallReadiness,
  });

  const tabs = [
    { id: "self-study", name: "Self-Study Mode", icon: Brain },
    { id: "planner", name: "AI Study Planner", icon: Calendar },
    { id: "weaknesses", name: "Academic Health", icon: Heart },
    { id: "readiness", name: "Exam Readiness", icon: Compass },
    { id: "analytics", name: "Performance Charts", icon: LineChart },
    { id: "insights", name: "AI Coach Insights", icon: Sparkles },
  ] as const;

  // Simple handler to trigger stats re-updates when actions occur
  const refreshStats = (newXP: number, streakUpdated?: number) => {
    setHubStats(prev => ({
      ...prev,
      totalXP: prev.totalXP + newXP,
      streak: streakUpdated !== undefined ? streakUpdated : prev.streak,
    }));
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-10 px-4 md:px-0 animate-in fade-in duration-300">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5 select-none">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2 bg-gradient-to-r from-foreground via-foreground to-foreground/75 bg-clip-text">
            Study Coach <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" />
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your personal AI tutor, academic health analyst, and smart study planner.
          </p>
        </div>
      </div>

      {/* Global Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 select-none">
        {/* Streak widget */}
        <div className="group flex items-center justify-between p-3.5 rounded-xl bg-card/45 border border-border/60 shadow-2xs transition-all duration-300 hover:bg-card/90 hover:border-primary/20 backdrop-blur-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Study Streak</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-semibold tracking-tight text-foreground">{hubStats.streak}</span>
              <span className="text-[10px] text-muted-foreground font-medium">days</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-orange-500/5 text-orange-400 border border-orange-500/10">
            <Flame className="h-5 w-5 fill-orange-500/10 animate-pulse" />
          </div>
        </div>

        {/* XP Progress widget */}
        <div className="group flex items-center justify-between p-3.5 rounded-xl bg-card/45 border border-border/60 shadow-2xs transition-all duration-300 hover:bg-card/90 hover:border-primary/20 backdrop-blur-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Level {hubStats.level}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-semibold tracking-tight text-foreground">{hubStats.totalXP.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground font-medium">XP total</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-yellow-500/5 text-yellow-400 border border-yellow-500/10">
            <Trophy className="h-5 w-5 animate-bounce" />
          </div>
        </div>

        {/* Academic Health widget */}
        <div className="group flex items-center justify-between p-3.5 rounded-xl bg-card/45 border border-border/60 shadow-2xs transition-all duration-300 hover:bg-card/90 hover:border-primary/20 backdrop-blur-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Academic Health</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-semibold tracking-tight text-foreground">{hubStats.overallHealthScore}%</span>
              <span className="text-[10px] text-muted-foreground font-medium">overall</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-red-500/5 text-red-400 border border-red-500/10">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        {/* Exam Readiness widget */}
        <div className="group flex items-center justify-between p-3.5 rounded-xl bg-card/45 border border-border/60 shadow-2xs transition-all duration-300 hover:bg-card/90 hover:border-primary/20 backdrop-blur-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Exam Readiness</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-semibold tracking-tight text-foreground">{hubStats.overallReadiness}%</span>
              <span className="text-[10px] text-muted-foreground font-medium">estimated</span>
            </div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/5 text-emerald-400 border border-emerald-500/10">
            <Compass className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tab controls */}
      <div className="flex overflow-x-auto gap-1 pb-1.5 scrollbar-none border-b border-border/20 select-none">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer h-8",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground border border-transparent"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="bg-card/40 border border-border/60 rounded-xl p-4 md:p-5 min-h-[500px] shadow-2xs backdrop-blur-xs">
        {activeTab === "self-study" && (
          <SelfStudyTab 
            subjects={initialData.subjects} 
            lectures={initialData.lectures} 
            onReward={refreshStats}
          />
        )}
        {activeTab === "planner" && (
          <StudyPlannerTab 
            subjects={initialData.subjects}
          />
        )}
        {activeTab === "weaknesses" && (
          <WeaknessDetectionTab />
        )}
        {activeTab === "analytics" && (
          <AnalyticsTab />
        )}
        {activeTab === "readiness" && (
          <ExamReadinessTab 
            subjects={initialData.subjects}
          />
        )}
        {activeTab === "insights" && (
          <InsightsTab />
        )}
      </div>

    </div>
  );
}
