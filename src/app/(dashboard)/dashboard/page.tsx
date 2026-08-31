import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BookOpen, 
  Clock, 
  FileText, 
  Zap, 
  Calendar as CalendarIcon, 
  Sparkles, 
  AlertTriangle, 
  Bell,
  ArrowRight,
  TrendingUp,
  Bookmark,
  Flame,
  CheckCircle2,
  ChevronRight,
  Plus
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getDynamicActivityStats, getRankName } from "@/services/gamification/rewards";

interface ReminderItem {
  id: string;
  title: string;
  due_date: string;
  reminder_type: string;
  priority?: string | null;
  subjects: { name: string } | { name: string }[] | null;
}

export default async function DashboardPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  const error = searchParams?.error;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-center">
        <p className="text-sm text-muted-foreground">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  // ─── BATCH 1: Parallel — profile + user_progress + activity stats ───────────
  const [profileResult, progressResult, activityStatsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, username, email, university, degree_program, semester, profile_image, interests')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('user_progress')
      .select('total_xp, current_level')
      .eq('user_id', user.id)
      .maybeSingle(),
    getDynamicActivityStats(user.id),
  ]);

  let profile = profileResult.data;
  let progress = progressResult.data;
  const activityStats = activityStatsResult;

  // Graceful creation if trigger has slightly delayed database synchronization
  if (!profile) {
    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        full_name: user.user_metadata?.full_name || 'Scholar Student',
        username: user.user_metadata?.username || 'scholar_' + user.id.substring(0, 5),
        email: user.email || '',
        university: user.user_metadata?.university || 'Neuron University',
        degree_program: user.user_metadata?.degree_program || 'Computer Science',
        semester: user.user_metadata?.semester || 'Semester 1',
        xp_points: 0,
        streak_count: 0
      })
      .select('full_name, username, email, university, degree_program, semester, profile_image, interests')
      .single();
    profile = newProfile;
  }

  if (!progress) {
    const { data: newProgress } = await supabase
      .from('user_progress')
      .insert({ user_id: user.id, total_xp: 0, current_level: 1 })
      .select('total_xp, current_level')
      .single();
    progress = newProgress;
  }

  // ─── BATCH 2: Parallel — counts + all reminders + recent docs + processing summaries ───
  const nowIso = new Date().toISOString();

  const [
    subjectCountResult,
    docCountResult,
    aiCompletedCountResult,
    aiProcessingCountResult,
    remindersResult,
    recentDocsResult,
    completedTaskCountResult,
  ] = await Promise.all([
    supabase
      .from('subjects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null),
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('upload_id', 'is', null)
      .or('ai_doc_type.is.null,ai_doc_type.neq.ai_generated')
      .is('deleted_at', null),
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('summary_status', 'completed')
      .is('deleted_at', null),
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('summary_status', 'processing')
      .is('deleted_at', null),
    // Single reminders query — filter client-side for overdue/upcoming/pending
    supabase
      .from('reminders')
      .select('id, title, due_date, reminder_type, priority, subjects(name)')
      .eq('user_id', user.id)
      .eq('completed_status', false)
      .order('due_date', { ascending: true })
      .limit(20),
    supabase
      .from('documents')
      .select('id, title, created_at, subjects(name)')
      .eq('user_id', user.id)
      .not('upload_id', 'is', null)
      .or('ai_doc_type.is.null,ai_doc_type.neq.ai_generated')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(4),
    supabase
      .from('reminders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed_status', true),
  ]);

  const subjectCount = subjectCountResult.count || 0;
  const docCount = docCountResult.count || 0;
  const aiCompletedCount = aiCompletedCountResult.count || 0;
  const aiProcessingCount = aiProcessingCountResult.count || 0;
  const recentDocs = recentDocsResult.data;
  const completedTaskCount = completedTaskCountResult.count || 0;

  // Filter reminders client-side from single query
  const allActiveReminders = (remindersResult.data as unknown as ReminderItem[]) || [];
  const pendingTaskCount = allActiveReminders.length;
  const overdueReminders = allActiveReminders.filter(r => r.due_date < nowIso).slice(0, 3);
  const upcomingReminders = allActiveReminders.filter(r => r.due_date >= nowIso).slice(0, 4);

  const totalTaskCount = pendingTaskCount + completedTaskCount;
  const completionPercentage = totalTaskCount > 0 
    ? Math.round((completedTaskCount / totalTaskCount) * 100) 
    : 0;

  // Intelligent AI Summaries subtext calculation
  const getAiSummarySubtitle = () => {
    if (aiProcessingCount > 0 && aiCompletedCount > 0) {
      return `${aiCompletedCount} ready · ${aiProcessingCount} processing`;
    }
    if (aiProcessingCount > 0 && aiCompletedCount === 0) {
      return `${aiProcessingCount} processing`;
    }
    if (aiCompletedCount > 0) {
      return `${aiCompletedCount} ready`;
    }
    return "Generated resources";
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.max(1, Math.floor(diffMs / 1000 / 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatDeadline = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  const showOnboarding = !subjectCount && !docCount && !pendingTaskCount;
  
  // Dynamic greeting calculation based on hour of day
  const firstName = profile?.full_name?.split(" ")[0] || "Scholar";
  const getGreeting = (name: string) => {
    const hour = new Date().getHours();
    if (hour < 12) return `Good morning, ${name} 🌅`;
    if (hour < 17) return `Ready to study today, ${name}? 📚`;
    return `Good evening, ${name} 🌌`;
  };
  const greetingText = getGreeting(firstName);

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto w-full pb-10 px-4 md:px-0 animate-in fade-in duration-300">
      
      {/* ⚠️ Database Schema / Error Banner */}
      {error && (
        <div className="relative overflow-hidden rounded-xl border border-destructive/20 bg-destructive/5 p-4 backdrop-blur-xs">
          <div className="flex gap-3.5 items-start">
            <AlertTriangle className="h-4.5 w-4.5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="text-xs font-semibold text-destructive">Database Connection Check Warning</h5>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {error.includes("relation") ? (
                  <>
                    The table <code className="px-1 py-0.5 bg-destructive/10 rounded font-mono text-destructive">profiles</code> (or related schemas) was not found. Please verify your Supabase migrations.
                  </>
                ) : (
                  <>
                    An error occurred while connecting to database: <span className="text-destructive font-mono text-[11px]">{decodeURIComponent(error)}</span>.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 1. Welcome Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          {profile?.profile_image ? (
            <div className="h-10 w-10 rounded-full overflow-hidden border border-border/80 flex items-center justify-center shrink-0 shadow-2xs bg-secondary/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.profile_image} alt={firstName} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full border border-primary/20 bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-sm">
              {firstName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
              {greetingText}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Welcome to your academic workspace. Let&apos;s make progress on your {profile?.degree_program || 'curriculum'}!
            </p>
          </div>
        </div>
        
        {/* Dynamic Gamification Header Info */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-center">
          <Link 
            href="/leaderboard" 
            className="flex items-center gap-1.5 bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/40 rounded-lg px-2.5 py-1 transition-all"
            title="View Academic Rank"
          >
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Lvl {progress?.current_level || 1} • {getRankName(progress?.current_level || 1).split(" ")[0]}
            </span>
          </Link>
          
          <Link 
            href="/leaderboard" 
            className="flex items-center gap-1.5 bg-orange-500/5 border border-orange-500/20 hover:border-orange-500/40 rounded-lg px-2.5 py-1 transition-all"
            title="Current Study Streak"
          >
            <Flame className="h-3 w-3 text-orange-500 fill-orange-500/10" />
            <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider">
              {activityStats.currentStreak} Day Streak
            </span>
          </Link>

          <Link 
            href="/reminders" 
            className="flex items-center gap-1.5 bg-primary/5 border border-primary/20 hover:border-primary/40 rounded-lg px-2.5 py-1 transition-all"
            title="Schedule & Reminders"
          >
            <Bell className={`h-3 w-3 text-primary shrink-0 ${pendingTaskCount > 0 ? "animate-pulse" : ""}`} />
            <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
              {pendingTaskCount > 0 ? `${pendingTaskCount} Alarms` : "Alarms Active"}
            </span>
          </Link>
        </div>
      </div>

      {/* ── 2. Neuron AI Advisor Widget ────────────────────────────────────── */}
      {profile && (
        <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-r from-card to-card/90 p-4 md:p-5 shadow-xs group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-500 pointer-events-none" />
          <div className="flex items-start gap-3.5 relative z-10">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5 shadow-2xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary/80 block">Neuron AI Advisor</span>
              <h3 className="font-semibold text-foreground text-sm leading-snug">Personalized Study Pathway</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                We&apos;ve customized your Academic Workspace for <span className="font-medium text-foreground">{profile.degree_program || 'Computer Science'}</span> ({profile.semester || 'Semester 1'}). 
                {profile.interests && profile.interests.length > 0 ? (
                  <> You are currently focused on mastering <span className="font-medium text-primary">{profile.interests.slice(0, 3).join(', ')}</span>. </>
                ) : (
                  <> Fill out your academic preferences in settings to unlock custom curriculum suggestions. </>
                )}
                Maintain your <span className="font-medium text-orange-500 dark:text-orange-400">{activityStats.currentStreak} Day Streak</span> by starting a new study activity today!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Overdue Urgent Alerts (if applicable) ─────────────────────────── */}
      {overdueReminders.length > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-destructive/25 bg-destructive/5 p-4">
          <div className="absolute top-0 left-0 w-1 h-full bg-destructive/60" />
          <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shrink-0 mt-0.5">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-destructive flex items-center gap-1.5 leading-snug text-sm">
                  Immediate Attention Required
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  You have <span className="font-medium text-destructive">{overdueReminders.length} overdue task(s)</span> scheduled that have passed their deadline.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {overdueReminders.map(r => (
                    <span key={r.id} className="text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-md">
                      {r.title} ({formatDeadline(r.due_date)})
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <Link href="/reminders" className="shrink-0 w-full md:w-auto">
              <Button size="sm" variant="destructive" className="w-full md:w-auto text-xs font-medium gap-1.5 rounded-lg h-8 cursor-pointer bg-destructive/20 hover:bg-destructive/30 border border-destructive/30 text-destructive transition-all">
                Resolve Alarms <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ── Modern Onboarding Banner (Zero Data) ─────────────────────────── */}
      {showOnboarding && (
        <Card className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-card to-secondary/30 p-5 shadow-2xs">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1 max-w-xl">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Initialize Your Course Library
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Upload a syllabus, lecture presentation, or study guide in the <span className="text-foreground font-medium">Uploads</span> tab. 
                Neuron AI will instantly classify the subjects, build folder pathways, generate summaries, and schedule exam/quiz reminders automatically!
              </p>
            </div>
            <Link href="/uploads" className="shrink-0">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs rounded-lg h-8 px-3.5 cursor-pointer shadow-2xs">
                Upload First File
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* ── 3. Four Statistics Cards ───────────────────────────────────────── */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Active Subjects */}
        <Link href="/subjects" className="block group">
          <Card className="border border-border/60 bg-card/60 hover:bg-card hover:border-primary/30 transition-all duration-200 cursor-pointer rounded-xl shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-4 px-4">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active Subjects</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="text-2xl font-bold tracking-tight text-foreground">{subjectCount}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Enrolled courses</p>
            </CardContent>
          </Card>
        </Link>
        
        {/* Card 2: Study Materials */}
        <Link href="/uploads" className="block group">
          <Card className="border border-border/60 bg-card/60 hover:bg-card hover:border-primary/30 transition-all duration-200 cursor-pointer rounded-xl shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-4 px-4">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Study Materials</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="text-2xl font-bold tracking-tight text-foreground">{docCount}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Uploaded files</p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 3: Pending Alarms */}
        <Link href="/reminders" className="block group">
          <Card className="border border-border/60 bg-card/60 hover:bg-card hover:border-primary/30 transition-all duration-200 cursor-pointer rounded-xl shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-4 px-4">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pending Alarms</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="text-2xl font-bold tracking-tight text-foreground">{pendingTaskCount}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Upcoming deadlines</p>
            </CardContent>
          </Card>
        </Link>

        {/* Card 4: AI Summaries */}
        <Link href="/subjects" className="block group">
          <Card className="border border-border/60 bg-card/60 hover:bg-card hover:border-primary/30 transition-all duration-200 cursor-pointer rounded-xl shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-4 px-4">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">AI Summaries</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="text-2xl font-bold tracking-tight text-foreground">{aiCompletedCount}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{getAiSummarySubtitle()}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── 4. Main Dashboard Grid ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 items-start">
        
        {/* Left Column: Recent Uploads */}
        <Card className="lg:col-span-4 border border-border/60 bg-card/50 rounded-xl shadow-2xs backdrop-blur-xs">
          <CardHeader className="py-3 px-4 border-b border-border/40 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Uploads</CardTitle>
            <Link 
              href="/uploads" 
              className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5 transition-all"
            >
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-3">
            {recentDocs && recentDocs.length > 0 ? (
              <div className="space-y-1.5">
                {recentDocs.map((doc) => {
                  const subjectName = (Array.isArray(doc.subjects) ? doc.subjects[0]?.name : (doc.subjects as any)?.name) || "General Notes";
                  return (
                    <Link
                      key={doc.id}
                      href="/uploads"
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30 bg-background/50 hover:bg-background/90 hover:border-primary/20 transition-all group cursor-pointer"
                    >
                      <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary group-hover:scale-105 transition-transform" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate text-foreground leading-snug group-hover:text-primary transition-colors">
                          {doc.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary/90">
                            <Bookmark className="h-2.5 w-2.5" />
                            {subjectName}
                          </span>
                          <span>•</span>
                          <span>{formatRelativeTime(doc.created_at)}</span>
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 px-4 text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
                <div className="h-10 w-10 rounded-full bg-muted/30 border border-border/40 flex items-center justify-center text-muted-foreground/50">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground text-xs">No uploads yet</p>
                  <p className="text-[11px] text-muted-foreground max-w-xs leading-normal">
                    Uploaded course files and lecture materials will appear here.
                  </p>
                </div>
                <Link href="/uploads" className="mt-1">
                  <Button size="sm" variant="outline" className="h-7 text-[11px] px-3 gap-1.5 rounded-lg border-border/60 hover:border-primary/30">
                    <Plus className="h-3 w-3" /> Upload File
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Academic Tasks & Upcoming Deadlines */}
        <div className="lg:col-span-3 flex flex-col gap-4">

          {/* Academic Tasks / Completion Rate */}
          <Card className="border border-border/60 bg-card/50 rounded-xl shadow-2xs backdrop-blur-xs">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1 text-left min-w-0">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-primary" /> Completion Rate
                </span>
                <h3 className="text-xs font-semibold leading-tight text-foreground">Academic Tasks</h3>
                {totalTaskCount > 0 ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                    You completed <span className="font-semibold text-foreground">{completedTaskCount}</span> of your <span className="font-semibold text-foreground">{totalTaskCount}</span> reminders.
                  </p>
                ) : (
                  <p className="text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                    No academic tasks yet. Add reminders to start tracking your progress.
                  </p>
                )}
              </div>

              {/* Circular SVG Progress Indicator */}
              <div className="relative flex items-center justify-center shrink-0 w-14 h-14">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    fill="transparent"
                    className="text-muted/30"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 22}
                    strokeDashoffset={2 * Math.PI * 22 - (2 * Math.PI * 22 * completionPercentage) / 100}
                    strokeLinecap="round"
                    className="text-primary transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-bold tracking-tight leading-none text-foreground">{completionPercentage}%</span>
                  <span className="text-[7px] font-medium text-muted-foreground uppercase leading-none mt-0.5">Done</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Deadlines Widget */}
          <Card className="border border-border/60 bg-card/50 rounded-xl shadow-2xs backdrop-blur-xs">
            <CardHeader className="py-3 px-4 border-b border-border/40 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-primary" /> Upcoming Deadlines
              </CardTitle>
              <Link href="/reminders" className="text-[11px] font-medium text-primary hover:underline transition-all">
                View Schedule
              </Link>
            </CardHeader>
            <CardContent className="p-3">
              {upcomingReminders && upcomingReminders.length > 0 ? (
                <div className="space-y-2">
                  {upcomingReminders.map((task) => (
                    <div key={task.id} className="flex flex-col gap-1 p-2.5 rounded-lg border border-border/30 bg-background/50 hover:bg-background/90 transition-all">
                      <div className="flex items-start justify-between gap-2.5">
                        <p className="text-xs font-medium truncate leading-snug text-foreground flex-1">{task.title}</p>
                        
                        {/* Priority level */}
                        <span className={`text-[8px] font-bold px-1.5 py-0.25 rounded border shrink-0 uppercase tracking-wider ${
                          task.priority === 'high'
                            ? 'bg-destructive/10 text-destructive border-destructive/20'
                            : task.priority === 'medium'
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-muted/50 border-border/60 text-muted-foreground'
                        }`}>
                          {task.priority || 'medium'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[10px] text-muted-foreground gap-2 pt-1 border-t border-border/20 mt-0.5">
                        <span className="flex items-center gap-1 font-normal text-[10px]">
                          <Clock className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                          {formatDeadline(task.due_date)}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          {task.subjects && (
                            <span className="text-[9px] font-semibold text-primary/90">
                              {Array.isArray(task.subjects) 
                                ? task.subjects[0]?.name 
                                : task.subjects?.name}
                            </span>
                          )}
                          <span className={`text-[8px] font-medium px-1.5 py-0.25 rounded uppercase border ${
                            task.reminder_type === "exam" 
                              ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" 
                              : task.reminder_type === "quiz"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                              : task.reminder_type === "presentation"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : task.reminder_type === "assignment"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" 
                              : "bg-muted/50 border-border/60 text-muted-foreground"
                          }`}>
                            {task.reminder_type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 px-4 text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <CheckCircle2 className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground text-xs">All caught up!</p>
                    <p className="text-[11px] text-muted-foreground">No upcoming deadlines on your schedule.</p>
                  </div>
                  <Link href="/reminders" className="mt-1">
                    <Button size="sm" variant="outline" className="h-7 text-[11px] px-3 gap-1.5 rounded-lg border-border/60 hover:border-primary/30">
                      <Plus className="h-3 w-3" /> Add Reminder
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  );
}
