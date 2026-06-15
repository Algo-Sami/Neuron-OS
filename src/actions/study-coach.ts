"use server";

import { createClient } from "@/lib/supabase/server";
import { awardXP, getDynamicActivityStats } from "@/services/gamification/rewards";
import { logger } from "@/lib/logger";
import {
  evaluateConceptAnswer,
  generateAIStudyPlan,
  detectWeaknesses,
  calculateExamReadiness,
  generateProductivityInsights,
  StudyPlannerParams,
} from "@/services/ai/study-coach";

// Helper to get user ID
async function getUserId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized user access.");
  }
  return user.id;
}

// 1. AI STUDY PLANNER: SAVE AND RETRIEVE
export async function saveStudyPlanAction(
  prefs: Omit<StudyPlannerParams, "examDates" | "weakSubjects" | "backlogSubjects"> & {
    examDates: Record<string, string>;
    weakSubjects: string[];
    backlogSubjects: string[];
  }
) {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    // Call Gemini to generate the study plan structure
    const planData = await generateAIStudyPlan({
      ...prefs,
    });

    // Save to study_plans table
    const { error: upsertError } = await supabase
      .from("study_plans")
      .upsert({
        user_id: userId,
        plan_data: planData as unknown as Record<string, unknown>,
        hours_per_day: prefs.hoursPerDay,
        exam_dates: prefs.examDates,
        weak_subjects: prefs.weakSubjects,
        prep_level: prefs.prepLevel,
        learning_style: prefs.learningStyle,
        backlog_subjects: prefs.backlogSubjects,
        sleep_schedule: prefs.sleepSchedule,
        mood_level: prefs.moodLevel,
        academic_goals: prefs.academicGoals,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      logger.error("Failed to upsert study plan in database", upsertError);
      return { success: false, error: upsertError.message };
    }

    // Sync tasks as Global Reminders across Neuron OS
    const daysMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
    };
    
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 is Sunday

    for (const dailyPlan of planData.weeklySchedule.dailyPlans) {
      const targetDayIndex = daysMap[dailyPlan.day.toLowerCase()];
      if (targetDayIndex === undefined) continue;

      // Calculate date offset for target day
      let diffDays = targetDayIndex - currentDayOfWeek;
      if (diffDays < 0) diffDays += 7; // Map to next week's day

      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + diffDays);

      for (const task of dailyPlan.tasks) {
        if (task.type === "break") continue; // No reminder for breaks

        // Parse time (e.g. "09:00 AM - 10:30 AM" -> extract "09:00 AM")
        const timePart = task.time.split("-")[0]?.trim();
        let hour = 9, minute = 0;
        if (timePart) {
          const match = timePart.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (match) {
            hour = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const isPM = match[3].toUpperCase() === "PM";
            if (isPM && hour < 12) hour += 12;
            if (!isPM && hour === 12) hour = 0;
            minute = minutes;
          }
        }

        const reminderDate = new Date(targetDate);
        reminderDate.setHours(hour, minute, 0, 0);

        // Fetch subject ID if it exists
        let subjectId = null;
        if (task.subject && task.subject !== "General Study") {
          const { data: subj } = await supabase
            .from("subjects")
            .select("id")
            .eq("user_id", userId)
            .ilike("name", task.subject)
            .maybeSingle();
          if (subj) subjectId = subj.id;
        }

        // Insert into reminders
        await supabase.from("reminders").insert({
          user_id: userId,
          subject_id: subjectId,
          title: `[Study Coach] ${task.subject}: ${task.activity}`,
          description: `Focus Block duration: ${task.durationMinutes} minutes. Recommended by your AI Study Planner.`,
          reminder_type: task.type === "focus" || task.type === "revision" ? "assignment" : "generic",
          due_date: reminderDate.toISOString(),
          extracted_from_ai: true,
          completed_status: false,
        });
      }
    }

    return { success: true, planData };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to generate and save Study Plan", err);
    return { success: false, error: err.message };
  }
}

export async function getStudyPlanAction() {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    const { data, error } = await supabase
      .from("study_plans")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      logger.error("Failed to fetch study plan", error);
      return { success: false, error: error.message };
    }

    return { success: true, plan: data };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}

// 2. CONCEPT EVALUATION ACTIONS
export async function evaluateConceptAction(
  docId: string,
  question: string,
  userAnswer: string
) {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    // 1. Get Subject details for classification mapping
    const { data: doc } = await supabase
      .from("documents")
      .select("subject_id, title")
      .eq("id", docId)
      .single();

    if (!doc) {
      throw new Error("Associated lecture document not found.");
    }

    // 2. Load context text snippet
    let documentContext = doc.title;
    
    // Check if summary exists for document text context
    const { data: summary } = await supabase
      .from("ai_summaries")
      .select("summary_text")
      .eq("document_id", docId)
      .maybeSingle();
      
    if (summary?.summary_text) {
      documentContext += "\n" + summary.summary_text;
    } else {
      // Fetch some text chunks
      const { data: chunks } = await supabase
        .from("document_chunks")
        .select("content")
        .eq("document_id", docId)
        .order("chunk_index", { ascending: true })
        .limit(3);
      if (chunks && chunks.length > 0) {
        documentContext += "\n" + chunks.map(c => c.content).join("\n");
      }
    }

    // 3. Call Gemini Concept Evaluation
    const evaluation = await evaluateConceptAnswer(question, userAnswer, documentContext);

    // 4. Save into concept_evaluations
    const { data: conceptEval, error: insertError } = await supabase
      .from("concept_evaluations")
      .insert({
        user_id: userId,
        subject_id: doc.subject_id,
        document_id: docId,
        question,
        user_answer: userAnswer,
        score: evaluation.score,
        feedback: evaluation,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to save concept evaluation", insertError);
      throw insertError;
    }

    // 5. Award XP based on scores
    if (evaluation.score >= 80) {
      // Perfect/Excel reward
      await awardXP(userId, "daily_activity", { score: evaluation.score });
    } else if (evaluation.score >= 50) {
      // Normal effort reward
      await awardXP(userId, "daily_activity", { score: evaluation.score });
    }

    // Trigger dynamic weakness update check in background
    triggerWeaknessReevaluation(userId);

    return { success: true, evaluation: conceptEval };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to run concept evaluation server action", err);
    return { success: false, error: err.message };
  }
}

export async function getConceptEvaluationsAction(docId?: string) {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    let query = supabase
      .from("concept_evaluations")
      .select("*, documents(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (docId) {
      query = query.eq("document_id", docId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, evaluations: data };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}

// 3. QUIZ ATTEMPT RECORDER (For Adaptive Custom Quizzes)
export async function saveCoachQuizAttemptAction(
  subjectId: string,
  docId: string,
  title: string,
  questions: Record<string, unknown>[],
  score: number,
  totalQuestions: number
) {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    // Save attempt directly in `quizzes` table matching schema
    const { data: quizAttempt, error } = await supabase
      .from("quizzes")
      .insert({
        user_id: userId,
        subject_id: subjectId || null,
        document_id: docId || null,
        title,
        questions: questions as unknown as Record<string, unknown>[],
        score,
        total_questions: totalQuestions,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to save custom quiz attempt in quizzes table", error);
      throw error;
    }

    // Award XP
    await awardXP(userId, "complete_quiz", { score, totalQuestions });

    // Trigger dynamic weakness re-evaluation in background
    triggerWeaknessReevaluation(userId);

    return { success: true, quizAttempt };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to log coach quiz session", err);
    return { success: false, error: err.message };
  }
}

// 4. WEAKNESS DETECTION ACTIONS
export async function getAcademicHealthAction() {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    // Fetch existing records from weakness_tracking
    const { data, error } = await supabase
      .from("weakness_tracking")
      .select("*, subjects(name)")
      .eq("user_id", userId);

    if (error) throw error;

    return { success: true, weaknesses: data };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}

// Triggers an asynchronous recheck of the user's weak points and updates weakness_tracking table
async function triggerWeaknessReevaluation(userId: string) {
  try {
    const supabase = await createClient();

    // 1. Gather all historical quiz results
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("id, title, score, total_questions, created_at, subject_id")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(15);

    // 2. Gather concept evaluations
    const { data: conceptEvals } = await supabase
      .from("concept_evaluations")
      .select("id, question, score, feedback, created_at, subject_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15);

    if ((!quizzes || quizzes.length === 0) && (!conceptEvals || conceptEvals.length === 0)) {
      return; // No data yet to analyze
    }

    // Call Gemini diagnostic
    const analysis = await detectWeaknesses(quizzes || [], conceptEvals || []);

    // Save or update for each subject analyzed
    for (const [subjName, health] of Object.entries(analysis.academicHealthScores)) {
      // Find subject ID by name
      const { data: subj } = await supabase
        .from("subjects")
        .select("id")
        .eq("user_id", userId)
        .ilike("name", subjName)
        .maybeSingle();

      if (!subj) continue;

      const weak = analysis.weakConcepts[subjName] || [];
      const strong = analysis.strongConcepts[subjName] || [];
      const confidence = analysis.confidenceLevels[subjName] || 50;

      let score = 100;
      if (health === "Weak") score = 40;
      else if (health === "Moderate") score = 70;

      await supabase
        .from("weakness_tracking")
        .upsert({
          user_id: userId,
          subject_id: subj.id,
          weak_concepts: weak,
          strong_concepts: strong,
          confidence_levels: { [subjName]: confidence } as unknown as Record<string, number>,
          health_score: score,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,subject_id" });
    }
  } catch (error) {
    logger.error("Failed to auto-update weakness statistics", error);
  }
}

export async function forceUpdateWeaknessesAction() {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);
    await triggerWeaknessReevaluation(userId);
    return { success: true };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}

// 5. EXAM READINESS ACTIONS
export async function getExamReadinessAction(subjectId: string) {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    // 1. Fetch Subject
    const { data: subject } = await supabase
      .from("subjects")
      .select("name")
      .eq("id", subjectId)
      .single();

    if (!subject) throw new Error("Subject does not exist.");

    // 2. Fetch Quiz History for this subject
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("score, total_questions, title, created_at")
      .eq("user_id", userId)
      .eq("subject_id", subjectId)
      .eq("status", "completed");

    // 3. Fetch Weak concepts for this subject
    const { data: weakTrack } = await supabase
      .from("weakness_tracking")
      .select("weak_concepts")
      .eq("user_id", userId)
      .eq("subject_id", subjectId)
      .maybeSingle();

    // 4. Fetch document summaries in this subject
    const { data: docs } = await supabase
      .from("documents")
      .select("id")
      .eq("user_id", userId)
      .eq("subject_id", subjectId);

    const summaries: string[] = [];
    if (docs && docs.length > 0) {
      const docIds = docs.map(d => d.id);
      const { data: sums } = await supabase
        .from("ai_summaries")
        .select("summary_text")
        .in("document_id", docIds);
      if (sums) {
        sums.forEach(s => summaries.push(s.summary_text));
      }
    }

    // 5. Run AI calculation
    const result = await calculateExamReadiness(
      subject.name,
      quizzes || [],
      weakTrack?.weak_concepts || [],
      summaries
    );

    // 6. Save in exam_readiness
    const { data: readiness, error: upsertError } = await supabase
      .from("exam_readiness")
      .upsert({
        user_id: userId,
        subject_id: subjectId,
        readiness_score: result.readinessPercentage,
        missing_topics: result.missingTopics,
        predicted_topics: result.predictedTopics,
        rapid_revision_plan: result.rapidRevisionPlan,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,subject_id" })
      .select()
      .single();

    if (upsertError) throw upsertError;

    return { success: true, readiness };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to estimate exam readiness", err);
    return { success: false, error: err.message };
  }
}

export async function getAllReadinessAction() {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    const { data, error } = await supabase
      .from("exam_readiness")
      .select("*, subjects(name)")
      .eq("user_id", userId);

    if (error) throw error;
    return { success: true, readinessList: data };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}

// 6. PRODUCTIVITY INSIGHTS ACTION
export async function getProductivityInsightsAction() {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    // Get active study logs in last 10 days
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - 10);
    
    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("duration_minutes, focus_score, created_at")
      .eq("user_id", userId)
      .gt("created_at", daysAgo.toISOString());

    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("score, total_questions, created_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gt("created_at", daysAgo.toISOString());

    // Compile simple text log for Gemini
    const activityLogs = [
      ...(sessions || []).map(s => `Focus Session on ${new Date(s.created_at).toDateString()}: duration ${s.duration_minutes}m, focus rating ${s.focus_score}/10`),
      ...(quizzes || []).map(q => `Completed Quiz on ${new Date(q.created_at).toDateString()}: answered ${q.score}/${q.total_questions} correctly`),
    ];

    // Call Gemini insights generator
    const result = await generateProductivityInsights(activityLogs);

    // Save in DB
    const { data: insightRow, error: upsertError } = await supabase
      .from("productivity_insights")
      .upsert({
        user_id: userId,
        insights: result as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (upsertError) throw upsertError;

    return { success: true, insights: insightRow.insights };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to fetch productivity logs", err);
    return { success: false, error: err.message };
  }
}

// 7. STUDY COACH HUB DATA AGGREGATOR
export interface StudyCoachHubData {
  subjects: { id: string; name: string; code: string; color: string }[];
  lectures: { id: string; title: string; subject_id: string; upload_date: string }[];
  streak: number;
  totalXP: number;
  level: number;
  overallHealthScore: number;
  overallReadiness: number;
}

export async function getStudyCoachHubDataAction(): Promise<{ success: boolean; data?: StudyCoachHubData; error?: string }> {
  try {
    const supabase = await createClient();
    const userId = await getUserId(supabase);

    // Fetch user subjects
    const { data: subjects } = await supabase
      .from("subjects")
      .select("id, name, code, color")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    // Fetch uploaded documents
    const { data: docs } = await supabase
      .from("documents")
      .select("id, title, subject_id, upload_date")
      .eq("user_id", userId)
      .order("upload_date", { ascending: false });

    // Fetch gamification stats
    const activity = await getDynamicActivityStats(userId);
    const { data: progress } = await supabase
      .from("user_progress")
      .select("total_xp, current_level")
      .eq("user_id", userId)
      .maybeSingle();

    // Fetch Academic Health scores
    const { data: weaknessRows } = await supabase
      .from("weakness_tracking")
      .select("health_score")
      .eq("user_id", userId);

    let healthSum = 0;
    let overallHealthScore = 80; // default standard
    if (weaknessRows && weaknessRows.length > 0) {
      weaknessRows.forEach(w => healthSum += w.health_score || 100);
      overallHealthScore = Math.round(healthSum / weaknessRows.length);
    }

    // Fetch Exam Readiness ratings
    const { data: readinessRows } = await supabase
      .from("exam_readiness")
      .select("readiness_score")
      .eq("user_id", userId);

    let readinessSum = 0;
    let overallReadiness = 0;
    if (readinessRows && readinessRows.length > 0) {
      readinessRows.forEach(r => readinessSum += r.readiness_score || 0);
      overallReadiness = Math.round(readinessSum / readinessRows.length);
    }

    return {
      success: true,
      data: {
        subjects: subjects || [],
        lectures: docs || [],
        streak: activity.currentStreak || 0,
        totalXP: progress?.total_xp || 0,
        level: progress?.current_level || 1,
        overallHealthScore,
        overallReadiness,
      }
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Failed to compile Study Coach hub info", err);
    return { success: false, error: err.message };
  }
}
