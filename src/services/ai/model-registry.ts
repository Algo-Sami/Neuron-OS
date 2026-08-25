/**
 * Model Registry — Phase X
 *
 * Centralized registry of all AI models and providers used in Neuron OS.
 * Every skill / task dynamically reads its configuration from here.
 */

export interface ModelConfig {
  provider: 'gemini' | 'openrouter';
  modelName: string;
  settings?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

export type SkillType =
  | 'summary'
  | 'key_points'
  | 'definitions'
  | 'examples'
  | 'quiz'
  | 'flashcards'
  | 'study_coach'
  | 'evaluation'
  | 'chat'
  | 'ocr'
  | 'embedding';

// Central model configuration mapped by skill
export const MODEL_REGISTRY: Record<SkillType, ModelConfig> = {
  summary: {
    provider: 'openrouter',
    modelName: 'google/gemini-2.5-flash'
  },
  key_points: {
    provider: 'openrouter',
    modelName: 'google/gemini-2.5-flash'
  },
  definitions: {
    provider: 'openrouter',
    modelName: 'google/gemini-2.5-flash'
  },
  examples: {
    provider: 'openrouter',
    modelName: 'google/gemini-2.5-flash'
  },
  quiz: {
    provider: 'openrouter',
    modelName: 'google/gemini-2.5-flash'
  },
  flashcards: {
    provider: 'openrouter',
    modelName: 'google/gemini-2.5-flash'
  },
  study_coach: {
    provider: 'openrouter',
    modelName: 'google/gemini-2.5-flash'
  },
  evaluation: {
    provider: 'openrouter',
    modelName: 'google/gemini-2.5-flash'
  },
  chat: {
    provider: 'openrouter',
    modelName: 'google/gemini-2.5-flash'
  },
  ocr: {
    provider: 'gemini',
    modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  },
  embedding: {
    provider: 'gemini',
    modelName: 'gemini-embedding-001'
  }
};

/**
 * Maps a task string (from routes or parameters) to its registry configuration.
 * Automatically normalized to prevent matching mismatches.
 */
export function getModelConfig(taskOrSkill: string): ModelConfig {
  const normalized = taskOrSkill.toLowerCase().replace(/[-_]/g, '');

  if (normalized.includes('summary') || normalized.includes('summarize')) {
    return MODEL_REGISTRY.summary;
  }
  if (normalized.includes('keypoints') || normalized.includes('keyconcepts') || normalized.includes('takeaways')) {
    return MODEL_REGISTRY.key_points;
  }
  if (normalized.includes('definition')) {
    return MODEL_REGISTRY.definitions;
  }
  if (normalized.includes('example')) {
    return MODEL_REGISTRY.examples;
  }
  if (normalized.includes('quiz') || normalized.includes('mcq')) {
    return MODEL_REGISTRY.quiz;
  }
  if (normalized.includes('flashcard')) {
    return MODEL_REGISTRY.flashcards;
  }
  if (
    normalized.includes('coach') ||
    normalized.includes('tutoring') ||
    normalized.includes('academicmentoring') ||
    normalized.includes('conceptexplanation')
  ) {
    return MODEL_REGISTRY.study_coach;
  }
  if (normalized.includes('evaluation') || normalized.includes('evaluate') || normalized.includes('answer')) {
    return MODEL_REGISTRY.evaluation;
  }
  if (normalized.includes('ocr') || normalized.includes('extraction') || normalized.includes('parser')) {
    return MODEL_REGISTRY.ocr;
  }
  if (normalized.includes('embedding')) {
    return MODEL_REGISTRY.embedding;
  }

  // Fallback to chat configuration
  return MODEL_REGISTRY.chat;
}
