"use server";

import { createClient } from "@/lib/supabase/server";
import { awardXP } from "@/services/gamification/rewards";
import { incrementWeeklyScore } from "@/services/gamification/weekly-scores";
import { revalidatePath } from "next/cache";

export async function dailyCheckIn() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const todayStr = new Date().toDateString();

  // Atomically verify, award XP, and record check-in in a single guarded transaction
  const result = await awardXP(user.id, "daily_activity", { lastCheckInDate: todayStr });

  if (!result.success || (result as any).alreadyCheckedIn) {
    return { success: false, message: "Already checked in today!" };
  }

  // Phase 3: increment weekly competition score (streak_day)
  await incrementWeeklyScore(user.id, "streak_day");

  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  
  return {
    success: true,
    xpGained: result.xpGained,
    newXp: result.newXp,
    levelUp: result.levelUp,
    newLevel: result.newLevel,
    message: `Daily Check-In successful! Gained +${result.xpGained} XP!`
  };
}

export async function logStudySession(durationMinutes: number, subjectId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Insert study session into the database
  const { error: sessionError } = await supabase.from("study_sessions").insert({
    user_id: user.id,
    subject_id: subjectId || null,
    start_time: new Date(Date.now() - durationMinutes * 60 * 1000).toISOString(),
    end_time: new Date().toISOString(),
    duration_minutes: durationMinutes,
    focus_score: Math.floor(Math.random() * 20) + 80 // random between 80-100
  });

  if (sessionError) {
    console.error("Failed to save study session:", sessionError.message);
    throw sessionError;
  }

  // Award XP
  const result = await awardXP(user.id, "focus_session");

  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  revalidatePath("/profile");

  return {
    success: true,
    xpGained: result.xpGained,
    newXp: result.newXp,
    levelUp: result.levelUp,
    newLevel: result.newLevel,
    message: `Great focus! Saved study session of ${durationMinutes} minutes. Gained +${result.xpGained} XP!`
  };
}

export async function completeQuickQuiz(score: number, totalQuestions: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Log quiz in the quizzes database
  const { error: quizError } = await supabase.from("quizzes").insert({
    user_id: user.id,
    title: "Quick Daily Quiz",
    score: score,
    total_questions: totalQuestions,
    created_at: new Date().toISOString()
  });

  if (quizError) {
    console.error("Failed to save quiz score:", quizError.message);
  }

  // Award XP
  const result = await awardXP(user.id, "complete_quiz", { score, totalQuestions });

  // Phase 3: increment weekly competition score (quiz_completed)
  await incrementWeeklyScore(user.id, "quiz_completed");

  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  revalidatePath("/profile");

  return {
    success: true,
    xpGained: result.xpGained,
    newXp: result.newXp,
    levelUp: result.levelUp,
    newLevel: result.newLevel,
    message: `Quiz completed! Score: ${score}/${totalQuestions}. Gained +${result.xpGained} XP!`
  };
}

export async function shareMaterials() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Award XP (lifetime XP preserved, weekly competition score unaffected)
  const result = await awardXP(user.id, "share_material");

  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  revalidatePath("/profile");

  return {
    success: true,
    xpGained: result.xpGained,
    newXp: result.newXp,
    levelUp: result.levelUp,
    newLevel: result.newLevel,
    message: `Notes shared! Gained +${result.xpGained} XP!`
  };
}
