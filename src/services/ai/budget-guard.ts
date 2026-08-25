/**
 * AI Budget Guard & Token Regulation Utility
 *
 * Evaluates estimated prompt tokens, requested output tokens, and available credit/budget.
 * Prevents requests from requesting excessive token allocations (e.g. 8192) that trigger
 * provider-side credit rejection (HTTP 402 on OpenRouter), clamping output limits to
 * safe bounds while preserving content completeness.
 */

import { logger } from '@/lib/logger';

export interface BudgetEvaluation {
  estimatedInputTokens: number;
  requestedMaxOutputTokens: number;
  effectiveMaxOutputTokens: number;
  estimatedCost: number;
  decision: 'allow' | 'reduce' | 'block';
  reason?: string;
}

export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
export const HARD_TOKEN_CEILING = 8192;

/**
 * Estimates token count from string length (~4 chars per token approximation).
 */
export function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Regulates and bounds the requested generation tokens before sending to provider.
 */
export function regulateBudget(
  prompt: string,
  systemInstruction?: string,
  requestedMaxOutputTokens?: number,
  maxAllowedTokens: number = DEFAULT_MAX_OUTPUT_TOKENS
): BudgetEvaluation {
  const inputChars = (systemInstruction?.length || 0) + prompt.length;
  const estimatedInputTokens = Math.ceil(inputChars / 4);
  const requestedTokens = requestedMaxOutputTokens || DEFAULT_MAX_OUTPUT_TOKENS;

  let effectiveMaxOutputTokens = requestedTokens;
  let decision: BudgetEvaluation['decision'] = 'allow';
  let reason: string | undefined;

  // If requested output tokens exceeds safe allocation threshold, clamp to safe ceiling
  if (requestedTokens > maxAllowedTokens) {
    effectiveMaxOutputTokens = maxAllowedTokens;
    decision = 'reduce';
    reason = `Requested max tokens (${requestedTokens}) reduced to safe ceiling (${maxAllowedTokens}) to avoid provider credit exhaustion.`;
  }

  // Very rough cost estimate (e.g. $0.0000005 per token)
  const totalEstimatedTokens = estimatedInputTokens + effectiveMaxOutputTokens;
  const estimatedCost = (totalEstimatedTokens / 1000) * 0.0005;

  logger.info(
    `[BudgetGuard] input_tokens=${estimatedInputTokens} requested_max=${requestedTokens} effective_max=${effectiveMaxOutputTokens} estimated_cost=$${estimatedCost.toFixed(5)} action=${decision}${reason ? ` reason="${reason}"` : ''}`
  );

  return {
    estimatedInputTokens,
    requestedMaxOutputTokens: requestedTokens,
    effectiveMaxOutputTokens,
    estimatedCost,
    decision,
    reason
  };
}
