"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Clock, RefreshCw, Layers, Check, ChevronDown, Terminal as TerminalIcon } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type StageStatus = "pending" | "processing" | "completed" | "failed" | "skipped" | "waiting";

interface StageProgress {
  status: StageStatus;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  attempts?: number;
  errorMessage?: string;
}

interface TaskProgress {
  overallStatus: "pending" | "processing" | "completed" | "failed";
  stages: {
    extraction: StageProgress;
    summary: StageProgress;
    keyConcepts: StageProgress;
    definitions: StageProgress;
    flashcards: StageProgress;
    mcqs: StageProgress;
    practiceQuestions: StageProgress;
    studyGuide: StageProgress;
    pdf: StageProgress;
    synchronize: StageProgress;
  };
}

interface LogEntry {
  timestamp: string;
  stage: string;
  message: string;
  level: "INFO" | "WARN" | "ERROR";
}

interface BackgroundTask {
  id: string;
  document_id: string;
  status: string; // "Queued" | "Downloading File" | ... | "Completed" | "Failed"
  progress: TaskProgress | null;
  logs: LogEntry[] | null;
  created_at: string;
  updated_at: string;
  doc_title?: string;
}

interface AIProcessingCenterProps {
  userId: string;
  subjectId: string;
}

interface UIStageState {
  key: string;
  label: string;
  status: "waiting" | "processing" | "completed" | "failed";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusIcon({ status, size = 16 }: { status: "pending" | "processing" | "completed" | "failed" | "waiting"; size?: number }) {
  const s = size;
  if (status === "completed") {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className="text-emerald-500 shrink-0">
        <circle cx="8" cy="8" r="7.5" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1"/>
        <path d="M5 8.5L7 10.5L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  if (status === "processing") {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className="text-blue-500 shrink-0 animate-spin">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.5"/>
        <path d="M8 1a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
  }
  if (status === "failed") {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className="text-red-500 shrink-0">
        <circle cx="8" cy="8" r="7.5" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1"/>
        <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" className="text-zinc-400 dark:text-zinc-600 shrink-0">
      <circle cx="8" cy="8" r="7.5" stroke="currentColor" strokeWidth="1"/>
    </svg>
  );
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function RunningTimer({ startIso, taskStatus, updatedAt }: { startIso: string; taskStatus: string; updatedAt: string }) {
  const isDone = taskStatus === "completed" || taskStatus === "Completed" || taskStatus === "failed" || taskStatus === "Failed";

  const getDuration = useCallback(() => {
    if (isDone) {
      return Math.max(0, Math.round((new Date(updatedAt).getTime() - new Date(startIso).getTime()) / 1000));
    }
    return Math.max(0, Math.round((Date.now() - new Date(startIso).getTime()) / 1000));
  }, [startIso, isDone, updatedAt]);

  const [secs, setSecs] = useState<number>(getDuration);

  useEffect(() => {
    if (isDone) {
      return;
    }
    const start = new Date(startIso).getTime();
    const tick = () => {
      setSecs(Math.max(0, Math.round((Date.now() - start) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startIso, isDone]);

  if (isDone) {
    return <span className="tabular-nums font-mono">{formatTimer(getDuration())}</span>;
  }

  return <span className="tabular-nums font-mono">{formatTimer(secs)}</span>;
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-1 border-b border-border/40 last:border-b-0">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="text-foreground font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// ── Extraction of stage sequences ───────────────────────────────────────────

function getFailedStatusKey(task: BackgroundTask): string {
  if (!task.logs || task.logs.length === 0) return "Extracting Text";

  const PIPELINE_KEYS = [
    "Downloading File",
    "Extracting Text",
    "Cleaning Text",
    "Validating Text",
    "Saving Text"
  ];

  for (let i = task.logs.length - 1; i >= 0; i--) {
    const msg = task.logs[i].message;
    for (const key of PIPELINE_KEYS) {
      if (msg.includes(key) || msg.toLowerCase().includes(key.toLowerCase())) {
        return key;
      }
    }
  }

  return "Extracting Text";
}

function getUIStages(task: BackgroundTask): UIStageState[] {
  const normalizedStatus = 
    task.status === "completed" ? "Completed" :
    task.status === "failed" ? "Failed" :
    task.status === "pending" ? "Queued" :
    task.status === "processing" ? "Downloading File" :
    task.status;

  const PIPELINE_STATUSES: { key: string; label: string }[] = [
    { key: "Queued", label: "Queued" },
    { key: "Downloading File", label: "Downloading File" },
    { key: "Extracting Text", label: "Extracting Text" },
    { key: "Cleaning Text", label: "Cleaning Text" },
    { key: "Validating Text", label: "Validating Text" },
    { key: "Saving Text", label: "Saving Text" },
    { key: "Completed", label: "Completed" }
  ];

  if (normalizedStatus === "Completed") {
    return PIPELINE_STATUSES.map(s => ({
      key: s.key,
      label: s.label,
      status: "completed"
    }));
  }

  let activeIndex = PIPELINE_STATUSES.findIndex(s => s.key === normalizedStatus);
  const isFailed = normalizedStatus === "Failed";
  let failedKey = "";

  if (isFailed) {
    failedKey = getFailedStatusKey(task);
    activeIndex = PIPELINE_STATUSES.findIndex(s => s.key === failedKey);
  }

  if (activeIndex === -1) {
    activeIndex = 0; // fallback
  }

  return PIPELINE_STATUSES.map((s, idx) => {
    let status: "waiting" | "processing" | "completed" | "failed" = "waiting";
    if (idx < activeIndex) {
      status = "completed";
    } else if (idx === activeIndex) {
      status = isFailed ? "failed" : "processing";
    }
    return {
      key: s.key,
      label: s.label,
      status
    };
  });
}

function getActiveStageLabel(task: BackgroundTask): string {
  return task.status;
}

// ── Log and stats calculations ───────────────────────────────────────────────

function extractCharacterCount(logs: LogEntry[] | null): string {
  if (!logs) return "—";
  const regexes = [
    /saved \((\d+)\s*chars\)/i,
    /Extracted (\d+)\s*characters/i,
    /cached text \((\d+)\s*chars\)/i,
    /length:\s*(\d+)\s*characters/i,
    /Raw length:\s*(\d+)/i,
    /Cleaned length:\s*(\d+)/i
  ];
  for (let i = logs.length - 1; i >= 0; i--) {
    for (const rx of regexes) {
      const m = logs[i].message.match(rx);
      if (m) {
        return parseInt(m[1], 10).toLocaleString();
      }
    }
  }
  return "—";
}

function getAiRequestsCompleted(task: BackgroundTask): string {
  const pg = task.progress;
  if (!pg) return "—";
  const stages = ["summary", "keyConcepts", "definitions", "flashcards", "mcqs", "practiceQuestions"];
  let completed = 0;
  stages.forEach(s => {
    const st = pg.stages[s as keyof TaskProgress["stages"]]?.status;
    if (st === "completed" || st === "failed" || st === "skipped") {
      completed++;
    }
  });
  return `${completed} / 6`;
}

// ── Components ─────────────────────────────────────────────────────────────────

function getGeneratedFilesCount(task: BackgroundTask): string {
  const pg = task.progress;
  if (!pg) return "—";
  const stages = ["summary", "keyConcepts", "definitions", "flashcards", "mcqs", "practiceQuestions", "studyGuide"];
  let completed = 0;
  stages.forEach(s => {
    const st = pg.stages[s as keyof TaskProgress["stages"]]?.status;
    if (st === "completed") {
      completed++;
    }
  });
  return `${completed} / 7`;
}

function TerminalLogs({ logs, createdIso }: { logs: LogEntry[] | null; createdIso: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const formatVirtualTime = (iso: string, offsetSec: number) => {
    const d = new Date(iso);
    d.setSeconds(d.getSeconds() + offsetSec);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const virtualLogs = [
    { time: formatVirtualTime(createdIso, -3), message: "Upload received" },
    { time: formatVirtualTime(createdIso, -2), message: "File stored successfully" },
    { time: formatVirtualTime(createdIso, -1), message: "Subject resolved" },
    { time: formatVirtualTime(createdIso, 0), message: "Downloading document" }
  ];

  const formattedLogs = (logs || []).map(l => {
    const timeStr = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    }).format(new Date(l.timestamp));
    return { time: timeStr, message: l.message };
  });

  const allLogs = [...virtualLogs, ...formattedLogs];

  return (
    <div className="rounded-lg bg-zinc-950 border border-zinc-800/60 overflow-hidden mt-4">
      <div className="px-3 py-1.5 border-b border-zinc-850 bg-zinc-900/40 flex items-center justify-between select-none">
        <span className="text-[9px] text-zinc-400 font-mono tracking-wide uppercase font-semibold flex items-center gap-1.5">
          <TerminalIcon className="h-3 w-3" /> Live Execution Logs
        </span>
        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
      </div>
      <div 
        ref={containerRef}
        className="h-44 overflow-y-auto p-3 space-y-1 font-mono text-[10px] text-zinc-300 scroll-smooth leading-normal select-text bg-zinc-950"
      >
        {allLogs.map((log, i) => (
          <div key={i} className="flex gap-3 hover:bg-zinc-900/30 py-0.5 px-1 rounded transition-colors">
            <span className="text-zinc-500 shrink-0 tabular-nums select-none">{log.time}</span>
            <span className="text-zinc-300 break-all">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorReportingPanel({ task }: { task: BackgroundTask }) {
  const pg = task.progress;
  if (!pg) return null;

  const failedStageKey = Object.keys(pg.stages).find(
    k => pg.stages[k as keyof TaskProgress["stages"]]?.status === "failed"
  );
  if (!failedStageKey) return null;

  const stageProgress = pg.stages[failedStageKey as keyof TaskProgress["stages"]];
  const stageNames: Record<string, string> = {
    extraction: "Text Extraction",
    summary: "Summary Generation",
    keyConcepts: "Key Concepts Generation",
    definitions: "Definitions Generation",
    flashcards: "Flashcard Generation",
    mcqs: "Quiz Generation",
    practiceQuestions: "Quiz Generation",
    studyGuide: "Study Guide Construction",
    pdf: "PDF Compilation",
    synchronize: "Folder Synchronization"
  };

  const stageName = stageNames[failedStageKey] || "Processing Stage";
  const rawReason = stageProgress?.errorMessage || "Unknown pipeline error.";

  let reason = rawReason;
  let action = "Retrying Stage...";

  if (failedStageKey === "extraction") {
    if (rawReason.toLowerCase().includes("150 readable characters") || rawReason.toLowerCase().includes("empty")) {
      reason = "PDF parser returned empty text.";
      action = "Trying OCR...";
    }
  }

  if (rawReason.toLowerCase().includes("safety") || rawReason.toLowerCase().includes("safety policy")) {
    reason = "Gemini OCR blocked due to safety policy.";
    action = "Manual Processing Required";
  } else if (rawReason.toLowerCase().includes("copyright") || rawReason.toLowerCase().includes("recitation")) {
    reason = "Blocked due to copyright recitation policies.";
    action = "Manual Processing Required";
  } else if (task.status === "failed") {
    action = "Manual Processing Required";
  }

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/[0.02] p-4 mt-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 text-red-500 shrink-0" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7.5" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1"/>
          <path d="M8 5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">Stage Failure Report</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] leading-relaxed">
        <div>
          <span className="text-muted-foreground block font-medium text-[10px] uppercase tracking-wider mb-0.5">Failed Stage</span>
          <span className="text-foreground font-semibold bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded text-[10px] uppercase inline-block">{stageName}</span>
        </div>
        <div className="md:col-span-2">
          <span className="text-muted-foreground block font-medium text-[10px] uppercase tracking-wider mb-0.5">Reason</span>
          <span className="text-foreground font-semibold block">{reason}</span>
        </div>
      </div>
      <div className="pt-2 border-t border-red-500/10 text-[11px]">
        <span className="text-muted-foreground font-medium mr-1.5">Action:</span>
        <span className="text-amber-600 dark:text-amber-400 font-semibold">{action}</span>
      </div>
    </div>
  );
}

function CompletionScreen({ task, subjectName, durationSec }: { task: BackgroundTask; subjectName: string; durationSec: number }) {
  const pg = task.progress;

  const generatedResources = [
    { key: "summary", name: "Summary.pdf" },
    { key: "keyConcepts", name: "Key Points.pdf" },
    { key: "flashcards", name: "Flashcards.pdf" },
    { key: "mcqs", name: "Practice Quiz.pdf" }
  ];

  const successfulResources = generatedResources.filter(res => {
    if (!pg) return false;
    const stage = pg.stages[res.key as keyof TaskProgress["stages"]];
    return stage?.status === "completed";
  });

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.01] p-4.5 space-y-4">
      <div className="flex items-center gap-2">
        <svg className="h-4.5 w-4.5 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7.5" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1"/>
          <path d="M5 8.5L7 10.5L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div>
          <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Processing Complete</h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">AI pipeline finished successfully. Documents are synchronized.</p>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block">Generated Resources</span>
        {successfulResources.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {successfulResources.map(res => (
              <div key={res.key} className="flex items-center gap-2 text-[11px] text-foreground/80 font-medium bg-emerald-500/[0.03] border border-emerald-500/10 px-2.5 py-1.5 rounded">
                <svg className="h-3.5 w-3.5 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="none">
                  <path d="M3.5 8.5L6 11L12.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{res.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">No study pack PDF resources were generated.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 pt-3.5 border-t border-emerald-500/10 text-[11px]">
        <div>
          <span className="text-muted-foreground block font-medium mb-0.5">Completed In</span>
          <span className="text-foreground font-semibold">{durationSec} seconds</span>
        </div>
        <div>
          <span className="text-muted-foreground block font-medium mb-0.5">Storage Location</span>
          <span className="text-foreground font-semibold flex items-center gap-1">
            {subjectName} <span className="text-muted-foreground">→</span> AI Generated
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function AIProcessingCenter({ userId, subjectId }: AIProcessingCenterProps) {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [subjectName, setSubjectName] = useState<string>("Subject");
  
  const [supabase] = useState(() => createClient());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch subject name once
  useEffect(() => {
    async function getSubject() {
      if (!subjectId) return;
      const { data, error } = await supabase
        .from("subjects")
        .select("name")
        .eq("id", subjectId)
        .single();
      if (!error && data) {
        setSubjectName(data.name);
      }
    }
    getSubject();
  }, [supabase, subjectId]);

  const fetchTasks = useCallback(async () => {
    // Step 1: Fetch background tasks
    const { data: taskData, error: taskError } = await supabase
      .from("background_tasks")
      .select("id, document_id, status, progress, logs, created_at, updated_at")
      .eq("user_id", userId)
      .eq("task_type", "study_pack")
      .order("created_at", { ascending: false })
      .limit(15);

    if (taskError) {
      console.error("[AIProcessingCenter] Fetch error:", taskError.message);
      setIsLoading(false);
      return;
    }

    if (!taskData || taskData.length === 0) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    // Step 2: Fetch document details, filtered by this subjectId
    const docIds = [...new Set(taskData.map((t: any) => t.document_id).filter(Boolean))];
    const titleMap: Record<string, string> = {};

    if (docIds.length > 0) {
      const { data: docData } = await supabase
        .from("documents")
        .select("id, title, subject_id")
        .in("id", docIds)
        .eq("subject_id", subjectId); // strict filter to this subject

      if (docData) {
        docData.forEach((d: any) => { 
          titleMap[d.id] = d.title; 
        });
      }
    }

    // Map tasks, keeping only the ones that match documents in this subject
    const shaped = taskData
      .filter((t: any) => t.document_id && titleMap[t.document_id])
      .map((t: any) => ({
        ...t,
        doc_title: titleMap[t.document_id],
      })) as BackgroundTask[];

    setTasks(shaped);
    setIsLoading(false);
  }, [supabase, userId, subjectId]);

  // Initial load + subscriptions + fallback polling
  useEffect(() => {
    // Run on next tick via setTimeout to avoid synchronous setState inside rendering path
    const runInitialLoad = setTimeout(() => {
      fetchTasks();
    }, 0);

    const channel = supabase
      .channel(`ai-pipeline-${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "background_tasks",
        filter: `user_id=eq.${userId}`,
      }, () => {
        fetchTasks();
      })
      .subscribe();

    pollRef.current = setInterval(fetchTasks, 3000);

    return () => {
      clearTimeout(runInitialLoad);
      supabase.removeChannel(channel);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [supabase, userId, fetchTasks]);

  const activeTasks = tasks.filter(t => t.status !== "Completed" && t.status !== "Failed" && t.status !== "completed" && t.status !== "failed");
  const completedTasks = tasks.filter(t => t.status === "Completed" || t.status === "Failed" || t.status === "completed" || t.status === "failed");
  const recentHistory = completedTasks.slice(0, 5);

  if (isLoading) {
    return (
      <div className="px-4 py-4">
        <div className="h-32 rounded-lg border border-border/30 bg-muted/10 animate-pulse"/>
      </div>
    );
  }

  if (tasks.length === 0) return null;

  // The primary dashboard focuses on the active task, or the most recent completed run
  const primaryTask = activeTasks[0] || tasks[0];
  if (!primaryTask) return null;

  return (
    <div className="shrink-0 px-4 py-4.5 space-y-4 border-b border-border/35 bg-background">
      
      {/* ── Active Queue Management Header ── */}
      {activeTasks.length > 1 && (
        <div className="border border-border rounded-lg bg-card/40 p-3 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Pipeline Queue</span>
            <span className="text-[9px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
              {activeTasks.length} Jobs Queued
            </span>
          </div>
          <div className="space-y-1.5">
            {activeTasks.map((t, idx) => {
              const isCurrentlyProcessing = idx === 0;
              return (
                <div key={t.id} className="flex items-center justify-between text-[11px] bg-background/50 border border-border/35 px-3 py-2 rounded">
                  <div className="flex items-center gap-2 truncate">
                    <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", isCurrentlyProcessing ? "bg-blue-500 animate-pulse" : "bg-zinc-400")} />
                    <span className="font-semibold text-foreground/90 truncate">{t.doc_title || "Document"}</span>
                  </div>
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                    isCurrentlyProcessing ? "bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400" : "bg-zinc-500/10 border border-zinc-500/20 text-zinc-400"
                  )}>
                    {isCurrentlyProcessing ? "Processing" : "Waiting"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main real-time pipeline dashboard card ── */}
      <div className="border border-border bg-card text-card-foreground rounded-lg overflow-hidden shadow-sm max-w-full">
        {/* Card Header */}
        <div className="px-4 py-3 bg-muted/15 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 select-none">
          <div className="flex items-center gap-3">
            <StatusIcon status={
              (primaryTask.status === "Completed" || primaryTask.status === "completed") ? "completed" :
              (primaryTask.status === "Failed" || primaryTask.status === "failed") ? "failed" :
              (primaryTask.status !== "Queued" && primaryTask.status !== "pending") ? "processing" : "waiting"
            } />
            <div>
              <h3 className="text-xs font-semibold text-foreground tracking-tight truncate max-w-[280px]">
                {primaryTask.doc_title || "Lecture Document"}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium flex items-center gap-1.5">
                <span>Status: <span className="text-foreground capitalize font-semibold">{getActiveStageLabel(primaryTask)}</span></span>
                <span className="text-muted-foreground/35">•</span>
                <span className="font-mono flex items-center gap-1 text-[9px] text-foreground/80 bg-muted px-1.5 py-0.5 rounded border border-border/30">
                  <Clock className="h-3 w-3 inline text-muted-foreground" />
                  <RunningTimer startIso={primaryTask.created_at} taskStatus={primaryTask.status} updatedAt={primaryTask.updated_at} />
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => fetchTasks()}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground border border-border bg-background px-2.5 py-1 rounded transition-colors font-medium cursor-pointer"
              title="Sync status"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5">
          {(primaryTask.status === "Completed" || primaryTask.status === "completed") ? (
            <CompletionScreen 
              task={primaryTask} 
              subjectName={subjectName} 
              durationSec={Math.round((new Date(primaryTask.updated_at).getTime() - new Date(primaryTask.created_at).getTime()) / 1000)} 
            />
          ) : (
            <div className="space-y-4">
              
              {/* 2-Column Dashboard layout */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* Left Column: Stages (7/12 width) */}
                <div className="md:col-span-7 space-y-3">
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 select-none">
                    <Layers className="h-3.5 w-3.5" /> Pipeline Progress
                  </h4>
                  <div className="relative border-l border-border/80 ml-2.5 pl-4.5 py-1.5 space-y-4.5">
                    {getUIStages(primaryTask).map((stage) => {
                      const isCompleted = stage.status === "completed";
                      const isProcessing = stage.status === "processing";
                      const isFailed = stage.status === "failed";

                      return (
                        <div key={stage.key} className="relative flex items-center gap-2.5">
                          {/* Left node circles */}
                          <div className={cn(
                            "absolute -left-[25.5px] h-4 w-4 rounded-full border bg-background flex items-center justify-center shrink-0 transition-colors select-none",
                            isCompleted ? "border-emerald-500 bg-emerald-50 text-emerald-500 dark:bg-emerald-950/20" :
                            isProcessing ? "border-blue-500 bg-blue-50 text-blue-500 dark:bg-blue-950/20" :
                            isFailed ? "border-red-500 bg-red-50 text-red-500 dark:bg-red-950/20" :
                            "border-border text-muted-foreground bg-muted"
                          )}>
                            {isCompleted ? (
                              <Check className="h-2.5 w-2.5 stroke-[2.5]" />
                            ) : isProcessing ? (
                              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                            ) : isFailed ? (
                              <span className="text-[9px] font-black">!</span>
                            ) : (
                              <div className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <span className={cn(
                              "text-[11px] font-medium leading-none",
                              isCompleted ? "text-foreground/80" :
                              isProcessing ? "text-blue-600 dark:text-blue-400 font-bold" :
                              isFailed ? "text-red-500 font-semibold" :
                              "text-muted-foreground/60"
                            )}>
                              {stage.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Statistics & Current activity (5/12 width) */}
                <div className="md:col-span-5 flex flex-col justify-between gap-4">
                  {/* Statistics */}
                  <div className="border border-border bg-muted/[0.04] rounded-lg p-3.5 space-y-3 flex-1">
                    <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest select-none">Processing Statistics</h4>
                    <div className="space-y-1.5">
                      <StatRow label="Pages Processed" value="—" />
                      <StatRow label="Characters Extracted" value={extractCharacterCount(primaryTask.logs)} />
                      <StatRow label="AI Requests Completed" value={getAiRequestsCompleted(primaryTask)} />
                      <StatRow label="Generated Files" value={getGeneratedFilesCount(primaryTask)} />
                      <StatRow label="Elapsed Time" value={
                        <RunningTimer startIso={primaryTask.created_at} taskStatus={primaryTask.status} updatedAt={primaryTask.updated_at} />
                      } />
                    </div>
                  </div>

                  {/* Current Activity */}
                  <div className="border border-border bg-muted/[0.04] rounded-lg p-3.5 space-y-1.5 shrink-0">
                    <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest select-none">Current Activity</h4>
                    <p className="text-[11px] font-semibold text-foreground tracking-normal min-h-[2.2em] line-clamp-2">
                      {primaryTask.logs && primaryTask.logs.length > 0
                        ? primaryTask.logs[primaryTask.logs.length - 1].message
                        : "Preparing document metadata..."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Error reporting if task failed */}
              {(primaryTask.status === "Failed" || primaryTask.status === "failed") && <ErrorReportingPanel task={primaryTask} />}

              {/* Monospace scrollable logs console */}
              <TerminalLogs logs={primaryTask.logs} createdIso={primaryTask.created_at} />
            </div>
          )}
        </div>
      </div>

      {/* ── Minimal Job History List ── */}
      {recentHistory.length > 0 && (
        <div className="border-t border-border/30 pt-4">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showHistory && "rotate-180")} />
            <span className="font-semibold uppercase tracking-wider">Historical Pipelines</span>
            <span className="text-muted-foreground/60 font-mono text-[9px]">({recentHistory.length})</span>
          </button>

          {showHistory && (
            <div className="mt-2 space-y-1.5 border border-border rounded-lg bg-card/30 overflow-hidden divide-y divide-border/60">
              {recentHistory.map((task) => {
                const ms = new Date(task.updated_at).getTime() - new Date(task.created_at).getTime();
                const durSecs = Math.max(0, Math.round(ms / 1000));
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-4 px-3.5 py-2.5 text-[11px] hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <StatusIcon status={
                        (task.status === "Completed" || task.status === "completed") ? "completed" :
                        (task.status === "Failed" || task.status === "failed") ? "failed" :
                        "waiting"
                      } size={14} />
                      <span className="font-semibold text-foreground/85 truncate">
                        {task.doc_title || "Document"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                      <span className="font-mono text-[9px]">{formatTimer(durSecs)}</span>
                      <span className={cn(
                        "text-[9px] border px-1.5 py-0.5 rounded capitalize font-bold tracking-wider",
                        (task.status === "Completed" || task.status === "completed") ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400"
                      )}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
