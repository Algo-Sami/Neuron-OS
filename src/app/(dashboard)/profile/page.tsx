import { createClient } from "@/lib/supabase/server";
import { getDynamicActivityStats, ensureAchievementsExist } from "@/services/gamification/rewards";
import { ProfileClient, BadgeItem } from "@/components/profile/profile-client";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Profile & Scholarly Preferences - Neuron",
  description: "Manage your student information, major studies, and review levels and achievement awards."
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Ensure achievements catalog exists
  await ensureAchievementsExist();

  // 1. Fetch profiles table record
  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // Graceful creation if auth trigger was delayed or missing in some environments
    const { data: newProfile } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        first_name: "Scholar",
        last_name: "Student",
        university: "Stanford University",
        major: "Computer Science"
      })
      .select()
      .single();
    profile = newProfile;
  }

  // 2. Fetch or initialize user progress (XP & Level)
  let { data: progress } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!progress) {
    const { data: newProgress } = await supabase
      .from("user_progress")
      .insert({
        user_id: user.id,
        total_xp: 0,
        current_level: 1
      })
      .select()
      .single();
    progress = newProgress;
  }

  // 3. Fetch list of unlocked achievements with full info (join mapping)
  const { data: unlockedRows } = await supabase
    .from("user_achievements")
    .select(`
      unlocked_at,
      achievements:achievement_id (
        id,
        name,
        description,
        icon_url,
        xp_reward
      )
    `)
    .eq("user_id", user.id);

  // Flatten the joined rows to get a clean list of achievement details
  const unlockedBadges = (unlockedRows
    ?.map(r => {
      if (!r.achievements) return null;
      // Handle array or single object if returned differently by type definitions
      const ach = Array.isArray(r.achievements) ? r.achievements[0] : r.achievements;
      return {
        id: ach.id,
        name: ach.name,
        description: ach.description,
        icon_url: ach.icon_url,
        xp_reward: ach.xp_reward,
        unlocked_at: r.unlocked_at
      };
    })
    .filter(Boolean) as BadgeItem[]) || [];

  // 4. Calculate dynamic study metrics and streaks
  const activityStats = await getDynamicActivityStats(user.id);

  // 5. Render client profile console
  return (
    <ProfileClient
      user={{ id: user.id, email: user.email || "" }}
      profile={{
        first_name: profile?.first_name ?? "",
        last_name: profile?.last_name ?? "",
        university: profile?.university ?? "",
        major: profile?.major ?? "",
        avatar_url: profile?.avatar_url ?? null
      }}
      progress={{
        total_xp: progress?.total_xp ?? 0,
        current_level: progress?.current_level ?? 1
      }}
      stats={{
        currentStreak: activityStats.currentStreak,
        highestStreak: activityStats.highestStreak,
        activeDaysCount: activityStats.activeDaysCount,
        totalStudyMinutes: activityStats.totalStudyMinutes
      }}
      unlockedBadges={unlockedBadges}
    />
  );
}
