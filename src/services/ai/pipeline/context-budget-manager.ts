import { countTokens } from './tokenizer';

export interface BudgetReport {
  maxTokens: number;
  usedTokens: number;
  remainingTokens: number;
  isTruncated: boolean;
}

export class ContextBudgetManager {
  private maxTokens: number;
  private usedTokens = 0;
  private isTruncated = false;

  constructor(maxTokens: number) {
    this.maxTokens = maxTokens;
  }

  getUsedTokens(): number {
    return this.usedTokens;
  }

  getRemainingTokens(): number {
    return Math.max(0, this.maxTokens - this.usedTokens);
  }

  getReport(): BudgetReport {
    return {
      maxTokens: this.maxTokens,
      usedTokens: this.usedTokens,
      remainingTokens: this.getRemainingTokens(),
      isTruncated: this.isTruncated,
    };
  }

  /**
   * Evaluates if a chunk fits within the remaining token budget.
   * If it fits completely, adds it and updates usedTokens.
   * If it exceeds, trims it to fit the budget exactly, flags truncation, and adds it.
   */
  fitAndAdd(text: string): {
    accepted: boolean;
    truncated: boolean;
    text: string;
    tokensAdded: number;
    reason?: string;
  } {
    const remaining = this.getRemainingTokens();
    if (remaining <= 10) {
      return { accepted: false, truncated: false, text: '', tokensAdded: 0, reason: 'Budget exhausted' };
    }

    const chunkTokens = countTokens(text);
    
    // fits completely
    if (chunkTokens <= remaining) {
      this.usedTokens += chunkTokens;
      return { accepted: true, truncated: false, text, tokensAdded: chunkTokens };
    }

    // exceeds budget, trim it to fit
    this.isTruncated = true;
    const trimmedText = this.trimToTokenLimit(text, remaining);
    const trimmedTokens = countTokens(trimmedText);

    if (trimmedTokens === 0) {
      return { accepted: false, truncated: false, text: '', tokensAdded: 0, reason: 'Cannot fit even a single sentence' };
    }

    this.usedTokens += trimmedTokens;
    return { accepted: true, truncated: true, text: trimmedText, tokensAdded: trimmedTokens };
  }

  /**
   * Trims text to fit inside target token limit, aligning strictly
   * at sentence boundaries (. ! ?) or word boundaries. Never cuts words in half.
   */
  private trimToTokenLimit(text: string, tokenLimit: number): string {
    let charCutoff = Math.min(text.length, Math.floor(tokenLimit * 3.5));
    let slice = text.substring(0, charCutoff);
    let tokens = countTokens(slice);

    // Adjust cutoff to match token budget
    if (tokens > tokenLimit) {
      while (tokens > tokenLimit && charCutoff > 0) {
        charCutoff = Math.floor(charCutoff * (tokenLimit / tokens));
        slice = text.substring(0, charCutoff);
        tokens = countTokens(slice);
      }
    } else {
      while (tokens < tokenLimit && charCutoff < text.length) {
        const step = Math.max(10, Math.floor((tokenLimit - tokens) * 3));
        const nextCutoff = Math.min(text.length, charCutoff + step);
        if (nextCutoff === charCutoff) break;
        const nextSlice = text.substring(0, nextCutoff);
        const nextTokens = countTokens(nextSlice);
        if (nextTokens > tokenLimit) {
          break;
        }
        charCutoff = nextCutoff;
        slice = nextSlice;
        tokens = nextTokens;
      }
    }

    // Find sentence boundary in final slice
    const sentenceBoundaryRegex = /[.!?](\s+|\n|$)/g;
    let match;
    let lastSentenceEnd = -1;

    sentenceBoundaryRegex.lastIndex = 0;
    while ((match = sentenceBoundaryRegex.exec(slice)) !== null) {
      lastSentenceEnd = match.index + 1;
    }

    // If sentence boundary exists within last 40% of slice, cut there
    if (lastSentenceEnd > 0 && lastSentenceEnd > charCutoff * 0.6) {
      return slice.substring(0, lastSentenceEnd).trim();
    }

    // Word boundary fallback
    const lastSpace = slice.lastIndexOf(' ');
    if (lastSpace > 0 && lastSpace > charCutoff * 0.8) {
      return slice.substring(0, lastSpace).trim();
    }

    return slice.trim();
  }
}
