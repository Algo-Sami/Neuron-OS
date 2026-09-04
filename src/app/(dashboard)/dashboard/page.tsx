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
      .limit(5),
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
    <div
      className="flex flex-col gap-4 max-w-5xl mx-auto w-full pb-10 px-4 md:px-0 select-none"
      style={{ fontFamily: '"Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif' }}
    >
      
      {/* ⚠️ Database Schema / Error Banner */}
      {error && (
        <div className="rounded-md border border-[#f1aeb5] bg-[#fdf3f4] p-3.5">
          <div className="flex gap-3 items-start">
            <AlertTriangle className="h-4 w-4 text-[#d13438] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h5 className="text-xs font-semibold text-[#d13438]">Database Connection Check Warning</h5>
              <p className="text-xs text-[#605e5c] leading-relaxed">
                {error.includes("relation") ? (
                  <>
                    The table <code className="px-1 py-0.5 bg-[#f8d7da] rounded font-mono text-[#a80000]">profiles</code> (or related schemas) was not found. Please verify your Supabase migrations.
                  </>
                ) : (
                  <>
                    An error occurred while connecting to database: <span className="text-[#a80000] font-mono text-xs">{decodeURIComponent(error)}</span>.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 1. Welcome Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#d0d4db] pb-3.5">
        <div className="flex items-center gap-3">
          {profile?.profile_image ? (
            <div className="h-10 w-10 rounded-full overflow-hidden border border-[#d0d4db] flex items-center justify-center shrink-0 bg-[#ffffff]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={profile.profile_image} alt={firstName} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full border border-[#d0d4db] bg-[#eff6fc] flex items-center justify-center shrink-0 text-[#0078d4] font-semibold text-sm">
              {firstName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#201f1e]">
              {greetingText}
            </h1>
            <p className="text-xs text-[#605e5c] mt-0.5">
              Welcome to your academic workspace. Let&apos;s make progress on your {profile?.degree_program || 'curriculum'}!
            </p>
          </div>
        </div>
        
        {/* Dynamic Gamification Header Info (Windows Explorer Style Status Tags) */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-center">
          <Link 
            href="/leaderboard" 
            className="flex items-center gap-1.5 bg-[#ffffff] border border-[#d0d4db] hover:bg-[#f3f2f1] hover:border-[#a19f9d] rounded-md px-2.5 py-1 transition-colors"
            title="View Academic Rank"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#0078d4]" />
            <span className="text-xs font-medium text-[#201f1e]">
              Lvl {progress?.current_level || 1} • {getRankName(progress?.current_level || 1).split(" ")[0]}
            </span>
          </Link>
          
          <Link 
            href="/leaderboard" 
            className="flex items-center gap-1.5 bg-[#ffffff] border border-[#d0d4db] hover:bg-[#f3f2f1] hover:border-[#a19f9d] rounded-md px-2.5 py-1 transition-colors"
            title="Current Study Streak"
          >
            <Flame className="h-3.5 w-3.5 text-[#d83b01]" />
            <span className="text-xs font-medium text-[#201f1e]">
              {activityStats.currentStreak} Day Streak
            </span>
          </Link>

          <Link 
            href="/reminders" 
            className="flex items-center gap-1.5 bg-[#ffffff] border border-[#d0d4db] hover:bg-[#f3f2f1] hover:border-[#a19f9d] rounded-md px-2.5 py-1 transition-colors"
            title="Schedule & Reminders"
          >
            <Bell className={`h-3.5 w-3.5 text-[#0078d4] shrink-0 ${pendingTaskCount > 0 ? "animate-pulse" : ""}`} />
            <span className="text-xs font-medium text-[#201f1e]">
              {pendingTaskCount > 0 ? `${pendingTaskCount} Alarms` : "Alarms Active"}
            </span>
          </Link>
        </div>
      </div>

      {/* ── 2. Neuron AI Advisor Widget ────────────────────────────────────── */}
      {profile && (
        <div className="rounded-md border border-[#d0d4db] bg-[#ffffff] p-4 shadow-xs">
          <div className="flex items-start gap-3 relative z-10">
            <div className="h-7 w-7 rounded bg-[#eff6fc] border border-[#c7e0f4] flex items-center justify-center text-[#0078d4] shrink-0 mt-0.5">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0078d4] block">Neuron AI Advisor</span>
              <h3 className="font-semibold text-[#201f1e] text-sm leading-snug">Personalized Study Pathway</h3>
              <p className="text-xs text-[#605e5c] leading-relaxed mt-0.5">
                We&apos;ve customized your Academic Workspace for <span className="font-semibold text-[#201f1e]">{profile.degree_program || 'Computer Science'}</span> ({profile.semester || 'Semester 1'}). 
                {profile.interests && profile.interests.length > 0 ? (
                  <> You are currently focused on mastering <span className="font-medium text-[#0078d4]">{profile.interests.slice(0, 3).join(', ')}</span>. </>
                ) : (
                  <> Fill out your academic preferences in settings to unlock custom curriculum suggestions. </>
                )}
                Maintain your <span className="font-semibold text-[#d83b01]">{activityStats.currentStreak} Day Streak</span> by starting a new study activity today!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Overdue Urgent Alerts (if applicable) ─────────────────────────── */}
      {overdueReminders.length > 0 && (
        <div className="rounded-md border border-[#f1aeb5] bg-[#fdf3f4] p-3.5">
          <div className="flex items-start md:items-center justify-between gap-3 flex-col md:flex-row">
            <div className="flex items-start gap-3">
              <div className="h-7 w-7 rounded bg-[#f8d7da] border border-[#f1aeb5] flex items-center justify-center text-[#d13438] shrink-0 mt-0.5">
                <AlertTriangle className="h-3.5 w-3.5" />
              </div>
              <div>
                <h3 className="font-semibold text-[#a80000] flex items-center gap-1.5 leading-snug text-sm">
                  Immediate Attention Required
                </h3>
                <p className="text-xs text-[#605e5c] leading-relaxed mt-0.5">
                  You have <span className="font-semibold text-[#a80000]">{overdueReminders.length} overdue task(s)</span> scheduled that have passed their deadline.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {overdueReminders.map(r => (
                    <span key={r.id} className="text-xs font-normal bg-[#ffffff] text-[#a80000] border border-[#f1aeb5] px-2 py-0.5 rounded">
                      {r.title} ({formatDeadline(r.due_date)})
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <Link href="/reminders" className="shrink-0 w-full md:w-auto">
              <Button size="sm" className="w-full md:w-auto text-xs font-medium gap-1.5 rounded h-7.5 cursor-pointer bg-[#d13438] hover:bg-[#a80000] text-white transition-colors">
                Resolve Alarms <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ── Modern Onboarding Banner (Zero Data) ─────────────────────────── */}
      {showOnboarding && (
        <div className="rounded-md border border-[#d0d4db] bg-[#ffffff] p-4 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
            <div className="space-y-0.5 max-w-xl">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-[#201f1e]">
                <Sparkles className="h-4 w-4 text-[#0078d4]" />
                Initialize Your Course Library
              </h2>
              <p className="text-xs text-[#605e5c] leading-relaxed">
                Upload a syllabus, lecture presentation, or study guide in the <span className="text-[#201f1e] font-semibold">Uploads</span> tab. 
                Neuron AI will instantly classify the subjects, build folder pathways, generate summaries, and schedule exam/quiz reminders automatically!
              </p>
            </div>
            <Link href="/uploads" className="shrink-0">
              <Button className="bg-[#0078d4] hover:bg-[#106ebe] text-white font-medium text-xs rounded h-7.5 px-3.5 cursor-pointer shadow-xs transition-colors">
                Upload First File
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ── 3. Four Statistics Cards ───────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Active Subjects */}
        <Link href="/subjects" className="block group">
          <div className="border border-[#d0d4db] bg-[#ffffff] hover:border-[#0078d4] hover:shadow-xs transition-colors cursor-pointer rounded-md p-3.5">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-medium text-[#605e5c]">Active Subjects</span>
              <BookOpen className="h-4 w-4 text-[#605e5c] group-hover:text-[#0078d4] transition-colors" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-[#201f1e]">{subjectCount}</div>
              <p className="text-xs text-[#605e5c] mt-0.5">Enrolled courses</p>
            </div>
          </div>
        </Link>
        
        {/* Card 2: Study Materials */}
        <Link href="/uploads" className="block group">
          <div className="border border-[#d0d4db] bg-[#ffffff] hover:border-[#0078d4] hover:shadow-xs transition-colors cursor-pointer rounded-md p-3.5">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-medium text-[#605e5c]">Study Materials</span>
              <FileText className="h-4 w-4 text-[#605e5c] group-hover:text-[#0078d4] transition-colors" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-[#201f1e]">{docCount}</div>
              <p className="text-xs text-[#605e5c] mt-0.5">Uploaded files</p>
            </div>
          </div>
        </Link>

        {/* Card 3: Pending Alarms */}
        <Link href="/reminders" className="block group">
          <div className="border border-[#d0d4db] bg-[#ffffff] hover:border-[#0078d4] hover:shadow-xs transition-colors cursor-pointer rounded-md p-3.5">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-medium text-[#605e5c]">Pending Alarms</span>
              <Clock className="h-4 w-4 text-[#605e5c] group-hover:text-[#0078d4] transition-colors" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-[#201f1e]">{pendingTaskCount}</div>
              <p className="text-xs text-[#605e5c] mt-0.5">Upcoming deadlines</p>
            </div>
          </div>
        </Link>

        {/* Card 4: AI Summaries */}
        <Link href="/subjects" className="block group">
          <div className="border border-[#d0d4db] bg-[#ffffff] hover:border-[#0078d4] hover:shadow-xs transition-colors cursor-pointer rounded-md p-3.5">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-medium text-[#605e5c]">AI Summaries</span>
              <Zap className="h-4 w-4 text-[#605e5c] group-hover:text-[#0078d4] transition-colors" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight text-[#201f1e]">{aiCompletedCount}</div>
              <p className="text-xs text-[#605e5c] mt-0.5">{getAiSummarySubtitle()}</p>
            </div>
          </div>
        </Link>
      </div>

      {/* ── 4. Main Dashboard Grid ─────────────────────────────────────────── */}
      <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Left Column: Recent Uploads */}
        <div className="lg:col-span-4 border border-[#d0d4db] bg-[#ffffff] rounded-md shadow-xs flex flex-col h-full min-h-[340px]">
          <div className="py-2.5 px-3.5 border-b border-[#e1dfdd] flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-[#201f1e]">Recent Uploads</span>
            <Link 
              href="/uploads" 
              className="text-xs font-medium text-[#0078d4] hover:underline flex items-center gap-0.5 transition-colors"
            >
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="p-3 flex-1 flex flex-col justify-between">
            {recentDocs && recentDocs.length > 0 ? (
              <>
                <div className="space-y-1.5 flex-1">
                  {recentDocs.map((doc) => {
                    const subjectName = (Array.isArray(doc.subjects) ? doc.subjects[0]?.name : (doc.subjects as any)?.name) || "General Notes";
                    return (
                      <Link
                        key={doc.id}
                        href="/uploads"
                        className="flex items-center gap-3 p-2.5 rounded border border-[#edebe9] bg-[#ffffff] hover:bg-[#f8fafc] hover:border-[#d0d4db] transition-colors group cursor-pointer"
                      >
                        <div className="h-8 w-8 rounded bg-[#eff6fc] border border-[#c7e0f4] flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-[#0078d4]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate text-[#201f1e] leading-snug group-hover:text-[#0078d4] transition-colors">
                            {doc.title}
                          </p>
                          <p className="text-[11px] text-[#605e5c] mt-0.5 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-normal text-[#0078d4]">
                              <Bookmark className="h-2.5 w-2.5" />
                              {subjectName}
                            </span>
                            <span>•</span>
                            <span>{formatRelativeTime(doc.created_at)}</span>
                          </p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-[#a19f9d] group-hover:text-[#0078d4] transition-colors shrink-0" />
                      </Link>
                    );
                  })}
                </div>

                {/* Quick Upload action row at bottom */}
                <div className="pt-2.5 mt-auto border-t border-[#f3f2f1] flex items-center justify-between shrink-0">
                  <span className="text-[11px] text-[#605e5c]">
                    {recentDocs.length} recent file{recentDocs.length > 1 ? 's' : ''}
                  </span>
                  <Link href="/uploads">
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2.5 gap-1 text-[#0078d4] hover:bg-[#eff6fc] hover:text-[#0078d4] rounded">
                      <Plus className="h-3 w-3" /> Upload New File
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-center py-8 px-4 text-[#605e5c] text-xs flex flex-col items-center justify-center gap-2 my-auto">
                <div className="h-10 w-10 rounded-full bg-[#f3f2f1] border border-[#d0d4db] flex items-center justify-center text-[#605e5c]">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="font-semibold text-[#201f1e] text-xs">No uploads yet</p>
                  <p className="text-xs text-[#605e5c] max-w-xs leading-normal">
                    Uploaded course files and lecture materials will appear here.
                  </p>
                </div>
                <Link href="/uploads" className="mt-2">
                  <Button size="sm" variant="outline" className="h-7.5 text-xs px-3.5 gap-1.5 rounded border-[#d0d4db] hover:border-[#0078d4] hover:bg-[#eff6fc] text-[#201f1e]">
                    <Plus className="h-3 w-3" /> Upload File
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Academic Tasks & Upcoming Deadlines */}
        <div className="lg:col-span-3 flex flex-col gap-3.5">

          {/* Academic Tasks / Completion Rate */}
          <div className="border border-[#d0d4db] bg-[#ffffff] rounded-md p-3.5 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5 flex-1 text-left min-w-0">
                <span className="text-[10px] font-semibold text-[#0078d4] uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Completion Rate
                </span>
                <h3 className="text-xs font-semibold leading-tight text-[#201f1e]">Academic Tasks</h3>
                {totalTaskCount > 0 ? (
                  <p className="text-xs leading-relaxed text-[#605e5c] mt-0.5">
                    You completed <span className="font-semibold text-[#201f1e]">{completedTaskCount}</span> of your <span className="font-semibold text-[#201f1e]">{totalTaskCount}</span> reminders.
                  </p>
                ) : (
                  <p className="text-xs leading-relaxed text-[#605e5c] mt-0.5">
                    No academic tasks yet. Add reminders to start tracking your progress.
                  </p>
                )}
              </div>

              {/* Circular SVG Progress Indicator */}
              <div className="relative flex items-center justify-center shrink-0 w-13 h-13">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="26"
                    cy="26"
                    r="20"
                    stroke="#edebe9"
                    strokeWidth="3"
                    fill="transparent"
                  />
                  <circle
                    cx="26"
                    cy="26"
                    r="20"
                    stroke="#0078d4"
                    strokeWidth="3"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 20}
                    strokeDashoffset={2 * Math.PI * 20 - (2 * Math.PI * 20 * completionPercentage) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-bold tracking-tight leading-none text-[#201f1e]">{completionPercentage}%</span>
                  <span className="text-[7px] font-medium text-[#605e5c] uppercase leading-none mt-0.5">Done</span>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Deadlines Widget */}
          <div className="border border-[#d0d4db] bg-[#ffffff] rounded-md shadow-xs">
            <div className="py-2.5 px-3.5 border-b border-[#e1dfdd] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#201f1e] flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-[#0078d4]" /> Upcoming Deadlines
              </span>
              <Link href="/reminders" className="text-xs font-medium text-[#0078d4] hover:underline transition-colors">
                View Schedule
              </Link>
            </div>
            <div className="p-3">
              {upcomingReminders && upcomingReminders.length > 0 ? (
                <div className="space-y-1.5">
                  {upcomingReminders.map((task) => (
                    <div key={task.id} className="flex flex-col gap-1 p-2 rounded border border-[#edebe9] bg-[#ffffff] hover:bg-[#f8fafc] hover:border-[#d0d4db] transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium truncate leading-snug text-[#201f1e] flex-1">{task.title}</p>
                        
                        {/* Priority level */}
                        <span className={`text-[9px] font-semibold px-1.5 py-0.25 rounded border shrink-0 uppercase tracking-wider ${
                          task.priority === 'high'
                            ? 'bg-[#fdf3f4] text-[#a80000] border-[#f1aeb5]'
                            : task.priority === 'medium'
                            ? 'bg-[#eff6fc] text-[#0078d4] border-[#c7e0f4]'
                            : 'bg-[#f3f2f1] border-[#d0d4db] text-[#605e5c]'
                        }`}>
                          {task.priority || 'medium'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[11px] text-[#605e5c] gap-2 pt-1 border-t border-[#edebe9] mt-0.5">
                        <span className="flex items-center gap-1 font-normal text-[11px]">
                          <Clock className="h-3 w-3 shrink-0 text-[#605e5c]" />
                          {formatDeadline(task.due_date)}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          {task.subjects && (
                            <span className="text-[10px] font-medium text-[#0078d4]">
                              {Array.isArray(task.subjects) 
                                ? task.subjects[0]?.name 
                                : task.subjects?.name}
                            </span>
                          )}
                          <span className={`text-[9px] font-medium px-1.5 py-0.25 rounded uppercase border ${
                            task.reminder_type === "exam" 
                              ? "bg-[#fdf3f4] text-[#a80000] border-[#f1aeb5]" 
                              : task.reminder_type === "quiz"
                              ? "bg-[#f3e8ff] text-[#6b21a8] border-[#e9d5ff]"
                              : task.reminder_type === "presentation"
                              ? "bg-[#fff8e6] text-[#b45309] border-[#fef08a]"
                              : task.reminder_type === "assignment"
                              ? "bg-[#eff6fc] text-[#0078d4] border-[#c7e0f4]" 
                              : "bg-[#f3f2f1] border-[#d0d4db] text-[#605e5c]"
                          }`}>
                            {task.reminder_type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 px-4 text-[#605e5c] text-xs flex flex-col items-center justify-center gap-1.5">
                  <div className="h-8 w-8 rounded-full bg-[#e6f4ea] border border-[#ceead6] flex items-center justify-center text-[#137333]">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[#201f1e] text-xs">All caught up!</p>
                    <p className="text-xs text-[#605e5c]">No upcoming deadlines on your schedule.</p>
                  </div>
                  <Link href="/reminders" className="mt-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs px-3 gap-1.5 rounded border-[#d0d4db] hover:border-[#0078d4] hover:bg-[#eff6fc] text-[#201f1e]">
                      <Plus className="h-3 w-3" /> Add Reminder
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
