import { ContextPackage } from './context-builder';
import { UniversalAIResponseEngine, SkillResponseContract } from './response-engine';
import { logger } from '@/lib/logger';
import * as fs from 'fs';
import * as path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AcademicGoal =
  | 'Exam Preparation'
  | 'Practice'
  | 'Deep Understanding'
  | 'Assignment Completion'
  | 'General Q&A';

export interface ExecutionPlanStep {
  skillId: string;
  priority: number;
  // Allows mapping preceding outputs to parameters.
  // E.g., { "previousSummary": "SummarizeLecture" } means map step SummarizeLecture's result to variable previousSummary.
  variableMappings?: Record<string, string>;
}

export interface ExecutionPlan {
  userGoal: AcademicGoal;
  intent: string;
  steps: ExecutionPlanStep[];
  reasoningSummary: string;
  createdAt: string;
}

// ── AI Skill Orchestrator ─────────────────────────────────────────────────────

export class AISkillOrchestrator {
  /**
   * Identifies user intent and academic goal to produce a structured execution plan.
   */
  static plan(query: string): ExecutionPlan {
    const startTimeMs = Date.now();
    logger.info(`[Orchestrator] Planning execution for query: "${query}"`);

    // 1. Detect Intent using deterministic regex patterns
    let intent = 'AnswerQuestion';
    
    const intentPatterns: Record<string, RegExp[]> = {
      SimplifyTopic: [/simplify/i, /explain simply/i, /eli5/i, /like i am 5/i],
      GenerateFlashcards: [/flashcard/i, /active recall/i, /make cards/i, /study card/i],
      GenerateQuiz: [/quiz/i, /test me/i, /practice question/i, /assessment/i, /mcq/i],
      SummarizeLecture: [/summarize/i, /summary/i, /overview/i, /breakdown/i],
      GenerateKeyPoints: [/key points/i, /bullet points/i, /takeaways/i, /core facts/i],
      CompareConcepts: [/compare/i, /difference between/i, /versus/i, /vs/i],
      CreateStudyPlan: [/study plan/i, /schedule/i, /revision plan/i, /calendar/i],
      EvaluateAnswer: [/evaluate answer/i, /grade my/i, /assess my/i, /check my answer/i],
      GenerateMnemonics: [/mnemonic/i, /acronym/i, /help me memorize/i],
      GenerateExamples: [/example/i, /code snippet/i, /demonstrate/i],
      ExplainConcept: [/explain/i, /what is/i, /how does/i, /define/i, /concept/i]
    };

    for (const [skillId, regexes] of Object.entries(intentPatterns)) {
      if (regexes.some(rx => rx.test(query))) {
        intent = skillId;
        break;
      }
    }

    // 2. Detect Academic Goal
    let goal: AcademicGoal = 'General Q&A';

    const goalPatterns: Record<AcademicGoal, RegExp[]> = {
      'Exam Preparation': [/exam/i, /test tomorrow/i, /finals/i, /midterm/i, /test next week/i, /help me pass/i],
      'Practice': [/practice/i, /quiz me/i, /test me/i, /solve questions/i],
      'Assignment Completion': [/assignment/i, /homework/i, /project/i, /lab/i, /solve task/i],
      'Deep Understanding': [/don't understand/i, /confused/i, /simplify/i, /explain simply/i, /eli5/i],
      'General Q&A': []
    };

    for (const [goalId, regexes] of Object.entries(goalPatterns)) {
      if (regexes.some(rx => rx.test(query))) {
        goal = goalId as AcademicGoal;
        break;
      }
    }

    // 3. Build execution steps based on goal complexity
    const steps: ExecutionPlanStep[] = [];
    let reasoningSummary = '';

    // Multi-skill execution mapping rules
    if (goal === 'Exam Preparation' && intent === 'AnswerQuestion') {
      reasoningSummary = 'Exam preparation goal detected. Generating structured learning plan with summaries, points, cards, quizzes, and schedules.';
      steps.push(
        { skillId: 'SummarizeLecture', priority: 1 },
        { skillId: 'GenerateKeyPoints', priority: 2 },
        { skillId: 'GenerateFlashcards', priority: 3, variableMappings: { query: 'SummarizeLecture' } },
        { skillId: 'GenerateQuiz', priority: 4, variableMappings: { query: 'SummarizeLecture' } },
        { skillId: 'CreateStudyPlan', priority: 5, variableMappings: { query: 'SummarizeLecture' } }
      );
    } else if (goal === 'Practice' && intent === 'AnswerQuestion') {
      reasoningSummary = 'Practice objective detected. Generating diagnostic quizzes and study flashcards.';
      steps.push(
        { skillId: 'GenerateFlashcards', priority: 1 },
        { skillId: 'GenerateQuiz', priority: 2 }
      );
    } else if (goal === 'Deep Understanding' && intent === 'AnswerQuestion') {
      reasoningSummary = 'Deep learning block detected. Explaining concepts fully, simplifying mechanisms, and providing examples.';
      steps.push(
        { skillId: 'ExplainConcept', priority: 1 },
        { skillId: 'SimplifyTopic', priority: 2 },
        { skillId: 'GenerateExamples', priority: 3 }
      );
    } else {
      // Default / Single-skill mapping rules
      reasoningSummary = `Direct request mapped to single active skill: ${intent}.`;
      steps.push({ skillId: intent, priority: 1 });
    }

    const plan: ExecutionPlan = {
      userGoal: goal,
      intent,
      steps,
      reasoningSummary,
      createdAt: new Date().toISOString()
    };

    const durationMs = Date.now() - startTimeMs;
    this.logOrchestrationToDisk(query, plan, durationMs);

    return plan;
  }

  /**
   * Executes the orchestration plan sequentially, supporting value-chain mappings.
   */
  static async executePlan(
    plan: ExecutionPlan,
    params: {
      query: string;
      context: ContextPackage;
      userId: string;
      variables?: Record<string, any>;
      skipCache?: boolean;
    }
  ): Promise<SkillResponseContract[]> {
    const results: SkillResponseContract[] = [];
    const executionCache = new Map<string, string>(); // Maps skillId -> generatedContent result

    logger.info(`[Orchestrator] Executing plan containing ${plan.steps.length} steps.`);
    
    // Execute plan steps in priority order
    const sortedSteps = [...plan.steps].sort((a, b) => a.priority - b.priority);

    for (const step of sortedSteps) {
      const stepVariables = { ...(params.variables || {}) };

      // Check if this step depends on the output of a previous step
      if (step.variableMappings) {
        for (const [targetVar, sourceSkillId] of Object.entries(step.variableMappings)) {
          if (executionCache.has(sourceSkillId)) {
            stepVariables[targetVar] = executionCache.get(sourceSkillId)!;
          }
        }
      }

      // Execute skill through Universal AI Response Engine
      const res = await UniversalAIResponseEngine.executeSkill(step.skillId, {
        query: params.query,
        context: params.context,
        userId: params.userId,
        variables: stepVariables,
        skipCache: params.skipCache
      });

      results.push(res);

      if (res.success) {
        executionCache.set(step.skillId, res.generatedContent);
      }
    }

    return results;
  }

  // ── Logging Helper ──────────────────────────────────────────────────────────

  private static logOrchestrationToDisk(
    query: string,
    plan: ExecutionPlan,
    durationMs: number
  ) {
    try {
      const ts = new Date().toISOString();
      const skillsStr = plan.steps.map(s => s.skillId).join(' -> ');
      const logMsg = `[${ts}] [Orchestrator] Query: "${query}" | Intent: ${plan.intent} | Goal: ${plan.userGoal} | Plan: [${skillsStr}] | Reasoning: ${plan.reasoningSummary} | Duration: ${durationMs}ms\n`;
      fs.appendFileSync(path.join(process.cwd(), 'background_logs.txt'), logMsg);
    } catch { /* ignore */ }
  }
}
