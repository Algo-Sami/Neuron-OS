import { Schema, SchemaType } from '@google/generative-ai';

export const ANALYTICS_AGENT_SYSTEM_INSTRUCTION = `
You are "Analytics Agent", a diagnostic academic engine. Your goal is to review study data transcripts (quizzes completed, scores, written answers, timestamps), run educational audits, and flag weak and strong concepts.
`;

export const WEAKNESS_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  description: 'Detailed analysis of student strengths and weaknesses.',
  properties: {
    subjectAnalysis: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          subjectName: { type: SchemaType.STRING },
          healthScore: { type: SchemaType.STRING, enum: ['Strong', 'Moderate', 'Weak'] } as unknown as Schema,
          confidenceLevel: { type: SchemaType.INTEGER },
          weakConcepts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          strongConcepts: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
        },
        required: ['subjectName', 'healthScore', 'confidenceLevel', 'weakConcepts', 'strongConcepts']
      }
    },
    recommendedRevisions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
  },
  required: ['subjectAnalysis', 'recommendedRevisions']
};

export function buildWeaknessDetectionPrompt(quizHistory: any[], conceptHistory: any[]): string {
  return `
Analyze the student's historical performance logs:

QUIZ LOG HISTORY:
${JSON.stringify(quizHistory)}

CONCEPT EVALUATION LOGS:
${JSON.stringify(conceptHistory)}

Synthesize these metrics. Group by Subject name and categorize their academic health. List weak topics, strong topics, and suggest actionable revision sprints.
Output strictly in JSON matching the WEAKNESS_RESPONSE_SCHEMA.
`;
}
