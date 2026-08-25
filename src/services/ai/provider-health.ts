/**
 * Provider Health & Circuit Breaker Manager
 *
 * Tracks the availability and health status of AI providers and models.
 * Automatically marks providers/models in a temporary cooldown when they encounter
 * persistent or non-retryable configuration/billing issues (e.g. 401, 402, 404),
 * preventing the scheduler and gateway from repeatedly hammering broken endpoints.
 */

import { logger } from '@/lib/logger';
import { AIErrorCategory } from './error-classifier';

interface HealthState {
  healthy: boolean;
  consecutiveFailures: number;
  lastFailureTime?: number;
  cooldownUntil?: number;
  lastErrorCategory?: AIErrorCategory;
  lastErrorMessage?: string;
}

class ProviderHealthTracker {
  private state = new Map<string, HealthState>();

  private getKey(providerId: string, modelName: string): string {
    return `${providerId}::${modelName}`;
  }

  /**
   * Checks if a provider/model combination is currently considered healthy and eligible for requests.
   */
  isHealthy(providerId: string, modelName: string): boolean {
    const key = this.getKey(providerId, modelName);
    const item = this.state.get(key);
    if (!item) return true;

    if (item.cooldownUntil && Date.now() < item.cooldownUntil) {
      logger.warn(`[ProviderHealth] ${providerId}/${modelName} is in cooldown until ${new Date(item.cooldownUntil).toISOString()} (reason: ${item.lastErrorCategory})`);
      return false;
    }

    return true;
  }

  /**
   * Records a successful completion to reset failure counts and restore health.
   */
  recordSuccess(providerId: string, modelName: string): void {
    const key = this.getKey(providerId, modelName);
    this.state.set(key, {
      healthy: true,
      consecutiveFailures: 0,
    });
  }

  /**
   * Records a failure and applies appropriate cooldown periods based on error category.
   */
  recordFailure(
    providerId: string,
    modelName: string,
    category: AIErrorCategory,
    errorMessage: string
  ): void {
    const key = this.getKey(providerId, modelName);
    const prev = this.state.get(key) || { healthy: true, consecutiveFailures: 0 };
    const consecutiveFailures = prev.consecutiveFailures + 1;

    let cooldownMs = 0;

    // Cooldown duration based on severity
    if (category === 'billing') {
      // Out of credits: cooldown for 10 minutes
      cooldownMs = 10 * 60 * 1000;
    } else if (category === 'auth' || category === 'invalid_model') {
      // Configuration/Model error: cooldown for 15 minutes
      cooldownMs = 15 * 60 * 1000;
    } else if (consecutiveFailures >= 3) {
      // Transient failures accumulating: short 1 minute cooldown
      cooldownMs = 60 * 1000;
    }

    const now = Date.now();
    const cooldownUntil = cooldownMs > 0 ? now + cooldownMs : undefined;

    this.state.set(key, {
      healthy: cooldownMs === 0,
      consecutiveFailures,
      lastFailureTime: now,
      cooldownUntil,
      lastErrorCategory: category,
      lastErrorMessage: errorMessage
    });

    logger.warn(
      `[ProviderHealth] Recorded failure for ${providerId}/${modelName} | Category: ${category} | Failures: ${consecutiveFailures} | Cooldown: ${cooldownMs > 0 ? `${cooldownMs / 1000}s` : 'none'}`
    );
  }

  /**
   * Resets all provider health states (useful for testing or manual retry).
   */
  reset(): void {
    this.state.clear();
  }
}

export const providerHealth = new ProviderHealthTracker();
