"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  Trophy, 
  Flame, 
  Sparkles, 
  Zap, 
  Award, 
  BookOpen, 
  Clock, 
  Share2, 
  FileText, 
  CheckCircle, 
  Play, 
  Pause, 
  Square, 
  AlertCircle, 
  Copy, 
  Check, 
  TrendingUp,
  Calendar,
  Shield,
  Timer,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  ExternalLink,
  Users,
  Lock,
  Flag,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dailyCheckIn, logStudySession, shareMaterials } from "@/actions/gamification";
import { getRankName } from "@/services/gamification/helpers";
import { getCohortLeaderboard, CohortLeaderboardResponse, CohortLeaderboardEntry } from "@/actions/leaderboard";
import { reportSharedFile, unshareDocument, getCohortSharedFiles, type CohortSharedFile } from "@/actions/sharing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  xp_reward: number;
}

interface LeaderboardEntry {
  user_id: string;
  total_xp: number;
  monthly_xp: number;
  current_level: number;
  quiz_accuracy: number;
  current_streak: number;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  university: string;
  major: string;
}

interface ChampionArchiveEntry {
  rank: number;
  total_xp: number;
  season_name: string;
  first_name: string;
  last_name: string;
}

interface LeaderboardClientProps {
  initialProgress: {
    total_xp: number;
    monthly_xp: number;
    current_level: number;
    quiz_accuracy: number;
    completed_quizzes_count: number;
    total_correct_answers: number;
    total_questions_attempted: number;
    current_streak: number;
    highest_streak: number;
    daily_challenges: { date: string; completed: { focus: boolean; quiz: boolean; share: boolean } };
    last_check_in_date: string;
    user_id: string;
    first_name: string;
    last_name: string;
    university: string;
    major: string;
  };
  achievements: Achievement[];
  unlockedAchievementIds: string[];
  stats: {
    currentStreak: number;
    highestStreak: number;
    activeDaysCount: number;
    totalStudyMinutes: number;
    weeklyActivity: { day: string; count: number; studyMinutes: number }[];
    allActiveDates: string[];
  };
  leaderboardList: LeaderboardEntry[];
  championsArchive: ChampionArchiveEntry[];
  seasonEndDate: string;
  completedDocs: { id: string; title: string }[];
  initialCohortLeaderboard?: CohortLeaderboardResponse | null;
  cohortInfo?: {
    id: string;
    name: string;
    semester: string;
  } | null;
  initialSharedFiles?: CohortSharedFile[];
  currentWeekStart?: string;
}

/** Returns the timestamp (ms) when the user last completed the daily gamified quiz, or null if never / older than 24 h. */
const getDailyQuizCompletedAt = (userId: string): number | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(`neuron_daily_quiz_${userId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const completedAt: number = parsed.completedAt || 0;
    // Still within 24-hour window?
    if (Date.now() - completedAt < 24 * 60 * 60 * 1000) return completedAt;
  } catch (e) {
    console.error(e);
  }
  return null;
};



/** Returns ms remaining until the 24-hour lock expires, or 0 if unlocked. */
const getDailyQuizLockMsRemaining = (userId: string): number => {
  const completedAt = getDailyQuizCompletedAt(userId);
  if (completedAt === null) return 0;
  return Math.max(0, completedAt + 24 * 60 * 60 * 1000 - Date.now());
};

/** Formats milliseconds into "Xh Ym Zs" string. */
const formatMsCountdown = (ms: number): string => {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

function ReportDialog({
  file,
  isOpen,
  onClose,
  onReportSuccess,
}: {
  file: CohortSharedFile | null;
  isOpen: boolean;
  onClose: () => void;
  onReportSuccess: (fileId: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);

  if (!file) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setErrorMsg("Please provide a reason with at least 3 characters.");
      return;
    }
    if (trimmed.length > 500) {
      setErrorMsg("Reason cannot exceed 500 characters.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await reportSharedFile(file.id, trimmed);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to submit report.");
        return;
      }
      setSuccessMsg(true);
      setTimeout(() => {
        onReportSuccess(file.id);
        onClose();
        setSuccessMsg(false);
        setReason("");
      }, 1500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to submit report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border border-border/70 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Flag className="h-4 w-4 text-destructive" />
            Report Shared Material
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Flag <span className="font-medium text-foreground">{file.title}</span> for review (e.g. copyright violation, inappropriate content).
          </DialogDescription>
        </DialogHeader>

        {successMsg ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="text-xs font-semibold text-foreground">Report Submitted</p>
            <p className="text-[11px] text-muted-foreground">Thank you for helping keep our learning community safe.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            <div>
              <label htmlFor="report-reason" className="block text-xs font-medium text-foreground mb-1">
                Reason for report
              </label>
              <textarea
                id="report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this content violates policy (3-500 characters)..."
                maxLength={500}
                rows={4}
                className="w-full text-xs rounded-lg border border-border/80 bg-background/80 p-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>Min 3 chars</span>
                <span>{reason.length}/500</span>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <DialogFooter className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={isSubmitting || reason.trim().length < 3}
                className="h-8 text-xs gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Flag className="h-3.5 w-3.5" />
                    Submit Report
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CohortNotesPanel({
  cohortInfo,
  sharedFiles,
  onRefresh,
}: {
  cohortInfo?: { id: string; name: string; semester: string } | null;
  sharedFiles: CohortSharedFile[];
  onRefresh: () => void;
}) {
  const [reportingFile, setReportingFile] = useState<CohortSharedFile | null>(null);
  const [unsharingId, setUnsharingId] = useState<string | null>(null);

  if (!cohortInfo?.id) {
    return (
      <div className="text-center py-12 px-4 space-y-3">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <BookOpen className="h-6 w-6" />
        </div>
        <h4 className="text-sm font-bold text-foreground">No Cohort Assigned</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Join a cohort by setting your University, Degree Program, and Year in your profile to view shared notes and study materials from your classmates.
        </p>
        <Link href="/profile">
          <Button size="sm" className="h-8 text-xs font-semibold mt-2">
            Update Profile
          </Button>
        </Link>
      </div>
    );
  }

  const handleUnshare = async (docId: string) => {
    try {
      setUnsharingId(docId);
      const res = await unshareDocument(docId);
      if (res.success) {
        onRefresh();
      } else {
        alert(res.error || "Failed to unshare document");
      }
    } finally {
      setUnsharingId(null);
    }
  };

  return (
    <div className="space-y-4 pt-1">
      {/* Cohort Header Info */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        <div>
          <p className="text-xs font-semibold text-foreground">{cohortInfo.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {sharedFiles.length} file{sharedFiles.length !== 1 ? "s" : ""} shared with your cohort
          </p>
        </div>
        <Link href="/uploads">
          <Button variant="outline" size="sm" className="h-7 text-[11px] font-semibold gap-1.5 cursor-pointer">
            <Share2 className="h-3 w-3 text-primary" />
            Share Your Notes
          </Button>
        </Link>
      </div>

      {sharedFiles.length === 0 ? (
        <div className="text-center py-10 px-4 border border-dashed border-border/70 rounded-2xl bg-muted/10 space-y-3">
          <div className="mx-auto h-10 w-10 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-center text-muted-foreground">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-foreground">No Class Notes Shared Yet</h4>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Be the first to share study materials with your classmates! Share any uploaded document from your Uploads page.
            </p>
          </div>
          <Link href="/uploads">
            <Button size="sm" variant="outline" className="h-7 text-xs font-medium cursor-pointer">
              Go to Uploads
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {sharedFiles.map((file) => {
            const rawExt = (file.file_type || "").toLowerCase();
            const isUnsharing = unsharingId === file.id;

            return (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 rounded-2xl border border-border/50 bg-card/40 hover:bg-muted/20 transition-all gap-3"
              >
                {/* File Icon & Meta */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border",
                      rawExt === "pdf"
                        ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        : rawExt === "docx" || rawExt === "doc"
                        ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                        : rawExt === "pptx" || rawExt === "ppt"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        : "bg-primary/10 text-primary border-primary/20"
                    )}
                  >
                    <FileText className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 text-left">
                    <p className="text-xs font-bold text-foreground truncate max-w-[220px] sm:max-w-[320px]" title={file.title}>
                      {file.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                      <span className="font-medium text-foreground/80">{file.author_name}</span>
                      <span>·</span>
                      <span className="uppercase font-semibold text-[9px]">{file.file_type}</span>
                      {file.size ? (
                        <>
                          <span>·</span>
                          <span>{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                        </>
                      ) : null}
                      {file.is_owner && (
                        <>
                          <span>·</span>
                          <span className="text-[9px] font-bold text-primary bg-primary/10 px-1 rounded">You</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-xs font-semibold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
                    onClick={() => {
                      if (file.download_url) {
                        window.open(file.download_url, "_blank", "noopener,noreferrer");
                      }
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="hidden sm:inline">Open / Download</span>
                  </Button>

                  {file.is_owner ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isUnsharing}
                      className="h-7 px-2 text-[11px] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                      onClick={() => handleUnshare(file.id)}
                    >
                      {isUnsharing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Unshare"}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="Report file"
                      onClick={() => setReportingFile(file)}
                    >
                      <Flag className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report Dialog */}
      <ReportDialog
        file={reportingFile}
        isOpen={Boolean(reportingFile)}
        onClose={() => setReportingFile(null)}
        onReportSuccess={() => {
          onRefresh();
        }}
      />
    </div>
  );
}

export function LeaderboardClient({
  initialProgress,
  achievements,
  unlockedAchievementIds,
  stats,
  leaderboardList,
  championsArchive,
  seasonEndDate,
  completedDocs,
  initialCohortLeaderboard,
  cohortInfo,
  initialSharedFiles,
  currentWeekStart = new Date().toISOString().split('T')[0]
}: LeaderboardClientProps) {
  // Global XP & Level States
  const [xp, setXp] = useState(initialProgress.total_xp);
  const [level, setLevel] = useState(initialProgress.current_level);
  const [monthlyXp, setMonthlyXp] = useState(initialProgress.monthly_xp);
  const [lastCheckInDate, setLastCheckInDate] = useState(initialProgress.last_check_in_date);
  const [sharedFiles, setSharedFiles] = useState<CohortSharedFile[]>(initialSharedFiles || []);
  
  // Leaderboard scope: defaults to cohort weekly if user has a cohort, otherwise global
  const [leaderboardScope, setLeaderboardScope] = useState<"cohort" | "global" | "notes">(() =>
    cohortInfo?.id ? "cohort" : "global"
  );

  const handleRefreshSharedFiles = async () => {
    if (!cohortInfo?.id) return;
    const res = await getCohortSharedFiles(cohortInfo.id);
    if (res.success && res.data) {
      setSharedFiles(res.data);
    }
  };

  // Cohort weekly states
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(
    currentWeekStart || new Date().toISOString().split("T")[0]
  );
  const [cohortData, setCohortData] = useState<CohortLeaderboardResponse | null>(
    initialCohortLeaderboard || null
  );
  const [cohortLoading, setCohortLoading] = useState<boolean>(false);

  // Helper to compute available past weeks (up to 4 weeks back)
  const getPastWeeks = (currentMonday: string, count = 4): string[] => {
    const weeks: string[] = [];
    const base = new Date(currentMonday + "T00:00:00Z");
    for (let i = 0; i < count; i++) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() - i * 7);
      weeks.push(d.toISOString().split("T")[0]);
    }
    return weeks;
  };

  const availableWeeks = getPastWeeks(currentWeekStart || new Date().toISOString().split("T")[0], 4);
  const currentWeekIdx = availableWeeks.indexOf(selectedWeekStart);
  const canGoPrevious = currentWeekIdx < availableWeeks.length - 1;
  const canGoNext = currentWeekIdx > 0;

  const handleWeekChange = async (targetWeek: string) => {
    if (!cohortInfo?.id || targetWeek === selectedWeekStart) return;
    setCohortLoading(true);
    setSelectedWeekStart(targetWeek);
    try {
      const res = await getCohortLeaderboard(cohortInfo.id, targetWeek);
      setCohortData(res);
    } catch (err) {
      console.error("Failed to load week scores:", err);
    } finally {
      setCohortLoading(false);
    }
  };

  const handlePrevWeek = () => {
    if (canGoPrevious) handleWeekChange(availableWeeks[currentWeekIdx + 1]);
  };

  const handleNextWeek = () => {
    if (canGoNext) handleWeekChange(availableWeeks[currentWeekIdx - 1]);
  };

  const formatWeekRange = (mondayStr: string): string => {
    const monday = new Date(mondayStr + "T00:00:00Z");
    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    const mMonth = monday.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    const sMonth = sunday.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    const isCur = mondayStr === (currentWeekStart || new Date().toISOString().split("T")[0]);
    if (mMonth === sMonth) {
      return `${mMonth} ${monday.getUTCDate()} – ${sunday.getUTCDate()}${isCur ? " (This Week)" : ""}`;
    }
    return `${mMonth} ${monday.getUTCDate()} – ${sMonth} ${sunday.getUTCDate()}${isCur ? " (This Week)" : ""}`;
  };

  // Leaderboard lists toggling (Monthly Season vs. Lifetime)
  const [rankingTab, setRankingTab] = useState<"monthly" | "lifetime">("monthly");
  
  // Pomodoro Focus Timer State
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<'focus' | 'test'>('focus'); // 'test' is 1 min for fast testing!

  const [selectedQuizDocId, setSelectedQuizDocId] = useState<string>(completedDocs?.[0]?.id || "");

  // Note Share simulation
  const [copied, setCopied] = useState(false);

  // Focus and general state
  const [activeTab, setActiveTab] = useState<'pomodoro' | 'quiz' | 'share'>('pomodoro');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | null }>({ text: '', type: null });

  // 24-hour quiz lock countdown
  const [quizLockMsRemaining, setQuizLockMsRemaining] = useState<number>(() =>
    getDailyQuizLockMsRemaining(initialProgress.user_id || '')
  );
  const quizIsLocked = quizLockMsRemaining > 0;

  // Time format
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleTimer = () => {
    setTimerRunning(!timerRunning);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimeLeft(timerMode === 'focus' ? 25 * 60 : 60);
  };

  const changeTimerMode = (mode: 'focus' | 'test') => {
    setTimerMode(mode);
    setTimerRunning(false);
    setTimeLeft(mode === 'focus' ? 25 * 60 : 60);
  };

  const handleFocusTimerCompletion = useCallback(async () => {
    try {
      setLoading(true);
      const duration = timerMode === 'focus' ? 25 : 1;
      const res = await logStudySession(duration);
      if (res.success) {
        setXp(res.newXp);
        setLevel(res.newLevel);
        setMonthlyXp(prev => prev + res.xpGained);
        setMessage({ text: res.message, type: 'success' });
      }
    } catch (error) {
      console.error(error);
      setMessage({ text: "Failed to save focus session.", type: 'error' });
    } finally {
      setLoading(false);
      setTimeLeft(timerMode === 'focus' ? 25 * 60 : 60);
    }
  }, [timerMode]);

  const handleDailyCheckIn = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dailyCheckIn();
      if (res.success) {
        setXp(res.newXp || xp);
        setLevel(res.newLevel || level);
        setMonthlyXp(prev => prev + (res.xpGained || 50));
        setLastCheckInDate(new Date().toDateString());
        setMessage({ text: res.message, type: 'success' });
      } else {
        setMessage({ text: res.message || "Already checked in!", type: 'error' });
      }
    } catch (error) {
      console.error(error);
      setMessage({ text: "Failed to perform check-in.", type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [xp, level]);

  const handleShareCopy = useCallback(async () => {
    try {
      setLoading(true);
      await navigator.clipboard.writeText("https://neuron.study/share/notes-midterm-summary");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      const res = await shareMaterials();
      if (res.success) {
        setXp(res.newXp);
        setLevel(res.newLevel);
        setMonthlyXp(prev => prev + res.xpGained);
        setMessage({ text: res.message, type: 'success' });
      }
    } catch (error) {
      console.error(error);
      setMessage({ text: "Failed to register share points.", type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  // Daily Reset Countdown timer hook (hours/minutes remaining in the current calendar day)
  const [countdownText, setCountdownText] = useState("");
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const diff = midnight.getTime() - now.getTime();
      
      if (diff <= 0) {
        setCountdownText("0h 0m");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setCountdownText(`${hours}h ${minutes}m`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [seasonEndDate]);

  // 24-hour quiz lock live-countdown (ticks every second)
  useEffect(() => {
    if (quizLockMsRemaining <= 0) return;
    const interval = setInterval(() => {
      const remaining = getDailyQuizLockMsRemaining(initialProgress.user_id || '');
      setQuizLockMsRemaining(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [quizLockMsRemaining, initialProgress.user_id]);

  // Pomodoro timer hook
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerRunning) {
      setTimeout(() => {
        setTimerRunning(false);
        handleFocusTimerCompletion();
      }, 0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timeLeft, handleFocusTimerCompletion]);

  // XP progression calculation
  const getCumulativeXpForLevel = (lvl: number) => {
    let sum = 0;
    for (let i = 1; i < lvl; i++) {
      sum += i * 1000;
    }
    return sum;
  };

  const xpAtCurrentLevelStart = getCumulativeXpForLevel(level);
  const xpNeededForNextLevel = level * 1000;
  const currentLevelProgressXp = xp - xpAtCurrentLevelStart;
  const progressPercentage = Math.min(100, Math.max(0, Math.round((currentLevelProgressXp / xpNeededForNextLevel) * 100)));

  // Calculate Sorted rankings dynamically based on the toggled tab
  const activeLeaderboard = [...leaderboardList].sort((a, b) => {
    if (rankingTab === "monthly") return b.monthly_xp - a.monthly_xp;
    return b.total_xp - a.total_xp;
  });

  // Identify current user's rank position
  const currentUserRankIndex = activeLeaderboard.findIndex(item => item.user_id === initialProgress.user_id);
  const currentUserRank = currentUserRankIndex !== -1 ? currentUserRankIndex + 1 : 99;

  // Identify Rival immediately in front of user
  const rival = currentUserRankIndex > 0 ? activeLeaderboard[currentUserRankIndex - 1] : null;
  const rivalXpDiff = rival 
    ? (rankingTab === "monthly" ? rival.monthly_xp - monthlyXp : rival.total_xp - xp)
    : 0;

  // Calculate League Tier based on rank
  let leagueTier = "Bronze League";
  let leagueGradient = "from-amber-600/15 to-orange-700/15 border-amber-600/30 text-amber-700 dark:text-amber-400";
  if (currentUserRank >= 1 && currentUserRank <= 3) {
    leagueTier = "Diamond League (Grand Champion)";
    leagueGradient = "from-cyan-400/15 via-blue-500/15 to-indigo-600/15 border-cyan-400/30 text-cyan-600 dark:text-cyan-400";
  } else if (currentUserRank >= 4 && currentUserRank <= 6) {
    leagueTier = "Platinum League";
    leagueGradient = "from-slate-300/15 via-indigo-400/15 to-slate-500/15 border-slate-300/30 text-indigo-600 dark:text-indigo-400";
  } else if (currentUserRank >= 7 && currentUserRank <= 10) {
    leagueTier = "Gold League";
    leagueGradient = "from-yellow-400/15 to-amber-500/15 border-yellow-400/30 text-amber-700 dark:text-yellow-500";
  } else if (currentUserRank >= 11 && currentUserRank <= 15) {
    leagueTier = "Silver League";
    leagueGradient = "from-zinc-300/15 to-zinc-500/15 border-zinc-300/30 text-zinc-700 dark:text-zinc-400";
  }

  // Top 3 Podium Users extraction
  const podiumUsers = activeLeaderboard.slice(0, 3);

  // Heatmap: dynamic rendering of the current month calendar
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = now.toLocaleString('default', { month: 'long' });

  // Map dates to active dates checking strings
  const activeDateSet = new Set(
    stats.allActiveDates.map(dStr => new Date(dStr).toDateString())
  );

  const calendarDays = [];
  // Fill initial offset weeks empty
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push({ dayNum: null, isActive: false });
  }
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const curDateStr = new Date(year, month, d).toDateString();
    calendarDays.push({
      dayNum: d,
      isActive: activeDateSet.has(curDateStr)
    });
  }

  // Live Daily Challenges Completion Verification
  const todayStr = new Date().toDateString();
  const challengeChecklist = initialProgress.daily_challenges?.date === todayStr
    ? initialProgress.daily_challenges.completed
    : { focus: false, quiz: false, share: false };

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pb-16 px-4 md:px-0">
      
      {/* Upper Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-400 animate-pulse" />
            Student Arena & Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compare rankings of real registered users, solve generated quizzes, complete daily milestones, and climb seasons!
          </p>
        </div>

        {/* Daily Reset countdown */}
        <div className="flex items-center gap-4 bg-muted/40 p-2.5 rounded-2xl border border-border/60">
          <div className="flex items-center gap-1.5 px-3">
            <Timer className="h-6 w-6 text-red-500 animate-spin" />
            <div className="text-left">
              <div className="text-xs font-bold leading-tight">Daily Reset</div>
              <div className="text-sm font-black tracking-tight text-red-500">{countdownText}</div>
            </div>
          </div>
          
          <Button 
            onClick={handleDailyCheckIn} 
            disabled={loading || lastCheckInDate === new Date().toDateString()}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 font-bold rounded-xl text-xs py-1.5 shadow-md shadow-orange-500/10"
          >
            {lastCheckInDate === new Date().toDateString() ? "Checked In Today" : "Claim Daily XP"}
          </Button>
        </div>
      </div>

      {/* Popups */}
      {message.text && (
        <div className={`p-4 rounded-xl border flex items-start gap-2 shadow-xs transition-all ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400' 
            : 'bg-red-500/10 border-red-500/30 text-red-500'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />}
          <div>
            <p className="text-sm font-bold">{message.type === 'success' ? "XP Logged Successfully!" : "Activity Warning"}</p>
            <p className="text-xs opacity-90 mt-0.5">{message.text}</p>
          </div>
          <button onClick={() => setMessage({ text: '', type: null })} className="ml-auto text-xs font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Dynamic Rival/Almost in Top 10 Motivational Banner */}
      {currentUserRank > 1 && (
        <div className="bg-gradient-to-r from-indigo-500/10 via-primary/5 to-indigo-500/10 border border-primary/20 p-4.5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3 text-left">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0 border border-indigo-500/20 shadow-inner">
              <Flame className="h-5 w-5 text-indigo-500 animate-bounce" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-foreground leading-tight">
                {currentUserRank > 10 && currentUserRank <= 15 
                  ? `Almost in Top 10! You're currently ranked #${currentUserRank}.` 
                  : `You're currently ranked #${currentUserRank} in the Platform Arena!`}
              </p>
              {rival ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  You are only <span className="font-extrabold text-foreground">{rivalXpDiff} XP</span> behind <span className="font-extrabold text-primary">{rival.first_name} {rival.last_name}</span>! Solve a lecture quiz to overtake them.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Keep solving lecture quizzes to climb the ranks and win the monthly rewards!
                </p>
              )}
            </div>
          </div>
          {rival && (
            <Button 
              size="sm" 
              onClick={() => {
                setActiveTab('quiz');
                document.getElementById('study-hub')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-xs font-black rounded-xl gap-1 shrink-0"
            >
              Take Lecture Quiz <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Main Grid: Card Progress & Challenges */}
      <div className="grid gap-6 md:grid-cols-3">

        {/* 1. Character Progression & Stats */}
        <Card className="glass-panel border-border/60 rounded-3xl md:col-span-1 shadow-md bg-gradient-to-b from-card to-background relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10"></div>
          <CardHeader className="pb-4">
            <CardTitle className="text-md font-bold tracking-tight text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-4.5 w-4.5 text-primary" /> Profile Progression
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            
            {/* Rank Badge SVG progress */}
            <div className="relative w-28 h-28 flex items-center justify-center bg-primary/5 rounded-full border border-primary/20 p-2 shadow-inner mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="5"
                  fill="transparent"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  stroke="url(#level-gradient)"
                  strokeWidth="6"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={(2 * Math.PI * 48) - ((2 * Math.PI * 48) * progressPercentage) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
                <defs>
                  <linearGradient id="level-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-black tracking-tighter leading-none text-foreground">{level}</span>
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mt-1">LEVEL</span>
              </div>
            </div>

            <h3 className="text-md font-black leading-tight text-foreground">{initialProgress.first_name} {initialProgress.last_name}</h3>
            
            <div className="flex flex-col items-center gap-1.5 mt-2">
              <span className="text-[9px] font-black uppercase tracking-wider bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/25">
                {getRankName(level)}
              </span>
              <span className={`text-[9px] font-black uppercase tracking-wider bg-gradient-to-r px-2.5 py-0.5 rounded-full border ${leagueGradient}`}>
                {leagueTier}
              </span>
            </div>

            {/* Level progression bar */}
            <div className="w-full mt-6 space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                <span>XP Progress</span>
                <span className="text-foreground font-extrabold">{currentLevelProgressXp} / {xpNeededForNextLevel} XP</span>
              </div>
              <div className="w-full h-2.5 bg-muted/50 rounded-full border border-border/40 overflow-hidden p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-500" 
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <p className="text-[9px] text-muted-foreground italic text-left pt-0.5">
                {xpNeededForNextLevel - currentLevelProgressXp} XP more to reach Level {level + 1}!
              </p>
            </div>

            {/* Stats List */}
            <div className="w-full grid grid-cols-2 gap-3 mt-6 border-t border-border/50 pt-5">
              <div className="flex flex-col items-center p-2.5 bg-muted/20 border border-border/40 rounded-2xl">
                <Clock className="h-4.5 w-4.5 text-blue-400" />
                <span className="text-[9px] font-extrabold text-muted-foreground uppercase mt-1">Study Hours</span>
                <span className="text-xs font-black text-foreground mt-0.5">
                  {Math.round(stats.totalStudyMinutes / 60 * 10) / 10}h
                </span>
              </div>
              <div className="flex flex-col items-center p-2.5 bg-muted/20 border border-border/40 rounded-2xl">
                <Flame className="h-4.5 w-4.5 text-orange-500" />
                <span className="text-[9px] font-extrabold text-muted-foreground uppercase mt-1">Active Streak</span>
                <span className="text-xs font-black text-foreground mt-0.5">{stats.currentStreak} Days</span>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* 2. Interactive Study Center & XP Generators */}
        <Card id="study-hub" className="glass-panel border-border/60 rounded-3xl md:col-span-2 shadow-md flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-md font-bold tracking-tight text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Zap className="h-4.5 w-4.5 text-yellow-400 fill-yellow-400 animate-bounce" /> Gamified Study Hub
              </span>
              <span className="text-[10px] bg-yellow-400/10 text-yellow-500 font-extrabold border border-yellow-400/25 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Earn XP Here
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Interact with the quick educational modules below to verify daily engagement and gain XP instantly!
            </CardDescription>

            {/* Tab navigation */}
            <div className="flex gap-2 border-b border-border/50 pt-4 pb-1">
              <button 
                onClick={() => setActiveTab('pomodoro')}
                className={`text-xs font-bold pb-2 px-1 relative transition-all cursor-pointer ${
                  activeTab === 'pomodoro' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Focus Pomodoro
                {activeTab === 'pomodoro' && <span className="absolute bottom-0 left-0 w-full h-0.75 bg-primary rounded-full"></span>}
              </button>
              <button 
                onClick={() => setActiveTab('quiz')}
                className={`text-xs font-bold pb-2 px-1 relative transition-all cursor-pointer ${
                  activeTab === 'quiz' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Daily Quiz
                {activeTab === 'quiz' && <span className="absolute bottom-0 left-0 w-full h-0.75 bg-primary rounded-full"></span>}
              </button>
              <button 
                onClick={() => setActiveTab('share')}
                className={`text-xs font-bold pb-2 px-1 relative transition-all cursor-pointer ${
                  activeTab === 'share' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Share Notes
                {activeTab === 'share' && <span className="absolute bottom-0 left-0 w-full h-0.75 bg-primary rounded-full"></span>}
              </button>
            </div>
          </CardHeader>
          
          <CardContent className="py-6 flex-1 flex flex-col justify-center min-h-[220px]">
            
            {/* FOCUS POMODORO TAB */}
            {activeTab === 'pomodoro' && (
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-2 w-full">
                
                {/* Timer Clock Visual */}
                <div className="relative w-36 h-36 flex flex-col items-center justify-center rounded-full bg-muted/30 border border-border/60 shadow-inner">
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl font-black tracking-tight font-mono text-foreground">
                    {formatTime(timeLeft)}
                  </div>
                  
                  {timerRunning && (
                    <div className="absolute -inset-1 rounded-full border border-primary/20 animate-ping opacity-75"></div>
                  )}
                  
                  <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest mt-12">
                    {timerRunning ? "Focusing" : "Paused"}
                  </span>
                </div>

                {/* Timer details & Controls */}
                <div className="flex-1 space-y-4 text-center md:text-left">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Focus Session Timer</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                      Start this countdown and commit to your books. Complete a full focus interval to earn a huge <span className="font-extrabold text-foreground">+200 XP</span> in study hours records!
                    </p>
                  </div>

                  {/* Mode switch */}
                  <div className="flex justify-center md:justify-start gap-2">
                    <Button 
                      size="sm" 
                      variant={timerMode === 'focus' ? 'default' : 'outline'} 
                      onClick={() => changeTimerMode('focus')}
                      className="text-[10px] font-bold h-7.5 px-3 rounded-lg"
                    >
                      Focus 25 Min
                    </Button>
                    <Button 
                      size="sm" 
                      variant={timerMode === 'test' ? 'default' : 'outline'} 
                      onClick={() => changeTimerMode('test')}
                      className="text-[10px] font-bold h-7.5 px-3 rounded-lg border-primary/30 text-primary"
                    >
                      Quick Test 1 Min
                    </Button>
                  </div>

                  {/* Controls buttons */}
                  <div className="flex justify-center md:justify-start gap-2">
                    <Button 
                      onClick={toggleTimer} 
                      className={`h-9 px-4 rounded-xl text-xs font-semibold gap-1.5 shadow-sm ${
                        timerRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary'
                      }`}
                    >
                      {timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      {timerRunning ? "Pause Session" : "Start Study"}
                    </Button>
                    
                    <Button 
                      onClick={resetTimer} 
                      variant="outline" 
                      className="h-9 px-4 rounded-xl text-xs font-semibold gap-1.5"
                    >
                      <Square className="h-3.5 w-3.5" />
                      Reset
                    </Button>
                  </div>
                </div>

              </div>
            )}

            {/* DYNAMIC MINI QUIZ TAB */}
            {activeTab === 'quiz' && (
              <div className="w-full px-2 space-y-4">
                <div className="text-center py-4 space-y-4">
                  {/* Icon — locked or live */}
                  <div className={`mx-auto h-12 w-12 rounded-2xl flex items-center justify-center border ${
                    quizIsLocked
                      ? 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-500 animate-pulse'
                  }`}>
                    {quizIsLocked ? <Lock className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground">
                      {quizIsLocked ? 'Daily Quiz Completed ✓' : 'AI Lecture Quiz (XP Mode)'}
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      {quizIsLocked
                        ? 'Great work! Your daily quiz slot is used. Come back when the timer resets to earn more XP.'
                        : 'Test your understanding of your uploaded lectures. Complete this quiz with good accuracy to earn XP, speed bonuses, and daily challenge tokens!'}
                    </p>
                  </div>

                  {/* 24-hour lock state */}
                  {quizIsLocked ? (
                    <div className="max-w-sm mx-auto space-y-3">
                      {/* Countdown card */}
                      <div className="bg-zinc-500/8 border border-zinc-500/15 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-center gap-2 text-zinc-400">
                          <Lock className="h-4 w-4" />
                          <span className="text-xs font-bold uppercase tracking-widest">Next quiz unlocks in</span>
                        </div>
                        <div className="text-3xl font-black font-mono text-foreground tracking-tight">
                          {formatMsCountdown(quizLockMsRemaining)}
                        </div>
                        {/* Progress bar — depletes over 24 h */}
                        <div className="w-full h-1.5 rounded-full bg-zinc-500/15 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000"
                            style={{ width: `${Math.max(0, (1 - quizLockMsRemaining / (24 * 60 * 60 * 1000)) * 100).toFixed(1)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground/70">
                          20 questions · 1 attempt per 24 hours
                        </p>
                      </div>
                    </div>
                  ) : completedDocs.length === 0 ? (
                    <div className="space-y-3.5 max-w-sm mx-auto">
                      <div className="bg-muted/40 p-4 border border-dashed rounded-2xl text-xs text-muted-foreground leading-normal">
                        📚 No completed lectures found! Please upload and process study notes first so Neuron AI can compile dynamic quizzes for you.
                      </div>
                      <Link href="/uploads">
                        <Button className="h-9 px-5 rounded-xl text-xs font-semibold bg-primary">
                          Go to Uploads Section
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4 max-w-xs mx-auto">
                      <div className="space-y-1 text-left">
                        <label className="text-[9px] font-black uppercase text-muted-foreground tracking-wider pl-1">
                          Select Lecture Document:
                        </label>
                        <select
                          value={selectedQuizDocId}
                          onChange={(e) => setSelectedQuizDocId(e.target.value)}
                          className="w-full bg-card hover:bg-muted/40 border border-border/80 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {completedDocs.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {doc.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="text-[10px] text-muted-foreground/70 text-center">
                        20 questions · 1 attempt per 24 hours · Earn XP
                      </div>

                      <Link href={`/uploads/${selectedQuizDocId || completedDocs[0].id}/quiz?earnXP=true`}>
                        <Button className="w-full h-9 px-5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md">
                          Start AI Quiz (Earn XP)
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MATERIAL SHARING TAB */}
            {activeTab === 'share' && (
              <div className="text-center py-6 space-y-4 px-4">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                  <Share2 className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-foreground">Collaborative Sharing</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    Share your current study lecture summary folder pathway link with friends. When they study, you gain <span className="font-extrabold text-foreground">+100 XP</span> in materials sharing!
                  </p>
                </div>

                <div className="flex items-center gap-2 max-w-md mx-auto bg-muted/40 border border-border/80 rounded-2xl p-1.5">
                  <div className="text-xs text-left truncate flex-1 px-3 font-mono text-muted-foreground select-all">
                    https://neuron.study/share/notes-midterm-summary
                  </div>
                  <Button 
                    size="sm" 
                    onClick={handleShareCopy} 
                    className="h-8 px-4.5 rounded-xl text-xs font-bold shrink-0 bg-blue-600 hover:bg-blue-700"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    {copied ? "Copied" : "Copy Link"}
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

      </div>

      {/* Heatmap & Dynamic Insights Grid */}
      <div className="grid gap-6 md:grid-cols-5">

        {/* Heatmap Calendar Calendar */}
        <Card className="glass-panel border-border/60 rounded-3xl md:col-span-3 shadow-md flex flex-col justify-between overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-md font-bold tracking-tight text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-indigo-400" /> Study Heatmap: {monthName} {year}
            </CardTitle>
            <CardDescription className="text-xs">
              Visual consistency tracker. Highlights represent days you completed study activities.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-4 flex-1 flex flex-col justify-center">
            
            {/* Calendar dynamic visual grid */}
            <div className="grid grid-cols-7 gap-1.5 max-w-sm mx-auto w-full p-2 bg-muted/20 border border-border/60 rounded-2xl shadow-inner">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                <div key={idx} className="text-center text-[9px] font-black text-muted-foreground uppercase">{d}</div>
              ))}
              {calendarDays.map((cell, idx) => (
                <div 
                  key={idx} 
                  className={`h-7.5 w-full flex items-center justify-center rounded-lg text-[10px] font-extrabold ${
                    cell.dayNum === null 
                      ? 'bg-transparent text-transparent opacity-0' 
                      : cell.isActive 
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-black shadow-sm shadow-emerald-500/20 scale-102 border border-emerald-500/30' 
                      : 'bg-card text-muted-foreground border border-border/40 hover:bg-muted/40'
                  }`}
                  title={cell.dayNum ? `${monthName} ${cell.dayNum}: ${cell.isActive ? 'Active Study Day' : 'Inactive'}` : undefined}
                >
                  {cell.dayNum}
                </div>
              ))}
            </div>

            <div className="flex justify-between text-[10px] text-muted-foreground font-semibold px-4 pt-4 border-t mt-4">
              <span className="flex items-center gap-1"><span className="h-2 w-2 bg-emerald-500 rounded-full"></span> Active: {stats.activeDaysCount} Days</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 bg-card border border-border rounded-full"></span> Inactive</span>
            </div>

          </CardContent>
        </Card>

        {/* Daily Challenges list checklist */}
        <Card className="glass-panel border-border/60 rounded-3xl md:col-span-2 shadow-md flex flex-col justify-between overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-md font-bold tracking-tight text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-4.5 w-4.5 text-indigo-400 animate-pulse" /> Daily Challenges Checklist
            </CardTitle>
            <CardDescription className="text-xs">
              Complete these tasks every day to unlock additional heavy XP bonus tokens!
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 flex-1 flex flex-col justify-center space-y-3.5">
            
            {/* Milestones list checkboxes */}
            
            {/* Focus pomodoro */}
            <div className={`flex items-center justify-between p-3 border rounded-2xl transition-all ${
              challengeChecklist.focus 
                ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-500' 
                : 'bg-card border-border/75'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                  challengeChecklist.focus ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-muted border-border/80'
                }`}>
                  {challengeChecklist.focus && <Check className="h-3 w-3 text-white" />}
                </span>
                <div className="text-left">
                  <p className={`text-xs font-bold leading-none ${challengeChecklist.focus ? 'text-emerald-500' : 'text-foreground'}`}>Focus Master</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">Complete a 25 min Pomodoro</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-muted border px-2.5 py-0.5 rounded-full">+50 XP</span>
            </div>

            {/* Quiz Whiz */}
            <div className={`flex items-center justify-between p-3 border rounded-2xl transition-all ${
              challengeChecklist.quiz 
                ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-500' 
                : 'bg-card border-border/75'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                  challengeChecklist.quiz ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-muted border-border/80'
                }`}>
                  {challengeChecklist.quiz && <Check className="h-3 w-3 text-white" />}
                </span>
                <div className="text-left">
                  <p className={`text-xs font-bold leading-none ${challengeChecklist.quiz ? 'text-emerald-500' : 'text-foreground'}`}>Quiz Master</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">Solve AI quiz with &gt;= 80% accuracy</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-muted border px-2.5 py-0.5 rounded-full">+50 XP</span>
            </div>

            {/* Note share */}
            <div className={`flex items-center justify-between p-3 border rounded-2xl transition-all ${
              challengeChecklist.share 
                ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-500' 
                : 'bg-card border-border/75'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                  challengeChecklist.share ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-muted border-border/80'
                }`}>
                  {challengeChecklist.share && <Check className="h-3 w-3 text-white" />}
                </span>
                <div className="text-left">
                  <p className={`text-xs font-bold leading-none ${challengeChecklist.share ? 'text-emerald-500' : 'text-foreground'}`}>Collaborator</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">Share notes pathway link</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-muted border px-2.5 py-0.5 rounded-full">+30 XP</span>
            </div>

          </CardContent>
        </Card>

      </div>

      {/* Main Leaderboard & Podiums Archive row */}
      <div className="grid gap-6 md:grid-cols-4">
        {/* Dynamic Podium, Toggles, and Standings List (Cohort Weekly Default + Global Platform) */}
        <Card className="glass-panel border-border/60 rounded-3xl md:col-span-3 shadow-md flex flex-col">
          <CardHeader className="pb-3 border-b border-border/20 flex flex-row items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-md font-bold tracking-tight text-muted-foreground flex items-center gap-2">
                {leaderboardScope === "cohort" ? (
                  <>
                    <Users className="h-4.5 w-4.5 text-primary" /> My Cohort Standings
                  </>
                ) : leaderboardScope === "notes" ? (
                  <>
                    <BookOpen className="h-4.5 w-4.5 text-emerald-500" /> Class Notes & Shared Materials
                  </>
                ) : (
                  <>
                    <Trophy className="h-4.5 w-4.5 text-yellow-400" /> Platform Registered Standings
                  </>
                )}
              </CardTitle>
            </div>
            
            {/* Toggles: Scope Switcher & Sub-toggles */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Scope Switcher: Cohort Weekly vs Class Notes vs Global Platform */}
              <div className="flex bg-muted/60 p-1 border rounded-xl">
                <button 
                  onClick={() => setLeaderboardScope("cohort")}
                  className={`text-[10px] font-extrabold px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    leaderboardScope === "cohort" ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Users className="h-3 w-3 text-primary" />
                  Cohort Weekly
                </button>
                <button 
                  onClick={() => setLeaderboardScope("notes")}
                  className={`text-[10px] font-extrabold px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    leaderboardScope === "notes" ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <BookOpen className="h-3 w-3 text-emerald-500" />
                  Class Notes
                </button>
                <button 
                  onClick={() => setLeaderboardScope("global")}
                  className={`text-[10px] font-extrabold px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    leaderboardScope === "global" ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Trophy className="h-3 w-3 text-yellow-500" />
                  Global Platform
                </button>
              </div>

              {/* Sub-toggles for Global Platform mode */}
              {leaderboardScope === "global" && (
                <div className="flex bg-muted/60 p-1 border rounded-xl">
                  <button 
                    onClick={() => setRankingTab("monthly")}
                    className={`text-[10px] font-extrabold px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      rankingTab === "monthly" ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Monthly Season
                  </button>
                  <button 
                    onClick={() => setRankingTab("lifetime")}
                    className={`text-[10px] font-extrabold px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      rankingTab === "lifetime" ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Lifetime XP
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="py-5 flex-1 flex flex-col gap-6">

            {/* COHORT WEEKLY VIEW (Default) */}
            {leaderboardScope === "cohort" ? (
              <div className="space-y-6">
                {/* Cohort Info Banner & Week Navigation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
                  <div>
                    <h3 className="text-xs font-black text-foreground flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
                      <span className="truncate">{cohortInfo?.name || "Cohort Standings"}</span>
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Weekly competition • Winner receives AI & storage tier boosts
                    </p>
                  </div>

                  {cohortInfo?.id && (
                    <div className="flex items-center gap-1 bg-muted/40 border border-border/60 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canGoPrevious || cohortLoading}
                        onClick={handlePrevWeek}
                        className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                        title="Previous Week"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-[11px] font-bold px-2 text-foreground font-mono">
                        {formatWeekRange(selectedWeekStart)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canGoNext || cohortLoading}
                        onClick={handleNextWeek}
                        className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                        title="Next Week"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* No Cohort Assigned Fallback */}
                {!cohortInfo?.id ? (
                  <div className="p-8 text-center bg-muted/20 border border-dashed border-border/80 rounded-2xl space-y-3 my-4">
                    <div className="h-10 w-10 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-foreground">No Cohort Assigned Yet</h4>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Set your university, degree program, and semester in your profile to automatically join your classmates on the weekly cohort leaderboard!
                      </p>
                    </div>
                    <Link href="/profile">
                      <Button size="sm" className="rounded-xl text-xs font-bold gap-1.5 mt-2">
                        Configure Profile <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                ) : cohortLoading ? (
                  <div className="py-16 text-center text-muted-foreground text-xs animate-pulse">
                    Loading weekly cohort scores...
                  </div>
                ) : (cohortData?.entries || []).length === 0 ? (
                  <div className="p-8 text-center bg-muted/20 border border-border/40 rounded-2xl space-y-2 my-4">
                    <p className="text-xs font-bold text-foreground">No scores recorded for this week yet.</p>
                    <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                      Complete a daily quiz, streak check-in, or share notes to claim the #1 spot in your cohort!
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Cohort Weekly Top 3 Podium */}
                    <div className="grid grid-cols-3 gap-3 items-end pt-2 pb-2 border-b border-border/40 max-w-md mx-auto w-full">
                      {/* 2ND RANK (Silver, left) */}
                      {cohortData!.entries[1] ? (
                        <div className="flex flex-col items-center">
                          <div className="relative flex items-center justify-center">
                            <div className="h-13 w-13 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-400 border-2 border-zinc-300 flex items-center justify-center font-extrabold text-[12px] text-zinc-700 shrink-0 shadow-md">
                              {cohortData!.entries[1].first_name[0]}{cohortData!.entries[1].last_name[0]}
                            </div>
                            <span className="absolute -bottom-1 h-5 w-5 rounded-full bg-zinc-400 border border-zinc-200 text-white font-black text-[9px] flex items-center justify-center shadow-sm">
                              {cohortData!.entries[1].rank}
                            </span>
                          </div>
                          <p className="text-[10px] font-black text-foreground text-center truncate w-full mt-2 leading-none">
                            {cohortData!.entries[1].first_name}
                          </p>
                          <p className="text-[9px] font-black text-zinc-400 mt-1 uppercase">
                            {cohortData!.entries[1].score} pts
                          </p>
                        </div>
                      ) : (
                        <div className="opacity-0"></div>
                      )}

                      {/* 1ST RANK (Gold, center) */}
                      {cohortData!.entries[0] ? (
                        <div className="flex flex-col items-center transform -translate-y-2">
                          <div className="relative flex items-center justify-center">
                            <div className="absolute -top-3.5 text-yellow-400 animate-bounce">👑</div>
                            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 border-3 border-yellow-400 flex items-center justify-center font-black text-[14px] text-yellow-950 shrink-0 shadow-lg shadow-yellow-500/20">
                              {cohortData!.entries[0].first_name[0]}{cohortData!.entries[0].last_name[0]}
                            </div>
                            <span className="absolute -bottom-1.5 h-6 w-6 rounded-full bg-yellow-400 border-2 border-yellow-200 text-yellow-950 font-black text-[10px] flex items-center justify-center shadow-sm">
                              {cohortData!.entries[0].rank}
                            </span>
                          </div>
                          <p className="text-xs font-black text-foreground text-center truncate w-full mt-2.5 leading-none">
                            {cohortData!.entries[0].first_name}
                          </p>
                          <p className="text-[10px] font-black text-yellow-500 mt-1 uppercase">
                            {cohortData!.entries[0].score} pts
                          </p>
                        </div>
                      ) : (
                        <div className="opacity-0"></div>
                      )}

                      {/* 3RD RANK (Bronze, right) */}
                      {cohortData!.entries[2] ? (
                        <div className="flex flex-col items-center">
                          <div className="relative flex items-center justify-center">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-600 to-orange-700 border-2 border-orange-600 flex items-center justify-center font-extrabold text-[11px] text-amber-100 shrink-0 shadow-md">
                              {cohortData!.entries[2].first_name[0]}{cohortData!.entries[2].last_name[0]}
                            </div>
                            <span className="absolute -bottom-1 h-5 w-5 rounded-full bg-orange-700 border border-orange-500 text-white font-black text-[9px] flex items-center justify-center shadow-sm">
                              {cohortData!.entries[2].rank}
                            </span>
                          </div>
                          <p className="text-[10px] font-black text-foreground text-center truncate w-full mt-2 leading-none">
                            {cohortData!.entries[2].first_name}
                          </p>
                          <p className="text-[9px] font-black text-orange-600 mt-1 uppercase">
                            {cohortData!.entries[2].score} pts
                          </p>
                        </div>
                      ) : (
                        <div className="opacity-0"></div>
                      )}
                    </div>

                    {/* Cohort Ranked List */}
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {cohortData!.entries.map((competitor) => {
                        const isCurrentUser = competitor.is_current_user;
                        const initials = `${competitor.first_name?.[0] || 'S'}${competitor.last_name?.[0] || 'N'}`;
                        const name = `${competitor.first_name} ${competitor.last_name}`;

                        const rankColor = competitor.rank === 1 
                          ? "bg-yellow-400/10 text-yellow-500 border-yellow-400/25 font-black" 
                          : competitor.rank === 2 
                          ? "bg-zinc-300/10 text-zinc-400 border-zinc-300/25 font-black"
                          : competitor.rank === 3 
                          ? "bg-amber-600/10 text-amber-600 border-amber-600/25 font-black"
                          : "bg-muted text-muted-foreground border-border/60 font-bold";

                        return (
                          <div 
                            key={competitor.user_id}
                            className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                              isCurrentUser 
                                ? 'border-primary bg-primary/5 shadow-xs' 
                                : 'border-border/50 bg-card/25 hover:bg-muted/20'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`h-6 w-6 text-center text-xs flex items-center justify-center rounded-lg border shrink-0 ${rankColor}`}>
                                {competitor.rank}
                              </span>
                              
                              <div className="h-8.5 w-8.5 rounded-full bg-gradient-to-br from-primary/10 to-indigo-500/10 border border-primary/20 flex items-center justify-center font-extrabold text-[11px] text-primary shrink-0">
                                {initials}
                              </div>
                              
                              <div className="min-w-0 text-left">
                                <p className={`text-xs font-black truncate leading-tight flex items-center gap-1.5 ${isCurrentUser ? 'text-primary' : 'text-foreground'}`}>
                                  {name}
                                  {isCurrentUser && (
                                    <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.2 rounded font-bold">You</span>
                                  )}
                                </p>
                                <p className="text-[9px] text-muted-foreground uppercase leading-none mt-0.5 truncate">
                                  {competitor.major} • {competitor.university}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-xs font-black tracking-tight text-foreground">+{competitor.score}</span>
                              <span className="text-[8px] text-muted-foreground uppercase font-extrabold block">PTS</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Visibility Notice if user opted out of leaderboard */}
                    {!cohortData?.currentUserVisible && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60 text-[11px] text-muted-foreground">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>
                          Your leaderboard visibility is turned off in Settings. Your rank ({cohortData?.currentUserRank ? `#${cohortData.currentUserRank}` : "recorded"}) is counted, but your name is hidden from peers.
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : leaderboardScope === "notes" ? (
              <CohortNotesPanel
                cohortInfo={cohortInfo}
                sharedFiles={sharedFiles}
                onRefresh={handleRefreshSharedFiles}
              />
            ) : (
              /* GLOBAL PLATFORM STANDINGS (Existing logic preserved exactly) */
              <>
                {/* 1. TOP 3 PODIUM VISUAL HIGHLIGHTS */}
                <div className="grid grid-cols-3 gap-3 items-end pt-4 pb-2 border-b border-border/40 max-w-md mx-auto w-full">
                  
                  {/* 2ND RANK (Silver, left) */}
                  {podiumUsers[1] ? (
                    <div className="flex flex-col items-center">
                      <div className="relative flex items-center justify-center">
                        <div className="h-13 w-13 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-400 border-2 border-zinc-300 flex items-center justify-center font-extrabold text-[12px] text-zinc-700 shrink-0 shadow-md">
                          {podiumUsers[1].first_name[0]}{podiumUsers[1].last_name[0]}
                        </div>
                        <span className="absolute -bottom-1 h-5 w-5 rounded-full bg-zinc-400 border border-zinc-200 text-white font-black text-[9px] flex items-center justify-center shadow-sm">2</span>
                      </div>
                      <p className="text-[10px] font-black text-foreground text-center truncate w-full mt-2 leading-none">
                        {podiumUsers[1].first_name}
                      </p>
                      <p className="text-[9px] font-black text-zinc-400 mt-1 uppercase">
                        {rankingTab === "monthly" ? podiumUsers[1].monthly_xp : podiumUsers[1].total_xp} XP
                      </p>
                    </div>
                  ) : (
                    <div className="opacity-0"></div>
                  )}

                  {/* 1ST RANK (Gold, center) */}
                  {podiumUsers[0] ? (
                    <div className="flex flex-col items-center transform -translate-y-2">
                      <div className="relative flex items-center justify-center">
                        <div className="absolute -top-3.5 text-yellow-400 animate-bounce">👑</div>
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 border-3 border-yellow-400 flex items-center justify-center font-black text-[14px] text-yellow-950 shrink-0 shadow-lg shadow-yellow-500/20">
                          {podiumUsers[0].first_name[0]}{podiumUsers[0].last_name[0]}
                        </div>
                        <span className="absolute -bottom-1.5 h-6 w-6 rounded-full bg-yellow-400 border-2 border-yellow-200 text-yellow-950 font-black text-[10px] flex items-center justify-center shadow-sm">1</span>
                      </div>
                      <p className="text-xs font-black text-foreground text-center truncate w-full mt-2.5 leading-none">
                        {podiumUsers[0].first_name}
                      </p>
                      <p className="text-[10px] font-black text-yellow-500 mt-1 uppercase">
                        {rankingTab === "monthly" ? podiumUsers[0].monthly_xp : podiumUsers[0].total_xp} XP
                      </p>
                    </div>
                  ) : (
                    <div className="opacity-0"></div>
                  )}

                  {/* 3RD RANK (Bronze, right) */}
                  {podiumUsers[2] ? (
                    <div className="flex flex-col items-center">
                      <div className="relative flex items-center justify-center">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-600 to-orange-700 border-2 border-orange-600 flex items-center justify-center font-extrabold text-[11px] text-amber-100 shrink-0 shadow-md">
                          {podiumUsers[2].first_name[0]}{podiumUsers[2].last_name[0]}
                        </div>
                        <span className="absolute -bottom-1 h-5 w-5 rounded-full bg-orange-700 border border-orange-500 text-white font-black text-[9px] flex items-center justify-center shadow-sm">3</span>
                      </div>
                      <p className="text-[10px] font-black text-foreground text-center truncate w-full mt-2 leading-none">
                        {podiumUsers[2].first_name}
                      </p>
                      <p className="text-[9px] font-black text-orange-600 mt-1 uppercase">
                        {rankingTab === "monthly" ? podiumUsers[2].monthly_xp : podiumUsers[2].total_xp} XP
                      </p>
                    </div>
                  ) : (
                    <div className="opacity-0"></div>
                  )}

                </div>

                {/* 2. REAL DB USERS LIST */}
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {activeLeaderboard.map((competitor, idx) => {
                    const isCurrentUser = competitor.user_id === initialProgress.user_id;
                    const score = rankingTab === "monthly" ? competitor.monthly_xp : competitor.total_xp;
                    
                    const initials = `${competitor.first_name?.[0] || 'S'}${competitor.last_name?.[0] || 'N'}`;
                    const name = `${competitor.first_name} ${competitor.last_name}`;

                    const rankColor = idx === 0 
                      ? "bg-yellow-400/10 text-yellow-500 border-yellow-400/25 font-black" 
                      : idx === 1 
                      ? "bg-zinc-300/10 text-zinc-400 border-zinc-300/25 font-black"
                      : idx === 2 
                      ? "bg-amber-600/10 text-amber-600 border-amber-600/25 font-black"
                      : "bg-muted text-muted-foreground border-border/60 font-bold";

                    return (
                      <div 
                        key={competitor.user_id}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                          isCurrentUser 
                            ? 'border-primary bg-primary/5 shadow-xs' 
                            : 'border-border/50 bg-card/25 hover:bg-muted/20'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`h-6 w-6 text-center text-xs flex items-center justify-center rounded-lg border shrink-0 ${rankColor}`}>
                            {idx + 1}
                          </span>
                          
                          <div className="h-8.5 w-8.5 rounded-full bg-gradient-to-br from-primary/10 to-indigo-500/10 border border-primary/20 flex items-center justify-center font-extrabold text-[11px] text-primary shrink-0">
                            {initials}
                          </div>
                          
                          <div className="min-w-0 text-left">
                            <p className={`text-xs font-black truncate leading-tight ${isCurrentUser ? 'text-primary' : 'text-foreground'}`}>
                              {name}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase leading-none mt-0.5 truncate">
                              Level {competitor.current_level} • Accuracy: {competitor.quiz_accuracy}% • {getRankName(competitor.current_level).split(" ")[0]}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black tracking-tight text-foreground">{score}</span>
                          <span className="text-[8px] text-muted-foreground uppercase font-extrabold block">XP</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

          </CardContent>
        </Card>

        {/* Right side: Personal insights & Monthly Winner Trophies Archive */}
        <div className="md:col-span-2 flex flex-col gap-6">
          
          {/* Insights dashboard */}
          <Card className="glass-panel border-border/60 rounded-3xl shadow-md">
            <CardHeader className="pb-3 border-b border-border/20">
              <CardTitle className="text-md font-bold tracking-tight text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4.5 w-4.5 text-indigo-400" /> Scholar Performance Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                
                {/* Accuracy */}
                <div className="flex flex-col p-4 bg-muted/20 border border-border/40 rounded-2xl text-left">
                  <span className="text-[9px] font-extrabold text-muted-foreground uppercase">Average Accuracy</span>
                  <span className="text-lg font-black text-foreground mt-1.5">{initialProgress.quiz_accuracy}%</span>
                  <span className="text-[9px] text-muted-foreground mt-1">{initialProgress.total_correct_answers} correct of {initialProgress.total_questions_attempted} MCQs</span>
                </div>

                {/* Quizzes Taken */}
                <div className="flex flex-col p-4 bg-muted/20 border border-border/40 rounded-2xl text-left">
                  <span className="text-[9px] font-extrabold text-muted-foreground uppercase">Completed Quizzes</span>
                  <span className="text-lg font-black text-foreground mt-1.5">{initialProgress.completed_quizzes_count}</span>
                  <span className="text-[9px] text-muted-foreground mt-1">Generated lecture quizzes solved</span>
                </div>

                {/* Lifetime Rank */}
                <div className="flex flex-col p-4 bg-muted/20 border border-border/40 rounded-2xl text-left col-span-2">
                  <span className="text-[9px] font-extrabold text-muted-foreground uppercase">Lifetime Ranks Milestone</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-black text-foreground">{getRankName(level)}</span>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-lg">
                      Tier Level {level}
                    </span>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>

          {/* Previous Winners seasons archive */}
          <Card className="glass-panel border-border/60 rounded-3xl shadow-md flex-1 flex flex-col">
            <CardHeader className="pb-3 border-b border-border/20">
              <CardTitle className="text-md font-bold tracking-tight text-muted-foreground flex items-center gap-2">
                <Award className="h-4.5 w-4.5 text-yellow-400" /> Monthly Champions Archive
              </CardTitle>
              <CardDescription className="text-xs">
                History of seasonal champions who finished at the top of their month.
              </CardDescription>
            </CardHeader>
            <CardContent className="py-4 flex-1 overflow-y-auto max-h-[250px]">
              {championsArchive.length > 0 ? (
                <div className="space-y-3">
                  {championsArchive.map((champion, idx) => {
                    const champInitials = `${champion.first_name[0]}${champion.last_name[0]}`;
                    
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/15 border border-border/40 rounded-2xl text-left">
                        <div className="flex items-center gap-3">
                          <span className={`h-5 w-5 rounded flex items-center justify-center text-[10px] font-black ${
                            champion.rank === 1 
                              ? 'bg-yellow-400/10 text-yellow-500 border border-yellow-400/25' 
                              : champion.rank === 2
                              ? 'bg-zinc-400/10 text-zinc-500 border border-zinc-400/25'
                              : 'bg-amber-600/10 text-amber-600 border border-amber-600/25'
                          }`}>
                            {champion.rank}
                          </span>
                          <div className="h-7 w-7 rounded-full bg-primary/5 border flex items-center justify-center font-extrabold text-[10px] text-primary shrink-0">
                            {champInitials}
                          </div>
                          <div>
                            <p className="text-xs font-black text-foreground">{champion.first_name} {champion.last_name}</p>
                            <p className="text-[9px] text-muted-foreground uppercase leading-none mt-0.5">{champion.season_name} Champion</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-foreground">{champion.total_xp}</span>
                          <span className="text-[8px] text-muted-foreground uppercase font-extrabold block">XP</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-8 w-8 opacity-25 mx-auto mb-2" />
                  <p className="text-xs font-bold">Trophy Catalog is empty</p>
                  <p className="text-[10px]">Archives will populate at the end of the current season!</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>

      {/* Achievements catalog widget */}
      <Card className="glass-panel border-border/60 rounded-3xl shadow-md w-full overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/20">
          <CardTitle className="text-md font-bold tracking-tight text-muted-foreground flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-400" /> Academic Achievements Catalog
          </CardTitle>
          <CardDescription className="text-xs">
            Unlock achievements by using study tools. Each unlocks custom ranks, badges, and rewards large XP bonuses!
          </CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {achievements.map((ach) => {
              const isUnlocked = unlockedAchievementIds.includes(ach.id);
              
              let IconComp = Award;
              if (ach.icon_url === 'FileText') IconComp = FileText;
              if (ach.icon_url === 'BookOpen') IconComp = BookOpen;
              if (ach.icon_url === 'Zap') IconComp = Zap;
              if (ach.icon_url === 'Award') IconComp = Award;
              if (ach.icon_url === 'Share2') IconComp = Share2;
              if (ach.icon_url === 'Clock') IconComp = Clock;
              if (ach.icon_url === 'Flame') IconComp = Flame;
              if (ach.icon_url === 'Sparkles') IconComp = Sparkles;

              return (
                <div 
                  key={ach.id} 
                  className={`relative p-4.5 rounded-2xl border transition-all duration-300 flex items-start gap-3.5 group text-left ${
                    isUnlocked 
                      ? 'border-yellow-500/35 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 shadow-xs' 
                      : 'border-border/50 bg-card/10 opacity-70 grayscale-60'
                  }`}
                >
                  
                  {isUnlocked && (
                    <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity blur-md -z-10"></div>
                  )}

                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    isUnlocked 
                      ? 'bg-yellow-400/10 text-yellow-500 border border-yellow-400/20' 
                      : 'bg-muted text-zinc-500 border border-border/60'
                  }`}>
                    <IconComp className="h-5 w-5" />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <h4 className="text-xs font-black text-foreground truncate group-hover:text-yellow-500 transition-colors">
                      {ach.name}
                    </h4>
                    <p className="text-[10px] text-muted-foreground leading-normal line-clamp-2">
                      {ach.description}
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[9px] font-black uppercase tracking-wider bg-muted border px-2 py-0.5 rounded-lg text-foreground">
                        +{ach.xp_reward} XP
                      </span>
                      {isUnlocked ? (
                        <span className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-lg">
                          Unlocked
                        </span>
                      ) : (
                        <span className="text-[8px] font-black uppercase bg-muted text-muted-foreground border border-border/40 px-1.5 py-0.5 rounded-lg">
                          Locked
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </CardContent>
      </Card>

    </div>
  );
}
