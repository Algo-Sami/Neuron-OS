"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { 
  User, Shield, Bell, Sparkles, Sliders, FolderOpen, Key, Eye, HelpCircle, 
  Trash2, Download, Upload, AlertCircle, Laptop, Check, RefreshCw, FileText,
  Clock, Flame, Award, CheckCircle2, ChevronRight, Moon, Sun, Info, Heart,
  Smartphone, Monitor, Globe, Mail, LogOut
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSettingsStore } from "@/store/settings-store";
import { Switch, SettingRow, SectionCard } from "./shared";
import { updateProfile } from "@/actions/profile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

// -------------------------------------------------------------
// PROFILE SETTINGS
// -------------------------------------------------------------
interface ProfileSettingsProps {
  dbProfile: {
    first_name: string | null;
    last_name: string | null;
    university: string | null;
    major: string | null;
    avatar_url: string | null;
  };
  dbProgress: {
    total_xp: number;
    current_level: number;
  };
  dbStats: {
    currentStreak: number;
    highestStreak: number;
    activeDaysCount: number;
    totalStudyMinutes: number;
  };
  unlockedBadges: any[];
  userEmail: string;
  onProfileSaveSuccess: () => void;
}

export function ProfileSettings({
  dbProfile,
  dbProgress,
  dbStats,
  unlockedBadges,
  userEmail,
  onProfileSaveSuccess
}: ProfileSettingsProps) {
  const store = useSettingsStore();
  
  // Local Form state
  const [firstName, setFirstName] = useState(dbProfile.first_name || "");
  const [lastName, setLastName] = useState(dbProfile.last_name || "");
  const [university, setUniversity] = useState(dbProfile.university || "");
  const [major, setMajor] = useState(dbProfile.major || "");
  
  // Local store state
  const [username, setUsername] = useState(store.username);
  const [bio, setBio] = useState(store.bio);
  const [department, setDepartment] = useState(store.department);
  const [semester, setSemester] = useState(store.semester);
  const [studentId, setStudentId] = useState(store.studentId);
  const [country, setCountry] = useState(store.country);
  const [timezone, setTimezone] = useState(store.timezone);
  const [language, setLanguageState] = useState(store.language);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Sync from store
  useEffect(() => {
    setUsername(store.username);
    setBio(store.bio);
    setDepartment(store.department);
    setSemester(store.semester);
    setStudentId(store.studentId);
    setCountry(store.country);
    setTimezone(store.timezone);
    setLanguageState(store.language);
  }, [store]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setErrorMsg("");

    try {
      // 1. Save DB columns via server action
      const res = await updateProfile({
        firstName,
        lastName,
        university,
        major
      });

      if (res.success) {
        // 2. Save extended metadata to local store
        store.updateSettings({
          username,
          bio,
          department,
          semester,
          studentId,
          country,
          timezone,
          language
        });

        setSuccess(true);
        onProfileSaveSuccess();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update profile settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFirstName(dbProfile.first_name || "");
    setLastName(dbProfile.last_name || "");
    setUniversity(dbProfile.university || "");
    setMajor(dbProfile.major || "");
    
    setUsername(store.username);
    setBio(store.bio);
    setDepartment(store.department);
    setSemester(store.semester);
    setStudentId(store.studentId);
    setCountry(store.country);
    setTimezone(store.timezone);
    setLanguageState(store.language);
  };

  return (
    <div className="space-y-6 text-left">
      <SectionCard 
        title="Scholarly Progress & Gamification" 
        description="Your current academic level and earned credentials." 
        icon={<Award className="h-4 w-4" />}
      >
        <div className="grid gap-4 sm:grid-cols-2 mt-2">
          {/* Level Progress */}
          <div className="p-4 bg-muted/20 border border-border/40 rounded-xl flex items-center gap-4">
            <div className="h-14 w-14 shrink-0 flex items-center justify-center bg-primary/10 border border-primary/20 rounded-full">
              <span className="text-xl font-black text-primary">{dbProgress.current_level}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Level {dbProgress.current_level} Scholar</span>
              <p className="text-xs font-bold text-foreground">{dbProgress.total_xp} Total XP Accumulated</p>
              <div className="w-40 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                <div className="h-full bg-primary" style={{ width: `${(dbProgress.total_xp % 1000) / 10}%` }}></div>
              </div>
            </div>
          </div>
          {/* Study Stats */}
          <div className="p-4 bg-muted/20 border border-border/40 rounded-xl grid grid-cols-3 gap-2">
            <div className="text-center">
              <Flame className="h-4.5 w-4.5 text-red-500 mx-auto" />
              <p className="text-[10px] text-muted-foreground font-semibold mt-1">Streak</p>
              <span className="text-xs font-bold text-foreground">{dbStats.currentStreak} Days</span>
            </div>
            <div className="text-center">
              <Clock className="h-4.5 w-4.5 text-blue-500 mx-auto" />
              <p className="text-[10px] text-muted-foreground font-semibold mt-1">Study Time</p>
              <span className="text-xs font-bold text-foreground">{Math.round(dbStats.totalStudyMinutes / 60 * 10) / 10}h</span>
            </div>
            <div className="text-center">
              <Award className="h-4.5 w-4.5 text-yellow-500 mx-auto" />
              <p className="text-[10px] text-muted-foreground font-semibold mt-1">Badges</p>
              <span className="text-xs font-bold text-foreground">{unlockedBadges.length} Earned</span>
            </div>
          </div>
        </div>
      </SectionCard>

      <form onSubmit={handleSave} className="space-y-6">
        <SectionCard 
          title="Student Credentials" 
          description="Manage your display parameters and academic fields." 
          icon={<User className="h-4 w-4" />}
          headerAction={
            <Button 
              type="button" 
              variant="outline" 
              size="xs" 
              className="text-[10px] font-semibold h-7 rounded-lg"
              onClick={() => setIsPreviewOpen(true)}
            >
              Preview Profile
            </Button>
          }
        >
          {success && (
            <div className="p-3 mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0" /> Settings updated successfully!
            </div>
          )}
          {errorMsg && (
            <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-xl">
              {errorMsg}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="firstName" className="text-[10px] font-bold text-muted-foreground uppercase">First Name</Label>
              <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} required className="h-9 text-xs rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName" className="text-[10px] font-bold text-muted-foreground uppercase">Last Name</Label>
              <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} required className="h-9 text-xs rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="username" className="text-[10px] font-bold text-muted-foreground uppercase">Username</Label>
              <Input id="username" value={username} onChange={e => setUsername(e.target.value)} required className="h-9 text-xs rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email" className="text-[10px] font-bold text-muted-foreground uppercase">Registered Email</Label>
              <Input id="email" value={userEmail} disabled className="h-9 text-xs rounded-xl bg-muted/40 cursor-not-allowed text-muted-foreground" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="bio" className="text-[10px] font-bold text-muted-foreground uppercase">Student Bio</Label>
              <textarea 
                id="bio" 
                value={bio} 
                onChange={e => setBio(e.target.value)} 
                className="w-full min-h-[70px] p-2.5 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                placeholder="Write a short description about your scholarly interests..."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="university" className="text-[10px] font-bold text-muted-foreground uppercase">University / Institution</Label>
              <Input id="university" value={university} onChange={e => setUniversity(e.target.value)} className="h-9 text-xs rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="department" className="text-[10px] font-bold text-muted-foreground uppercase">Department</Label>
              <Input id="department" value={department} onChange={e => setDepartment(e.target.value)} className="h-9 text-xs rounded-xl" placeholder="e.g. Computer Science" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="major" className="text-[10px] font-bold text-muted-foreground uppercase">Major / Field of Study</Label>
              <Input id="major" value={major} onChange={e => setMajor(e.target.value)} className="h-9 text-xs rounded-xl" placeholder="e.g. Artificial Intelligence" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="semester" className="text-[10px] font-bold text-muted-foreground uppercase">Semester</Label>
              <Input id="semester" value={semester} onChange={e => setSemester(e.target.value)} className="h-9 text-xs rounded-xl" placeholder="e.g. 4th Semester" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="studentId" className="text-[10px] font-bold text-muted-foreground uppercase">Student ID (Optional)</Label>
              <Input id="studentId" value={studentId} onChange={e => setStudentId(e.target.value)} className="h-9 text-xs rounded-xl" placeholder="e.g. NR-2026" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="country" className="text-[10px] font-bold text-muted-foreground uppercase">Country</Label>
              <Input id="country" value={country} onChange={e => setCountry(e.target.value)} className="h-9 text-xs rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="timezone" className="text-[10px] font-bold text-muted-foreground uppercase">Time Zone</Label>
              <select 
                id="timezone" 
                value={timezone} 
                onChange={e => setTimezone(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
              >
                <option value="UTC-8 (Pacific Standard Time)">UTC-8 (Pacific Standard Time)</option>
                <option value="UTC-5 (Eastern Standard Time)">UTC-5 (Eastern Standard Time)</option>
                <option value="UTC+0 (Greenwich Mean Time)">UTC+0 (Greenwich Mean Time)</option>
                <option value="UTC+1 (Central European Time)">UTC+1 (Central European Time)</option>
                <option value="UTC+5 (Pakistan Standard Time)">UTC+5 (Pakistan Standard Time)</option>
                <option value="UTC+8 (China Standard Time)">UTC+8 (China Standard Time)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="language" className="text-[10px] font-bold text-muted-foreground uppercase">Preferred Language</Label>
              <select 
                id="language" 
                value={language} 
                onChange={e => setLanguageState(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
              >
                <option value="en">English (US)</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="zh">中文</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-border/40">
            <Button type="button" variant="ghost" className="text-xs h-9 rounded-xl" onClick={handleReset}>
              Reset Changes
            </Button>
            <Button type="submit" disabled={loading} className="text-xs h-9 px-6 rounded-xl bg-primary">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </SectionCard>
      </form>

      {/* Profile Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border/80 p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">Scholar Identity Card</DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground">This is how your credentials display inside the study room.</DialogDescription>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center text-center space-y-4 bg-muted/20 border border-border/40 rounded-xl p-4 mt-2">
            <Avatar className="h-16 w-16 border-2 border-primary/30">
              <AvatarImage src="" />
              <AvatarFallback className="text-lg font-black bg-gradient-to-br from-primary/10 to-indigo-500/10 text-primary">
                {firstName?.[0] || "S"}{lastName?.[0] || "N"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-extrabold text-sm text-foreground">{firstName || "Scholar"} {lastName || "Student"}</h3>
              <p className="text-[9px] text-primary uppercase font-bold tracking-wider mt-0.5">@{username || "student"}</p>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed italic">
              "{bio || "No biography provided yet."}"
            </p>
            <div className="w-full grid grid-cols-2 gap-2 text-left pt-4 border-t border-border/40 text-[10px] text-muted-foreground">
              <div><span className="font-bold text-foreground">University:</span> {university || "Not set"}</div>
              <div><span className="font-bold text-foreground">Major:</span> {major || "Not set"}</div>
              <div><span className="font-bold text-foreground">Department:</span> {department || "Not set"}</div>
              <div><span className="font-bold text-foreground">Semester:</span> {semester || "Not set"}</div>
              <div><span className="font-bold text-foreground">Country:</span> {country || "Not set"}</div>
              <div><span className="font-bold text-foreground">Student ID:</span> {studentId || "None"}</div>
            </div>
          </div>
          <DialogFooter>
            <Button size="xs" onClick={() => setIsPreviewOpen(false)} className="text-xs rounded-xl">Close Preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -------------------------------------------------------------
// APPEARANCE SETTINGS
// -------------------------------------------------------------
export function AppearanceSettings() {
  const store = useSettingsStore();
  const { setTheme: setNextTheme } = useTheme();

  // Handle setting updates
  const handleThemeChange = (newTheme: typeof store.theme) => {
    store.updateSetting("theme", newTheme);
    // Apply standard system theme routing mapping
    if (newTheme === "light") {
      setNextTheme("light");
    } else if (newTheme === "dark" || newTheme === "system") {
      setNextTheme(newTheme);
    } else {
      // Custom dark flavors: applied to html element as classes
      setNextTheme(newTheme);
    }
  };

  const handleAccentChange = (accent: typeof store.accentColor) => {
    store.updateSetting("accentColor", accent);
    // Remove previous accent classes
    const html = document.documentElement;
    const accentPrefixes = ["accent-violet", "accent-amber", "accent-emerald", "accent-blue", "accent-rose"];
    accentPrefixes.forEach(c => html.classList.remove(c));
    html.classList.add(`accent-${accent}`);
  };

  const handleFontSizeChange = (size: typeof store.fontSize) => {
    store.updateSetting("fontSize", size);
    const html = document.documentElement;
    html.classList.remove("font-size-small", "font-size-medium", "font-size-large");
    html.classList.add(`font-size-${size}`);
  };

  // Sync state on render (helpful for accent/fontsize loading from localStorage)
  useEffect(() => {
    const html = document.documentElement;
    
    // Accent
    const accentPrefixes = ["accent-violet", "accent-amber", "accent-emerald", "accent-blue", "accent-rose"];
    accentPrefixes.forEach(c => html.classList.remove(c));
    html.classList.add(`accent-${store.accentColor}`);

    // Font size
    html.classList.remove("font-size-small", "font-size-medium", "font-size-large");
    html.classList.add(`font-size-${store.fontSize}`);
  }, [store.accentColor, store.fontSize]);

  const themesList = [
    { id: "light", name: "Light Mode", icon: <Sun className="h-4 w-4" />, bg: "bg-white border-slate-300 text-slate-800" },
    { id: "dark", name: "Dark Mode", icon: <Moon className="h-4 w-4" />, bg: "bg-zinc-950 border-zinc-800 text-zinc-300" },
    { id: "system", name: "System Default", icon: <Laptop className="h-4 w-4" />, bg: "bg-slate-900/40 border-slate-800 text-slate-400" },
    { id: "neuron-dark", name: "Neuron Dark", icon: <Sparkles className="h-4 w-4 text-violet-400" />, bg: "bg-neutral-900 border-neutral-800 text-violet-100" },
    { id: "midnight-blue", name: "Midnight Blue", icon: <Sliders className="h-4 w-4 text-blue-400" />, bg: "bg-slate-950 border-slate-800 text-blue-100" },
    { id: "academic-gray", name: "Academic Gray", icon: <Sliders className="h-4 w-4 text-slate-400" />, bg: "bg-zinc-900 border-zinc-800 text-zinc-100" },
    { id: "ocean-blue", name: "Ocean Blue", icon: <Sliders className="h-4 w-4 text-cyan-400" />, bg: "bg-sky-950 border-sky-800 text-cyan-100" },
    { id: "professional-black", name: "Professional Black", icon: <Sliders className="h-4 w-4 text-zinc-200" />, bg: "bg-black border-zinc-900 text-zinc-100" }
  ];

  const accents = [
    { id: "violet", color: "bg-violet-600", label: "Violet" },
    { id: "amber", color: "bg-amber-500", label: "Amber" },
    { id: "emerald", color: "bg-emerald-500", label: "Emerald" },
    { id: "blue", color: "bg-blue-500", label: "Blue" },
    { id: "rose", color: "bg-rose-500", label: "Rose" }
  ] as const;

  return (
    <div className="space-y-6 text-left">
      <SectionCard 
        title="Theme System" 
        description="Select your aesthetic and customize the operating system shell colors."
        icon={<Sparkles className="h-4 w-4" />}
      >
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mt-2">
          {themesList.map((t) => (
            <button
              key={t.id}
              onClick={() => handleThemeChange(t.id as any)}
              className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between h-20 ${t.bg} ${
                store.theme === t.id 
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary" 
                  : "hover:border-border/80 border-border/40"
              }`}
            >
              <div className="flex justify-between items-center w-full">
                {t.icon}
                {store.theme === t.id && <Check className="h-3 w-3 text-primary shrink-0" />}
              </div>
              <span className="text-[10px] font-black tracking-wide">{t.name}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard 
        title="Color and Styling Accent" 
        description="Choose a primary action highlight color scheme."
        icon={<Sliders className="h-4 w-4" />}
      >
        <div className="flex gap-4 items-center mt-2 flex-wrap">
          {accents.map((a) => (
            <button
              key={a.id}
              onClick={() => handleAccentChange(a.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
                store.accentColor === a.id
                  ? "bg-primary/10 border-primary text-foreground"
                  : "bg-muted/25 border-border/40 text-muted-foreground hover:border-border/80"
              }`}
            >
              <span className={`h-3 w-3 rounded-full ${a.color} shrink-0`} />
              {a.label}
              {store.accentColor === a.id && <Check className="h-3 w-3 text-primary shrink-0 ml-1" />}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard 
        title="Appearance Customization Controls" 
        description="Scale fonts and control density models for accessibility and layout spacing."
        icon={<Sliders className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="Sidebar Style" description="Change sidebar visual state and width.">
            <select 
              value={store.sidebarStyle} 
              onChange={e => store.updateSetting("sidebarStyle", e.target.value as any)}
              className="h-8 px-2 text-[11px] rounded-lg border border-border bg-background cursor-pointer"
            >
              <option value="glass">Glass Overlay</option>
              <option value="solid">Solid Panel</option>
              <option value="compact">Compact Width</option>
            </select>
          </SettingRow>

          <SettingRow label="Visual Density Mode" description="Choose compact padding options to see more content.">
            <select 
              value={store.density} 
              onChange={e => store.updateSetting("density", e.target.value as any)}
              className="h-8 px-2 text-[11px] rounded-lg border border-border bg-background cursor-pointer"
            >
              <option value="comfortable">Comfortable spacing</option>
              <option value="compact">Compact layout</option>
            </select>
          </SettingRow>

          <SettingRow label="Global Font Size" description="Change text sizing rules across dashboard layouts.">
            <div className="flex gap-1 border border-border/60 rounded-lg p-0.5 bg-muted/20">
              {(["small", "medium", "large"] as const).map((sz) => (
                <button
                  key={sz}
                  onClick={() => handleFontSizeChange(sz)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md capitalize transition-all ${
                    store.fontSize === sz
                      ? "bg-card text-foreground border border-border/80 shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow label="Animations & Visual Transitions" description="Toggle animation speeds or disable them.">
            <select 
              value={store.animations} 
              onChange={e => store.updateSetting("animations", e.target.value as any)}
              className="h-8 px-2 text-[11px] rounded-lg border border-border bg-background cursor-pointer"
            >
              <option value="enabled">Enable Animations</option>
              <option value="reduced">Reduce Motion</option>
              <option value="disabled">Disable Animations</option>
            </select>
          </SettingRow>
        </div>
      </SectionCard>
    </div>
  );
}

// -------------------------------------------------------------
// NOTIFICATION SETTINGS
// -------------------------------------------------------------
export function NotificationSettings() {
  const store = useSettingsStore();

  return (
    <div className="space-y-6 text-left">
      <SectionCard 
        title="Scholarly Reminders & Alerts" 
        description="Configure what items trigger alert notifications in your workspace."
        icon={<Bell className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="Assignment Due Dates" description="Reminders about imminent assignments and target tasks.">
            <Switch checked={store.assignmentDeadlines} onChange={val => store.updateSetting("assignmentDeadlines", val)} />
          </SettingRow>
          <SettingRow label="Quiz Deadlines" description="Alerts before scheduled class practice quizzes expire.">
            <Switch checked={store.quizDeadlines} onChange={val => store.updateSetting("quizDeadlines", val)} />
          </SettingRow>
          <SettingRow label="Study Sessions" description="Notification checks before focus blocks and Pomodoro milestones.">
            <Switch checked={store.studySessions} onChange={val => store.updateSetting("studySessions", val)} />
          </SettingRow>
          <SettingRow label="Exam Countdown & Alerts" description="Alerts for midterms and final examination schedules.">
            <Switch checked={store.examAlerts} onChange={val => store.updateSetting("examAlerts", val)} />
          </SettingRow>
          <SettingRow label="AI Weakness Recommendations" description="Notifications when AI detects topics that need review.">
            <Switch checked={store.aiRecommendations} onChange={val => store.updateSetting("aiRecommendations", val)} />
          </SettingRow>
          <SettingRow label="Leaderboard & Streak Updates" description="Get notified about points updates and active streak status.">
            <Switch checked={store.leaderboardUpdates} onChange={val => store.updateSetting("leaderboardUpdates", val)} />
          </SettingRow>
          <SettingRow label="Study Room Invitations" description="Alerts when peers invite you to join active study spaces.">
            <Switch checked={store.studyRoomInvites} onChange={val => store.updateSetting("studyRoomInvites", val)} />
          </SettingRow>
          <SettingRow label="Upload processing complete" description="Notifications when notes uploads are indexed by AI.">
            <Switch checked={store.uploadProcessing} onChange={val => store.updateSetting("uploadProcessing", val)} />
          </SettingRow>
        </div>
      </SectionCard>

      <SectionCard 
        title="Notification Channels & Sound" 
        description="Choose where notification messages are delivered."
        icon={<Bell className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="Email Notifications" description="Receive digests of notes and leaderboard updates in email.">
            <Switch checked={store.emailNotifications} onChange={val => store.updateSetting("emailNotifications", val)} />
          </SettingRow>
          <SettingRow label="Push Notifications" description="Show browser desktop alerts for study invitations and processing.">
            <Switch checked={store.pushNotifications} onChange={val => store.updateSetting("pushNotifications", val)} />
          </SettingRow>
          <SettingRow label="In-App Notifications" description="Show badge indicators inside notifications top bell.">
            <Switch checked={store.inAppNotifications} onChange={val => store.updateSetting("inAppNotifications", val)} />
          </SettingRow>
          <SettingRow label="Notification Alert Sound" description="Play a subtle bell sound when an in-app notice arrives.">
            <Switch checked={store.notificationSound} onChange={val => store.updateSetting("notificationSound", val)} />
          </SettingRow>
        </div>
      </SectionCard>

      <SectionCard 
        title="Quiet Hours (Do Not Disturb)" 
        description="Mute non-critical study room notifications during specific times."
        icon={<Clock className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="Enable Quiet Hours" description="Mute dashboard push alerts automatically during quiet times.">
            <Switch checked={store.quietHoursEnabled} onChange={val => store.updateSetting("quietHoursEnabled", val)} />
          </SettingRow>
          
          {store.quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-4 py-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Start Muting Time</Label>
                <Input 
                  type="time" 
                  value={store.quietHoursStart} 
                  onChange={e => store.updateSetting("quietHoursStart", e.target.value)}
                  className="h-8 text-xs rounded-lg bg-background border"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">End Muting Time</Label>
                <Input 
                  type="time" 
                  value={store.quietHoursEnd} 
                  onChange={e => store.updateSetting("quietHoursEnd", e.target.value)}
                  className="h-8 text-xs rounded-lg bg-background border"
                />
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// -------------------------------------------------------------
// LEARNING PREFERENCES
// -------------------------------------------------------------
export function LearningPreferences() {
  const store = useSettingsStore();

  const styles = [
    { id: "visual", title: "Visual Learner", desc: "Prefers diagrams, notes colors, mind maps, and slides visual layouts." },
    { id: "reading", title: "Reading & Writing", desc: "Prefers structured documents, manuals, lecture transcripts, and text notes." },
    { id: "practice", title: "Practice-Based", desc: "Prefers flashcards, training quizzes, mock exams, and test templates." },
    { id: "conceptual", title: "Conceptual Core", desc: "Prefers abstract summaries, primary lectures definitions, and AI tutoring." },
    { id: "mixed", title: "Mixed (Adaptive)", desc: "A hybrid combination optimized by the AI based on weak review areas." }
  ] as const;

  const goals = [
    { id: "pass", title: "Pass Course", desc: "Focus on passing requirements and primary note summaries." },
    { id: "gpa", title: "Improve GPA", desc: "Maximize study scores, maintain streaks, and complete test preparations." },
    { id: "exam_prep", title: "Exam Preparation", desc: "Cramming systems, quiz generation, and weaknesses review trackers." },
    { id: "competitive", title: "Competitive Exams", desc: "Advanced training, speed quizzes, and complex conceptual analysis." },
    { id: "deep_understanding", title: "Deep Understanding", desc: "High conceptual exploration, professor level Q&A, and detailed references." }
  ] as const;

  return (
    <div className="space-y-6 text-left">
      <SectionCard 
        title="Preferred Learning Style" 
        description="Choose how AI structures lecture summaries, flashcards, and tutoring responses."
        icon={<Sliders className="h-4 w-4" />}
      >
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mt-2">
          {styles.map((s) => (
            <button
              key={s.id}
              onClick={() => store.updateSetting("learningStyle", s.id)}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all ${
                store.learningStyle === s.id
                  ? "bg-primary/10 border-primary text-foreground"
                  : "bg-muted/10 border-border/40 text-muted-foreground hover:border-border/80 hover:text-foreground"
              }`}
            >
              <div className="flex justify-between items-center w-full">
                <span className="text-xs font-bold">{s.title}</span>
                {store.learningStyle === s.id && <Check className="h-3 w-3 text-primary shrink-0" />}
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal">{s.desc}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard 
        title="Academic Study Target" 
        description="Set your primary learning goal to configure study reminders and course paths."
        icon={<Sparkles className="h-4 w-4" />}
      >
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mt-2">
          {goals.map((g) => (
            <button
              key={g.id}
              onClick={() => store.updateSetting("studyGoal", g.id)}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all ${
                store.studyGoal === g.id
                  ? "bg-primary/10 border-primary text-foreground"
                  : "bg-muted/10 border-border/40 text-muted-foreground hover:border-border/80 hover:text-foreground"
              }`}
            >
              <div className="flex justify-between items-center w-full">
                <span className="text-xs font-bold">{g.title}</span>
                {store.studyGoal === g.id && <Check className="h-3 w-3 text-primary shrink-0" />}
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal">{g.desc}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard 
        title="Weekly Commitment Goals" 
        description="Configure target study limits for course schedules."
        icon={<Clock className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="Preferred Study Block duration" description="Choose baseline minutes for one study room session.">
            <select 
              value={store.studySessionDuration} 
              onChange={e => store.updateSetting("studySessionDuration", e.target.value as any)}
              className="h-8 px-2 text-[11px] rounded-lg border border-border bg-background cursor-pointer"
            >
              <option value="30">30 Minutes</option>
              <option value="45">45 Minutes</option>
              <option value="60">60 Minutes</option>
              <option value="90">90 Minutes</option>
              <option value="custom">Custom Duration</option>
            </select>
          </SettingRow>

          {store.studySessionDuration === "custom" && (
            <div className="py-2.5 flex items-center justify-between">
              <Label htmlFor="customSessionVal" className="text-[11px] font-bold text-muted-foreground uppercase">Custom Session Duration (min)</Label>
              <Input 
                id="customSessionVal" 
                type="number" 
                value={store.customSessionDuration}
                onChange={e => store.updateSetting("customSessionDuration", parseInt(e.target.value) || 30)}
                className="h-8 w-20 text-center rounded-lg border bg-background"
                min="5" max="300"
              />
            </div>
          )}

          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-foreground">Weekly Study Goal (Hours)</label>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Target study time inside the portal room per week.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Input 
                type="number" 
                value={store.weeklyStudyHours}
                onChange={e => store.updateSetting("weeklyStudyHours", parseInt(e.target.value) || 1)}
                className="h-8 w-16 text-center rounded-lg border bg-background text-xs"
                min="1" max="168"
              />
              <span className="text-xs font-bold text-muted-foreground">Hours / Week</span>
            </div>
          </div>

          <div className="py-3.5 space-y-2">
            <Label htmlFor="targetCourses" className="text-xs font-semibold text-foreground block">Target Courses</Label>
            <Input 
              id="targetCourses" 
              value={store.targetCourses}
              onChange={e => store.updateSetting("targetCourses", e.target.value)}
              className="h-9 text-xs rounded-xl"
              placeholder="e.g. CS-101, MATH-202"
            />
          </div>

          <div className="py-3.5 space-y-2 last:pb-0">
            <Label htmlFor="prioritySubjects" className="text-xs font-semibold text-foreground block">Priority Subjects</Label>
            <Input 
              id="prioritySubjects" 
              value={store.prioritySubjects}
              onChange={e => store.updateSetting("prioritySubjects", e.target.value)}
              className="h-9 text-xs rounded-xl"
              placeholder="e.g. Data Structures, Linear Algebra"
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// -------------------------------------------------------------
// AI PREFERENCES
// -------------------------------------------------------------
export function AIPreferences() {
  const store = useSettingsStore();
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const personalities = [
    { id: "tutor", title: "AI Academic Tutor", desc: "Breaks down formulas, solves step-by-step, highlights concepts." },
    { id: "coach", title: "Study Coach", desc: "Focuses on motivation, study timetables, streak tracking and planning reviews." },
    { id: "professor", title: "Professor Mode", desc: "Rigorous academic terminology, detailed reference citations, deep source indexing." },
    { id: "mentor", title: "Friendly Mentor", desc: "Encouraging tone, simplified analogies, conversational check-ins." },
    { id: "trainer", title: "Exam Trainer", desc: "Drill practice questions, quiz tips, error analysis feedback, test shortcuts." }
  ] as const;

  const handleClearMemory = () => {
    setClearing(true);
    setTimeout(() => {
      setClearing(false);
      setCleared(true);
      setTimeout(() => setCleared(false), 3000);
    }, 1200);
  };

  return (
    <div className="space-y-6 text-left">
      <SectionCard 
        title="AI Personality & Persona" 
        description="Select the default voice tone and explanation structure of your AI study helpers."
        icon={<Sparkles className="h-4 w-4" />}
      >
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mt-2">
          {personalities.map((p) => (
            <button
              key={p.id}
              onClick={() => store.updateSetting("aiPersonality", p.id)}
              className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all ${
                store.aiPersonality === p.id
                  ? "bg-primary/10 border-primary text-foreground"
                  : "bg-muted/10 border-border/40 text-muted-foreground hover:border-border/80 hover:text-foreground"
              }`}
            >
              <div className="flex justify-between items-center w-full">
                <span className="text-xs font-bold">{p.title}</span>
                {store.aiPersonality === p.id && <Check className="h-3 w-3 text-primary shrink-0" />}
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal">{p.desc}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard 
        title="AI Response Styling & Difficulty" 
        description="Configure length thresholds and conceptual depth limits."
        icon={<Sliders className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="AI Response Length" description="Choose output detail levels for chat and note generation.">
            <select 
              value={store.responseStyle} 
              onChange={e => store.updateSetting("responseStyle", e.target.value as any)}
              className="h-8 px-2 text-[11px] rounded-lg border border-border bg-background cursor-pointer"
            >
              <option value="short">Short (Bullet points and summaries)</option>
              <option value="balanced">Balanced (Standard academic detail)</option>
              <option value="detailed">Detailed (In-depth notes summaries)</option>
              <option value="very_detailed">Very Detailed (Full text essays and examples)</option>
            </select>
          </SettingRow>

          <SettingRow label="Explanation Level" description="Define background terminology difficulty.">
            <select 
              value={store.explanationDifficulty} 
              onChange={e => store.updateSetting("explanationDifficulty", e.target.value as any)}
              className="h-8 px-2 text-[11px] rounded-lg border border-border bg-background cursor-pointer"
            >
              <option value="beginner">Beginner (No background needed)</option>
              <option value="intermediate">Intermediate (Standard undergraduate term)</option>
              <option value="advanced">Advanced (Graduate terminology & formulas)</option>
              <option value="adaptive">Adaptive (Auto-scales based on performance)</option>
            </select>
          </SettingRow>
        </div>
      </SectionCard>

      <SectionCard 
        title="Automation Preferences" 
        description="Choose what steps AI runs automatically after you upload a slide deck or notes file."
        icon={<Sparkles className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="Auto Generate Notes Summary" description="Generate a 5-bullet conceptual summary card instantly.">
            <Switch checked={store.autoSummary} onChange={val => store.updateSetting("autoSummary", val)} />
          </SettingRow>
          <SettingRow label="Auto Generate Study Flashcards" description="Extract core definitions into revision flashcards cards.">
            <Switch checked={store.autoFlashcards} onChange={val => store.updateSetting("autoFlashcards", val)} />
          </SettingRow>
          <SettingRow label="Auto Generate Assessment Quiz" description="Prepare a 5-question adaptive quiz after folder ingestion.">
            <Switch checked={store.autoQuiz} onChange={val => store.updateSetting("autoQuiz", val)} />
          </SettingRow>
          <SettingRow label="Auto Compile Detailed Lecture Notes" description="Combine slides and transcript into cohesive study notes.">
            <Switch checked={store.autoNotes} onChange={val => store.updateSetting("autoNotes", val)} />
          </SettingRow>
        </div>
      </SectionCard>

      <SectionCard 
        title="AI Memory Records" 
        description="Control how AI retains local context about your weaknesses and learning speed."
        icon={<Shield className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="Remember Study Progress" description="Allows AI to contextualize notes based on completed quizzes.">
            <Switch checked={store.rememberProgress} onChange={val => store.updateSetting("rememberProgress", val)} />
          </SettingRow>
          <SettingRow label="Remember Weak Topics" description="Retain indices of quiz questions you failed to tailor flashcards.">
            <Switch checked={store.rememberWeakTopics} onChange={val => store.updateSetting("rememberWeakTopics", val)} />
          </SettingRow>
          <SettingRow label="Remember Study Schedule Habits" description="Track peak hours to recommend optimal calendar countdown timings.">
            <Switch checked={store.rememberHabits} onChange={val => store.updateSetting("rememberHabits", val)} />
          </SettingRow>

          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border/40">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-destructive">Wipe AI Memory Space</label>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Completely erase AI indices regarding your study habits. This action is immediate and local.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-3">
              {cleared && (
                <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Memory Wiped!
                </span>
              )}
              <Button 
                type="button" 
                variant="destructive" 
                size="xs"
                disabled={clearing}
                className="text-[10px] font-semibold h-7 px-3 rounded-lg"
                onClick={handleClearMemory}
              >
                {clearing ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                Clear AI Memory
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// -------------------------------------------------------------
// STUDY PLANNER SETTINGS
// -------------------------------------------------------------
export function StudyPlannerSettings() {
  const store = useSettingsStore();

  return (
    <div className="space-y-6 text-left">
      <SectionCard 
        title="Schedule & Time Customization" 
        description="Choose peak times and set Pomodoro work intervals."
        icon={<Clock className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="Preferred Study Time Window" description="Optimize automated notifications around these hours.">
            <select 
              value={store.preferredStudyTime} 
              onChange={e => store.updateSetting("preferredStudyTime", e.target.value as any)}
              className="h-8 px-2 text-[11px] rounded-lg border border-border bg-background cursor-pointer"
            >
              <option value="morning">Morning (06:00 - 12:00)</option>
              <option value="afternoon">Afternoon (12:00 - 18:00)</option>
              <option value="evening">Evening (18:00 - 22:00)</option>
              <option value="night">Late Night (22:00 - 06:00)</option>
            </select>
          </SettingRow>

          <SettingRow label="Maximum Study hours per day" description="Cap automatically planned study sessions to prevent burnout.">
            <div className="flex items-center gap-2">
              <Input 
                type="number" 
                value={store.maxDailyStudyHours}
                onChange={e => store.updateSetting("maxDailyStudyHours", parseInt(e.target.value) || 1)}
                className="h-8 w-14 text-center rounded-lg border bg-background text-xs"
                min="1" max="24"
              />
              <span className="text-[11px] font-bold text-muted-foreground uppercase">Hours</span>
            </div>
          </SettingRow>

          <SettingRow label="Break duration interval" description="Set default minutes of idle breathing before study timers restart.">
            <div className="flex items-center gap-2">
              <Input 
                type="number" 
                value={store.breakDuration}
                onChange={e => store.updateSetting("breakDuration", parseInt(e.target.value) || 5)}
                className="h-8 w-14 text-center rounded-lg border bg-background text-xs"
                min="1" max="60"
              />
              <span className="text-[11px] font-bold text-muted-foreground uppercase">Minutes</span>
            </div>
          </SettingRow>
        </div>
      </SectionCard>

      <SectionCard 
        title="Pomodoro Session Configuration" 
        description="Fine-tune time segments for the local Study Room Pomodoro clock."
        icon={<Clock className="h-4 w-4" />}
      >
        <div className="grid gap-4 sm:grid-cols-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="pomoFocus" className="text-[10px] font-bold text-muted-foreground uppercase">Focus Block (min)</Label>
            <Input 
              id="pomoFocus" 
              type="number" 
              value={store.pomodoroFocus}
              onChange={e => store.updateSetting("pomodoroFocus", parseInt(e.target.value) || 25)}
              className="h-8 text-xs rounded-lg bg-background border"
              min="5" max="120"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pomoShort" className="text-[10px] font-bold text-muted-foreground uppercase">Short Break (min)</Label>
            <Input 
              id="pomoShort" 
              type="number" 
              value={store.pomodoroShortBreak}
              onChange={e => store.updateSetting("pomodoroShortBreak", parseInt(e.target.value) || 5)}
              className="h-8 text-xs rounded-lg bg-background border"
              min="1" max="30"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pomoLong" className="text-[10px] font-bold text-muted-foreground uppercase">Long Break (min)</Label>
            <Input 
              id="pomoLong" 
              type="number" 
              value={store.pomodoroLongBreak}
              onChange={e => store.updateSetting("pomodoroLongBreak", parseInt(e.target.value) || 15)}
              className="h-8 text-xs rounded-lg bg-background border"
              min="5" max="60"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard 
        title="Calendar & Adaptive Integration" 
        description="Control automated calendar compilation options."
        icon={<Sliders className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="Countdown Calendar visibility" description="Show exam time counters at the top of the dashboard pages.">
            <Switch checked={store.examCountdown} onChange={val => store.updateSetting("examCountdown", val)} />
          </SettingRow>
          <SettingRow label="External Calendar Integration" description="Sync study planner slots with Google Calendar or ICS feeds.">
            <Switch checked={store.calendarIntegration} onChange={val => store.updateSetting("calendarIntegration", val)} />
          </SettingRow>
          <SettingRow label="Automated Planner Generation" description="Let AI generate study planners for subjects upon slide uploading.">
            <Switch checked={store.autoPlanGeneration} onChange={val => store.updateSetting("autoPlanGeneration", val)} />
          </SettingRow>
          <SettingRow label="Adaptive study plans" description="Allow schedules to adapt dynamically if you fail a course quiz.">
            <Switch checked={store.adaptiveStudyPlans} onChange={val => store.updateSetting("adaptiveStudyPlans", val)} />
          </SettingRow>
        </div>
      </SectionCard>
    </div>
  );
}

// -------------------------------------------------------------
// FILES & STORAGE SETTINGS
// -------------------------------------------------------------
export function FilesStorageSettings() {
  const store = useSettingsStore();
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleEmptyRecycleBin = () => {
    setClearing(true);
    setTimeout(() => {
      setClearing(false);
      setCleared(true);
      setTimeout(() => setCleared(false), 3000);
    }, 1200);
  };

  // Mock values matching file manager scope
  const stats = {
    totalFiles: 24,
    totalLectures: 12,
    totalNotes: 8,
    totalAssignments: 4,
    storageUsedMB: 184,
    storageLimitMB: 512,
  };

  const usedPercent = Math.round((stats.storageUsedMB / stats.storageLimitMB) * 100);

  return (
    <div className="space-y-6 text-left">
      <SectionCard 
        title="Account Storage Space Usage" 
        description="Verify your storage footprint inside the file system."
        icon={<FolderOpen className="h-4 w-4" />}
      >
        <div className="space-y-3 mt-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-foreground">Capacity Footprint</span>
            <span className="text-muted-foreground font-bold">{stats.storageUsedMB} MB / {stats.storageLimitMB} MB ({usedPercent}%)</span>
          </div>
          <Progress value={usedPercent} className="h-2 rounded-full" />
          <div className="grid grid-cols-4 gap-2 text-center pt-2">
            <div className="p-2 bg-muted/15 border border-border/40 rounded-xl">
              <span className="text-xs font-black text-foreground">{stats.totalFiles}</span>
              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide mt-0.5">Files</p>
            </div>
            <div className="p-2 bg-muted/15 border border-border/40 rounded-xl">
              <span className="text-xs font-black text-foreground">{stats.totalLectures}</span>
              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide mt-0.5">Lectures</p>
            </div>
            <div className="p-2 bg-muted/15 border border-border/40 rounded-xl">
              <span className="text-xs font-black text-foreground">{stats.totalNotes}</span>
              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide mt-0.5">Notes</p>
            </div>
            <div className="p-2 bg-muted/15 border border-border/40 rounded-xl">
              <span className="text-xs font-black text-foreground">{stats.totalAssignments}</span>
              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide mt-0.5">Homeworks</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard 
        title="File Layout & Sort Rules" 
        description="Configure default layout structures inside the file explorer."
        icon={<Sliders className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="Default Explorer Layout" description="Select standard visualization model when you load subjects.">
            <select 
              value={store.defaultView} 
              onChange={e => store.updateSetting("defaultView", e.target.value as any)}
              className="h-8 px-2 text-[11px] rounded-lg border border-border bg-background cursor-pointer"
            >
              <option value="grid">Grid tiles</option>
              <option value="list">Compact List</option>
              <option value="details">Details Table View</option>
              <option value="compact">Compact grid tiles</option>
            </select>
          </SettingRow>

          <SettingRow label="Default Sorting Field" description="Choose primary field for index mapping.">
            <select 
              value={store.defaultSort} 
              onChange={e => store.updateSetting("defaultSort", e.target.value as any)}
              className="h-8 px-2 text-[11px] rounded-lg border border-border bg-background cursor-pointer"
            >
              <option value="name">Name (Alphabetical)</option>
              <option value="date">Date Ingested</option>
              <option value="subject">Subject Category</option>
              <option value="size">Size (KB)</option>
            </select>
          </SettingRow>
        </div>
      </SectionCard>

      <SectionCard 
        title="Recycle Bin Settings" 
        description="Configure document deletion storage limits."
        icon={<Trash2 className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="Retention Period (Days)" description="Time deleted files are stored in Recycle Bin before permanent wipe.">
            <select 
              value={store.recycleBinRetention} 
              onChange={e => store.updateSetting("recycleBinRetention", parseInt(e.target.value) || 30)}
              className="h-8 px-2 text-[11px] rounded-lg border border-border bg-background cursor-pointer"
            >
              <option value="7">7 Days</option>
              <option value="14">14 Days</option>
              <option value="30">30 Days</option>
              <option value="90">90 Days</option>
            </select>
          </SettingRow>

          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-destructive">Wipe Recycle Bin Now</label>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Immediately erase deleted files cache to reclaim local space.
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {cleared && (
                <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Empty!
                </span>
              )}
              <Button 
                type="button" 
                variant="outline" 
                size="xs"
                disabled={clearing}
                className="text-[10px] font-semibold h-7 border-destructive/30 text-destructive hover:bg-destructive/10 rounded-lg"
                onClick={handleEmptyRecycleBin}
              >
                {clearing ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                Empty Recycle Bin
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard 
        title="Upload Processing Preferences" 
        description="Choose automation triggers for file upload events."
        icon={<Upload className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="Automatic Subject Categorization" description="Let AI analyze slides content and auto route to the correct Subject portal.">
            <Switch checked={store.autoCategorization} onChange={val => store.updateSetting("autoCategorization", val)} />
          </SettingRow>
          <SettingRow label="Automatic Subject Detection" description="Identify slide names to automatically associate tags.">
            <Switch checked={store.autoSubjectDetection} onChange={val => store.updateSetting("autoSubjectDetection", val)} />
          </SettingRow>
          <SettingRow label="Automatic AI Processing" description="Initiate LLM vectors embedding automatically upon upload.">
            <Switch checked={store.autoAiProcessing} onChange={val => store.updateSetting("autoAiProcessing", val)} />
          </SettingRow>
          <SettingRow label="Background Processing" description="Process document files in background task lists so dashboard stays interactive.">
            <Switch checked={store.backgroundProcessing} onChange={val => store.updateSetting("backgroundProcessing", val)} />
          </SettingRow>
        </div>
      </SectionCard>
    </div>
  );
}

// -------------------------------------------------------------
// PRIVACY & SECURITY SETTINGS
// -------------------------------------------------------------
interface PrivacySecurityProps {
  onDeleteAccountClick: () => void;
}

export function PrivacySecurity({ onDeleteAccountClick }: PrivacySecurityProps) {
  const store = useSettingsStore();

  // Password changes state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setErrorMsg("");

    if (newPassword !== confirmPassword) {
      setErrorMsg("New passwords do not match.");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("Password must contain at least 6 characters.");
      setLoading(false);
      return;
    }

    // Simulate password change
    setTimeout(() => {
      setSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLoading(false);
      setTimeout(() => setSuccess(false), 3000);
    }, 1500);
  };

  const sessions = [
    { id: "s1", device: "Windows Desktop Computer", browser: "Google Chrome", ip: "192.168.1.44", location: "San Jose, CA", current: true },
    { id: "s2", device: "Apple iPhone 15 Pro", browser: "Safari Mobile", ip: "172.56.21.9", location: "Santa Clara, CA", current: false }
  ];

  const logHistory = [
    { id: "h1", event: "Successful Password Sign In", time: "Jun 12, 2026, 11:05 PM", status: "success" },
    { id: "h2", event: "Two-Factor verification check", time: "Jun 09, 2026, 09:12 AM", status: "success" },
    { id: "h3", event: "Session logout triggered", time: "Jun 05, 2026, 04:30 PM", status: "success" }
  ];

  return (
    <div className="space-y-6 text-left">
      <SectionCard 
        title="Privacy Controls" 
        description="Configure account visibility and sharing permissions."
        icon={<Eye className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="Profile Visibility" description="Choose who can see your bio, university details, and badges room.">
            <select 
              value={store.profileVisibility} 
              onChange={e => store.updateSetting("profileVisibility", e.target.value as any)}
              className="h-8 px-2 text-[11px] rounded-lg border border-border bg-background cursor-pointer"
            >
              <option value="public">Public (Everyone)</option>
              <option value="friends">Study Peers Only</option>
              <option value="private">Private (Only me)</option>
            </select>
          </SettingRow>

          <SettingRow label="Study Statistics Visibility" description="Show study streaks, times and badges count inside the leaderboard.">
            <select 
              value={store.statsVisibility} 
              onChange={e => store.updateSetting("statsVisibility", e.target.value as any)}
              className="h-8 px-2 text-[11px] rounded-lg border border-border bg-background cursor-pointer"
            >
              <option value="public">Public (Show on leaderboard)</option>
              <option value="private">Private (Hide from standings)</option>
            </select>
          </SettingRow>

          <SettingRow label="Leaderboard Visibility" description="Appear inside the weekly XP top ranking list.">
            <Switch checked={store.leaderboardVisibility} onChange={val => store.updateSetting("leaderboardVisibility", val)} />
          </SettingRow>

          <SettingRow label="Study Room Default Privacy" description="Choose privacy setting when spawning study rooms.">
            <select 
              value={store.roomPrivacy} 
              onChange={e => store.updateSetting("roomPrivacy", e.target.value as any)}
              className="h-8 px-2 text-[11px] rounded-lg border border-border bg-background cursor-pointer"
            >
              <option value="public">Public (Open to find)</option>
              <option value="invite_only">Invite Only</option>
              <option value="private">Strictly Private</option>
            </select>
          </SettingRow>

          <SettingRow label="AI Data Usage Preferences" description="Allow Neuron AI processors to improve algorithms using query histories.">
            <Switch checked={store.aiDataUsage} onChange={val => store.updateSetting("aiDataUsage", val)} />
          </SettingRow>
        </div>
      </SectionCard>

      <SectionCard 
        title="Change Security Password" 
        description="Update your account sign-in password."
        icon={<Key className="h-4 w-4" />}
      >
        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md mt-2">
          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0" /> Password updated successfully!
            </div>
          )}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-xl">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="oldPass" className="text-[10px] font-bold text-muted-foreground uppercase">Current Password</Label>
            <Input id="oldPass" type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required className="h-9 text-xs rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="newPass" className="text-[10px] font-bold text-muted-foreground uppercase">New Password</Label>
            <Input id="newPass" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="h-9 text-xs rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmPass" className="text-[10px] font-bold text-muted-foreground uppercase">Confirm New Password</Label>
            <Input id="confirmPass" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="h-9 text-xs rounded-xl" />
          </div>
          <Button type="submit" disabled={loading} size="xs" className="text-xs h-8 px-4 rounded-xl bg-primary mt-2">
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </SectionCard>

      <SectionCard 
        title="Two-Factor Authentication (2FA)" 
        description="Secure your student account by requesting code confirmation."
        icon={<Shield className="h-4 w-4" />}
      >
        <SettingRow label="Enable Two-Factor Codes" description="Verify logins using confirmation emails or authenticator codes.">
          <Switch checked={store.twoFactorAuth} onChange={val => store.updateSetting("twoFactorAuth", val)} />
        </SettingRow>
      </SectionCard>

      <SectionCard 
        title="Active Device Sessions" 
        description="Verify devices currently connected to your profile."
        icon={<Smartphone className="h-4 w-4" />}
      >
        <div className="space-y-3 mt-2">
          {sessions.map(s => (
            <div key={s.id} className="flex justify-between items-center p-3 bg-muted/20 border border-border/40 rounded-xl text-left">
              <div className="flex items-center gap-3">
                {s.device.includes("iPhone") ? <Smartphone className="h-5 w-5 text-muted-foreground" /> : <Monitor className="h-5 w-5 text-muted-foreground" />}
                <div>
                  <h4 className="text-xs font-bold text-foreground">
                    {s.device} {s.current && <span className="text-[8px] bg-primary/20 border border-primary/30 text-primary px-1.5 py-0.25 rounded-full font-bold ml-1.5">THIS DEVICE</span>}
                  </h4>
                  <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                    {s.browser} • {s.ip} • {s.location}
                  </p>
                </div>
              </div>
              {!s.current && (
                <Button variant="ghost" size="xs" className="text-[10px] text-destructive hover:bg-destructive/10 h-7 rounded-lg">
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard 
        title="Login History Log" 
        description="Review security records of password entry history."
        icon={<Info className="h-4 w-4" />}
      >
        <div className="space-y-2 mt-2">
          {logHistory.map(l => (
            <div key={l.id} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0 text-[10px] text-muted-foreground text-left">
              <div>
                <span className="font-bold text-foreground block">{l.event}</span>
                <span className="text-[9px] mt-0.5 block">{l.time}</span>
              </div>
              <span className="text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">SUCCESS</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard 
        title="Account Administration" 
        description="Permanent actions regarding your dashboard profiles data."
        icon={<AlertCircle className="h-4 w-4 text-destructive" />}
      >
        <div className="flex justify-between items-center py-2">
          <div className="text-left space-y-0.5">
            <h4 className="text-xs font-bold text-foreground">Delete Student Account</h4>
            <p className="text-[10px] text-muted-foreground max-w-sm">
              Permanently wipe notes uploads, quizzes history, and credentials. This action is irreversible.
            </p>
          </div>
          <Button 
            type="button" 
            variant="destructive" 
            size="xs" 
            className="text-[10px] font-bold h-8 px-4 rounded-xl"
            onClick={onDeleteAccountClick}
          >
            Delete Account
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

// -------------------------------------------------------------
// ACCESSIBILITY
// -------------------------------------------------------------
export function AccessibilitySettings() {
  const store = useSettingsStore();

  const handleHighContrast = (val: boolean) => {
    store.updateSetting("highContrast", val);
    const html = document.documentElement;
    if (val) {
      html.classList.add("high-contrast");
    } else {
      html.classList.remove("high-contrast");
    }
  };

  return (
    <div className="space-y-6 text-left">
      <SectionCard 
        title="Visual Accessibility Adjustments" 
        description="Modify typography contrast and colors for easier reading."
        icon={<Eye className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <SettingRow label="High Contrast Mode" description="Increase contrast thresholds across text components.">
            <Switch checked={store.highContrast} onChange={handleHighContrast} />
          </SettingRow>

          <SettingRow label="Larger Text Display" description="Increase text baseline scale automatically.">
            <Switch checked={store.largerText} onChange={val => store.updateSetting("largerText", val)} />
          </SettingRow>

          <SettingRow label="Screen Reader Support" description="Optimize HTML tags hierarchy to read layouts aloud.">
            <Switch checked={store.screenReader} onChange={val => store.updateSetting("screenReader", val)} />
          </SettingRow>

          <SettingRow label="Reduced Animations Motion" description="Minimize hover transitions and radial rotations.">
            <Switch checked={store.reducedMotion} onChange={val => store.updateSetting("reducedMotion", val)} />
          </SettingRow>

          <SettingRow label="Color Blind Friendly Filters" description="Adjust key color hues inside progress circles.">
            <select 
              value={store.colorBlindMode} 
              onChange={e => store.updateSetting("colorBlindMode", e.target.value as any)}
              className="h-8 px-2 text-[11px] rounded-lg border border-border bg-background cursor-pointer"
            >
              <option value="none">Standard colors (None)</option>
              <option value="protanopia">Protanopia (Red weak)</option>
              <option value="deuteranopia">Deuteranopia (Green weak)</option>
              <option value="tritanopia">Tritanopia (Blue weak)</option>
              <option value="monochromacy">Monochromacy (Achromatopsia)</option>
            </select>
          </SettingRow>

          <SettingRow label="Highlight Input Focus Indicators" description="Force neon rings around input fields during tab focus.">
            <Switch checked={store.focusIndicators} onChange={val => store.updateSetting("focusIndicators", val)} />
          </SettingRow>
        </div>
      </SectionCard>

      <SectionCard 
        title="Keyboard Navigation Shortcuts" 
        description="Dashboard navigation shortcuts for desktop speed keys."
        icon={<Laptop className="h-4 w-4" />}
      >
        <div className="grid gap-2 sm:grid-cols-2 mt-2">
          <div className="p-2.5 bg-muted/20 border border-border/40 rounded-xl flex justify-between items-center text-[10px]">
            <span className="font-bold text-foreground">Global Search Ingestions</span>
            <kbd className="bg-card px-2 py-0.5 border rounded-md font-mono text-muted-foreground">⌘ K</kbd>
          </div>
          <div className="p-2.5 bg-muted/20 border border-border/40 rounded-xl flex justify-between items-center text-[10px]">
            <span className="font-bold text-foreground">File Explorer Properties</span>
            <kbd className="bg-card px-2 py-0.5 border rounded-md font-mono text-muted-foreground">Alt + Enter</kbd>
          </div>
          <div className="p-2.5 bg-muted/20 border border-border/40 rounded-xl flex justify-between items-center text-[10px]">
            <span className="font-bold text-foreground">Close Active Overlay sheets</span>
            <kbd className="bg-card px-2 py-0.5 border rounded-md font-mono text-muted-foreground">Esc</kbd>
          </div>
          <div className="p-2.5 bg-muted/20 border border-border/40 rounded-xl flex justify-between items-center text-[10px]">
            <span className="font-bold text-foreground">Trigger AI Chat Focus</span>
            <kbd className="bg-card px-2 py-0.5 border rounded-md font-mono text-muted-foreground">⌥ C</kbd>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// -------------------------------------------------------------
// ACCOUNT SETTINGS
// -------------------------------------------------------------
interface AccountSettingsProps {
  onLogoutClick: () => void;
  onDeleteAccountClick: () => void;
  dbStats: {
    totalStudyMinutes: number;
  };
}

export function AccountSettings({ onLogoutClick, onDeleteAccountClick, dbStats }: AccountSettingsProps) {
  const store = useSettingsStore();

  const handleExportData = () => {
    // Generate clean JSON payload representing their preferences + mock download
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      studentId: store.studentId,
      preferences: {
        theme: store.theme,
        accentColor: store.accentColor,
        sidebarStyle: store.sidebarStyle,
        learningStyle: store.learningStyle,
        studyGoal: store.studyGoal,
        aiPersonality: store.aiPersonality,
        pomodoro: {
          focus: store.pomodoroFocus,
          short: store.pomodoroShortBreak,
          long: store.pomodoroLongBreak
        }
      }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `neuron_preferences_${store.username || "student"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const [backingUp, setBackingUp] = useState(false);
  const [backedUp, setBackedUp] = useState(false);

  const handleBackup = () => {
    setBackingUp(true);
    setTimeout(() => {
      setBackingUp(false);
      setBackedUp(true);
      setTimeout(() => setBackedUp(false), 3000);
    }, 1200);
  };

  return (
    <div className="space-y-6 text-left">
      <SectionCard 
        title="Scholarly Subscription Details" 
        description="Verify your subscription status and available AI tokens."
        icon={<Info className="h-4 w-4" />}
      >
        <div className="grid gap-4 sm:grid-cols-2 mt-2">
          {/* Subscription Tier */}
          <div className="p-4 bg-muted/20 border border-border/40 rounded-xl text-left space-y-1">
            <span className="text-[9px] text-primary uppercase font-black tracking-widest">Subscription Plan</span>
            <h4 className="text-sm font-black text-foreground">Scholar Premium (Academic Tier)</h4>
            <p className="text-[10px] text-muted-foreground leading-normal mt-1">
              Registered since Jun 01, 2026. Auto-renews monthly.
            </p>
          </div>

          {/* Credits remaining */}
          <div className="p-4 bg-muted/20 border border-border/40 rounded-xl text-left space-y-2">
            <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold">
              <span className="uppercase tracking-widest text-primary font-black">AI Processor Credits</span>
              <span>850 / 1000 left</span>
            </div>
            <Progress value={85} className="h-1.5 rounded-full" />
            <p className="text-[9px] text-muted-foreground leading-normal pt-0.5">
              Resets on Jul 01, 2026. Ingestion requires 2 credits/slide.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard 
        title="Account Configuration Tools" 
        description="Backup your locally configured studies, learning models or reset profiles."
        icon={<Sliders className="h-4 w-4" />}
      >
        <div className="divide-y divide-border/40">
          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-foreground">Export Configuration Data</label>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Download a `.json` file containing your locally saved study goals, AI persona settings and theme selections.
              </p>
            </div>
            <Button 
              type="button" 
              variant="outline" 
              size="xs" 
              className="text-[10px] font-bold h-8 px-4 rounded-xl shrink-0"
              onClick={handleExportData}
            >
              <Download className="h-3 w-3 mr-1" />
              Export Settings
            </Button>
          </div>

          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-foreground">Backup Settings Cloud</label>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Sync local learning style definitions and folder defaults to our cloud directory.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {backedUp && (
                <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Synced!
                </span>
              )}
              <Button 
                type="button" 
                variant="outline" 
                size="xs" 
                className="text-[10px] font-bold h-8 px-4 rounded-xl"
                disabled={backingUp}
                onClick={handleBackup}
              >
                {backingUp ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                Cloud Backup
              </Button>
            </div>
          </div>

          <div className="py-3.5 flex justify-between items-center">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-foreground">Sign Out of Neuron</label>
              <p className="text-[10px] text-muted-foreground">
                Safely sign out from this scholar space session.
              </p>
            </div>
            <Button 
              type="button" 
              variant="outline" 
              size="xs" 
              className="text-[10px] font-bold h-8 px-4 border-border/80 hover:bg-muted/40 rounded-xl"
              onClick={onLogoutClick}
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Logout Session
            </Button>
          </div>

          <div className="py-3.5 flex justify-between items-center text-left">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-destructive">Wipe Profile Data</label>
              <p className="text-[10px] text-muted-foreground max-w-sm">
                Delete account record permanently from Supabase server files.
              </p>
            </div>
            <Button 
              type="button" 
              variant="destructive" 
              size="xs" 
              className="text-[10px] font-bold h-8 px-4 rounded-xl"
              onClick={onDeleteAccountClick}
            >
              Delete Account
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// -------------------------------------------------------------
// ABOUT NEURON OS
// -------------------------------------------------------------
export function AboutSettings() {
  const [feedbackType, setFeedbackType] = useState("feedback");
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackBody, setFeedbackBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isReleaseOpen, setIsReleaseOpen] = useState(false);

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    // Simulate feedback submission
    setTimeout(() => {
      setSuccess(true);
      setFeedbackSubject("");
      setFeedbackBody("");
      setLoading(false);
      setTimeout(() => setSuccess(false), 3000);
    }, 1200);
  };

  const releases = [
    { version: "v2.4.0", date: "Jun 08, 2026", details: "Upgraded File Explorer to professional tabular layouts, fixed duplicates in Recycle Bin sidebar tree, expanded system Settings controls dashboard." },
    { version: "v2.3.1", date: "May 20, 2026", details: "Improved RAG speed latency for document query indexing, upgraded Gemini tutor chat outputs formatting templates." },
    { version: "v2.2.0", date: "Apr 15, 2026", details: "Spawning study room peers streams integration, added Pomodoro timers to workspace headers." }
  ];

  return (
    <div className="space-y-6 text-left">
      <SectionCard 
        title="About Neuron OS" 
        description="Technical parameters and deployment build keys."
        icon={<Info className="h-4 w-4" />}
      >
        <div className="grid gap-4 sm:grid-cols-2 mt-2">
          {/* Version / Build info */}
          <div className="p-4 bg-muted/20 border border-border/40 rounded-xl space-y-1.5 text-xs text-muted-foreground">
            <div><span className="font-bold text-foreground">Application Version:</span> v2.4.0 (Scholar Core)</div>
            <div><span className="font-bold text-foreground">Build Number:</span> 8122-rev44-X</div>
            <div><span className="font-bold text-foreground">Official Website:</span> <a href="https://neuron.internal" target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold">neuron.internal</a></div>
            <div><span className="font-bold text-foreground">Support Hotline:</span> support@neuron.internal</div>
            <div className="pt-2">
              <Button 
                type="button" 
                variant="outline" 
                size="xs" 
                className="text-[10px] font-bold h-7 rounded-lg"
                onClick={() => setIsReleaseOpen(true)}
              >
                Release Notes history
              </Button>
            </div>
          </div>

          {/* Core Licensing */}
          <div className="p-4 bg-muted/20 border border-border/40 rounded-xl text-left text-[10px] text-muted-foreground flex flex-col justify-between">
            <p className="leading-relaxed">
              Neuron OS is a private academic operating system. Licensed to students in registered institutions to optimize revision scheduling.
            </p>
            <div className="flex gap-3 pt-3 border-t border-border/40 font-bold text-foreground">
              <a href="#" className="hover:text-primary">Privacy Policy</a>
              <span>•</span>
              <a href="#" className="hover:text-primary">Terms of Service</a>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard 
        title="Scholarly Feedback & Bug Center" 
        description="Request features, submit suggestions, or report bugs directly to developers."
        icon={<Mail className="h-4 w-4" />}
      >
        <form onSubmit={handleSubmitFeedback} className="space-y-4 max-w-md mt-2">
          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0" /> Thank you! Feedback submitted successfully.
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {(["feedback", "bug", "feature"] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setFeedbackType(t)}
                className={`py-1.5 text-[10px] font-bold border rounded-lg capitalize transition-all ${
                  feedbackType === t
                    ? "bg-primary/10 border-primary text-foreground"
                    : "bg-muted/20 border-border/40 text-muted-foreground hover:border-border/80"
                }`}
              >
                {t === "feedback" && "Suggestion"}
                {t === "bug" && "Report Bug"}
                {t === "feature" && "Request Feature"}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <Label htmlFor="feedSubj" className="text-[10px] font-bold text-muted-foreground uppercase">Subject Line</Label>
            <Input 
              id="feedSubj" 
              value={feedbackSubject} 
              onChange={e => setFeedbackSubject(e.target.value)} 
              required 
              placeholder="e.g. Ingestion speed suggestion..."
              className="h-9 text-xs rounded-xl" 
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="feedBody" className="text-[10px] font-bold text-muted-foreground uppercase">Details Description</Label>
            <textarea 
              id="feedBody" 
              value={feedbackBody} 
              onChange={e => setFeedbackBody(e.target.value)} 
              required 
              placeholder="Provide context or reproduce steps..."
              className="w-full min-h-[80px] p-2.5 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          <Button type="submit" disabled={loading} size="xs" className="text-xs h-8 px-5 rounded-xl bg-primary mt-2">
            {loading ? "Sending..." : "Submit Feedback"}
          </Button>
        </form>
      </SectionCard>

      {/* Release Notes Dialog */}
      <Dialog open={isReleaseOpen} onOpenChange={setIsReleaseOpen}>
        <DialogContent className="sm:max-w-lg bg-card border border-border/80 p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">Release Notes History</DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground">Version history details for Scholar Academic OS.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar py-2 text-left">
            {releases.map(r => (
              <div key={r.version} className="p-3 bg-muted/20 border border-border/40 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold text-foreground">
                  <span className="text-primary">{r.version}</span>
                  <span className="text-muted-foreground font-medium">{r.date}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {r.details}
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button size="xs" onClick={() => setIsReleaseOpen(false)} className="text-xs rounded-xl">Close Notes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
