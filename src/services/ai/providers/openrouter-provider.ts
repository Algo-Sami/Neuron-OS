import { AIProvider, GenerateOptions, CompletionResult, estimateCost } from './provider-interface';
import { logger } from '@/lib/logger';
import { classifyAIError } from '../error-classifier';
import { providerHealth } from '../provider-health';
import { regulateBudget } from '../budget-guard';

export class OpenRouterProvider implements AIProvider {
  id = 'openrouter' as const;
  name = 'OpenRouter';

  private getApiKey(): string {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not defined in environment variables.');
    }
    return apiKey;
  }

  async generateText(
    modelName: string,
    prompt: string,
    options?: GenerateOptions
  ): Promise<CompletionResult> {
    const apiKey = this.getApiKey();
    const maxRetries = 3;
    let attempt = 0;
    let lastError: any = null;

    const messages: { role: string; content: string }[] = [];
    if (options?.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    // Apply budget regulation to prevent 402 token-ceiling errors
    const budget = regulateBudget(
      prompt,
      options?.systemInstruction,
      options?.maxOutputTokens,
      4096 // Safe default ceiling for OpenRouter calls
    );

    const payload: Record<string, any> = {
      model: modelName,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: budget.effectiveMaxOutputTokens
    };

    if (options?.responseMimeType === 'application/json') {
      payload.response_format = { type: 'json_object' };
    }

    while (attempt < maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000); // 35 second request timeout

      try {
        logger.info(`[OpenRouterProvider] Calling model: ${modelName} (Attempt ${attempt}/${maxRetries})`);
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://neuron-os.ai', // OpenRouter requirement
            'X-Title': 'Neuron OS'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const err = new Error(`OpenRouter HTTP error [${response.status}]: ${errorText}`);
          (err as any).status = response.status;
          throw err;
        }

        const data = await response.json();
        let responseText = data.choices?.[0]?.message?.content;

        if (!responseText) {
          throw new Error('OpenRouter API returned an empty response.');
        }

        // Clean JSON markdown tags if JSON requested
        if (options?.responseMimeType === 'application/json') {
          responseText = responseText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        }

        const promptTokens = data.usage?.prompt_tokens || Math.ceil(((options?.systemInstruction?.length || 0) + prompt.length) / 4);
        const completionTokens = data.usage?.completion_tokens || Math.ceil(responseText.length / 4);

        // Record health success
        providerHealth.recordSuccess('openrouter', modelName);

        return {
          text: responseText,
          model: modelName,
          provider: 'openrouter',
          usage: {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            estimatedCost: estimateCost(modelName, promptTokens, completionTokens)
          }
        };

      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;

        // Classify the error
        const classified = classifyAIError(err, 'openrouter');
        providerHealth.recordFailure('openrouter', modelName, classified.category, classified.message);

        logger.warn(
          `[OpenRouterProvider] Attempt ${attempt} failed [Category: ${classified.category}, Retryable: ${classified.retryable}]: ${classified.message}`
        );

        // If non-retryable (e.g. 402 billing, 401 auth, 404 invalid model, 400 bad request), STOP retries immediately
        if (!classified.retryable) {
          logger.warn(`[OpenRouterProvider] Stopping retries immediately due to non-retryable error (Category: ${classified.category}).`);
          break;
        }

        // Wait before retry (exponential backoff: 1s, 2s, 4s...)
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw new Error(`OpenRouter query failed after ${attempt} attempt(s). Last error: ${lastError?.message || String(lastError)}`);
  }

  async generateStructuredJSON(
    modelName: string,
    prompt: string,
    options?: GenerateOptions
  ): Promise<CompletionResult> {
    return this.generateText(modelName, prompt, {
      ...options,
      responseMimeType: 'application/json'
    });
  }

  async stream(
    modelName: string,
    prompt: string,
    options?: GenerateOptions
  ): Promise<ReadableStream> {
    const result = await this.generateText(modelName, prompt, options);
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(result.text));
        controller.close();
      }
    });
  }

  async healthCheck(modelName: string): Promise<boolean> {
    try {
      const result = await this.generateText(modelName, 'Ping', { maxOutputTokens: 10 });
      return !!result.text;
    } catch {
      return false;
    }
  }
}
