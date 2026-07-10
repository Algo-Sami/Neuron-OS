// Unified Provider Request Options
export interface GenerateOptions {
  systemInstruction?: string;
  responseMimeType?: 'application/json' | 'text/plain';
  responseSchema?: unknown;
  temperature?: number;
  maxOutputTokens?: number;
}

// Unified Token Usage Response
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// Cost calculations (constants in USD per 1M tokens)
export const COST_GRID: Record<string, { input: number; output: number }> = {
  // Gemini
  'gemini-3.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-3.5-pro': { input: 1.25, output: 5.00 },
  // OpenAI / OpenRouter typical models
  'gpt-4o-mini': { input: 0.150, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'google/gemini-2.5-flash': { input: 0.075, output: 0.30 },
  // Fallbacks
  'default-light': { input: 0.15, output: 0.60 },
  'default-premium': { input: 2.50, output: 10.00 }
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_GRID[model] || (model.includes('pro') || model.includes('sonnet') || model.includes('gpt-4o') ? COST_GRID['default-premium'] : COST_GRID['default-light']);
  return ((inputTokens / 1000000) * rates.input) + ((outputTokens / 1000000) * rates.output);
}

// Unified Completion Response
export interface CompletionResult {
  text: string;
  usage: TokenUsage;
  model: string;
  provider: 'gemini' | 'openrouter';
}

// Provider interface mapping high-level actions
export interface AIProvider {
  id: 'gemini' | 'openrouter';
  name: string;
  generateText(modelName: string, prompt: string, options?: GenerateOptions): Promise<CompletionResult>;
  generateStructuredJSON(modelName: string, prompt: string, options?: GenerateOptions): Promise<CompletionResult>;
  stream(modelName: string, prompt: string, options?: GenerateOptions): Promise<ReadableStream>;
  healthCheck(modelName: string): Promise<boolean>;
}
