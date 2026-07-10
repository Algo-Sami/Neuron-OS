import { routeAIRequest } from '../router';
import { SearchResult } from '../search';
import { countTokens } from './tokenizer';
import { logger } from '@/lib/logger';

export class SlidingWindowSummarizer {
  /**
   * Generates a concise summary for a group of chunks.
   */
  private static async summarizeChunkGroup(
    userId: string,
    chunks: SearchResult[],
    groupIndex: number,
    totalGroups: number
  ): Promise<string> {
    logger.info(`[SlidingWindowSummarizer] Summarizing chunk group ${groupIndex + 1}/${totalGroups} (${chunks.length} chunks)`);
    
    const contextText = chunks.map(c => c.content).join('\n\n');
    const prompt = `You are an experienced university professor. Your task is to rewrite this section of a lecture into a clear, flowing educational explanation that a student can easily understand and learn from.

For every concept or topic in this section:
- Explain what it is in plain language.
- Explain why it exists or why it matters.
- Explain how it works or how it is applied.
- Explain how it connects to related ideas if applicable.
- Preserve any examples or comparisons from the original — they help students understand.

Write in natural, flowing prose paragraphs. Do not use excessive bullet points as substitutes for explanation.
Do NOT include: Key Takeaways, Exam Tips, Quick Revision, or any non-explanatory sections.
Preserve the original teaching order. Do not skip any concept.

SECTION LECTURE CONTENT:
"""
${contextText}
"""`;

    const res = await routeAIRequest({
      userId,
      taskType: 'summary',
      prompt,
      systemInstruction: 'You are an experienced university professor. Rewrite lecture content into clear, flowing educational explanations. Explain every concept fully. Do not compress or skip ideas. Write in natural prose.',
      temperature: 0.3,
      skipCache: true
    });

    if (!res.success || !res.content) {
      throw new Error(`Failed to generate group summary for group ${groupIndex + 1}: ${res.content || 'Empty response'}`);
    }

    return res.content;
  }

  /**
   * Orchestrates the sliding window summary generation.
   * Divides raw chunks into windows, summarizes each window, and returns a merged context string.
   */
  static async generateSlidingWindowContext(
    userId: string,
    chunks: SearchResult[],
    windowSize = 4
  ): Promise<string> {
    const chunkGroups: SearchResult[][] = [];
    for (let i = 0; i < chunks.length; i += windowSize) {
      chunkGroups.push(chunks.slice(i, i + windowSize));
    }

    logger.info(`[SlidingWindowSummarizer] Initiating Sliding Window context generation. ${chunks.length} chunks divided into ${chunkGroups.length} groups.`);

    const partialSummaries: string[] = [];
    for (let i = 0; i < chunkGroups.length; i++) {
      const summary = await this.summarizeChunkGroup(userId, chunkGroups[i], i, chunkGroups.length);
      partialSummaries.push(`=== Section ${i + 1} Summary ===\n${summary}`);
    }

    return partialSummaries.join('\n\n');
  }

  /**
   * Orchestrates Hierarchical summarization for extremely large documents.
   * Recursively groups and summarizes until the combined summaries fit within the target budget.
   */
  static async generateHierarchicalContext(
    userId: string,
    chunks: SearchResult[],
    maxBudgetTokens = 6000,
    sectionSize = 6
  ): Promise<string> {
    logger.info(`[SlidingWindowSummarizer] Initiating Hierarchical context generation for ${chunks.length} chunks.`);

    // 1. Initial round: summarize all chunks in sections
    const chunkGroups: SearchResult[][] = [];
    for (let i = 0; i < chunks.length; i += sectionSize) {
      chunkGroups.push(chunks.slice(i, i + sectionSize));
    }

    let summaries: string[] = [];
    for (let i = 0; i < chunkGroups.length; i++) {
      const summary = await this.summarizeChunkGroup(userId, chunkGroups[i], i, chunkGroups.length);
      summaries.push(summary);
    }

    // 2. Hierarchical consolidation if the combined summaries still exceed the token budget
    let currentLevelText = summaries.join('\n\n');
    let currentLevelTokens = countTokens(currentLevelText);
    let level = 1;

    while (currentLevelTokens > maxBudgetTokens && summaries.length > 1) {
      logger.info(`[SlidingWindowSummarizer] Level ${level} summaries exceed budget (${currentLevelTokens} > ${maxBudgetTokens} tokens). Summarizing hierarchically.`);
      const consolidatedSummaries: string[] = [];
      
      for (let i = 0; i < summaries.length; i += 4) {
        const group = summaries.slice(i, i + 4).map((s, idx) => `=== Section ${idx + 1} ===\n${s}`).join('\n\n');
        const prompt = `You are an experienced university professor. You have been given several section-level educational explanations from the same lecture. Your task is to merge them into one coherent, flowing educational narrative.

Rules:
- Preserve all concepts and explanations. Do not drop or over-compress any idea.
- Remove only exact repetition of the same concept.
- Connect sections smoothly so the merged result reads as one unified educational document, not a stitched collection.
- Maintain the original lecture order.
- Write in natural, conversational prose. Do not add Exam Tips, Key Takeaways, Quick Revision, or any non-explanatory sections.
- The merged result should read as if a professor wrote it as one continuous explanation.

SECTION EXPLANATIONS TO MERGE:
"""
${group}
"""`;

        const res = await routeAIRequest({
          userId,
          taskType: 'summary',
          prompt,
          systemInstruction: 'You are an experienced university professor merging section explanations into one coherent educational document. Preserve all concepts. Remove only exact repetition. Write in flowing, natural prose.',
          temperature: 0.3,
          skipCache: true
        });

        if (!res.success || !res.content) {
          throw new Error(`Failed to consolidate summaries at level ${level}, index ${i}: ${res.content || 'Empty'}`);
        }
        consolidatedSummaries.push(res.content);
      }

      summaries = consolidatedSummaries;
      currentLevelText = summaries.join('\n\n');
      currentLevelTokens = countTokens(currentLevelText);
      level++;
    }

    logger.info(`[SlidingWindowSummarizer] Hierarchical context stable at level ${level} (${currentLevelTokens} tokens)`);
    return currentLevelText;
  }
}
