import { Schema, SchemaType } from '@google/generative-ai';

export const STUDY_COACH_SYSTEM_INSTRUCTION = `
You are "Study Coach Agent", an elite university academic advisor and performance coach. Your goal is to guide students to maximum academic performance, optimal scheduling, and structured study consistency.

CORE DIRECTIVES:
- Maintain a rigorous, supportive, and motivating academic tone.
- Base scheduling and revisions on scientific spacing, active recall frequency, and cognitive load distribution.
- Support students' preferred learning styles (visual, auditory, kinesthetic, read_write).
- Highlight burnout warning flags immediately if study schedules conflict with rest patterns.
`;

export const STUDY_PLAN_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  description: 'Fully optimized dynamic study schedule.',
  properties: {
    weeklySchedule: {
      type: SchemaType.OBJECT,
      properties: {
        weekGoal: { type: SchemaType.STRING },
        dailyPlans: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              day: { type: SchemaType.STRING },
              tasks: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    time: { type: SchemaType.STRING },
                    subject: { type: SchemaType.STRING },
                    activity: { type: SchemaType.STRING },
                    type: { type: SchemaType.STRING, enum: ['focus', 'revision', 'quiz', 'break'] } as unknown as Schema,
                    durationMinutes: { type: SchemaType.INTEGER }
                  },
                  required: ['time', 'subject', 'activity', 'type', 'durationMinutes']
                }
              },
              productivityTip: { type: SchemaType.STRING }
            },
            required: ['day', 'tasks', 'productivityTip']
          }
        }
      },
      required: ['weekGoal', 'dailyPlans']
    },
    revisionStrategy: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    breakRecommendations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    productivitySuggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
  },
  required: ['weeklySchedule', 'revisionStrategy', 'breakRecommendations', 'productivitySuggestions']
};

export const CONCEPT_EVALUATION_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  description: 'AI evaluation of a written student answer.',
  properties: {
    score: { type: SchemaType.INTEGER, description: 'Conceptual grade out of 100.' },
    understandingLevel: { type: SchemaType.STRING, enum: ['Strong', 'Moderate', 'Weak'] } as unknown as Schema,
    strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    weakAreas: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    missingConcepts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    suggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
  },
  required: ['score', 'understandingLevel', 'strengths', 'weakAreas', 'missingConcepts', 'suggestions']
};

export function buildStudyPlannerPrompt(params: any): string {
  return `
Your task is to generate a highly detailed, personalized 7-day study plan tailored to the student's needs.

STUDENT PARAMETERS:
- Available time: ${params.hoursPerDay} hours/day
- Target Exams: ${JSON.stringify(params.examDates)}
- Weak subjects: ${JSON.stringify(params.weakSubjects)}
- Backlogs: ${JSON.stringify(params.backlogSubjects)}
- Prep Level: ${params.prepLevel}
- Learning Style: ${params.learningStyle}
- Current Date Context: ${new Date().toISOString()}

Ensure you schedule active focus blocks, revision intervals, and spacing breaks. Restrict study blocks during their sleep schedule: ${params.sleepSchedule}.
Output strictly in JSON matching the STUDY_PLAN_RESPONSE_SCHEMA.
`;
}

export function buildConceptEvalPrompt(question: string, userAnswer: string, referenceText: string): string {
  return `
Analyze the student's answer to a conceptual question based on the reference materials.

QUESTION: "${question}"
STUDENT'S ANSWER: "${userAnswer}"

REFERENCE TEXT:
"""
${referenceText.substring(0, 16000)}
"""

Evaluate their response with academic rigor. Output the analysis strictly matching the CONCEPT_EVALUATION_RESPONSE_SCHEMA.
`;
}
