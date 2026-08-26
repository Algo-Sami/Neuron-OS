import { routeAIRequest } from '../router';
import { ContextPackage } from './context-builder';
import { logger } from '@/lib/logger';
import * as fs from 'fs';
import * as path from 'path';

// ── Types and Standard Response Contract ─────────────────────────────────────

export interface AISkill {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  systemInstruction?: string;
  responseMimeType?: 'application/json' | 'text/plain';
  responseSchema?: any; // JSON schema when applicable
  temperature?: number;
  maxOutputTokens?: number;
  validate?: (content: string) => { valid: boolean; error?: string };
}

export interface SkillResponseContract {
  success: boolean;
  skillUsed: string;
  confidenceScore: number;
  confidenceLabel: 'Excellent Match' | 'Good Match' | 'Weak Match' | 'No Reliable Match';
  sourcesUsed: string[]; // document titles/IDs used as grounding
  generatedContent: string; // Structured JSON or formatted markdown
  metadata: {
    modelUsed: string;
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number;
  };
}

export interface ExecuteParams {
  query: string;
  context: ContextPackage;
  userId: string;
  variables?: Record<string, any>; // Optional additional variables (like userAnswer, userLevel)
  skipCache?: boolean;
}

// ── central Output Validators ───────────────────────────────────────────────

function validateJsonArray(content: string, requiredKeys: string[]): { valid: boolean; error?: string } {
  try {
    const clean = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) {
      return { valid: false, error: 'Output is not a valid JSON array.' };
    }
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      if (!item || typeof item !== 'object') {
        return { valid: false, error: `Item at index ${i} is not a valid JSON object.` };
      }
      for (const key of requiredKeys) {
        if (!(key in item)) {
          return { valid: false, error: `Item at index ${i} is missing required key: "${key}".` };
        }
      }
    }
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Malformed JSON parser error: ${err?.message || String(err)}` };
  }
}

function validateJsonObject(content: string, requiredKeys: string[]): { valid: boolean; error?: string } {
  try {
    const clean = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(clean);
    if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
      return { valid: false, error: 'Output is not a valid JSON object.' };
    }
    for (const key of requiredKeys) {
      if (!(key in parsed)) {
        return { valid: false, error: `JSON object is missing required key: "${key}".` };
      }
    }
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Malformed JSON parser error: ${err?.message || String(err)}` };
  }
}

// ── central Prompt Registry ───────────────────────────────────────────────

export const PROMPT_REGISTRY: Record<string, AISkill> = {
  ExplainConcept: {
    id: 'ExplainConcept',
    name: 'Explain Concept',
    description: 'Provides a structured, pedagogical explanation of an academic concept using grounded course context.',
    systemInstruction: 'You are an elite university professor. Your job is to explain academic concepts clearly, factually, and step-by-step using only the provided document context.',
    promptTemplate: `
Using the provided document context, explain the following academic concept.
Structure your explanation using bold markdown headers: Overview, Core Mechanics, and Academic Examples.

CONCEPT TO EXPLAIN:
{query}

DOCUMENT CONTEXT:
\"\"\"
{context}
\"\"\"
`,
    temperature: 0.2
  },

  SummarizeLecture: {
    id: 'SummarizeLecture',
    name: 'Summarize Lecture',
    description: 'Rewrites lecture content into a clear, educational study summary that a student can learn from without reading the original lecture.',
    systemInstruction: `You are an experienced university professor and expert educator. Your only job is to rewrite lecture content into a clear, flowing, educational summary that students can study from. 

Follow these absolute rules:
- Write in natural, conversational prose. Not bullet points. Not compressed facts.
- For every topic: explain what it is, why it exists, how it works, when it is used, and why it matters.
- Explain technical terms in simple, accessible language the first time they appear.
- Preserve every major concept. Do not skip or merge topics. If the lecture explains something in depth, your summary must also explain it in depth.
- Preserve the original lecture order and teaching flow. Never re-order topics.
- Only remove repetition and unnecessary filler wording. Do not compress educational content.
- Do NOT include: Quick Revision Sheets, Key Takeaways, Exam Tips, Practice Questions, MCQs, Flashcards, Cheat Sheets, Formula Sheets, Memory Tricks, or any non-explanatory study assets.
- The summary should feel like a professor teaching the lecture in writing — not like AI output.
- Respond ONLY using the ---SUM_START--- and ---POINTS_START--- markers. Do not include any commentary outside those markers.`,
    promptTemplate: `
You are rewriting the following lecture content into a high-quality educational summary.

Your goal is NOT to compress the lecture. Your goal is to REWRITE it into clearer, simpler, more understandable language — so a university student can read ONLY your summary and understand everything taught in the lecture.

Summary Mode: {mode}

STRICT RULES FOR THE SUMMARY:
1. Follow the original lecture order. Do not skip any major topic.
2. For every topic or concept, write at least one full explanatory paragraph covering:
   - What it is (definition in plain language)
   - Why it exists or why it matters
   - How it works (mechanism, process, or logic)
   - When or where it is applied
   - How it relates to other concepts in the lecture
3. Explain technical terms clearly the first time they appear.
4. When the lecture provides an example or comparison, include it — examples help students understand.
5. Write in flowing prose. Avoid compressed bullet-point lists as the main explanation style.
6. Do NOT include: Key Takeaways, Exam Tips, Quick Revision, Practice Questions, MCQs, Flashcards, Formula Sheets, or any section that is not a direct educational explanation.
7. The target length is approximately 30–50% of the original lecture length. Do not artificially shorten the summary.
8. Write as if you are a professor teaching this lecture to students in written form.

Required Output Format — wrap your response in these EXACT markers with NO text outside them:

---SUM_START---
[Write the complete educational summary here in Markdown. Use ## headers for major topics, ### for subtopics. Write full explanatory paragraphs under each header. Do not use excessive bullet lists as substitutes for explanation.]
---SUM_END---

---POINTS_START---
["A concise statement of the first key concept covered", "A concise statement of the second key concept covered", "Continue for all major topics, minimum 5 points"]
---POINTS_END---

LECTURE CONTENT:
\"\"\"
{context}
\"\"\"
`,
    temperature: 0.3,
    maxOutputTokens: 8192,
    validate: (content: string) => {
      const clean = content.trim();
      if (!clean || clean.length < 150) {
        return { valid: false, error: 'Summary output is too short or empty (minimum 150 characters required).' };
      }
      return { valid: true };
    }
  },

  GenerateFlashcards: {
    id: 'GenerateFlashcards',
    name: 'Generate Flashcards',
    description: 'Generates high-yield active recall flashcards from course material.',
    systemInstruction: 'You are an active recall learning specialist. Generate study flashcards strictly as a JSON array of objects.',
    responseMimeType: 'application/json',
    promptTemplate: `
Generate a list of 5-10 high-yield flashcards from the provided document context.
Format the output strictly as a JSON array of objects, containing "front" (question or core term) and "back" (definition or concise answer) keys. Do not wrap in markdown blocks.

TOPIC/REQUEST:
{query}

DOCUMENT CONTEXT:
\"\"\"
{context}
\"\"\"
`,
    temperature: 0.3,
    validate: (content) => validateJsonArray(content, ['front', 'back'])
  },

  GenerateQuiz: {
    id: 'GenerateQuiz',
    name: 'Generate Quiz',
    description: 'Generates a structured, multiple-choice quiz with explanations for testing learning.',
    systemInstruction: 'You are an assessment designer. Create diagnostic multiple choice quizzes strictly as a JSON array of objects.',
    responseMimeType: 'application/json',
    promptTemplate: `
Generate a multiple-choice diagnostic quiz based on the provided document context.
Format the output strictly as a JSON array of objects matching this exact structure:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0, // 0-indexed integer corresponding to correct option in the options array
    "explanation": "pedagogical explanation of why this answer is correct."
  }
]

TOPIC/DETAILS:
{query}

DOCUMENT CONTEXT:
\"\"\"
{context}
\"\"\"
`,
    temperature: 0.2,
    validate: (content) => validateJsonArray(content, ['question', 'options', 'correctAnswer', 'explanation'])
  },

  GenerateKeyPoints: {
    id: 'GenerateKeyPoints',
    name: 'Generate Key Points',
    description: 'Extracts revision-oriented academic key points, facts, and tips from summary context.',
    systemInstruction: 'You are "Neuron Key Points Agent", a specialized study assistant. Respond ONLY as a JSON object matching the requested schema. Do not include commentary outside the JSON.',
    responseMimeType: 'application/json',
    promptTemplate: `
Analyze the provided course material summary and generate a high-yield revision guide.

Required JSON Output Structure:
{
  "lectureTitle": "Title of the lecture topic",
  "keyPoints": [
    "Exam-friendly revision key point 1 (one clear academic concept)",
    "Exam-friendly revision key point 2",
    "Exam-friendly revision key point 3",
    "Exam-friendly revision key point 4",
    "Exam-friendly revision key point 5"
  ],
  "importantFacts": [
    "Important definition, date, years, numbers, limit, or formula 1",
    "Important definition, date, years, numbers, limit, or formula 2"
  ],
  "quickRevisionTips": [
    "Pedagogical study tip, common pitfall warning, or active recall prompt 1",
    "Pedagogical study tip, common pitfall warning, or active recall prompt 2"
  ]
}

Quality Rules:
1. "keyPoints" must have at least 5 distinct items. Each item must contain a complete, standalone educational fact.
2. Focus strictly on topics likely to appear on college-level exams.
3. No duplicates, empty points, or prompt leakages.

SUMMARY CONTEXT:
"""
{context}
"""
`,
    temperature: 0.15,
    validate: (content: string) => {
      try {
        const clean = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(clean);
        if (!parsed.lectureTitle || typeof parsed.lectureTitle !== 'string') {
          return { valid: false, error: 'Response is missing "lectureTitle" property.' };
        }
        if (!Array.isArray(parsed.keyPoints) || parsed.keyPoints.length < 5) {
          return { valid: false, error: 'Response keyPoints must be an array with at least 5 items.' };
        }
        if (new Set(parsed.keyPoints).size !== parsed.keyPoints.length) {
          return { valid: false, error: 'Response keyPoints contains duplicate statements.' };
        }
        if (parsed.keyPoints.some((p: any) => typeof p !== 'string' || p.trim().length === 0)) {
          return { valid: false, error: 'Response keyPoints contains empty items.' };
        }
        if (!Array.isArray(parsed.importantFacts) || !Array.isArray(parsed.quickRevisionTips)) {
          return { valid: false, error: 'Response is missing importantFacts or quickRevisionTips array properties.' };
        }
        return { valid: true };
      } catch (err: any) {
        return { valid: false, error: `Malformed JSON parser error: ${err?.message || String(err)}` };
      }
    }
  },

  GenerateDefinitions: {
    id: 'GenerateDefinitions',
    name: 'Generate Definitions',
    description: 'Extracts key technical terms and generates glossary definitions, relevance, examples, and tips.',
    systemInstruction: 'You are "Neuron Glossary Agent", a specialized academic lexicographer. Respond ONLY as a JSON array of objects matching the requested schema. Do not include commentary outside the JSON.',
    responseMimeType: 'application/json',
    promptTemplate: `
Analyze the provided course material summary and key points, extract the most important technical concepts, and construct a structured glossary.

Required JSON Output Format:
[
  {
    "term": "Concept or Term Name",
    "definition": "Clear, concise academic explanation of the term",
    "whyItMatters": "Why this concept is crucial or where its significance lies",
    "realWorldExample": "Practical real-world application or analogy of the concept",
    "examTip": "Revision tip, mnemonic, formula, or exam alerts"
  }
]

Quality Rules:
1. Extract ONLY meaningful academic concepts (e.g. key terms, algorithms, frameworks). Do not include everyday words.
2. Terms must be unique. Do not create duplicate glossary entries.
3. Every field must contain non-empty, high-quality text.

CONTEXT:
"""
{context}
"""
`,
    temperature: 0.15,
    validate: (content: string) => {
      try {
        const clean = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(clean);
        if (!Array.isArray(parsed)) {
          return { valid: false, error: 'Response is not a JSON array.' };
        }
        if (parsed.length === 0) {
          return { valid: false, error: 'Glossary array must have at least one entry.' };
        }

        const seenTerms = new Set<string>();
        const requiredKeys = ['term', 'definition', 'whyItMatters', 'realWorldExample', 'examTip'];

        for (let i = 0; i < parsed.length; i++) {
          const entry = parsed[i];
          if (!entry || typeof entry !== 'object') {
            return { valid: false, error: `Item at index ${i} is not a valid object.` };
          }
          for (const key of requiredKeys) {
            if (!entry[key] || typeof entry[key] !== 'string' || entry[key].trim().length === 0) {
              return { valid: false, error: `Item at index ${i} is missing or has empty required key: "${key}".` };
            }
          }
          const normalizedTerm = entry.term.toLowerCase().trim();
          if (seenTerms.has(normalizedTerm)) {
            return { valid: false, error: `Glossary contains duplicate term entry: "${entry.term}".` };
          }
          seenTerms.add(normalizedTerm);
        }
        return { valid: true };
      } catch (err: any) {
        return { valid: false, error: `Malformed JSON parser error: ${err?.message || String(err)}` };
      }
    }
  },

  GenerateExamples: {
    id: 'GenerateExamples',
    name: 'Generate Examples',
    description: 'Generates categorized educational examples (real-world, technical, analogy, exam) for key concepts.',
    systemInstruction: 'You are "Neuron Examples Agent", a specialized academic concept illustrator. Respond ONLY as a JSON array of objects. Do not include commentary outside the JSON.',
    responseMimeType: 'application/json',
    promptTemplate: `
Analyze the provided lecture content (summary, key points, and definitions) and generate categorized educational examples for the most important academic concepts.

Required JSON Output Format:
[
  {
    "concept": "Name of the academic concept",
    "realWorldExample": "How this concept appears in real life (null if not applicable)",
    "technicalExample": "Technical or implementation example (null if not applicable)",
    "analogy": "Simple analogy to aid understanding (null if not applicable)",
    "examExample": "How this concept might appear in an exam question (null if not applicable)"
  }
]

Selection Rules:
1. Include ONLY concepts that genuinely benefit from examples (avoid trivial or obvious terms).
2. For each concept, include ONLY the example categories that add real educational value. Use null for categories that don't apply.
3. Every included example must be factually accurate, concise, and contextually relevant to the lecture.
4. Never create duplicate concepts. Maximum one entry per concept.
5. Minimum 1 concept. At least one example field must be non-null per concept.

CONTEXT:
"""
{context}
"""
`,
    temperature: 0.2,
    validate: (content: string) => {
      try {
        const clean = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        const parsed = JSON.parse(clean);
        if (!Array.isArray(parsed)) {
          return { valid: false, error: 'Response is not a JSON array.' };
        }
        if (parsed.length === 0) {
          return { valid: false, error: 'Examples array must have at least one entry.' };
        }

        const seenConcepts = new Set<string>();
        const exampleFields = ['realWorldExample', 'technicalExample', 'analogy', 'examExample'];

        for (let i = 0; i < parsed.length; i++) {
          const item = parsed[i];
          if (!item || typeof item !== 'object') {
            return { valid: false, error: `Item at index ${i} is not a valid object.` };
          }
          if (!item.concept || typeof item.concept !== 'string' || item.concept.trim().length === 0) {
            return { valid: false, error: `Item at index ${i} is missing or has an empty "concept" field.` };
          }
          const normalizedConcept = item.concept.toLowerCase().trim();
          if (seenConcepts.has(normalizedConcept)) {
            return { valid: false, error: `Duplicate concept entry found: "${item.concept}".` };
          }
          seenConcepts.add(normalizedConcept);

          // Ensure at least one example category is non-null and non-empty
          const hasAtLeastOneExample = exampleFields.some(
            f => item[f] && typeof item[f] === 'string' && item[f].trim().length > 0
          );
          if (!hasAtLeastOneExample) {
            return { valid: false, error: `Item "${item.concept}" has no populated example fields.` };
          }
        }
        return { valid: true };
      } catch (err: any) {
        return { valid: false, error: `Malformed JSON parser error: ${err?.message || String(err)}` };
      }
    }
  },

  SimplifyTopic: {
    id: 'SimplifyTopic',
    name: 'Simplify Topic (ELI5)',
    description: 'Explains complex concepts using simple analogies and layman vocabulary.',
    systemInstruction: 'Explain academic concepts like I am 5 years old. Use clear analogies, simple terminology, and zero jargon.',
    promptTemplate: `
Simplify the following concept using analogies. Avoid any heavy technical terms unless you define them immediately.

CONCEPT TO SIMPLIFY:
{query}

DOCUMENT CONTEXT:
\"\"\"
{context}
\"\"\"
`,
    temperature: 0.4
  },

  CompareConcepts: {
    id: 'CompareConcepts',
    name: 'Compare Concepts',
    description: 'Draws side-by-side comparison matrices or tables between two related academic ideas.',
    systemInstruction: 'You are an analytical tutor. Draw logical side-by-side comparisons using markdown tables.',
    promptTemplate: `
Draw a detailed side-by-side comparison between the concepts specified in the query, based strictly on the provided context.
Use a markdown table comparing attributes such as definition, functionality, complexity, and examples.

CONCEPTS TO COMPARE:
{query}

DOCUMENT CONTEXT:
\"\"\"
{context}
\"\"\"
`,
    temperature: 0.2
  },

  CreateStudyPlan: {
    id: 'CreateStudyPlan',
    name: 'Create Study Plan',
    description: 'Generates a structured week-by-week study calendar tailored to topic weight.',
    systemInstruction: 'You are an academic coach. Build structured, realistic calendars and schedules for study.',
    promptTemplate: `
Create a study plan or revision schedule to master the topics specified in the query, based on the provided context.

REQUEST DETAILS:
{query}

DOCUMENT CONTEXT:
\"\"\"
{context}
\"\"\"
`,
    temperature: 0.3
  },

  EvaluateAnswer: {
    id: 'EvaluateAnswer',
    name: 'Evaluate Answer',
    description: 'Grades student active-recall responses and provides constructive coaching feedback.',
    systemInstruction: 'You are an objective assessor. Grade student answers strictly as a JSON object.',
    responseMimeType: 'application/json',
    promptTemplate: `
Evaluate the student's answer to the question using the provided context as the ground truth.
Format the output strictly as a JSON object:
{
  "score": 85, // Integer score from 0 to 100 based on accuracy
  "correct": true, // boolean indicating if answer is conceptually accurate
  "feedback": "Explain what parts they got correct and what gaps remain."
}

QUESTION:
{query}

STUDENT ANSWER:
{userAnswer}

DOCUMENT CONTEXT:
\"\"\"
{context}
\"\"\"
`,
    temperature: 0.1,
    validate: (content) => validateJsonObject(content, ['score', 'correct', 'feedback'])
  },

  GenerateMnemonics: {
    id: 'GenerateMnemonics',
    name: 'Generate Mnemonics',
    description: 'Creates acronyms or memory aids to help students memorize academic terms.',
    systemInstruction: 'You are a cognitive memory aids assistant. Design memorable acronyms and mnemonics.',
    promptTemplate: `
Create high-yield mnemonics or acronyms to help me memorize the concepts specified in the query, using the provided context.

CONCEPTS/TERMS:
{query}

DOCUMENT CONTEXT:
\"\"\"
{context}
\"\"\"
`,
    temperature: 0.4
  },

  AnswerQuestion: {
    id: 'AnswerQuestion',
    name: 'Answer Question',
    description: 'Grounded conversation answering general student Q&A.',
    systemInstruction: 'You are an intelligent university tutor. Provide factually grounded answers to the user\'s question.',
    promptTemplate: `
Answer the student's question factually and directly based on the provided document context.

STUDENT QUESTION:
{query}

DOCUMENT CONTEXT:
\"\"\"
{context}
\"\"\"
`,
    temperature: 0.2
  }
};

// ── Universal AI Response Engine ──────────────────────────────────────────────

export class UniversalAIResponseEngine {
  /**
   * Executes an AI Skill against the provided Context Package.
   */
  static async executeSkill(
    skillId: string,
    params: ExecuteParams
  ): Promise<SkillResponseContract> {
    const startTimeMs = Date.now();
    const { query, context, userId, variables = {}, skipCache = false } = params;

    logger.info(`[ResponseEngine] Executing Skill: ${skillId} for User: ${userId}`);

    // Step 1: Fetch and validate skill existence in registry
    const skill = PROMPT_REGISTRY[skillId];
    if (!skill) {
      const errMsg = `Unknown AI Skill: "${skillId}"`;
      logger.error(`[ResponseEngine] ${errMsg}`);
      throw new Error(errMsg);
    }

    try {
      this.logToDiskDisk(skillId, 'Request Received', 'INFO');

      // Step 2 & Hallucination Prevention check:
      // If retrieval confidence is low (< 0.50), configure prompt instructions to state uncertainty
      let finalPromptTemplate = skill.promptTemplate;
      let finalSystemInstruction = skill.systemInstruction || 'You are an academic assistant.';

      if (context.overallConfidenceScore < 0.50) {
        this.logToDiskDisk(skillId, `Low context confidence (${context.overallConfidenceScore}). Applying hallucination prevention safeguards.`, 'WARN');
        
        const warningSafeguard = '\n\nIMPORTANT SAFEGUARD:\nIf the provided context does not contain relevant information to answer the question, state clearly: "I cannot find reliable information about this in your uploaded materials." Provide general knowledge about the topic afterward, but explicitly label it as "General Knowledge" rather than document content. Do not fabricate or hallucinate lecture contents.';
        
        finalSystemInstruction += warningSafeguard;
      }

      // Step 3: Central prompt injection
      let promptText = finalPromptTemplate
        .replace('{query}', query)
        .replace('{context}', context.formattedContext);

      // Inject other custom variables if present (e.g. {userAnswer} for EvaluateAnswer skill)
      for (const [key, val] of Object.entries(variables)) {
        const replacementStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
        promptText = promptText.replace(`{${key}}`, replacementStr);
      }

      const estTokens = Math.ceil(promptText.length / 4);
      this.logToDiskDisk(skillId, `Prompt Loaded. Context Chunks: ${context.sources.length} | Est Prompt Tokens: ${estTokens}`, 'INFO');

      // Step 4: Execute LLM request via AI Router (preserves daily quotas, semantic caches, and Downgrade logic)
      this.logToDiskDisk(skillId, 'LLM Request Sent', 'INFO');
      
      const routerParams = {
        userId,
        taskType: skillId.toLowerCase().includes('chat') ? 'chat' as const : 'concept-explanation' as const,
        prompt: promptText,
        systemInstruction: finalSystemInstruction,
        responseMimeType: skill.responseMimeType,
        temperature: skill.temperature || 0.2,
        maxOutputTokens: skill.maxOutputTokens || 2048,
        skipCache
      };

      // Phase 8: Validate built prompt
      const { PipelineValidator } = require('./context-validator');
      PipelineValidator.validatePrompt(promptText);

      const response = await routeAIRequest(routerParams);
      this.logToDiskDisk(skillId, 'LLM Response Received', 'INFO');

      if (!response.success) {
        throw new Error(response.content || 'AI model gateway generation failed.');
      }

      let generatedContent = response.content || '';
      PipelineValidator.validateAIResponse(generatedContent);

      // Step 5: Screen response for prompt/system instruction leaks
      generatedContent = this.sanitizeOutput(generatedContent);

      // Step 6: Validate response structure if skill defines a validator
      if (skill.validate) {
        this.logToDiskDisk(skillId, 'Enforcing Output Structure Validation', 'INFO');
        const validation = skill.validate(generatedContent);
        
        if (!validation.valid) {
          this.logToDiskDisk(skillId, `Validation Failed: ${validation.error}. Retrying once with correction instructions.`, 'WARN');
          
          // Step 7: Single retry attempt with explicit syntax error corrections
          const retryPrompt = `
Your previous output failed validation because: "${validation.error}".
Please correct the output structure and return the response strictly matching the requested format. Do not include markdown tags.

PREVIOUS OUTPUT:
${generatedContent}
`;
          const retryResponse = await routeAIRequest({
            ...routerParams,
            prompt: retryPrompt,
            skipCache: true // Skip cache to get direct corrective response
          });

          if (retryResponse.success) {
            generatedContent = this.sanitizeOutput(retryResponse.content || '');
            const finalValidation = skill.validate(generatedContent);
            if (!finalValidation.valid) {
              throw new Error(`Output validation failed after retry: ${finalValidation.error}`);
            }
            this.logToDiskDisk(skillId, 'Validation Passed after retry', 'INFO');
          } else {
            throw new Error(`Correction retry execution failed: ${retryResponse.content}`);
          }
        } else {
          this.logToDiskDisk(skillId, 'Validation Passed', 'INFO');
        }
      }

      const durationMs = Date.now() - startTimeMs;
      this.logToDiskDisk(skillId, `Execution Completed. Latency: ${durationMs}ms`, 'INFO');

      // Step 8: Standard Response Contract mapping
      const sourcesUsed = context.sources.map(s => s.documentTitle);

      const contract: SkillResponseContract = {
        success: true,
        skillUsed: skillId,
        confidenceScore: context.overallConfidenceScore,
        confidenceLabel: context.overallConfidenceLabel,
        sourcesUsed,
        generatedContent,
        metadata: {
          modelUsed: response.modelUsed,
          latencyMs: durationMs,
          promptTokens: response.metrics.promptTokens,
          completionTokens: response.metrics.completionTokens,
          estimatedCost: response.metrics.estimatedCost
        }
      };

      return contract;

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const durationMs = Date.now() - startTimeMs;
      
      this.logToDiskDisk(skillId, `Execution Failed. Error: ${errMsg}`, 'ERROR');

      return {
        success: false,
        skillUsed: skillId,
        confidenceScore: context.overallConfidenceScore,
        confidenceLabel: context.overallConfidenceLabel,
        sourcesUsed: [],
        generatedContent: `Execution failed: ${errMsg}`,
        metadata: {
          modelUsed: 'failed',
          latencyMs: durationMs,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCost: 0
        }
      };
    }
  }

  // ── Sanitization and Cleaning Helpers ──────────────────────────────────────

  private static sanitizeOutput(text: string): string {
    let clean = text;
    
    // Remove JSON markdown wrappers if returned despite request
    if (clean.includes('```json')) {
      clean = clean.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    }

    // Clean common prompt leaks
    const leakagePhrases = [
      /As an AI assistant,/gi,
      /I am a Google AI model,/gi,
      /Based on the system instructions,/gi,
      /In the provided context,/gi
    ];

    for (const regex of leakagePhrases) {
      clean = clean.replace(regex, '');
    }

    return clean.trim();
  }

  private static logToDiskDisk(
    skillId: string,
    message: string,
    level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'
  ) {
    try {
      const ts = new Date().toISOString();
      const formatted = `[${ts}] [ResponseEngine] [${skillId}] (${level}) ${message}\n`;
      fs.appendFileSync(path.join(process.cwd(), 'background_logs.txt'), formatted);
    } catch { /* ignore */ }
  }
}
