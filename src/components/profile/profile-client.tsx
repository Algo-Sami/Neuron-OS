"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  User, Sparkles, Bell, BookOpen, Cpu, Clock, FolderOpen, 
  Shield, Eye, Key, Info, Search, RefreshCw, Download, 
  Upload, Trash2, CheckCircle2, LogOut, Menu, X, AlertTriangle, Loader2, ChevronRight
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteUserAccountAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from "@/store/settings-store";
import { 
  ProfileSettings, AppearanceSettings, NotificationSettings, 
  LearningPreferences, AIPreferences, StudyPlannerSettings, 
  FilesStorageSettings, PrivacySecurity, AccessibilitySettings, 
  AccountSettings, AboutSettings 
} from "@/components/settings/settings-panels";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon_url?: string | null;
  xp_reward?: number;
  unlocked_at?: string;
}

interface ProfileClientProps {
  user: {
    id: string;
    email: string;
  };
  profile: {
    first_name: string | null;
    last_name: string | null;
    university: string | null;
    major: string | null;
    avatar_url: string | null;
  };
  progress: {
    total_xp: number;
    current_level: number;
  };
  stats: {
    currentStreak: number;
    highestStreak: number;
    activeDaysCount: number;
    totalStudyMinutes: number;
  };
  unlockedBadges: BadgeItem[];
}

export function ProfileClient({
  user,
  profile,
  progress,
  stats,
  unlockedBadges
}: ProfileClientProps) {
  const router = useRouter();
  const store = useSettingsStore();

  // Selected Section Category state
  const [activeTab, setActiveTab] = useState<string>("profile");
  
  // Search parameters state
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Mobile UI Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  
  // Autosave status animation triggers
  const [showSavedToast, setShowSavedToast] = useState<boolean>(false);
  const isFirstMount = useRef(true);

  // Modals trigger states
  const [logoutDialogOpen, setLogoutDialogOpen] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>("");
  const [confirmDeleteText, setConfirmDeleteText] = useState<string>("");

  // Hidden File input reference for import trigger
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Monitor store state changes for autosave indicator (toggles, selects)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setShowSavedToast(true);
    const timeout = setTimeout(() => setShowSavedToast(false), 2000);
    return () => clearTimeout(timeout);
  }, [
    // Watch relevant styling/AI/planner variables for changes
    store.theme, store.accentColor, store.sidebarStyle, store.density, store.fontSize, store.animations,
    store.assignmentDeadlines, store.quizDeadlines, store.studySessions, store.examAlerts, store.aiRecommendations,
    store.leaderboardUpdates, store.studyRoomInvites, store.uploadProcessing, store.emailNotifications,
    store.pushNotifications, store.inAppNotifications, store.notificationSound, store.quietHoursEnabled,
    store.quietHoursStart, store.quietHoursEnd, store.learningStyle, store.studyGoal, store.studySessionDuration,
    store.customSessionDuration, store.weeklyStudyHours, store.targetCourses, store.prioritySubjects,
    store.aiPersonality, store.responseStyle, store.explanationDifficulty, store.autoSummary, store.autoFlashcards,
    store.autoQuiz, store.autoNotes, store.rememberProgress, store.rememberWeakTopics, store.rememberHabits,
    store.preferredStudyTime, store.maxDailyStudyHours, store.breakDuration, store.pomodoroFocus,
    store.pomodoroShortBreak, store.pomodoroLongBreak, store.examCountdown, store.calendarIntegration,
    store.autoPlanGeneration, store.adaptiveStudyPlans, store.defaultView, store.defaultSort,
    store.recycleBinRetention, store.autoCategorization, store.autoSubjectDetection, store.autoAiProcessing,
    store.backgroundProcessing, store.twoFactorAuth, store.profileVisibility, store.statsVisibility,
    store.leaderboardVisibility, store.roomPrivacy, store.aiDataUsage, store.highContrast,
    store.largerText, store.keyboardNavigation, store.screenReader, store.reducedMotion, store.colorBlindMode,
    store.focusIndicators
  ]);

  // Sidebar settings categories list
  const categories = [
    { id: "profile", label: "Profile", icon: <User className="h-4 w-4" />, tags: "name avatar username university bio details" },
    { id: "appearance", label: "Appearance", icon: <Sparkles className="h-4 w-4" />, tags: "theme mode dark light accent sidebar density font animations motion" },
    { id: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" />, tags: "alerts email push quiet sound sound study room updates" },
    { id: "learning", label: "Learning Preferences", icon: <BookOpen className="h-4 w-4" />, tags: "style style visual goals hours courses weekly subjects" },
    { id: "ai", label: "AI Preferences", icon: <Cpu className="h-4 w-4" />, tags: "persona professor friendly summary flashcards memory wipe credits" },
    { id: "planner", label: "Study Planner", icon: <Clock className="h-4 w-4" />, tags: "pomodoro breaks time countdown calendar integration" },
    { id: "files", label: "Files & Storage", icon: <FolderOpen className="h-4 w-4" />, tags: "space mb folder view sort recycle bin upload index details" },
    { id: "privacy", label: "Privacy & Security", icon: <Shield className="h-4 w-4" />, tags: "password lock security 2fa sessions logs visibility leaderboard rooms delete" },
    { id: "accessibility", label: "Accessibility", icon: <Eye className="h-4 w-4" />, tags: "contrast text scale reader keyboard keys color blind indicators" },
    { id: "account", label: "Account", icon: <Key className="h-4 w-4" />, tags: "credits data backup restore subscription renew signout logout" },
    { id: "about", label: "About Neuron OS", icon: <Info className="h-4 w-4" />, tags: "version build website email policy terms bugs feedback feature" }
  ];

  // Perform filtering on search query
  const filteredCategories = categories.filter(cat => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return cat.label.toLowerCase().includes(q) || cat.tags.includes(q);
  });

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Log out failed:", err);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmDeleteText !== "DELETE") return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res = await deleteUserAccountAction();
      if (res.success) {
        setDeleteDialogOpen(false);
        router.push("/login");
        router.refresh();
      } else {
        setDeleteError(res.error || "Failed to delete account.");
      }
    } catch (err: any) {
      setDeleteError(err.message || "An unexpected error occurred.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        const success = store.importSettings(result);
        if (success) {
          setShowSavedToast(true);
          setTimeout(() => setShowSavedToast(false), 2000);
        }
      }
    };
    reader.readAsText(file);
  };

  // Render the selected category view
  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <ProfileSettings
            dbProfile={profile}
            dbProgress={progress}
            dbStats={stats}
            unlockedBadges={unlockedBadges}
            userEmail={user.email}
            onProfileSaveSuccess={() => setShowSavedToast(true)}
          />
        );
      case "appearance":
        return <AppearanceSettings />;
      case "notifications":
        return <NotificationSettings />;
      case "learning":
        return <LearningPreferences />;
      case "ai":
        return <AIPreferences />;
      case "planner":
        return <StudyPlannerSettings />;
      case "files":
        return <FilesStorageSettings />;
      case "privacy":
        return <PrivacySecurity onDeleteAccountClick={() => setDeleteDialogOpen(true)} />;
      case "accessibility":
        return <AccessibilitySettings />;
      case "account":
        return (
          <AccountSettings
            onLogoutClick={() => setLogoutDialogOpen(true)}
            onDeleteAccountClick={() => setDeleteDialogOpen(true)}
            dbStats={stats}
          />
        );
      case "about":
        return <AboutSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.25rem)] overflow-hidden bg-background text-foreground dashboard-layout-root select-none">
      
      {/* Settings Navigation Sidebar */}
      <aside className={`fixed inset-y-13 left-0 z-20 w-64 md:w-72 bg-card border-r border-border/60 shrink-0 transform transition-transform duration-200 md:relative md:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      } flex flex-col justify-between select-none`}>
        
        {/* Sidebar Header & Search Box */}
        <div className="p-4 space-y-4 border-b border-border/40">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Settings Hub</h2>
            <button className="md:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search settings..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-2 text-xs rounded-lg border bg-muted/20 placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Sidebar Navigation Items */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-0.5">
          {filteredCategories.length > 0 ? (
            filteredCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveTab(cat.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl transition-all duration-150 text-left font-semibold ${
                  activeTab === cat.id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground border border-transparent"
                }`}
              >
                {cat.icon}
                <span className="truncate">{cat.label}</span>
                {activeTab === cat.id && <ChevronRight className="h-3 w-3 ml-auto text-primary" />}
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground">No sections matched.</div>
          )}
        </div>

        {/* Sidebar Footer Operations */}
        <div className="p-4 border-t border-border/40 bg-muted/10 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="xs" 
              className="text-[10px] font-bold h-7 rounded-lg"
              onClick={() => store.resetAll()}
            >
              Reset All
            </Button>
            <Button 
              variant="outline" 
              size="xs" 
              className="text-[10px] font-bold h-7 rounded-lg"
              onClick={() => fileInputRef.current?.click()}
            >
              Import
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportSettings} 
              accept=".json" 
              className="hidden" 
            />
          </div>
          <p className="text-[9px] text-center text-muted-foreground/75 leading-normal pt-1">
            Neuron Scholar OS v2.4
          </p>
        </div>
      </aside>

      {/* Main Settings Panel Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background/30 overflow-y-auto select-text relative">
        
        {/* Top Control Bar */}
        <div className="sticky top-0 bg-background/55 backdrop-blur-md border-b border-border/40 px-6 py-3 flex justify-between items-center shrink-0 z-10 select-none">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary/40"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span>System Settings</span>
              <span>\</span>
              <span className="text-foreground capitalize">{activeTab.replace("-", " ")}</span>
            </div>
          </div>

          {/* Autosave Simulated Status Icon */}
          <div className="flex items-center gap-2">
            {showSavedToast ? (
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Settings updated!
              </span>
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground/80 flex items-center gap-1">
                Preferences autosaved
              </span>
            )}
          </div>
        </div>

        {/* Inner Content Section Scroll container */}
        <div className="p-6 md:p-8 max-w-4xl w-full mx-auto pb-24">
          {renderTabContent()}
        </div>
      </main>

      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border/80 p-6 rounded-2xl shadow-2xl text-left">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">Sign Out Confirmation</DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground uppercase font-black tracking-wider mt-0.5">Are you sure you want to sign out?</DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground leading-relaxed my-2">
            You will be signed out of your current study session. Any active study streaks will remain paused until your next login.
          </p>
          <DialogFooter className="mt-4 flex gap-2">
            <Button variant="ghost" size="xs" onClick={() => setLogoutDialogOpen(false)} className="text-xs rounded-xl">Cancel</Button>
            <Button variant="destructive" size="xs" onClick={handleLogout} className="text-xs rounded-xl bg-destructive">Sign Out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Deletion Dialog (Wiped) */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[440px] bg-card border border-border/80 p-6 rounded-2xl shadow-2xl text-left">
          <DialogHeader className="gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-foreground">Delete Student Account</DialogTitle>
                <DialogDescription className="text-[10px] text-destructive/80 font-bold uppercase tracking-wider mt-0.5">Warning: Irreversible Action</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="p-4 rounded-xl bg-muted/40 border border-border/60 text-muted-foreground text-xs leading-relaxed">
              <p className="font-bold text-foreground mb-1.5">Are you absolutely sure?</p>
              <p>Wiping your account will permanently clear:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground font-medium">
                <li>All uploaded slides, files, and lectures</li>
                <li>Your study progress history, streak totals, XP, and badges</li>
                <li>All generated AI revision notes, flashcards, and quizzes</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-foreground/80 block uppercase">
                To verify, type <span className="font-mono text-destructive bg-destructive/10 px-1.5 py-0.5 rounded font-bold">DELETE</span> below:
              </label>
              <input
                type="text"
                placeholder="Type 'DELETE'"
                value={confirmDeleteText}
                onChange={e => setConfirmDeleteText(e.target.value)}
                disabled={deleteLoading}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 focus:ring-destructive focus:border-destructive transition-all font-mono"
              />
            </div>

            {deleteError && (
              <div className="text-xs text-destructive font-semibold bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg">
                {deleteError}
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 flex gap-2 pt-3 border-t border-border/60">
            <Button variant="ghost" size="xs" onClick={() => { setDeleteDialogOpen(false); setConfirmDeleteText(""); }} disabled={deleteLoading} className="text-xs rounded-xl">Cancel</Button>
            <Button 
              variant="destructive" 
              size="xs" 
              onClick={handleDeleteAccount}
              disabled={deleteLoading || confirmDeleteText !== "DELETE"}
              className="text-xs rounded-xl bg-destructive font-bold"
            >
              {deleteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 inline" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5 inline" />}
              Wipe Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
