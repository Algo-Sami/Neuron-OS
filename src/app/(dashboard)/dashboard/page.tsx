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
  Flame
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
        <p className="text-muted-foreground">Please sign in to view your dashboard.</p>
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

  // ─── BATCH 2: Parallel — counts + all reminders + recent docs ───────────────
  const nowIso = new Date().toISOString();

  const [
    subjectCountResult,
    docCountResult,
    aiInsightCountResult,
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
      .is('deleted_at', null),
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('summary_status', 'completed')
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
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(4),
    supabase
      .from('reminders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed_status', true),
  ]);

  const subjectCount = subjectCountResult.count;
  const docCount = docCountResult.count;
  const aiInsightCount = aiInsightCountResult.count;
  const recentDocs = recentDocsResult.data;
  const completedTaskCount = completedTaskCountResult.count;

  // Filter reminders client-side from single query
  const allActiveReminders = (remindersResult.data as unknown as ReminderItem[]) || [];
  const pendingTaskCount = allActiveReminders.length;
  const overdueReminders = allActiveReminders.filter(r => r.due_date < nowIso).slice(0, 3);
  const upcomingReminders = allActiveReminders.filter(r => r.due_date >= nowIso).slice(0, 4);

  const totalTaskCount = (pendingTaskCount || 0) + (completedTaskCount || 0);
  const completionPercentage = totalTaskCount > 0 
    ? Math.round(((completedTaskCount || 0) / totalTaskCount) * 100) 
    : 0;

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.max(1, Math.floor(diffMs / 1000 / 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
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
  
  // Dynamic greetings calculation based on hour of day
  const firstName = profile?.full_name?.split(" ")[0] || "Scholar";
  const getGreeting = (name: string) => {
    const hour = new Date().getHours();
    if (hour < 12) return `Good morning, ${name} 🌅`;
    if (hour < 17) return `Ready to study today, ${name}? 📚`;
    return `Good evening, ${name} 🌌`;
  };
  const greetingText = getGreeting(firstName);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-10 px-4 md:px-0 animate-in fade-in duration-300">
      
      {/* ⚠️ Database Schema / Error Banner */}
      {error && (
        <div className="relative overflow-hidden rounded-xl border border-destructive/20 bg-destructive/5 p-5 backdrop-blur-md">
          <div className="flex gap-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="text-xs font-bold uppercase tracking-wider text-destructive">Database Connection Check Warning</h5>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {error.includes("relation") ? (
                  <>
                    The table <code className="px-1 py-0.5 bg-destructive/10 rounded font-mono text-destructive">profiles</code> (or related gamification/subject schemas) does not exist in your database. Run the migration scripts inside <span className="font-bold">supabase/migrations/</span> to generate the required database tables.
                  </>
                ) : (
                  <>
                    An error occurred while connecting to database: <span className="text-destructive font-mono text-[11px]">{decodeURIComponent(error)}</span>. Please verify your Supabase tables and RLS security credentials.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3.5">
          {profile?.profile_image && (
            <div className="h-11 w-11 rounded-full overflow-hidden border border-border/80 flex items-center justify-center shrink-0 shadow-inner bg-secondary/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.profile_image} alt={firstName} className="h-full w-full object-cover" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground bg-gradient-to-r from-foreground via-foreground to-foreground/75 bg-clip-text">
              {greetingText}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Welcome to your academic workspace. Let&apos;s make progress on your {profile?.degree_program || 'major'} curriculum!</p>
          </div>
        </div>
        
        {/* Dynamic Gamification Header Info */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-center">
          <Link href="/leaderboard" className="flex items-center gap-1.5 bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/40 rounded-lg px-3 py-1 transition-all">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">
              Lvl {progress?.current_level || 1} • {getRankName(progress?.current_level || 1).split(" ")[0]}
            </span>
          </Link>
          
          <Link href="/leaderboard" className="flex items-center gap-1.5 bg-orange-500/5 border border-orange-500/20 hover:border-orange-500/40 rounded-lg px-3 py-1 transition-all">
            <Flame className="h-3 w-3 text-orange-500 fill-orange-500/10" />
            <span className="text-[10px] font-medium text-orange-400 uppercase tracking-wider">
              {activityStats.currentStreak} Day Streak
            </span>
          </Link>

          <Link href="/reminders" className="flex items-center gap-1.5 bg-primary/5 border border-primary/20 hover:border-primary/40 rounded-lg px-3 py-1 transition-all">
            <Bell className="h-3 w-3 text-primary shrink-0 animate-pulse" />
            <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
              Alarms Active
            </span>
          </Link>
        </div>
      </div>

      {/* Intelligent AI Advisor Widget */}
      {profile && (
        <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-gradient-to-r from-card/80 to-card p-5 shadow-sm backdrop-blur-xs group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/8 transition-all duration-500" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-[9px] font-bold uppercase tracking-wider text-primary/80">Neuron AI Advisor</h4>
              <h3 className="font-semibold text-foreground text-sm leading-snug">Personalized Study Pathway</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                We&apos;ve customized your Academic Workspace for <span className="font-semibold text-foreground">{profile.degree_program || 'Computer Science'}</span> ({profile.semester || 'Semester 1'}). 
                {profile.interests && profile.interests.length > 0 ? (
                  <> You are currently focused on mastering <span className="font-medium text-primary/95">{profile.interests.slice(0, 3).join(', ')}</span>. </>
                ) : (
                  <> Fill out your academic preferences in settings to unlock custom curriculum suggestions. </>
                )}
                Maintain your <span className="font-medium text-orange-400">{activityStats.currentStreak} Day Streak</span> by starting a new study activity today!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* OVERDUE URGENT ALERTS */}
      {overdueReminders.length > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-destructive/20 bg-destructive/5 p-5">
          <div className="absolute top-0 left-0 w-1 h-full bg-destructive/50" />
          <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shrink-0">
                <AlertTriangle className="h-4.5 w-4.5 animate-bounce" />
              </div>
              <div>
                <h3 className="font-semibold text-destructive flex items-center gap-1.5 leading-snug text-sm">
                  Immediate Attention Required
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  You have <span className="font-medium text-destructive">{overdueReminders.length} overdue task(s)</span> scheduled that have passed their deadline. 
                  Check and update them in your schedule tracker.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {overdueReminders.map(r => (
                    <span key={r.id} className="text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/15 px-2.5 py-0.5 rounded-md">
                      {r.title} ({formatDeadline(r.due_date)})
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <Link href="/reminders" className="shrink-0 w-full md:w-auto">
              <Button size="sm" variant="destructive" className="w-full md:w-auto text-xs font-medium gap-1.5 rounded-lg h-8 cursor-pointer bg-destructive/20 hover:bg-destructive/30 border border-destructive/35 text-destructive transition-all">
                Resolve Alarms <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Modern Onboarding */}
      {showOnboarding && (
        <Card className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-card to-secondary/35 p-6 shadow-sm">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1.5 max-w-xl">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Sparkles className="h-4.5 w-4.5 text-primary" />
                Initialize Your Course Library
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Upload a syllabus, lecture presentation, or study guide in the <span className="text-foreground font-medium">Uploads</span> tab. 
                Neuron AI will instantly classify the subjects, build folder pathways, write summaries, and schedule exam/quiz reminders automatically!
              </p>
            </div>
            <Link href="/uploads" className="shrink-0">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-lg h-8 px-4 cursor-pointer shadow-sm">
                Upload First File
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/subjects" className="block group">
          <Card className="border border-border/60 bg-card/60 hover:bg-card hover:border-primary/20 transition-all duration-200 cursor-pointer rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active Subjects</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-foreground">{subjectCount || 0}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Enrolled courses</p>
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/uploads" className="block group">
          <Card className="border border-border/60 bg-card/60 hover:bg-card hover:border-primary/20 transition-all duration-200 cursor-pointer rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Study Materials</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-foreground">{docCount || 0}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Files uploaded</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/reminders" className="block group">
          <Card className="border border-border/60 bg-card/60 hover:bg-card hover:border-primary/20 transition-all duration-200 cursor-pointer rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pending Alarms</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-foreground">{pendingTaskCount || 0}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Upcoming deadlines</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/summaries" className="block group">
          <Card className="border border-border/60 bg-card/60 hover:bg-card hover:border-primary/20 transition-all duration-200 cursor-pointer rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">AI Summaries</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-foreground">{aiInsightCount || 0}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Reviewed notes and insights</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-7 items-start">
        
        {/* Left Widget: Recent Uploads */}
        <Card className="lg:col-span-4 border border-border/60 bg-card/40 rounded-xl shadow-2xs backdrop-blur-xs">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold text-foreground">Recent Uploads</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {recentDocs && recentDocs.length > 0 ? (
              <div className="space-y-2">
                {recentDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3.5 p-2 rounded-lg border border-border/40 bg-background/55 hover:bg-background/80 hover:border-primary/10 transition-all group">
                    <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-primary group-hover:scale-105 transition-transform" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate text-foreground leading-snug">{doc.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <span className="flex items-center gap-1 text-[9px] font-bold text-primary">
                          <Bookmark className="h-2.5 w-2.5" />
                          {(Array.isArray(doc.subjects) ? doc.subjects[0]?.name : (doc.subjects as any)?.name) || "General Notes"}
                        </span>
                        <span>•</span>
                        <span>{formatRelativeTime(doc.created_at)}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-xs flex flex-col items-center justify-center gap-1.5">
                <AlertTriangle className="h-6 w-6 text-muted-foreground/30 mb-1" />
                <p className="font-semibold text-foreground text-sm">No uploads recorded</p>
                <p className="text-xs max-w-xs leading-normal">Upload notes in the Uploads section to trigger AI processing.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Widgets: Productivity Stats & Upcoming Deadlines */}
        <div className="lg:col-span-3 flex flex-col gap-5">

          {/* Premium Circular SVG Progress Widget */}
          <Card className="border border-border/60 bg-card/40 rounded-xl shadow-2xs backdrop-blur-xs">
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div className="space-y-1 flex-1 text-left">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-primary" /> Completion Rate
                </span>
                <h3 className="text-sm font-semibold leading-tight text-foreground">Academic Tasks</h3>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  You completed <span className="font-medium text-foreground">{completedTaskCount || 0}</span> of your <span className="font-medium text-foreground">{totalTaskCount}</span> reminders.
                </p>
              </div>

              {/* Breathtaking SVG circular progress */}
              <div className="relative flex items-center justify-center shrink-0 w-16 h-16">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="25"
                    stroke="oklch(0.20 0.02 245)"
                    strokeWidth="3.5"
                    fill="transparent"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="25"
                    stroke="var(--primary)"
                    strokeWidth="3.5"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 25}
                    strokeDashoffset={2 * Math.PI * 25 - (2 * Math.PI * 25 * completionPercentage) / 100}
                    strokeLinecap="round"
                    className="text-primary transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-bold tracking-tighter leading-none">{completionPercentage}%</span>
                  <span className="text-[7px] font-medium text-muted-foreground uppercase leading-none mt-0.5">Done</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Deadlines Widget */}
          <Card className="border border-border/60 bg-card/40 rounded-xl shadow-2xs backdrop-blur-xs">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-primary" /> Upcoming Deadlines
                </span>
                <Link href="/reminders" className="text-[10px] font-medium text-primary hover:underline transition-all">
                  View Calendar
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {upcomingReminders && upcomingReminders.length > 0 ? (
                <div className="space-y-2.5">
                  {upcomingReminders.map((task) => (
                    <div key={task.id} className="flex flex-col gap-1.5 p-2 rounded-lg border border-border/40 bg-background/55 hover:bg-background/85 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-semibold truncate leading-snug text-foreground flex-1">{task.title}</p>
                        
                        {/* Priority level */}
                        <span className={`text-[8px] font-bold px-1.5 py-0.25 rounded border shrink-0 uppercase tracking-wider ${
                          task.priority === 'high'
                            ? 'bg-destructive/10 text-destructive border-destructive/15'
                            : task.priority === 'medium'
                            ? 'bg-primary/10 text-primary border-primary/15'
                            : 'bg-muted/40 border-border text-muted-foreground'
                        }`}>
                          {task.priority || 'medium'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[10px] text-muted-foreground gap-2 pt-1.5 border-t border-border/20 mt-0.5">
                        <span className="flex items-center gap-1 font-medium text-[9px]">
                          <Clock className="h-3 w-3 shrink-0" />
                          {formatDeadline(task.due_date)}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          {task.subjects && (
                            <span className="text-[9px] font-bold text-primary">
                              {Array.isArray(task.subjects) 
                                ? task.subjects[0]?.name 
                                : task.subjects?.name}
                            </span>
                          )}
                          <span className={`text-[8px] font-semibold px-1.5 py-0.25 rounded uppercase border ${
                            task.reminder_type === "exam" 
                              ? "bg-red-500/10 text-red-400 border-red-500/15" 
                              : task.reminder_type === "quiz"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/15"
                              : task.reminder_type === "presentation"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/15"
                              : task.reminder_type === "assignment"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/15" 
                              : "bg-muted/40 border-border text-muted-foreground"
                          }`}>
                            {task.reminder_type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground text-xs flex flex-col items-center justify-center gap-1.5">
                  <Clock className="h-5 w-5 text-muted-foreground/30" />
                  <p>All caught up! No upcoming deadlines.</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  );
}
