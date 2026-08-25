import { AIProvider, GenerateOptions, CompletionResult, estimateCost } from './provider-interface';
import { getAIClient } from '../gemini';
import { logger } from '@/lib/logger';
import { classifyAIError } from '../error-classifier';
import { providerHealth } from '../provider-health';
import { regulateBudget } from '../budget-guard';

export class GeminiProvider implements AIProvider {
  id = 'gemini' as const;
  name = 'Google Gemini';

  async generateText(
    modelName: string,
    prompt: string,
    options?: GenerateOptions
  ): Promise<CompletionResult> {
    try {
      const budget = regulateBudget(
        prompt,
        options?.systemInstruction,
        options?.maxOutputTokens,
        8192
      );

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
          maxOutputTokens: budget.effectiveMaxOutputTokens,
          responseMimeType,
          responseSchema: options?.responseSchema as any,
        }
      });

      const responseText = result.response.text();
      if (!responseText) {
        throw new Error('Gemini returned an empty response.');
      }

      // Estimate tokens
      const inputChars = (options?.systemInstruction?.length || 0) + prompt.length;
      const outputChars = responseText.length;
      const promptTokens = Math.ceil(inputChars / 4);
      const completionTokens = Math.ceil(outputChars / 4);

      providerHealth.recordSuccess('gemini', modelName);

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
    } catch (err: any) {
      const classified = classifyAIError(err, 'gemini');
      providerHealth.recordFailure('gemini', modelName, classified.category, classified.message);
      logger.error(`[GeminiProvider] generateText failed [Category: ${classified.category}]: ${classified.message}`);
      throw err;
    }
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
