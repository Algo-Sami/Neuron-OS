import { Schema, SchemaType } from '@google/generative-ai';

export const QUIZ_AGENT_SYSTEM_INSTRUCTION = `
You are "Quiz Agent", an expert academic psychometrician and assessor. Your task is to generate premium, highly accurate academic study quizzes based on provided course materials.

CRITICAL CONTENT RESTRICTIONS:
- NEVER ask questions about document metadata. This includes: university names, department headers, course codes, lecture numbers, chapter numbers, document titles, file names, student names, instructor names, semesters, or administrative info.
- ONLY generate questions testing the actual academic subject matter, theories, concepts, definitions, processes, and facts.
- Spread questions evenly across different sections and topics in the text to avoid clustering.

QUESTION TYPES:
- 'mcq': Multiple Choice Questions. Must have exactly 4 choices in the options list. Correct answer must be the zero-based index of the correct option ("0", "1", "2", "3").
- 'true_false': True/False Questions. Options list must be exactly ["True", "False"]. Correct answer must be either "True" or "False".
- 'short_answer': Conceptual short write-up testing definitions and mechanisms. Correct answer is a perfect model response. Provide 2-4 key terms in the 'keyPoints' array.
- 'long_answer': In-depth analytical questions testing syntheses and complex reasoning.
- 'viva': Typical verbal exam questions testing oral defense capacity.

DIFFICULTY LEVEL REGULATION:
- EASY: Focus on factual definitions, terms, and direct textbook facts.
- MEDIUM: Focus on comprehension, connections between ideas, processes, and basic analysis.
- HARD: Focus on advanced theoretical edge cases, scenarios, logical fallacies, and deep syntheses.
- ADAPTIVE: Incorporate a mix of easy, medium, and hard questions based on performance context.
`;

export const QUIZ_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.ARRAY,
  description: 'List of generated quiz questions matching difficulty and context.',
  items: {
    type: SchemaType.OBJECT,
    properties: {
      id: { type: SchemaType.STRING, description: 'Unique question ID, e.g. "q_1", "q_2".' },
      type: { 
        type: SchemaType.STRING, 
        enum: ['mcq', 'true_false', 'short_answer', 'long_answer', 'viva'], 
        description: 'Categorization of question.' 
      } as unknown as Schema,
      questionText: { type: SchemaType.STRING, description: 'Engaging, clear question text.' },
      options: { 
        type: SchemaType.ARRAY, 
        items: { type: SchemaType.STRING },
        description: 'For mcq: exactly 4 options. For true_false: ["True", "False"]. For others: empty array.'
      },
      correctAnswer: { 
        type: SchemaType.STRING, 
        description: 'Correct answer index as string for mcq ("0"-"3"). "True"/"False" for true_false. Model answer for short/long/viva.' 
      },
      explanation: { type: SchemaType.STRING, description: 'Detailed, conceptual explanation.' },
      keyPoints: { 
        type: SchemaType.ARRAY, 
        items: { type: SchemaType.STRING },
        description: 'For short/long/viva: 2 to 4 core grading criteria words/phrases. Empty for mcq/tf.' 
      },
      difficulty: { 
        type: SchemaType.STRING, 
        enum: ['easy', 'medium', 'hard'], 
        description: 'Assigned difficulty of this specific question.' 
      } as unknown as Schema
    },
    required: ['id', 'type', 'questionText', 'correctAnswer', 'explanation', 'difficulty']
  }
};

export function buildQuizGenerationPrompt(
  text: string,
  title: string,
  difficulty: 'easy' | 'medium' | 'hard' | 'adaptive',
  excludeQuestionTexts?: string[],
  count: number = 10
): string {
  let difficultyDirective = '';
  if (difficulty === 'easy') {
    difficultyDirective = 'Focus strictly on basic definitions and direct terms. Questions should test straightforward factual recall.';
  } else if (difficulty === 'medium') {
    difficultyDirective = 'Focus on understanding processes and connections. Test comprehension of details and logical relations.';
  } else if (difficulty === 'hard') {
    difficultyDirective = 'Focus on deep analytical scenarios, edge cases, mathematical formulation logic, and theoretical syntheses.';
  } else {
    difficultyDirective = 'Adaptive Mode: Provide a balanced mix (30% Easy, 40% Medium, 30% Hard) testing both foundational recall and analytical depth.';
  }

  let excludeDirective = '';
  if (excludeQuestionTexts && excludeQuestionTexts.length > 0) {
    excludeDirective = `\nSTRICT DUPLICATION EXCLUSION: Do NOT repeat or generate questions similar to:\n${excludeQuestionTexts.map(q => `- "${q}"`).join('\n')}`;
  }

  return `
Your task is to generate a comprehensive, premium academic study quiz of exactly ${count} questions based ONLY on the actual content of the provided study material.

DOCUMENT DETAILS:
- Title: "${title}"
- Target Difficulty: "${difficulty.toUpperCase()}"
- Difficulty Directive: ${difficultyDirective}
${excludeDirective}

QUIZ COMPOSITION REQUIREMENTS:
Generate a total of exactly ${count} questions. The breakdown must be:
- MCQs (Multiple Choice)
- True/False
- Short Answer / Conceptual
- Long Answer
- Viva Questions (Oral Review)

DOCUMENT TEXT SNIPPET:
"""
${text.substring(0, 24000)}
"""

Output the quiz strictly as a JSON array matching the designated schema. Do not include markdown wraps unless required by the parser.
`;
}
