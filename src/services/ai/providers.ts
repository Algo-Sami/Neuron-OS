import { getAIClient } from './gemini';
import { logger } from '@/lib/logger';

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

// Unified Completion Response
export interface CompletionResult {
  text: string;
  usage: TokenUsage;
  model: string;
  provider: 'gemini' | 'openai' | 'anthropic';
}

// Cost calculations (constants in USD per 1M tokens)
const COST_GRID: Record<string, { input: number; output: number }> = {
  // Gemini
  'gemini-3.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-3.5-pro': { input: 1.25, output: 5.00 },
  // OpenAI
  'gpt-4o-mini': { input: 0.150, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  // Anthropic
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  // Fallbacks
  'default-light': { input: 0.15, output: 0.60 },
  'default-premium': { input: 2.50, output: 10.00 }
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_GRID[model] || (model.includes('pro') || model.includes('sonnet') || model.includes('gpt-4o') ? COST_GRID['default-premium'] : COST_GRID['default-light']);
  // Let's divide properly by 1,000,000
  return ((inputTokens / 1000000) * rates.input) + ((outputTokens / 1000000) * rates.output);
}

// 1. Google Gemini Provider
async function callGemini(modelName: string, prompt: string, options?: GenerateOptions): Promise<CompletionResult> {
  const ai = getAIClient();
  const rawModel = ai.getGenerativeModel({
    model: modelName,
    systemInstruction: options?.systemInstruction,
  });

  const responseMimeType = options?.responseMimeType || 'text/plain';
  const result = await rawModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.2,
      maxOutputTokens: options?.maxOutputTokens ?? 4096,
      responseMimeType: responseMimeType,
      responseSchema: options?.responseSchema as any,
    }
  });

  const responseText = result.response.text();
  if (!responseText) {
    throw new Error('Gemini returned an empty response.');
  }

  // Estimate tokens (roughly 1 token = 4 characters)
  const inputChars = (options?.systemInstruction?.length || 0) + prompt.length;
  const outputChars = responseText.length;
  const promptTokens = Math.ceil(inputChars / 4);
  const completionTokens = Math.ceil(outputChars / 4);

  return {
    text: responseText,
    model: modelName,
    provider: 'gemini',
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCost: estimateCost(modelName, promptTokens, completionTokens)
    }
  };
}

// 2. OpenAI Provider (Native HTTP Fetch API to prevent peer-dependency conflicts)
async function callOpenAI(modelName: string, prompt: string, options?: GenerateOptions): Promise<CompletionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not defined in environment variables.');
  }

  const messages: { role: string; content: string }[] = [];
  if (options?.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  const payload: Record<string, unknown> = {
    model: modelName,
    messages,
    temperature: options?.temperature ?? 0.2,
    max_tokens: options?.maxOutputTokens ?? 4096,
  };

  if (options?.responseMimeType === 'application/json') {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI HTTP Error: [${response.status}] ${errorText}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content;
  if (!responseText) {
    throw new Error('OpenAI returned an empty response.');
  }

  const promptTokens = data.usage?.prompt_tokens || Math.ceil(((options?.systemInstruction?.length || 0) + prompt.length) / 4);
  const completionTokens = data.usage?.completion_tokens || Math.ceil(responseText.length / 4);

  return {
    text: responseText,
    model: modelName,
    provider: 'openai',
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCost: estimateCost(modelName, promptTokens, completionTokens)
    }
  };
}

// 3. Anthropic Provider (Native HTTP Fetch API)
async function callAnthropic(modelName: string, prompt: string, options?: GenerateOptions): Promise<CompletionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not defined in environment variables.');
  }

  const payload: Record<string, unknown> = {
    model: modelName,
    max_tokens: options?.maxOutputTokens ?? 4096,
    temperature: options?.temperature ?? 0.2,
    messages: [{ role: 'user', content: prompt }],
  };

  if (options?.systemInstruction) {
    payload.system = options.systemInstruction;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic HTTP Error: [${response.status}] ${errorText}`);
  }

  const data = await response.json();
  const responseText = data.content?.[0]?.text;
  if (!responseText) {
    throw new Error('Anthropic returned an empty response.');
  }

  const promptTokens = data.usage?.input_tokens || Math.ceil(((options?.systemInstruction?.length || 0) + prompt.length) / 4);
  const completionTokens = data.usage?.output_tokens || Math.ceil(responseText.length / 4);

  return {
    text: responseText,
    model: modelName,
    provider: 'anthropic',
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCost: estimateCost(modelName, promptTokens, completionTokens)
    }
  };
}

/**
 * Executes a text completion query against the specified primary model.
 * If the primary client call fails, automatically triggers secondary fallbacks in order.
 */
export async function executeAICompletion(
  primaryModel: string,
  prompt: string,
  options?: GenerateOptions
): Promise<CompletionResult> {
  // Compile sequence of attempts: Primary -> Fallbacks based on provider config
  const attempts: { provider: string; model: string }[] = [];

  // Determine provider by model prefix/keyword
  const detectProvider = (m: string): 'gemini' | 'openai' | 'anthropic' => {
    if (m.startsWith('gpt-')) return 'openai';
    if (m.startsWith('claude-')) return 'anthropic';
    return 'gemini';
  };

  const primaryProvider = detectProvider(primaryModel);
  attempts.push({ provider: primaryProvider, model: primaryModel });

  // Add robust fallback options
  if (primaryProvider === 'gemini') {
    attempts.push({ provider: 'openai', model: primaryModel.includes('pro') ? 'gpt-4o' : 'gpt-4o-mini' });
    attempts.push({ provider: 'anthropic', model: primaryModel.includes('pro') ? 'claude-3-5-sonnet-20241022' : 'claude-3-5-haiku-20241022' });
    attempts.push({ provider: 'gemini', model: 'gemini-1.5-flash' });
  } else if (primaryProvider === 'openai') {
    attempts.push({ provider: 'gemini', model: primaryModel.includes('gpt-4o-mini') ? 'gemini-1.5-flash' : 'gemini-1.5-pro' });
    attempts.push({ provider: 'anthropic', model: primaryModel.includes('gpt-4o-mini') ? 'claude-3-5-haiku-20241022' : 'claude-3-5-sonnet-20241022' });
  } else {
    attempts.push({ provider: 'gemini', model: primaryModel.includes('haiku') ? 'gemini-1.5-flash' : 'gemini-1.5-pro' });
    attempts.push({ provider: 'openai', model: primaryModel.includes('haiku') ? 'gpt-4o-mini' : 'gpt-4o' });
  }

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      logger.info(`[AI Provider] Querying ${attempt.provider} model: "${attempt.model}"`);

      // Verify key is set for non-gemini fallback
      if (attempt.provider === 'openai' && !process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not defined.');
      }
      if (attempt.provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not defined.');
      }

      if (attempt.provider === 'gemini') {
        return await callGemini(attempt.model, prompt, options);
      } else if (attempt.provider === 'openai') {
        return await callOpenAI(attempt.model, prompt, options);
      } else if (attempt.provider === 'anthropic') {
        return await callAnthropic(attempt.model, prompt, options);
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`[AI Provider] Failover: ${attempt.provider}/${attempt.model} call failed: ${lastError.message}`);
    }
  }

  throw new Error(`AI generation completely failed for all providers. Last error: ${lastError?.message}`);
}
