import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { logger } from '@/lib/logger';
import { ExtractedDeadline, DocumentClassification, GeneratedQuestion } from '@/types';
import { AI_CONFIG } from '@/config';
import { MAX_CLASSIFICATION_TEXT_LENGTH, MAX_QUIZ_TEXT_LENGTH } from '@/constants';

// Lazy initialize the Gemini client to avoid crashes if environment variables are not set yet
let ai: GoogleGenerativeAI | null = null;

export function getAIClient(): GoogleGenerativeAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables.');
    }
    ai = new GoogleGenerativeAI(apiKey);
  }
  return ai;
}



/**
 * Uses Gemini AI to scan the document text for deadlines, homework, exams, quiz, or presentation dates.
 * Returns a structured JSON list of reminders.
 */
export async function extractDeadlinesFromText(text: string): Promise<ExtractedDeadline[]> {
  try {
    const aiClient = getAIClient();
    const model = aiClient.getGenerativeModel({ model: getAIModelName() });

    // Define strict response schema for reliable parsing
    const responseSchema: Schema = {
      type: SchemaType.ARRAY,
      description: 'List of deadlines, exams, quizzes, presentations, and assignment due dates found in the document.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: {
            type: SchemaType.STRING,
            description: 'Name of the task, exam, quiz, or presentation (e.g. Physics Lab Report, Midterm Exam, OS Quiz 1).'
          },
          description: {
            type: SchemaType.STRING,
            description: 'Short context or instructions related to the deadline.'
          },
          dueDate: {
            type: SchemaType.STRING,
            description: 'The due date formatted as a valid ISO 8601 string (YYYY-MM-DDTHH:mm:ssZ). If only a date is given, set the time to 23:59:59.'
          },
          type: {
            type: SchemaType.STRING,
            enum: ['assignment', 'exam', 'quiz', 'presentation', 'generic'],
            description: 'Categorization of the deadline.'
          } as unknown as Schema,
          priority: {
            type: SchemaType.STRING,
            enum: ['low', 'medium', 'high'],
            description: 'Priority of the reminder. High-stakes tasks like exams or major assignments = high; interactive tasks like quizzes or presentations = medium; reading or homework tasks = low or medium.'
          } as unknown as Schema,
          course: {
            type: SchemaType.STRING,
            description: 'Suggested course or subject name this task belongs to (e.g., "Operating Systems", "Calculus", "Physics").'
          }
        },
        required: ['title', 'dueDate', 'type', 'priority']
      }
    };

    const prompt = `
      You are an expert academic assistant designed to help students organize their schedule.
      Carefully read the following text extracted from a study material (such as a syllabus, lecture notes, or an assignment brief).
      Identify any explicit deadlines, assignment due dates, quiz dates, presentations, homework tasks, or exam schedules mentioned in the text.
      
      CRITICAL INSTRUCTIONS:
      - ONLY extract actual deadlines mentioned in the text.
      - If no deadlines or dates are explicitly mentioned, return an empty array.
      - Convert any relative dates (e.g., "next Monday", "end of this week", "in 3 days") relative to the current local date: ${new Date().toISOString()}.
      - Assign priority: 'high' for exams, final presentations, major assignments; 'medium' for quizzes, mid-term assignments, standard presentations; 'low' for readings, daily homework, and optional exercises.
      - Map the task to a course subject based on text context. If a subject isn't obvious, try to infer one or default to the most likely course name (e.g. Computer Science, Calculus, General Study).
      - Return the output strictly matching the JSON schema.
      
      DOCUMENT TEXT:
      \"\"\"
      ${text}
      \"\"\"
    `;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1, // Low temperature for maximum factual extraction
      }
    });

    const responseText = result.response.text();
    if (!responseText) return [];

    logger.info('Gemini deadline extraction response: ' + responseText);
    
    // Clean potential markdown backticks before parsing
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    return JSON.parse(cleanedText) as ExtractedDeadline[];

  } catch (error) {
    logger.error('Failed to extract deadlines using Gemini', error);
    return []; // Return empty array to gracefully avoid crashing the pipeline
  }
}

export function getAIModelName(): string {
  return AI_CONFIG.model;
}

/**
 * Classifies an uploaded document into a specific academic Subject, Topic, and Document Type.
 * Returns structured classification details with tags and a confidence score.
 */
export async function classifyAcademicDocument(
  fileName: string,
  textSnippet: string,
  fileType: string,
  existingSubjects: string[] = []
): Promise<DocumentClassification> {
  try {
    const aiClient = getAIClient();
    const model = aiClient.getGenerativeModel({ model: getAIModelName() });

    // Define strict response schema for reliable parsing
    const responseSchema: Schema = {
      type: SchemaType.OBJECT,
      description: 'AI-driven academic subject classification and course tagging results.',
      properties: {
        subject: {
          type: SchemaType.STRING,
          description: 'A standard, clean name of the university/academic course subject (e.g. Operating Systems, DBMS, Data Structures, AI, Calculus, Physics, Psychology). Use Capitalized naming.'
        },
        topic: {
          type: SchemaType.STRING,
          description: 'The specific topic, chapter, or sub-domain within the subject (e.g. CPU Scheduling, Normalization, Binary Trees, Neural Networks, Integration, Kinematics). Keep it short (1-3 words).'
        },
        docType: {
          type: SchemaType.STRING,
          description: 'The category of the document (e.g. Lecture Notes, Syllabus, Exam Paper, Assignment Brief, Lab Manual, Other).'
        },
        confidence: {
          type: SchemaType.NUMBER,
          description: 'Confidence score of the classification (between 0.00 and 1.00). If the document content is vague, out-of-scope, or lacks clear academic markers, assign a confidence lower than 0.70.'
        },
        tags: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: '3 to 5 specific academic keywords or concept tags extracted from the text.'
        }
      },
      required: ['subject', 'topic', 'docType', 'confidence', 'tags']
    };

    const prompt = `
      You are "Neuron Academic Organizer", an advanced AI classifier.
      Your job is to analyze the metadata of an uploaded file and classify it into an academic subject and course folder.
      
      FILE DETAILS:
      - Filename: "${fileName}"
      - File Extension: "${fileType}"
      
      EXTRACTED TEXT SNIPPET (First pages):
      \"\"\"
      ${textSnippet.substring(0, MAX_CLASSIFICATION_TEXT_LENGTH)}
      \"\"\"
      
      CRITICAL INSTRUCTIONS:
      1. Subject: Standard course names like "Data Structures", "DBMS", "Operating Systems", "Calculus", "AI", "Physics", etc.
         ${existingSubjects.length > 0 ? `\nVERY IMPORTANT: The user already has the following subjects created: [${existingSubjects.join(', ')}]. If the document belongs to one of these, you MUST output the exact existing subject name. Only invent a new subject if it clearly does not fit into any of the existing ones.` : ''}
      2. Topic: Specify the exact lecture topic or chapter (e.g. "Process Scheduling" instead of "Lecture 3").
      3. Confidence Score:
         - Assign a high score (0.80 to 1.00) if the document clearly belongs to a specific university course.
         - Assign a low score (0.00 to 0.79) if the document is generic, vague, or you are guessing.
      4. Output: Produce output strictly formatted to the JSON schema.
    `;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1,
      }
    });

    const responseText = result.response.text();
    if (!responseText) {
      throw new Error('Empty response received from Gemini');
    }

    logger.info('Gemini academic classification response: ' + responseText);
    
    // Clean potential markdown backticks before parsing
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```/, '').replace(/```$/, '').trim();
    }
    
    return JSON.parse(cleanedText) as DocumentClassification;

  } catch (error) {
    logger.error('Failed to classify document using Gemini', error);
    // Return a safe fallback classification so we do not crash
    return {
      subject: 'General Study',
      topic: 'General Notes',
      docType: 'Other',
      confidence: 0.50,
      tags: ['General', 'Unclassified']
    };
  }
}



/**
 * Generates an interactive, conceptual academic quiz from lecture notes text using Gemini.
 * Customizes the prompt based on the required dynamic difficulty.
 */
export async function generateQuizFromText(
  text: string,
  title: string,
  difficulty: 'easy' | 'medium' | 'hard',
  excludeQuestionTexts?: string[]
): Promise<GeneratedQuestion[]> {
  try {
    const aiClient = getAIClient();
    const model = aiClient.getGenerativeModel({ model: getAIModelName() });

    // Define strict response schema for reliable quiz parsing
    const responseSchema: Schema = {
      type: SchemaType.ARRAY,
      description: 'List of generated quiz questions matching the requested difficulty and context.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: {
            type: SchemaType.STRING,
            description: 'Unique string id for the question, e.g. "q_1", "q_2".'
          },
          type: {
            type: SchemaType.STRING,
            enum: ['mcq', 'true_false', 'short_answer'],
            description: 'Type of the question.'
          } as unknown as Schema,
          questionText: {
            type: SchemaType.STRING,
            description: 'The conceptual or factual question prompt. Keep it highly clear and engaging.'
          },
          options: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: 'List of options. MCQs MUST have exactly 4 choices. True/False MUST have ["True", "False"]. Short Answer should have an empty list or null.'
          },
          correctAnswer: {
            type: SchemaType.STRING,
            description: 'For MCQ, the zero-based index of the correct option as a string (e.g. "0", "1", "2", "3"). For True/False, either "True" or "False". For Short Answer, a detailed model answer that represents the perfect conceptual response.'
          },
          explanation: {
            type: SchemaType.STRING,
            description: 'Detailed explanation of why the answer is correct, referencing concepts from the material.'
          },
          keyPoints: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: 'For Short Answer only: 2 to 4 key terms or key criteria that the student must include in their answer to get self-graded credit (e.g. ["virtual memory", "page fault", "translation-lookaside buffer"]). Leave empty for MCQs/TF.'
          },
          difficulty: {
            type: SchemaType.STRING,
            enum: ['easy', 'medium', 'hard'],
            description: 'The difficulty of this specific question.'
          } as unknown as Schema
        },
        required: ['id', 'type', 'questionText', 'correctAnswer', 'explanation', 'difficulty']
      }
    };

    // Configure prompt based on dynamic difficulty settings
    let difficultyDirective = '';
    if (difficulty === 'easy') {
      difficultyDirective = `
        - Difficulty Focus: EASY / FACTIONAL.
        - Focus on clear, straightforward factual questions testing basic definitions, direct terms, and fundamental concepts from the text.
        - The questions should be clear, introductory, and encourage confidence in learning.
      `;
    } else if (difficulty === 'medium') {
      difficultyDirective = `
        - Difficulty Focus: MEDIUM / CONCEPTUAL.
        - Focus on conceptual questions requiring students to understand processes, connections between ideas, and simple relational diagrams/logic from the material.
        - Questions should test comprehension and require thin analysis of context.
      `;
    } else {
      difficultyDirective = `
        - Difficulty Focus: HARD / DEEP ANALYTICAL.
        - Focus on advanced theoretical questions, edge cases, scenario/case-based problems, and logical fallacies.
        - Incorporate analytical short answer questions where they must explain *why* or *how* a complex process operates, synthesising concepts in deep detail.
        - The MCQs should have highly competitive distractors (plausible but incorrect options).
      `;
    }

    let excludeDirective = '';
    if (excludeQuestionTexts && excludeQuestionTexts.length > 0) {
      excludeDirective = `
      - STRICT DUPLICATION EXCLUSION: Do NOT generate or repeat any of these questions or similar ideas:
      ${excludeQuestionTexts.map(q => `- "${q}"`).join('\n      ')}
      `;
    }

    const prompt = `
      You are "Neuron Quiz Architect", a state-of-the-art educational psychometrician.
      Your task is to generate a comprehensive, premium academic study quiz based ONLY on the actual academic content of the provided study material.
      
      MATERIAL DETAILS:
      - Document Title: "${title}"
      - Target Quiz Difficulty: "${difficulty.toUpperCase()}"
      ${excludeDirective}
      
      DIFFICULTY REGULATION:
      ${difficultyDirective}
      
      QUIZ FORMAT SPECIFICATIONS:
      1. Generate a total of exactly 20 high-quality, relevant questions.
      2. The generated list MUST consist of:
         - 14 Multiple Choice Questions (MCQ) - exactly 4 options each. (These are the Graded Competitive Quiz portion).
         - 4 True/False Questions - exactly 2 options: ["True", "False"] each. (Graded Portion).
         - 2 Short Conceptual Questions - options list empty/null. (These last 2 represent the unrated optional "Self-Study Sandbox" portion where students can test their writing without affecting their XP rating or scores).
      3. Questions MUST be directly based on facts, ideas, or theories in the document text snippet below. Do NOT hallucinate outside information.
      4. For Short Conceptual questions, provide a highly descriptive model answer in "correctAnswer" and 2-4 core grading criteria (short phrases/keywords) in "keyPoints" for the checklist (e.g. key terms they must write).
      5. Provide an encouraging, insightful, and clear explanation for each answer.
      6. Spread questions across different sections and concepts of the material — do not cluster them around a single topic.
      
      CRITICAL CONTENT RESTRICTIONS — STRICTLY ENFORCED:
      - NEVER ask questions about document metadata. This includes: university name, institution name, college name, department name, course name, subject name, course code, lecture number, chapter number, document title, file name, student name, instructor name, professor name, semester, year, or any administrative header information.
      - ONLY generate questions that test understanding of the actual academic subject matter, theories, concepts, definitions, processes, and facts contained within the body of the document.
      - If the document begins with a cover page or header (e.g. "University of XYZ — Operating Systems — Lecture 3"), completely ignore that metadata and focus exclusively on the lecture/study content that follows.
      - A valid question must be answerable purely from the academic knowledge in the material body, not from reading the document's title or header.
      
      DOCUMENT TEXT:
      \"\"\"
      ${text.substring(0, MAX_QUIZ_TEXT_LENGTH)}
      \"\"\"
      
      Output the quiz strictly matching the designated JSON Schema array format.
    `;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.2, // Moderate temperature for robust conceptual structure
      }
    });

    const responseText = result.response.text();
    if (!responseText) {
      throw new Error('Empty response received from Gemini');
    }

    logger.info('Gemini quiz generation response length: ' + responseText.length);
    
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    return JSON.parse(cleanedText) as GeneratedQuestion[];

  } catch (error) {
    logger.error('Failed to generate study quiz using Gemini', error);
    // Return a safe fallback quiz so the user does not crash and gets an educational review
    return [
      {
        id: 'fallback_1',
        type: 'mcq',
        questionText: `Which of the following is the most effective study method supported by the platform?`,
        options: ['Passive re-reading', 'Active recall via interactive quizzes', 'Cramming the night before', 'Highlighting entire pages'],
        correctAnswer: '1',
        explanation: 'Active recall (testing yourself via quizzes) is scientifically proven to double retention compared to passive reading.',
        difficulty: 'easy'
      },
      {
        id: 'fallback_2',
        type: 'true_false',
        questionText: 'Maintaining a daily study streak boosts memory retention and study consistency.',
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: 'Daily micro-learning sessions establish habit loops that significantly reduce cognitive friction.',
        difficulty: 'easy'
      },
      {
        id: 'fallback_3',
        type: 'short_answer',
        questionText: 'Explain why active quiz taking is more effective than passive reading of lectures.',
        correctAnswer: 'Active testing forces the brain to retrieve information from long-term memory, strengthening neural connections. Passive reading only builds familiarity, which creates an illusion of competence without deep storage.',
        keyPoints: ['retrieve information', 'strengthens neural connections', 'passive familiarity', 'active recall'],
        explanation: 'Active recall stimulates brain pathways, training the brain to retrieve facts under pressure.',
        difficulty: 'medium'
      }
    ];
  }
}

