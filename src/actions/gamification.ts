"use server";

import { createClient } from "@/lib/supabase/server";
import { awardXP } from "@/services/gamification/rewards";
import { revalidatePath } from "next/cache";

export async function dailyCheckIn() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Fetch their current progress to verify last check-in date
  const { data: progress, error: fetchError } = await supabase
    .from("user_progress")
    .select("last_check_in_date")
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    console.error("Error checking daily check-in date:", fetchError.message);
  }

  const todayStr = new Date().toDateString();
  if (progress && progress.last_check_in_date === todayStr) {
    return { success: false, message: "Already checked in today!" };
  }

  // Award XP for daily activity check-in
  const result = await awardXP(user.id, "daily_activity");

  // Update check-in timestamp in database progress
  await supabase
    .from("user_progress")
    .update({ 
      last_check_in_date: todayStr,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", user.id);

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

  // Award XP
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
