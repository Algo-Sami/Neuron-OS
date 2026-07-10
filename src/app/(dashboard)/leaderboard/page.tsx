import { createClient } from "@/lib/supabase/server";
import { 
  ensureAchievementsExist, 
  getDynamicActivityStats, 
  DEFAULT_ACHIEVEMENTS
} from "@/services/gamification/rewards";
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

  // 2. Fire-and-forget achievements check — never block page render
  ensureAchievementsExist().catch(() => {});

  // ─── BATCH 1: Parallel — profile + progress + activity stats ─────────────
  const [profileResult, progressResult, activityStats] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, university, major")
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

  // ─── BATCH 2: Parallel — achievements + leaderboard + champions + docs ────
  const [
    dbAchievementsResult,
    unlockedRowsResult,
    rawUsersResult,
    rawChampionsResult,
    completedDocsResult,
  ] = await Promise.all([
    supabase.from("achievements").select("*").order("xp_reward", { ascending: true }),
    supabase.from("user_achievements").select("achievement_id").eq("user_id", user.id),
    supabase.from("profiles").select(`id, first_name, last_name, avatar_url, university, major, user_progress(total_xp, monthly_xp, current_level, quiz_accuracy, current_streak)`),
    supabase.from("monthly_champions").select(`rank, total_xp, user_id, profiles:user_id(first_name, last_name), leaderboard_seasons:season_id(season_name)`).order("created_at", { ascending: false }),
    supabase.from("documents").select("id, title").eq("user_id", user.id).eq("summary_status", "completed"),
  ]);

  const dbAchievements = dbAchievementsResult.data;
  const achievements = dbAchievements && dbAchievements.length > 0 ? dbAchievements : DEFAULT_ACHIEVEMENTS;
  const unlockedAchievementIds = unlockedRowsResult.data?.map(r => r.achievement_id) || [];

  const leaderboardList = ((rawUsersResult.data as unknown as RawUser[]) || []).map((u) => {
    const progressData = u.user_progress
      ? (Array.isArray(u.user_progress) ? u.user_progress[0] : u.user_progress)
      : null;
    return {
      user_id: u.id,
      total_xp: progressData?.total_xp || 0,
      monthly_xp: progressData?.monthly_xp || 0,
      current_level: progressData?.current_level || 1,
      quiz_accuracy: progressData?.quiz_accuracy || 0,
      current_streak: progressData?.current_streak || 0,
      first_name: u.first_name || `Student_${u.id.substring(0, 4)}`,
      last_name: u.last_name || "",
      avatar_url: u.avatar_url || null,
      university: u.university || "Neuron Academy",
      major: u.major || "Computer Science"
    };
  });

  if (!leaderboardList.some(item => item.user_id === user.id)) {
    leaderboardList.push(userProgress);
  }

  const championsArchive = ((rawChampionsResult.data as unknown as RawChampion[]) || []).map((c) => {
    const profileData = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    const seasonData = Array.isArray(c.leaderboard_seasons) ? c.leaderboard_seasons[0] : c.leaderboard_seasons;
    return {
      rank: c.rank,
      total_xp: c.total_xp,
      season_name: seasonData?.season_name || "Past Season",
      first_name: profileData?.first_name || "Scholar",
      last_name: profileData?.last_name || "Student"
    };
  });

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const seasonEndDate = nextMonth.toISOString();
  const completedDocs = completedDocsResult.data;

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
    />
  );
}

