"use server";

import { createClient } from "@/lib/supabase/server";
import { awardXP } from "@/services/gamification/rewards";
import { routeAIRequest } from "@/services/ai/router";
import { buildQuizGenerationPrompt } from "@/services/ai/agents/quiz";

/**
 * Creates or retrieves a lecture-specific generated AI quiz.
 * Automatically regulates the difficulty (EASY, MEDIUM, HARD) based on the user's leaderboard rank.
 */
export async function generateQuizAction(documentId: string) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 2. Check if a quiz was already generated for this document and is not started yet
    const { data: existingQuiz } = await supabase
      .from("quizzes")
      .select("id, status")
      .eq("document_id", documentId)
      .eq("user_id", user.id)
      .eq("status", "not_started")
      .maybeSingle();

    if (existingQuiz) {
      return { success: true, quizId: existingQuiz.id };
    }

    // 3. Determine dynamic difficulty based on leaderboard rank
    const { data: progressList } = await supabase
      .from("user_progress")
      .select("user_id")
      .order("total_xp", { ascending: false }); // Using total_xp for stable leaderboard ranking

    const rank = progressList ? progressList.findIndex(p => p.user_id === user.id) + 1 : 100;
    
    let difficulty: "easy" | "medium" | "hard" = "easy";
    if (rank >= 1 && rank <= 5) {
      difficulty = "hard";
    } else if (rank >= 6 && rank <= 15) {
      difficulty = "medium";
    } else {
      difficulty = "easy";
    }

    // 4. Fetch the document text
    const { data: doc } = await supabase
      .from("documents")
      .select("title, subject_id")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!doc) throw new Error("Document not found");

    const { data: chunks } = await supabase
      .from("document_chunks")
      .select("content")
      .eq("document_id", documentId)
      .order("chunk_index", { ascending: true });

    const fullText = chunks && chunks.length > 0
      ? chunks.map(c => c.content).join("\n")
      : doc.title;

    // 5. Query previous quizzes for this user & document to exclude duplicate questions
    const { data: previousQuizzes } = await supabase
      .from("quizzes")
      .select("questions")
      .eq("document_id", documentId)
      .eq("user_id", user.id);

    interface Question {
      id: string;
      type: "mcq" | "true_false" | "short_answer" | "long_answer" | "viva";
      questionText: string;
      options?: string[];
      correctAnswer: string | number;
      keyPoints?: string[];
    }

    const excludeQuestionTexts: string[] = [];
    if (previousQuizzes) {
      previousQuizzes.forEach((quiz: { questions: unknown }) => {
        if (quiz.questions && Array.isArray(quiz.questions)) {
          (quiz.questions as Question[]).forEach((q) => {
            if (q.questionText) {
              excludeQuestionTexts.push(q.questionText);
            }
          });
        }
      });
    }

    // Generate quiz using Centralized AI Request Router
    const prompt = buildQuizGenerationPrompt(fullText, doc.title, difficulty, excludeQuestionTexts, 10);
    const routerRes = await routeAIRequest({
      userId: user.id,
      taskType: 'quiz-generation',
      prompt,
      responseMimeType: 'application/json'
    });

    if (!routerRes.success) {
      throw new Error(`Failed to generate quiz: ${routerRes.content}`);
    }

    const questions = JSON.parse(routerRes.content);

    // 6. Insert new quiz into quizzes database
    const { data: newQuiz, error: quizInsertError } = await supabase
      .from("quizzes")
      .insert({
        user_id: user.id,
        document_id: documentId,
        subject_id: doc.subject_id,
        title: `AI Quiz: ${doc.title}`,
        questions: questions,
        total_questions: questions.length,
        score: 0,
        status: "not_started"
      })
      .select("id")
      .single();

    if (quizInsertError) {
      throw new Error(`Failed to insert quiz: ${quizInsertError.message}`);
    }

    // 7. Update document status to generated
    await supabase
      .from("documents")
      .update({ quiz_status: "generated" })
      .eq("id", documentId);

    return { success: true, quizId: newQuiz.id };

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[generateQuizAction] Error:", err.message || err);
    return { success: false, error: err.message || "Failed to generate AI quiz." };
  }
}

/**
 * Scores the student's quiz submissions, computes streaks/combos/speed bonuses,
 * checks daily challenges, and updates database progress and XP points.
 */
export async function submitQuizAction(
  quizId: string,
  userAnswers: { id: string; answer: string; selfGrade?: boolean }[],
  timeTakenSeconds: number,
  isPractice: boolean = false
) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 2. Fetch the quiz
    const { data: quiz } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", quizId)
      .eq("user_id", user.id)
      .single();

    if (!quiz) throw new Error("Quiz not found");
    if (quiz.status === "completed") {
      return { success: false, message: "This quiz has already been submitted!" };
    }

    const isSuspicious = timeTakenSeconds < 8;

    interface Question {
      id: string;
      type: "mcq" | "true_false" | "short_answer" | "long_answer" | "viva";
      questionText: string;
      options?: string[];
      correctAnswer: string | number;
      keyPoints?: string[];
    }

    const questions = quiz.questions as unknown as Question[];
    const totalQuestions = questions.length;
    const gradedQuestions = questions.filter(q => q.type === "mcq" || q.type === "true_false");
    const totalGraded = gradedQuestions.length || 1;
    
    let correctCount = 0;
    const scoredQuestions = [];
    let currentCombo = 0;
    let maxCombo = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const userAnswer = userAnswers.find(ua => ua.id === q.id);
      let isCorrect = false;

      if (q.type === "mcq" || q.type === "true_false") {
        isCorrect = userAnswer ? String(userAnswer.answer) === String(q.correctAnswer) : false;
        
        if (isCorrect) {
          correctCount++;
          currentCombo++;
          if (currentCombo > maxCombo) maxCombo = currentCombo;
        } else {
          currentCombo = 0;
        }
      } else {
        // short_answer, long_answer, viva
        const studentText = userAnswer ? userAnswer.answer.trim().toLowerCase() : "";
        const selfGrade = userAnswer?.selfGrade === true;
        
        let keywordMatches = 0;
        const keyPoints = q.keyPoints || [];
        keyPoints.forEach((kp: string) => {
          if (studentText.includes(kp.toLowerCase())) {
            keywordMatches++;
          }
        });

        isCorrect = selfGrade || (keyPoints.length > 0 && keywordMatches >= 1);
      }

      scoredQuestions.push({
        ...q,
        studentAnswer: userAnswer ? userAnswer.answer : "",
        isCorrect
      });
    }

    // 5. Compute gamified XP points
    let baseXP = correctCount * 20;
    let completionXP = 50;
    let speedBonus = 0;
    let comboBonus = 0;
    let streakBonus = 0;
    let perfectBonus = 0;

    const { data: progress } = await supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!progress) throw new Error("User progress not found");

    const currentStreak = progress.current_streak || 0;
    if (currentStreak > 0) {
      streakBonus = Math.min(25, currentStreak * 5);
    }

    if (timeTakenSeconds < 45 && correctCount >= 3 && !isSuspicious) {
      speedBonus = 30;
    }

    if (maxCombo >= 3) comboBonus += 15;
    if (maxCombo === 5) comboBonus += 15;

    if (correctCount === totalGraded) {
      perfectBonus = 100;
    }

    let totalQuizXP = baseXP + completionXP + speedBonus + comboBonus + streakBonus + perfectBonus;

    if (isSuspicious) {
      totalQuizXP = 10;
      baseXP = 10;
      completionXP = 0;
      speedBonus = 0;
      comboBonus = 0;
      streakBonus = 0;
      perfectBonus = 0;
    }

    // 6. Update quiz status in DB
    await supabase
      .from("quizzes")
      .update({
        score: correctCount,
        status: "completed",
        questions: scoredQuestions,
        updated_at: new Date().toISOString()
      })
      .eq("id", quizId);

    if (isPractice) {
      return {
        success: true,
        correctCount,
        totalQuestions,
        timeTakenSeconds,
        baseXP: 0,
        completionXP: 0,
        speedBonus: 0,
        comboBonus: 0,
        streakBonus: 0,
        perfectBonus: 0,
        dailyChallengeXP: 0,
        totalQuizXP: 0,
        xpGained: 0,
        newXp: progress?.total_xp ?? 0,
        newLevel: progress?.current_level ?? 1,
        levelUp: false,
        isSuspicious: false,
        challengeAlert: "",
        unlockedAchievements: [],
        isPractice: true
      };
    }

    // 7. Process Daily Challenges Check
    const todayStr = new Date().toDateString();
    let dailyChallenges = progress.daily_challenges || { date: "", completed: { focus: false, quiz: false, share: false } };

    if (dailyChallenges.date !== todayStr) {
      dailyChallenges = {
        date: todayStr,
        completed: { focus: false, quiz: false, share: false }
      };
    }

    let dailyChallengeXP = 0;
    let challengeAlert = "";

    const quizAccuracyPercent = Math.round((correctCount / totalGraded) * 100);
    if (quizAccuracyPercent >= 80 && !dailyChallenges.completed.quiz && !isSuspicious) {
      dailyChallenges.completed.quiz = true;
      dailyChallengeXP = 50;
      challengeAlert = "🎯 Completed Daily Challenge: Quiz Whiz! (+50 XP)";
    }

    // 8. Update User Statistics
    const updatedCorrect = (progress.total_correct_answers || 0) + correctCount;
    const updatedAttempted = (progress.total_questions_attempted || 0) + totalGraded;
    const updatedQuizzesCount = (progress.completed_quizzes_count || 0) + 1;
    const updatedAccuracy = Math.round((updatedCorrect / updatedAttempted) * 100);

    await supabase
      .from("user_progress")
      .update({
        total_correct_answers: updatedCorrect,
        total_questions_attempted: updatedAttempted,
        completed_quizzes_count: updatedQuizzesCount,
        quiz_accuracy: updatedAccuracy,
        daily_challenges: dailyChallenges,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    // 9. Award Quiz XP & Daily Challenge XP
    const result = await awardXP(user.id, "complete_quiz", { score: correctCount, totalQuestions });
    const extraXP = totalQuizXP + dailyChallengeXP - (correctCount === totalQuestions ? 250 : 150);
    
    let finalXP = result.newXp;
    let finalLevel = result.newLevel;
    let finalLeveledUp = result.levelUp;

    if (extraXP > 0) {
      const getCumulativeXpForLevel = (lvl: number) => {
        let sum = 0;
        for (let i = 1; i < lvl; i++) {
          sum += i * 1000;
        }
        return sum;
      };

      const finalProgressXp = result.newXp + extraXP;
      let tempLevel = result.newLevel;
      let hasLeveledUp = false;
      let targetXpForNext = getCumulativeXpForLevel(tempLevel + 1);

      while (finalProgressXp >= targetXpForNext) {
        tempLevel++;
        hasLeveledUp = true;
        targetXpForNext = getCumulativeXpForLevel(tempLevel + 1);
      }

      await supabase
        .from("user_progress")
        .update({
          total_xp: finalProgressXp,
          current_level: tempLevel,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id);

      finalXP = finalProgressXp;
      finalLevel = tempLevel;
      finalLeveledUp = result.levelUp || hasLeveledUp;

      await supabase.from("notifications").insert({
        user_id: user.id,
        title: `+${extraXP} Gamification Bonuses!`,
        message: `Earned ${extraXP} XP for completing with Speed, Combos, and Daily Streak multipliers!`,
        type: "system"
      });

      if (hasLeveledUp && !result.levelUp) {
        await supabase.from("notifications").insert({
          user_id: user.id,
          title: "🎉 Level Up!",
          message: `Congratulations! You leveled up to Level ${tempLevel}!`,
          type: "alert"
        });
      }
    }

    return {
      success: true,
      correctCount,
      totalQuestions,
      timeTakenSeconds,
      baseXP,
      completionXP,
      speedBonus,
      comboBonus,
      streakBonus,
      perfectBonus,
      dailyChallengeXP,
      totalQuizXP: totalQuizXP + dailyChallengeXP,
      xpGained: totalQuizXP + dailyChallengeXP,
      newXp: finalXP,
      newLevel: finalLevel,
      levelUp: finalLeveledUp,
      isSuspicious,
      challengeAlert,
      unlockedAchievements: result.unlockedAchievements
    };

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[submitQuizAction] Error:", err.message || err);
    return { success: false, error: err.message || "Failed to submit quiz score." };
  }
}
