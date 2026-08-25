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
import { classifyAIError } from './error-classifier';
import { providerHealth } from './provider-health';
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
 * Resolves standard model names dynamically from environment or defaults
 */
export function getStandardModelName(provider: 'gemini' | 'openrouter'): string {
  if (provider === 'gemini') {
    return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }
  return process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
}

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
  const geminiFallbackModel = getStandardModelName('gemini');
  const openrouterFallbackModel = getStandardModelName('openrouter');
  
  // Set up sequential attempt sequence
  const attempts: Array<{ providerId: 'gemini' | 'openrouter'; model: string }> = [
    { providerId: primaryProviderId, model: primaryModel }
  ];

  // Configure fallbacks
  if (primaryProviderId === 'openrouter') {
    // If OpenRouter fails, attempt failover via Gemini (using currently supported model)
    attempts.push({ providerId: 'gemini', model: geminiFallbackModel });
  } else {
    // If Gemini fails, attempt failover via OpenRouter
    attempts.push({ providerId: 'openrouter', model: openrouterFallbackModel });
  }

  let lastError: Error | null = null;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    const isFallback = i > 0;

    // Check circuit breaker health
    if (!providerHealth.isHealthy(attempt.providerId, attempt.model) && attempts.length > 1 && !isFallback) {
      logger.warn(`[AI Pipeline][Gateway] Skipping primary ${attempt.providerId}/${attempt.model} because it is in unhealthy cooldown.`);
      continue;
    }

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
      const classified = classifyAIError(error, attempt.providerId);

      if (i + 1 < attempts.length) {
        const nextAttempt = attempts[i + 1];
        logger.warn(
          `[AI Fallback] primary=${attempt.providerId}/${attempt.model} error=${classified.statusCode || classified.category} fallback=${nextAttempt.providerId}/${nextAttempt.model} reason=${classified.category}`
        );
      } else {
        logger.error(
          `[AI Pipeline][Gateway] All configured provider attempts failed. Last error [${classified.category}]: ${lastError.message}`
        );
      }
    }
  }

  throw new Error(`AI generation completely failed across all active providers. Last error: ${lastError?.message || 'Unknown'}`);
}
