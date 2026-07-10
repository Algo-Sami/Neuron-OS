/**
 * providers.ts — Phase X Abstraction Layer Entry Point
 *
 * Exposes executeAICompletion, ensuring backward compatibility with all
 * previous phases. It initializes the Gemini and OpenRouter providers
 * and handles automatic failover mechanisms.
 */

import { GenerateOptions, TokenUsage, CompletionResult, AIProvider } from './providers/provider-interface';
import { GeminiProvider } from './providers/gemini-provider';
import { OpenRouterProvider } from './providers/openrouter-provider';
import { logger } from '@/lib/logger';

// Re-export type definitions for backwards-compatibility
export type { GenerateOptions, TokenUsage, CompletionResult };

// Initialize provider instances
const geminiProvider = new GeminiProvider();
const openRouterProvider = new OpenRouterProvider();

const providers: Record<'gemini' | 'openrouter', AIProvider> = {
  gemini: geminiProvider,
  openrouter: openRouterProvider
};

/**
 * Detects the correct provider matching the specified model name
 */
export function detectProvider(modelName: string): 'gemini' | 'openrouter' {
  if (modelName.startsWith('google/') || modelName.includes('/') || modelName.startsWith('meta-') || modelName.startsWith('mistralai/') || modelName.startsWith('anthropic/')) {
    // OpenRouter models typically use prefix / organization namespaces
    return 'openrouter';
  }
  return 'gemini';
}

/**
 * Main execution routing query. Resolves the correct provider, executes completion,
 * and handles robust fallback policies if the primary provider encounters issues.
 */
export async function executeAICompletion(
  primaryModel: string,
  prompt: string,
  options?: GenerateOptions
): Promise<CompletionResult> {
  const primaryProviderId = detectProvider(primaryModel);
  
  // Set up sequential attempt sequence
  const attempts: Array<{ providerId: 'gemini' | 'openrouter'; model: string }> = [
    { providerId: primaryProviderId, model: primaryModel }
  ];

  // Configure fallbacks
  if (primaryProviderId === 'openrouter') {
    // If OpenRouter fails, attempt failover via Gemini
    attempts.push({ providerId: 'gemini', model: 'gemini-1.5-flash' });
  } else {
    // If Gemini fails, attempt failover via OpenRouter
    attempts.push({ providerId: 'openrouter', model: 'google/gemini-2.5-flash' });
  }

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      logger.info(`[AI Pipeline][Gateway] Routing request to: ${attempt.providerId} (${attempt.model})`);
      
      const provider = providers[attempt.providerId];
      if (!provider) {
        throw new Error(`Provider not configured: ${attempt.providerId}`);
      }

      // Check key availability before making request to prevent unnecessary delays
      if (attempt.providerId === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not defined in environment variables.');
      }
      if (attempt.providerId === 'gemini' && !process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not defined in environment variables.');
      }

      // Execute text generation
      const result = await provider.generateText(attempt.model, prompt, options);
      return result;

    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`[AI Pipeline][Gateway] Fallback triggered: ${attempt.providerId}/${attempt.model} failed. Error: ${lastError.message}`);
    }
  }

  throw new Error(`AI generation completely failed across all active providers. Last error: ${lastError?.message || 'Unknown'}`);
}
