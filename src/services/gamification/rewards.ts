import { createClient } from '@/lib/supabase/server';
import { 
  getRankName, 
  getXpThresholdForLevel, 
} from './helpers';
import { 
  XP_UPLOAD_NOTES,
  XP_COMPLETE_QUIZ,
  XP_PERFECT_QUIZ,
  XP_STUDY_STREAK,
  XP_SHARE_MATERIAL,
  XP_FOCUS_SESSION,
  XP_DAILY_ACTIVITY,
  XP_PER_LEVEL,
  XP_CHALLENGE_FOCUS,
  XP_CHALLENGE_SHARE,
  DEFAULT_ACHIEVEMENTS
} from '@/constants';
import type { Achievement, UserProgress } from '@/types';

export { 
  getRankName, 
  getXpThresholdForLevel, 
  DEFAULT_ACHIEVEMENTS, 
};
export type { Achievement, UserProgress };


// In-memory cache for dynamic activity stats keyed by user ID
const activityStatsCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache expiry

// 3. Dynamic Seeding of achievements catalog
export async function ensureAchievementsExist() {
  const supabase = await createClient();
  
  // Fetch existing achievements
  const { data: existing, error } = await supabase.from('achievements').select('*');
  if (error) {
    console.warn("[Gamification] Warning: Failed to query achievements catalog from DB:", error.message);
    return;
  }
  
  if (!existing || existing.length === 0) {
    console.log("[Gamification] Achievements table is empty. Seeding catalog...");
    const { error: seedError } = await supabase.from('achievements').insert(DEFAULT_ACHIEVEMENTS);
    if (seedError) {
      console.warn(
        "[Gamification] Warning: Failed to seed achievements dynamically. " +
        "This is expected if the RLS INSERT policy is not active on your remote Supabase DB. " +
        "Admin can seed achievements directly in the Supabase SQL editor using the schema script. " +
        "Details: " + seedError.message
      );
    } else {
      console.log("[Gamification] Achievements seeded successfully!");
    }
  }
}

// 4. Award XP Action with Level-Up & Achievement Checks
export async function awardXP(
  userId: string, 
  actionType: 'upload_notes' | 'complete_quiz' | 'study_streak' | 'share_material' | 'daily_activity' | 'focus_session',
  details?: { score?: number; totalQuestions?: number; levelReached?: number; count?: number }
) {
  // Invalidate cache when user performs an action
  activityStatsCache.delete(userId);
  const supabase = await createClient();
  
  // Verify/create user_progress row
  const { data: progressVal, error: fetchError } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
    
  if (fetchError) {
    console.error("Error fetching user progress:", fetchError.message);
    throw fetchError;
  }
  
  let progress = progressVal;
  
  if (!progress) {
    const { data: newProgress, error: insertError } = await supabase
      .from('user_progress')
      .insert({ user_id: userId, total_xp: 0, current_level: 1 })
      .select()
      .single();
      
    if (insertError) {
      console.error("Failed to create user progress row:", insertError.message);
      throw insertError;
    }
    progress = newProgress;
  }
  
  // Set default points for actions
  let pointsAwarded = XP_DAILY_ACTIVITY;
  let actionLabel = "Daily Activity";
  
  switch(actionType) {
    case 'upload_notes':
      pointsAwarded = XP_UPLOAD_NOTES;
      actionLabel = "Uploading Notes";
      break;
    case 'complete_quiz':
      pointsAwarded = XP_COMPLETE_QUIZ;
      if (details?.score && details?.totalQuestions && details.score === details.totalQuestions) {
        pointsAwarded = XP_PERFECT_QUIZ; // Perfect score bonus
        actionLabel = "Completing Quiz (Perfect Score!)";
      } else {
        actionLabel = "Completing Quiz";
      }
      break;
    case 'study_streak':
      pointsAwarded = XP_STUDY_STREAK;
      actionLabel = "Maintaining Study Streak";
      break;
    case 'share_material':
      pointsAwarded = XP_SHARE_MATERIAL;
      actionLabel = "Sharing Study Materials";
      break;
    case 'focus_session':
      pointsAwarded = XP_FOCUS_SESSION;
      actionLabel = "Completing Focus Session";
      break;
    case 'daily_activity':
      pointsAwarded = XP_DAILY_ACTIVITY;
      actionLabel = "Daily Activity Check-In";
      break;
  }
  
  const oldXp = progress.total_xp || 0;
  const oldMonthlyXp = progress.monthly_xp || 0;

  // Track dynamic daily challenges status
  const todayStr = new Date().toDateString();
  let dailyChallenges = progress.daily_challenges || { date: "", completed: { focus: false, quiz: false, share: false } };

  if (dailyChallenges.date !== todayStr) {
    dailyChallenges = {
      date: todayStr,
      completed: { focus: false, quiz: false, share: false }
    };
  }

  let challengeBonusXP = 0;
  let challengeAlert = "";

  if (actionType === "focus_session" && !dailyChallenges.completed.focus) {
    dailyChallenges.completed.focus = true;
    challengeBonusXP = XP_CHALLENGE_FOCUS;
    challengeAlert = `🎯 Completed Daily Challenge: Focus Master! (+${XP_CHALLENGE_FOCUS} XP)`;
  } else if (actionType === "share_material" && !dailyChallenges.completed.share) {
    dailyChallenges.completed.share = true;
    challengeBonusXP = XP_CHALLENGE_SHARE;
    challengeAlert = `🎯 Completed Daily Challenge: Collaborator! (+${XP_CHALLENGE_SHARE} XP)`;
  }

  const finalPointsAwarded = pointsAwarded + challengeBonusXP;
  const newXp = oldXp + finalPointsAwarded;
  const newMonthlyXp = oldMonthlyXp + finalPointsAwarded;

  // Calculate active streak stats in background to keep data in sync
  let activeStreak = progress.current_streak || 0;
  let highestStreak = progress.highest_streak || 0;
  try {
    const activity = await getDynamicActivityStats(userId);
    activeStreak = activity.currentStreak;
    highestStreak = Math.max(activity.highestStreak, progress.highest_streak || 0);
  } catch (err) {
    console.error("[Gamification] Streak fetch warning:", err);
  }

  // Calculate Level-Up
  let currentLevel = progress.current_level || 1;
  let hasLeveledUp = false;
  
  const getCumulativeXpForLevel = (lvl: number) => {
    let sum = 0;
    for (let i = 1; i < lvl; i++) {
      sum += i * XP_PER_LEVEL;
    }
    return sum;
  };
  
  let targetXpForNext = getCumulativeXpForLevel(currentLevel + 1);
  while (newXp >= targetXpForNext) {
    currentLevel++;
    hasLeveledUp = true;
    targetXpForNext = getCumulativeXpForLevel(currentLevel + 1);
  }
  
  // Update database progress
  const { error: updateError } = await supabase
    .from('user_progress')
    .update({
      total_xp: newXp,
      monthly_xp: newMonthlyXp,
      current_level: currentLevel,
      current_streak: activeStreak,
      highest_streak: highestStreak,
      daily_challenges: dailyChallenges,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);
    
  if (updateError) {
    console.error("Failed to update user progress:", updateError.message);
    throw updateError;
  }
  
  // Insert log notification for points earned
  await supabase.from('notifications').insert({
    user_id: userId,
    title: `+${pointsAwarded} XP Earned!`,
    message: `You earned ${pointsAwarded} XP for ${actionLabel}.`,
    type: 'system'
  });

  // Daily Challenge completed notification
  if (challengeBonusXP > 0) {
    await supabase.from('notifications').insert({
      user_id: userId,
      title: challengeAlert,
      message: `Completed daily challenge activity. Received +${challengeBonusXP} bonus XP!`,
      type: 'alert'
    });
  }
  
  // Insert level-up notification
  if (hasLeveledUp) {
    await supabase.from('notifications').insert({
      user_id: userId,
      title: "🎉 Level Up!",
      message: `Congratulations! You leveled up to Level ${currentLevel} and reached rank: ${getRankName(currentLevel)}!`,
      type: 'alert'
    });
  }
  
  // Check and unlock Achievements
  const unlocked = await checkAndTriggerAchievements(userId, actionType, details, currentLevel);
  
  return {
    success: true,
    xpGained: finalPointsAwarded,
    newXp,
    levelUp: hasLeveledUp,
    newLevel: currentLevel,
    unlockedAchievements: unlocked
  };
}

// 5. Check and unlock achievements dynamically based on user statistics
async function checkAndTriggerAchievements(
  userId: string,
  actionType: string,
  details: { score?: number; totalQuestions?: number; levelReached?: number; count?: number } | undefined,
  currentLevel: number
): Promise<string[]> {
  const supabase = await createClient();
  const unlockedAchievements: string[] = [];
  
  // Ensure we have seeded achievements
  await ensureAchievementsExist();
  
  // Fetch user achievements mapped already
  const { data: unlockedRows } = await supabase
    .from('user_achievements')
    .select('achievement_id');
  const unlockedIds = new Set(unlockedRows?.map(r => r.achievement_id) || []);
  
  // Fetch all achievements from catalog
  const { data: catalog } = await supabase.from('achievements').select('*');
  if (!catalog) return [];
  
  const tryUnlock = async (achievementName: string) => {
    const ach = catalog.find(a => a.name === achievementName);
    if (!ach || unlockedIds.has(ach.id)) return;
    
    // Unlock achievement!
    const { error: unlockError } = await supabase.from('user_achievements').insert({
      user_id: userId,
      achievement_id: ach.id,
      unlocked_at: new Date().toISOString()
    });
    
    if (!unlockError) {
      unlockedAchievements.push(achievementName);
      // Award reward XP for the achievement!
      const { data: prog } = await supabase.from('user_progress').select('total_xp').eq('user_id', userId).single();
      const currentXp = prog?.total_xp || 0;
      await supabase.from('user_progress').update({
        total_xp: currentXp + ach.xp_reward,
        updated_at: new Date().toISOString()
      }).eq('user_id', userId);
      
      // Notify user
      await supabase.from('notifications').insert({
        user_id: userId,
        title: `🏆 Badge Unlocked: ${ach.name}!`,
        message: `Unlocked: "${ach.description}". You received a bonus +${ach.xp_reward} XP!`,
        type: 'alert'
      });
    }
  };
  
  // Check conditions based on trigger actions
  if (actionType === 'upload_notes') {
    const { count: docCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);
      
    if (docCount && docCount >= 1) {
      await tryUnlock("First of Many");
    }
    if (docCount && docCount >= 5) {
      await tryUnlock("Knowledge Collector");
    }
  }
  
  if (actionType === 'complete_quiz') {
    await tryUnlock("Quiz Whiz");
    if (details?.score && details?.totalQuestions && details.score === details.totalQuestions) {
      await tryUnlock("Perfect Score");
    }
  }
  
  if (actionType === 'share_material') {
    await tryUnlock("Collaborator");
  }
  
  if (actionType === 'focus_session') {
    await tryUnlock("Focus Initiate");
  }
  
  if (currentLevel >= 5) {
    await tryUnlock("Neuron Scholar");
  }
  
  return unlockedAchievements;
}

// 6. Calculate dynamic user activity and streak metrics
export async function getDynamicActivityStats(userId: string) {
  // Check in-memory cache first
  const cached = activityStatsCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const supabase = await createClient();
  
  // Ninety days ago ISO string to restrict DB queries payload
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAgoIso = ninetyDaysAgo.toISOString();

  // Gather timestamps of all activities (limited to last 90 days)
  const [
    { data: docs },
    { data: quizzes },
    { data: sessions },
    { data: completedReminders },
    { data: achievements }
  ] = await Promise.all([
    supabase.from('documents').select('created_at').eq('user_id', userId).is('deleted_at', null).gte('created_at', ninetyDaysAgoIso),
    supabase.from('quizzes').select('created_at').eq('user_id', userId).gte('created_at', ninetyDaysAgoIso),
    supabase.from('study_sessions').select('created_at, duration_minutes').eq('user_id', userId).gte('created_at', ninetyDaysAgoIso),
    supabase.from('reminders').select('updated_at').eq('user_id', userId).eq('completed_status', true).gte('updated_at', ninetyDaysAgoIso),
    supabase.from('user_achievements').select('unlocked_at').eq('user_id', userId).gte('unlocked_at', ninetyDaysAgoIso)
  ]);
  
  const activeDates = new Set<string>();
  let totalStudyMinutes = 0;
  
  docs?.forEach(d => activeDates.add(new Date(d.created_at).toDateString()));
  quizzes?.forEach(q => activeDates.add(new Date(q.created_at).toDateString()));
  completedReminders?.forEach(r => activeDates.add(new Date(r.updated_at).toDateString()));
  achievements?.forEach(a => activeDates.add(new Date(a.unlocked_at).toDateString()));
  
  sessions?.forEach(s => {
    activeDates.add(new Date(s.created_at).toDateString());
    totalStudyMinutes += s.duration_minutes || 0;
  });
  
  // Calculate streaks
  const sortedDates = Array.from(activeDates)
    .map(d => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime()); // Descending (latest first)
    
  let currentStreak = 0;
  let highestStreak = 0;
  
  if (sortedDates.length > 0) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if user has been active today or yesterday to maintain the streak
    const latestDate = new Date(sortedDates[0]);
    latestDate.setHours(0,0,0,0);
    
    if (latestDate.getTime() === today.getTime() || latestDate.getTime() === yesterday.getTime()) {
      currentStreak = 1;
      let tempStreak = 1;
      let prevDate = latestDate;
      
      for (let i = 1; i < sortedDates.length; i++) {
        const currDate = new Date(sortedDates[i]);
        currDate.setHours(0,0,0,0);
        
        const diffTime = prevDate.getTime() - currDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          tempStreak++;
          currentStreak = tempStreak;
          prevDate = currDate;
        } else if (diffDays > 1) {
          break; // Streak broken
        }
      }
    }
  }
  
  // Calculate highest streak historically
  if (sortedDates.length > 0) {
    let tempStreak = 1;
    let prevDate = new Date(sortedDates[sortedDates.length - 1]);
    prevDate.setHours(0,0,0,0);
    highestStreak = 1;
    
    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const currDate = new Date(sortedDates[i]);
      currDate.setHours(0,0,0,0);
      
      const diffTime = currDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        tempStreak++;
        if (tempStreak > highestStreak) {
          highestStreak = tempStreak;
        }
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
      prevDate = currDate;
    }
  }
  
  // Activity stats by day of week for progress charts (Last 7 days)
  const last7Days: { day: string; count: number; studyMinutes: number }[] = [];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0,0,0,0);
    
    // Count actions on this day
    let actionCount = 0;
    let minsOnDay = 0;
    
    const dateStr = d.toDateString();
    
    docs?.forEach(doc => {
      if (new Date(doc.created_at).toDateString() === dateStr) actionCount++;
    });
    quizzes?.forEach(q => {
      if (new Date(q.created_at).toDateString() === dateStr) actionCount++;
    });
    completedReminders?.forEach(r => {
      if (new Date(r.updated_at).toDateString() === dateStr) actionCount++;
    });
    sessions?.forEach(s => {
      if (new Date(s.created_at).toDateString() === dateStr) {
        actionCount++;
        minsOnDay += s.duration_minutes || 0;
      }
    });
    
    last7Days.push({
      day: daysOfWeek[d.getDay()],
      count: actionCount,
      studyMinutes: minsOnDay
    });
  }
  
  const statsResult = {
    currentStreak,
    highestStreak,
    activeDaysCount: activeDates.size,
    totalStudyMinutes,
    weeklyActivity: last7Days,
    allActiveDates: Array.from(activeDates)
  };

  // Cache stats result
  activityStatsCache.set(userId, {
    data: statsResult,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
  
  return statsResult;
}
