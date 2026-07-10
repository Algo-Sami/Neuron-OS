"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Brain, 
  ChevronRight, 
  Play, 
  RotateCcw, 
  FileText, 
  HelpCircle,
  MessageSquare,
  Bookmark,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConceptEvaluationMode } from "./concept-evaluation-mode";
import { VivaStudyMode } from "./viva-study-mode";
import { FlashcardStudyMode } from "./flashcard-study-mode";
import { RevisionStudyMode } from "./revision-study-mode";
import { AdaptiveQuizMode } from "./adaptive-quiz-mode";

interface SelfStudyTabProps {
  subjects: { id: string; name: string; code: string; color: string }[];
  lectures: { id: string; title: string; subject_id: string; upload_date: string }[];
  onReward: (xp: number) => void;
}

export interface LastSession {
  subjectId: string;
  subjectName: string;
  lectureId: string;
  lectureTitle: string;
  topic: string;
  modeId: string;
  modeName: string;
  timestamp: number;
}

export function SelfStudyTab({ subjects, lectures, onReward }: SelfStudyTabProps) {
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedLecture, setSelectedLecture] = useState<string>("");
  const [topicName, setTopicName] = useState<string>("");
  
  const [lastSession, setLastSession] = useState<LastSession | null>(null);
  
  // Interactive active study mode states
  const [activeStudyMode, setActiveStudyMode] = useState<string | null>(null);

  useEffect(() => {
    // Load last session cache
    const cached = localStorage.getItem("neuron_study_coach_last_session");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const timer = setTimeout(() => {
          setLastSession(parsed);
        }, 0);
        return () => clearTimeout(timer);
      } catch {
        // no-op
      }
    }
  }, []);

  // Filter lectures matching subject
  const filteredLectures = lectures.filter(l => l.subject_id === selectedSubject);
  const activeSubjectObj = subjects.find(s => s.id === selectedSubject);
  const activeLectureObj = lectures.find(l => l.id === selectedLecture);

  const saveSessionCache = useCallback((modeId: string, modeName: string) => {
    if (!selectedSubject || !selectedLecture) return;
    
    const session: LastSession = {
      subjectId: selectedSubject,
      subjectName: activeSubjectObj?.name || "",
      lectureId: selectedLecture,
      lectureTitle: activeLectureObj?.title || "",
      topic: topicName || "General Overview",
      modeId,
      modeName,
      timestamp: Date.now(),
    };
    
    localStorage.setItem("neuron_study_coach_last_session", JSON.stringify(session));
    setLastSession(session);
  }, [selectedSubject, selectedLecture, activeSubjectObj, activeLectureObj, topicName]);

  const handleLaunchMode = (modeId: string, modeName: string) => {
    if (!selectedSubject) {
      alert("Please select a subject first.");
      return;
    }
    if (!selectedLecture) {
      alert("Please select a lecture file first.");
      return;
    }
    
    saveSessionCache(modeId, modeName);
    setActiveStudyMode(modeId);
  };

  const handleResumeLastSession = () => {
    if (!lastSession) return;
    setSelectedSubject(lastSession.subjectId);
    setSelectedLecture(lastSession.lectureId);
    setTopicName(lastSession.topic);
    setActiveStudyMode(lastSession.modeId);
  };

  const studyModes = [
    {
      id: "mcq",
      name: "Adaptive MCQ Quiz",
      description: "Generates difficulty-adapting multiple choice assessments with instant analytics.",
      icon: HelpCircle,
      gradient: "from-purple-500 to-indigo-500",
      xpGains: "150-250 XP",
    },
    {
      id: "concept",
      name: "Concept Evaluation",
      description: "Submit written text responses to verify your depth, vocab, and conceptual gaps.",
      icon: TrendingUp,
      gradient: "from-blue-500 to-cyan-500",
      xpGains: "50-100 XP",
    },
    {
      id: "viva",
      name: "Viva Conversation",
      description: "Turn-based text session simulating a direct oral exam with a professional personal AI tutor.",
      icon: MessageSquare,
      gradient: "from-amber-500 to-orange-500",
      xpGains: "100-200 XP",
    },
    {
      id: "flashcards",
      name: "Smart Flashcards",
      description: "Review key vocab, processes, and edge cases in an active flip card stack.",
      icon: Bookmark,
      gradient: "from-pink-500 to-rose-500",
      xpGains: "50-120 XP",
    },
    {
      id: "revision",
      name: "Quick Revision Maps",
      description: "Synthesizes beautiful mind-maps, rapid guides, bullet files, and revision sheets.",
      icon: FileText,
      gradient: "from-emerald-500 to-teal-500",
      xpGains: "30-50 XP",
    },
    {
      id: "practice",
      name: "Exam Practice Prep",
      description: "A premium final preparation simulation testing all subject elements simultaneously.",
      icon: Sparkles,
      gradient: "from-indigo-600 to-violet-600",
      xpGains: "200-300 XP",
    },
  ];

  // Render active study screen if launched
  if (activeStudyMode === "concept" && activeLectureObj) {
    return (
      <ConceptEvaluationMode 
        documentId={selectedLecture} 
        documentTitle={activeLectureObj.title}
        topicName={topicName}
        onBack={() => setActiveStudyMode(null)}
        onReward={onReward}
      />
    );
  }

  if (activeStudyMode === "viva" && activeLectureObj) {
    return (
      <VivaStudyMode 
        documentId={selectedLecture}
        documentTitle={activeLectureObj.title}
        topicName={topicName}
        onBack={() => setActiveStudyMode(null)}
        onReward={onReward}
      />
    );
  }

  if (activeStudyMode === "flashcards" && activeLectureObj) {
    return (
      <FlashcardStudyMode 
        documentId={selectedLecture}
        documentTitle={activeLectureObj.title}
        topicName={topicName}
        onBack={() => setActiveStudyMode(null)}
        onReward={onReward}
      />
    );
  }

  if (activeStudyMode === "revision" && activeLectureObj) {
    return (
      <RevisionStudyMode 
        documentId={selectedLecture}
        documentTitle={activeLectureObj.title}
        topicName={topicName}
        onBack={() => setActiveStudyMode(null)}
      />
    );
  }

  if (activeStudyMode === "mcq" && activeLectureObj) {
    return (
      <AdaptiveQuizMode 
        subjectId={selectedSubject}
        documentId={selectedLecture}
        documentTitle={activeLectureObj.title}
        topicName={topicName}
        onBack={() => setActiveStudyMode(null)}
        onReward={onReward}
      />
    );
  }

  if (activeStudyMode === "practice" && activeLectureObj) {
    return (
      <AdaptiveQuizMode 
        subjectId={selectedSubject}
        documentId={selectedLecture}
        documentTitle={activeLectureObj.title}
        topicName={topicName || "Mock Exam"}
        isExamPractice={true}
        onBack={() => setActiveStudyMode(null)}
        onReward={onReward}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-bottom duration-300">
      
      {/* 1. Continue Last Session Widget */}
      {lastSession && (
        <div className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 shadow-inner gap-4">
          <div className="flex gap-3 items-start">
            <div className="p-2 bg-primary/20 text-primary rounded-xl shrink-0">
              <RotateCcw className="h-5 w-5 animate-spin-reverse" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Continue Last Session</h3>
              <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
                Resume studying <strong className="text-foreground">{lastSession.topic}</strong> in <strong className="text-foreground">{lastSession.lectureTitle}</strong> via <span className="underline decoration-indigo-400 font-semibold">{lastSession.modeName}</span>
              </p>
            </div>
          </div>
          <Button 
            onClick={handleResumeLastSession}
            size="lg" 
            className="w-full md:w-auto font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Resume Session
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 2. Selection Flow Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Subject Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">1. Select Subject</label>
          <div className="relative">
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedLecture(""); // Reset lecture
              }}
              className="w-full h-10 px-3 pr-8 rounded-xl border border-border bg-background text-sm font-semibold focus:border-primary focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">-- Choose Subject --</option>
              {subjects.map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.code ? `[${sub.code}] ` : ""}{sub.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-3.5 pointer-events-none w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-muted-foreground" />
          </div>
        </div>

        {/* Lecture Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">2. Select Lecture Upload</label>
          <div className="relative">
            <select
              value={selectedLecture}
              onChange={(e) => setSelectedLecture(e.target.value)}
              disabled={!selectedSubject}
              className="w-full h-10 px-3 pr-8 rounded-xl border border-border bg-background text-sm font-semibold focus:border-primary focus:outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Choose Document --</option>
              {filteredLectures.map(lec => (
                <option key={lec.id} value={lec.id}>
                  {lec.title}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-3.5 pointer-events-none w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-muted-foreground" />
          </div>
          {!selectedSubject && (
            <span className="text-[10px] text-muted-foreground flex gap-1 items-center">
              <AlertCircle className="h-3 w-3" /> Select a subject first to unlock files.
            </span>
          )}
        </div>

        {/* Topic Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">3. Select Specific Topic (Optional)</label>
          <input
            type="text"
            value={topicName}
            onChange={(e) => setTopicName(e.target.value)}
            disabled={!selectedLecture}
            placeholder="e.g. Semaphores, CPU Scheduling, Normalization"
            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm font-medium focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* 3. Choose Study Mode Panels */}
      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <h2 className="text-lg font-bold tracking-tight text-foreground flex gap-2 items-center">
            <Brain className="h-5 w-5 text-primary" />
            4. Select Your Study Mode
          </h2>
          <span className="text-xs text-muted-foreground font-semibold">Active Selection Needed</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {studyModes.map(mode => {
            const isSelectable = selectedSubject !== "" && selectedLecture !== "";
            return (
              <div
                key={mode.id}
                onClick={() => isSelectable && handleLaunchMode(mode.id, mode.name)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border bg-card/60 p-5 transition-all duration-300 shadow-sm flex flex-col justify-between min-h-[190px]",
                  isSelectable
                    ? "hover:border-primary/40 hover:-translate-y-1 hover:shadow-lg cursor-pointer"
                    : "opacity-60 cursor-not-allowed border-border"
                )}
              >
                <div className="space-y-3">
                  {/* Icon & Title Header */}
                  <div className="flex items-center justify-between">
                    <div className={cn("p-2.5 rounded-xl text-white bg-gradient-to-r shadow-md", mode.gradient)}>
                      <mode.icon className="h-5 w-5" />
                    </div>
                    {isSelectable ? (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {mode.xpGains}
                      </span>
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground/60" />
                    )}
                  </div>
                  
                  {/* Details */}
                  <div className="space-y-1">
                    <h3 className="font-bold text-base tracking-tight text-foreground group-hover:text-primary transition-colors">
                      {mode.name}
                    </h3>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {mode.description}
                    </p>
                  </div>
                </div>

                {/* Launch Action */}
                {isSelectable && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary mt-4 select-none opacity-0 group-hover:opacity-100 transition-opacity">
                    Start Session
                    <Play className="h-3 w-3 fill-primary shrink-0" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
