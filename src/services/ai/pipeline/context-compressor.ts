import { logger } from '@/lib/logger';

export class ContextCompressor {
  /**
   * Compresses context text to optimize token usage.
   * Removes duplicate whitespace, excessive blank lines, repeating page headers/footers, and page numbers.
   * Preserves meaningful content while stripping boilerplate.
   */
  static compress(text: string, documentTitle?: string): string {
    if (!text) return '';
    const startLen = text.length;

    // 1. Normalize line endings
    let processed = text.replace(/\r\n/g, '\n');

    // 2. Remove standard page number indicators: "Page X of Y", "Page X", "X / Y"
    processed = processed.replace(/Page\s+\d+\s+of\s+\d+/gi, '');
    processed = processed.replace(/Page\s+\d+/gi, '');
    processed = processed.replace(/\b\d+\s*\/\s*\d+\b/g, '');

    // 3. Remove document title repetitions if provided
    if (documentTitle) {
      const escapedTitle = documentTitle.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const titlePlainRegex = new RegExp(`^\\s*${escapedTitle}\\s*$`, 'gm');
      processed = processed.replace(titlePlainRegex, '');
    }

    // 4. Collapse consecutive spaces/tabs to a single space
    processed = processed.replace(/[ \t]+/g, ' ');

    // 5. Collapse consecutive blank lines
    processed = processed.replace(/\n\s*\n\s*\n+/g, '\n\n');

    // 6. Filter repeating header/footer lines (lines that appear identically 3 or more times)
    const lines = processed.split('\n');
    const lineCounts: Record<string, number> = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 5) {
        lineCounts[trimmed] = (lineCounts[trimmed] || 0) + 1;
      }
    }

    const repeatingLines = new Set<string>();
    for (const [line, count] of Object.entries(lineCounts)) {
      if (count >= 3) {
        repeatingLines.add(line);
      }
    }

    if (repeatingLines.size > 0) {
      processed = lines
        .filter(line => !repeatingLines.has(line.trim()))
        .join('\n');
    }

    const endLen = processed.length;
    const reductionPercent = startLen > 0 ? (((startLen - endLen) / startLen) * 100).toFixed(1) : '0';
    logger.info(`[ContextCompressor] Compressed context from ${startLen} to ${endLen} chars (${reductionPercent}% reduction)`);

    return processed.trim();
  }
}
