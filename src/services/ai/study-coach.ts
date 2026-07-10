import { routeAIRequest } from './router';
import { logger } from '@/lib/logger';
import {
  STUDY_PLAN_RESPONSE_SCHEMA,
  CONCEPT_EVALUATION_RESPONSE_SCHEMA,
  buildStudyPlannerPrompt,
  buildConceptEvalPrompt
} from './agents/study-coach';
import {
  WEAKNESS_RESPONSE_SCHEMA,
  buildWeaknessDetectionPrompt
} from './agents/analytics';

// Interface types
export interface ConceptEvaluationResult {
  score: number; // 0 - 100
  understandingLevel: 'Strong' | 'Moderate' | 'Weak';
  strengths: string[];
  weakAreas: string[];
  missingConcepts: string[];
  suggestions: string[];
}

export interface StudyTask {
  time: string; // e.g. "09:00 AM - 10:30 AM"
  subject: string;
  activity: string; // e.g. "Focus Session: Process Synchronization"
  type: 'focus' | 'revision' | 'quiz' | 'break';
  durationMinutes: number;
}

export interface DailyPlan {
  day: string; // e.g. "Monday"
  tasks: StudyTask[];
  productivityTip: string;
}

export interface WeeklySchedule {
  weekGoal: string;
  dailyPlans: DailyPlan[];
}

export interface StudyPlanData {
  weeklySchedule: WeeklySchedule;
  revisionStrategy: string[];
  breakRecommendations: string[];
  productivitySuggestions: string[];
}

export interface StudyPlannerParams {
  hoursPerDay: number;
  examDates: Record<string, string>; // subject -> date
  weakSubjects: string[];
  sleepSchedule: string;
  moodLevel: string;
  academicGoals: string;
  prepLevel: string;
  learningStyle: string;
  backlogSubjects: string[];
}

export interface WeaknessDetectionResult {
  academicHealthScores: Record<string, 'Strong' | 'Moderate' | 'Weak'>;
  weakConcepts: Record<string, string[]>;
  strongConcepts: Record<string, string[]>;
  confidenceLevels: Record<string, number>; // 0 - 100
  recommendedRevisions: string[];
}

export interface ExamReadinessResult {
  readinessPercentage: number;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  revisionCompletion: number; // 0 - 100
  missingTopics: string[];
  predictedTopics: string[];
  rapidRevisionPlan: string[];
}

export interface ProductivityInsightsResult {
  motivationMessage: string;
  productivityScore: number; // 0 - 100
  consistencyRating: 'Increasing' | 'Stable' | 'Declining';
  burnoutRisk: 'Low' | 'Moderate' | 'High';
  smartBreakSuggestions: string[];
  recommendedFocusInterval: string;
}

export interface QuizHistoryItem {
  title: string;
  score: number;
  total_questions: number;
  created_at: string;
}

export interface ConceptEvaluationItem {
  question: string;
  score: number;
  feedback: string;
  created_at: string;
}

interface SubjectAnalysisItem {
  subjectName: string;
  healthScore: 'Strong' | 'Moderate' | 'Weak';
  weakConcepts?: string[];
  strongConcepts?: string[];
  confidenceLevel?: number;
}

// 1. CONCEPT EVALUATION
export async function evaluateConceptAnswer(
  question: string,
  userAnswer: string,
  documentText: string
): Promise<ConceptEvaluationResult> {
  try {
    const prompt = buildConceptEvalPrompt(question, userAnswer, documentText);

    logger.info('[Study Coach] Rerouting concept evaluation to AI Router...');
    const routerRes = await routeAIRequest({
      userId: 'system', // Router checks usage logic
      taskType: 'tutoring', // Route C Premium model
      prompt,
      responseMimeType: 'application/json',
      responseSchema: CONCEPT_EVALUATION_RESPONSE_SCHEMA
    });

    if (!routerRes.success) {
      throw new Error(`Concept evaluation failed: ${routerRes.content}`);
    }

    return JSON.parse(routerRes.content) as ConceptEvaluationResult;
  } catch (error) {
    logger.error('Failed to evaluate concept answer via AI Router', error);
    return {
      score: 50,
      understandingLevel: 'Moderate',
      strengths: ['Attempted to answer the prompt conceptually.'],
      weakAreas: ['An error occurred during AI evaluation. Please try again.'],
      missingConcepts: ['AI evaluation payload failed to load.'],
      suggestions: ['Check your internet connection and re-submit your response.']
    };
  }
}

// 2. AI STUDY PLANNER
export async function generateAIStudyPlan(
  params: StudyPlannerParams
): Promise<StudyPlanData> {
  try {
    const prompt = buildStudyPlannerPrompt(params);

    logger.info('[Study Coach] Rerouting study planner to AI Router...');
    const routerRes = await routeAIRequest({
      userId: 'system',
      taskType: 'study-coaching', // Route C Premium model
      prompt,
      responseMimeType: 'application/json',
      responseSchema: STUDY_PLAN_RESPONSE_SCHEMA
    });

    if (!routerRes.success) {
      throw new Error(`Study planner generation failed: ${routerRes.content}`);
    }

    return JSON.parse(routerRes.content) as StudyPlanData;
  } catch (error) {
    logger.error('Failed to generate study plan via AI Router', error);
    return {
      weeklySchedule: {
        weekGoal: 'Review core course structures and schedule consistent study routines.',
        dailyPlans: [
          {
            day: 'Monday',
            tasks: [
              { time: '09:00 AM - 10:00 AM', subject: 'General Study', activity: 'Initial conceptual active recall review', type: 'focus', durationMinutes: 60 }
            ],
            productivityTip: 'Use Pomodoro cycles: 25 minutes studying, 5 minutes off.'
          }
        ]
      },
      revisionStrategy: ['Focus on active recall instead of passive textbook reading.'],
      breakRecommendations: ['Walk outside for 5 minutes during breaks to rest your eyes.'],
      productivitySuggestions: ['Review notes before sleeping to enhance memory consolidation.']
    };
  }
}

// 3. WEAKNESS DETECTION & ACADEMIC HEALTH
export async function detectWeaknesses(
  quizHistory: QuizHistoryItem[],
  conceptEvaluations: ConceptEvaluationItem[]
): Promise<WeaknessDetectionResult> {
  try {
    const cleanQuizHistory = quizHistory.map(q => ({ title: q.title, score: q.score, total: q.total_questions, date: q.created_at }));
    const cleanConceptHistory = conceptEvaluations.map(c => ({ question: c.question, score: c.score, feedback: c.feedback, date: c.created_at }));

    const prompt = buildWeaknessDetectionPrompt(cleanQuizHistory, cleanConceptHistory);

    logger.info('[Study Coach] Rerouting weakness detection to AI Router...');
    const routerRes = await routeAIRequest({
      userId: 'system',
      taskType: 'analytics-calc', // Route A locally or cheap Route B
      prompt,
      responseMimeType: 'application/json',
      responseSchema: WEAKNESS_RESPONSE_SCHEMA
    });

    if (!routerRes.success) {
      throw new Error(`Weakness detection failed: ${routerRes.content}`);
    }

    const parsed = JSON.parse(routerRes.content);

    const academicHealthScores: Record<string, 'Strong' | 'Moderate' | 'Weak'> = {};
    const weakConcepts: Record<string, string[]> = {};
    const strongConcepts: Record<string, string[]> = {};
    const confidenceLevels: Record<string, number> = {};

    if (parsed.subjectAnalysis && Array.isArray(parsed.subjectAnalysis)) {
      parsed.subjectAnalysis.forEach((item: SubjectAnalysisItem) => {
        const key = item.subjectName;
        academicHealthScores[key] = item.healthScore;
        weakConcepts[key] = item.weakConcepts || [];
        strongConcepts[key] = item.strongConcepts || [];
        confidenceLevels[key] = item.confidenceLevel || 70;
      });
    }

    return {
      academicHealthScores,
      weakConcepts,
      strongConcepts,
      confidenceLevels,
      recommendedRevisions: parsed.recommendedRevisions || []
    };
  } catch (error) {
    logger.error('Failed to detect academic weaknesses via AI Router', error);
    return {
      academicHealthScores: {},
      weakConcepts: {},
      strongConcepts: {},
      confidenceLevels: {},
      recommendedRevisions: ['Complete a quiz session to trigger weakness analysis feedback.']
    };
  }
}

// 4. EXAM READINESS ESTIMATION
export async function calculateExamReadiness(
  subjectName: string,
  quizAttempts: QuizHistoryItem[],
  weakAreas: string[],
  referenceSummaries: string[]
): Promise<ExamReadinessResult> {
  try {
    const prompt = `
      You are "Neuron Exam readiness Analyst". Analyze the student's preparation status for: "${subjectName}".
      
      STUDENT METRICS:
      - Weak Concepts: ${JSON.stringify(weakAreas)}
      - Performance History: ${JSON.stringify(quizAttempts)}
      - Reference Summaries: ${JSON.stringify(referenceSummaries.map(s => s.substring(0, 500)))}
      
      Estimate readiness (0-100), missing topics, predicted topics, and a 3-step rapid revision plan.
      Output strictly in JSON matching the Schema:
      {
        "readinessPercentage": 85,
        "confidenceLevel": "High",
        "revisionCompletion": 75,
        "missingTopics": ["A", "B"],
        "predictedTopics": ["C"],
        "rapidRevisionPlan": ["Step 1", "Step 2"]
      }
    `;

    logger.info('[Study Coach] Rerouting exam readiness to AI Router...');
    const routerRes = await routeAIRequest({
      userId: 'system',
      taskType: 'academic-mentoring', // Route C Premium model
      prompt,
      responseMimeType: 'application/json'
    });

    if (!routerRes.success) {
      throw new Error(`Exam readiness failed: ${routerRes.content}`);
    }

    return JSON.parse(routerRes.content) as ExamReadinessResult;
  } catch (error) {
    logger.error('Failed to estimate exam readiness via AI Router', error);
    return {
      readinessPercentage: 50,
      confidenceLevel: 'Medium',
      revisionCompletion: 40,
      missingTopics: ['Unresolved lecture content reviews.'],
      predictedTopics: ['Core syllabus fundamentals.'],
      rapidRevisionPlan: ['Review lecture notes and take the adaptive diagnostic MCQ quizzes.']
    };
  }
}

// 5. PRODUCTIVITY INSIGHTS & MOTIVATION
export async function generateProductivityInsights(
  recentActivityLogs: unknown[]
): Promise<ProductivityInsightsResult> {
  try {
    const prompt = `
      You are "Neuron Productivity Coach". Analyze the student's study activity logs:
      ${JSON.stringify(recentActivityLogs)}
      
      Generate a motivation message, consistency rating ('Increasing', 'Stable', 'Declining'), burnout risk ('Low', 'Moderate', 'High'), smart break suggestions, and recommended Pomodoro interval.
      Output strictly in JSON matching the Schema:
      {
        "motivationMessage": "Message",
        "productivityScore": 80,
        "consistencyRating": "Stable",
        "burnoutRisk": "Low",
        "smartBreakSuggestions": ["Break 1"],
        "recommendedFocusInterval": "25/5"
      }
    `;

    logger.info('[Study Coach] Rerouting productivity insights to AI Router...');
    const routerRes = await routeAIRequest({
      userId: 'system',
      taskType: 'study-coaching', // Route C Premium model
      prompt,
      responseMimeType: 'application/json'
    });

    if (!routerRes.success) {
      throw new Error(`Productivity insights failed: ${routerRes.content}`);
    }

    return JSON.parse(routerRes.content) as ProductivityInsightsResult;
  } catch (error) {
    logger.error('Failed to generate productivity insights via AI Router', error);
    return {
      motivationMessage: 'Every active study session strengthens your memory pathways. Consistency is key!',
      productivityScore: 70,
      consistencyRating: 'Stable',
      burnoutRisk: 'Low',
      smartBreakSuggestions: [
        'Take a 5-minute visual break: focus on objects 20 feet away to relax eye muscles.',
        'Stretch your neck and shoulders to release focus-induced physical tension.'
      ],
      recommendedFocusInterval: '25 mins Focus / 5 mins Break'
    };
  }
}
