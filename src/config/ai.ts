export const AI_CONFIG = {
  model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  temperature: { low: 0.1, medium: 0.2, high: 0.7 },
  maxTokens: 8192,
} as const;
