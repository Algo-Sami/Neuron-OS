import { createClient } from "@/lib/supabase/server";
import { 
  getDynamicActivityStats, 
  DEFAULT_ACHIEVEMENTS
} from "@/services/gamification/rewards";
import { getISOWeekStartDate } from "@/services/gamification/weekly-scores";
import { getCohortLeaderboard } from "@/actions/leaderboard";
import { getCohortSharedFiles, CohortSharedFile } from "@/actions/sharing";
import { LeaderboardClient } from "@/components/gamification/leaderboard-client";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Leaderboard & Trophy Room - Neuron",
  description: "View real-time student rankings, daily challenges, active streaks, and monthly champion rewards."
};

interface UserProgressData {
  total_xp: number;
  monthly_xp: number;
  current_level: number;
  quiz_accuracy: number;
  completed_quizzes_count: number;
  total_correct_answers: number;
  total_questions_attempted: number;
  current_streak: number;
  highest_streak: number;
  daily_challenges: {
    date: string;
    completed: {
      focus: boolean;
      quiz: boolean;
      share: boolean;
    };
  } | null;
  last_check_in_date: string | null;
}

interface RawUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  university: string | null;
  major: string | null;
  user_progress: UserProgressData | UserProgressData[] | null;
}

interface RawChampion {
  rank: number;
  total_xp: number;
  user_id: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
  } | {
    first_name: string | null;
    last_name: string | null;
  }[] | null;
  leaderboard_seasons: {
    season_name: string | null;
  } | {
    season_name: string | null;
  }[] | null;
}

export default async function LeaderboardPage() {
  const supabase = await createClient();
  
  // 1. Authenticate Request
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/login");
  }


  // ─── BATCH 1: Parallel — profile + progress + activity stats ─────────────
  const [profileResult, progressResult, activityStats] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, university, major, cohort_id, leaderboard_visibility")
      .eq("id", user.id)
      .single(),
    supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    getDynamicActivityStats(user.id),
  ]);

  const profile = profileResult.data;
  const firstName = profile?.first_name || "Scholar";
  const lastName = profile?.last_name || "Student";

  let progress = progressResult.data;
  if (!progress) {
    const { data: newProgress } = await supabase
      .from("user_progress")
      .insert({ user_id: user.id, total_xp: 0, current_level: 1, monthly_xp: 0 })
      .select()
      .single();
    progress = newProgress;
  }

  const userProgress = {
    total_xp: progress?.total_xp ?? 0,
    monthly_xp: progress?.monthly_xp ?? 0,
    current_level: progress?.current_level ?? 1,
    quiz_accuracy: progress?.quiz_accuracy ?? 0,
    completed_quizzes_count: progress?.completed_quizzes_count ?? 0,
    total_correct_answers: progress?.total_correct_answers ?? 0,
    total_questions_attempted: progress?.total_questions_attempted ?? 0,
    current_streak: progress?.current_streak ?? 0,
    highest_streak: progress?.highest_streak ?? 0,
    daily_challenges: progress?.daily_challenges ?? { date: "", completed: { focus: false, quiz: false, share: false } },
    last_check_in_date: progress?.last_check_in_date || "",
    user_id: user.id,
    first_name: firstName,
    last_name: lastName,
    avatar_url: null as string | null,
    university: profile?.university || "Neuron Academy",
    major: profile?.major || "Computer Science"
  };

  // ─── BATCH 2: Parallel — achievements + leaderboard progress + champions + docs ────
  const [
    dbAchievementsResult,
    unlockedRowsResult,
    rawProgressResult,
    rawChampionsResult,
    completedDocsResult,
  ] = await Promise.all([
    supabase.from("achievements").select("*").order("xp_reward", { ascending: true }),
    supabase.from("user_achievements").select("achievement_id").eq("user_id", user.id),
    supabase.from("user_progress").select("user_id, total_xp, monthly_xp, current_level, quiz_accuracy, current_streak").order("total_xp", { ascending: false }).limit(50),
    supabase.from("monthly_champions").select(`rank, total_xp, user_id, leaderboard_seasons:season_id(season_name)`).order("created_at", { ascending: false }),
    supabase.from("documents").select("id, title").eq("user_id", user.id).eq("summary_status", "completed"),
  ]);

  const dbAchievements = dbAchievementsResult.data;
  const achievements = dbAchievements && dbAchievements.length > 0 ? dbAchievements : DEFAULT_ACHIEVEMENTS;
  const unlockedAchievementIds = unlockedRowsResult.data?.map(r => r.achievement_id) || [];

  // Safe lookup of participant profiles from public_profiles view
  const progressRows = rawProgressResult.data || [];
  const championRows = rawChampionsResult.data || [];
  const profileUserIds = Array.from(new Set([
    ...progressRows.map(p => p.user_id),
    ...championRows.map(c => c.user_id)
  ])).filter(Boolean);

  const profileMap = new Map<string, { first_name?: string | null; last_name?: string | null; avatar_url?: string | null; university?: string | null; major?: string | null }>();
  if (profileUserIds.length > 0) {
    const { data: publicProfiles } = await supabase
      .from("public_profiles")
      .select("id, first_name, last_name, avatar_url, university, major")
      .in("id", profileUserIds);
    if (publicProfiles) {
      publicProfiles.forEach(p => profileMap.set(p.id, p));
    }
  }

  const leaderboardList = progressRows.map((prog) => {
    const p = profileMap.get(prog.user_id);
    return {
      user_id: prog.user_id,
      total_xp: prog.total_xp || 0,
      monthly_xp: prog.monthly_xp || 0,
      current_level: prog.current_level || 1,
      quiz_accuracy: prog.quiz_accuracy || 0,
      current_streak: prog.current_streak || 0,
      first_name: p?.first_name || `Student_${prog.user_id.substring(0, 4)}`,
      last_name: p?.last_name || "",
      avatar_url: p?.avatar_url || null,
      university: p?.university || "Neuron Academy",
      major: p?.major || "Computer Science"
    };
  });

  if (!leaderboardList.some(item => item.user_id === user.id)) {
    leaderboardList.push(userProgress);
  }

  const championsArchive = championRows.map((c) => {
    const p = profileMap.get(c.user_id);
    const seasonData = Array.isArray(c.leaderboard_seasons) ? c.leaderboard_seasons[0] : c.leaderboard_seasons;
    return {
      rank: c.rank,
      total_xp: c.total_xp,
      season_name: seasonData?.season_name || "Past Season",
      first_name: p?.first_name || "Scholar",
      last_name: p?.last_name || "Student"
    };
  });

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const seasonEndDate = nextMonth.toISOString();
  const completedDocs = completedDocsResult.data;

  // ─── BATCH 3: Cohort Information, Initial Cohort Leaderboard & Shared Notes ──
  const currentWeekStart = getISOWeekStartDate();
  let cohortInfo: { id: string; name: string; semester: string } | null = null;
  let initialCohortLeaderboard: any = null;
  let initialSharedFiles: CohortSharedFile[] = [];

  if (profile?.cohort_id) {
    const [cohortRes, leaderboardRes, sharedFilesRes] = await Promise.all([
      supabase
        .from("cohorts")
        .select(`
          id,
          semester,
          universities:university_id ( name ),
          degree_programs:program_id ( name )
        `)
        .eq("id", profile.cohort_id)
        .maybeSingle(),
      getCohortLeaderboard(profile.cohort_id, currentWeekStart),
      getCohortSharedFiles(profile.cohort_id),
    ]);

    const cRow = cohortRes.data;
    if (cRow) {
      const uName = (Array.isArray(cRow.universities) ? cRow.universities[0]?.name : (cRow.universities as any)?.name) || profile.university || "University";
      const pName = (Array.isArray(cRow.degree_programs) ? cRow.degree_programs[0]?.name : (cRow.degree_programs as any)?.name) || profile.major || "Program";
      cohortInfo = {
        id: cRow.id,
        name: `${uName} • ${pName} • ${cRow.semester}`,
        semester: cRow.semester,
      };
    }
    initialCohortLeaderboard = leaderboardRes;
    if (sharedFilesRes?.success && sharedFilesRes.data) {
      initialSharedFiles = sharedFilesRes.data;
    }
  }

  return (
    <LeaderboardClient
      initialProgress={userProgress}
      achievements={achievements || []}
      unlockedAchievementIds={unlockedAchievementIds}
      stats={activityStats}
      leaderboardList={leaderboardList}
      championsArchive={championsArchive}
      seasonEndDate={seasonEndDate}
      completedDocs={completedDocs || []}
      initialCohortLeaderboard={initialCohortLeaderboard}
      initialSharedFiles={initialSharedFiles}
      cohortInfo={cohortInfo}
      currentWeekStart={currentWeekStart}
    />
  );
}

