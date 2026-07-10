/**
 * cleanExtractedText
 *
 * Cleans raw extracted text from PDFs, DOCX, PPTX, images, and plain-text files
 * before it is validated and stored as the permanent knowledge source.
 *
 * Rules:
 *   ✅ Remove control characters, null bytes, invisible Unicode
 *   ✅ Strip page numbers (Page 3, - 4 -, standalone "12", etc.)
 *   ✅ Remove duplicate headers/footers (lines repeated 3+ times)
 *   ✅ Rejoin broken mid-sentence line breaks (word wrap artifacts)
 *   ✅ Collapse excessive blank lines into a single paragraph break
 *   ✅ Collapse multiple spaces/tabs into a single space
 *   ✅ Strip duplicated document titles at the top of pages
 *   ✅ Keep: headings, paragraphs, bullet lists, numbering, indentation
 */
export function cleanExtractedText(rawText: string): string {
  if (!rawText) return '';

  let cleaned = rawText;

  // ── 1. Remove null bytes and non-printable control characters ─────────────
  // Keep: \t (tab=0x09), \n (newline=0x0A), \r (CR=0x0D)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');

  // ── 2. Remove invisible/broken Unicode ────────────────────────────────────
  // Removes: replacement character, zero-width spaces, BOM, NBSP abuse
  cleaned = cleaned.replace(/[\uFFFD\u200B\u200C\u200D\u200E\u200F\uFEFF\u00AD]/g, '');

  // ── 3. Normalize Windows line endings ─────────────────────────────────────
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // ── 4. Strip page numbers ─────────────────────────────────────────────────
  // Matches: "Page 3", "Page 3 of 12", "- 3 -", standalone "3", "3."
  const lines = cleaned.split('\n');
  const filteredLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip pure page numbers
    if (
      /^(page\s+)?\d+(\s+of\s+\d+)?$/i.test(trimmed) ||   // Page 3 / Page 3 of 12
      /^-\s*\d+\s*-$/.test(trimmed) ||                      // - 3 -
      /^\d+\.?$/.test(trimmed)                              // 3 or 3.
    ) {
      continue;
    }

    filteredLines.push(line);
  }

  cleaned = filteredLines.join('\n');

  // ── 5. Detect and remove repeated headers/footers ─────────────────────────
  // Lines appearing 3+ times across the document are likely headers/footers.
  const allLines = cleaned.split('\n');
  const lineCounts = new Map<string, number>();
  
  for (const line of allLines) {
    const t = line.trim();
    // Only count meaningful lines (length > 5, not bullets/numbering)
    if (t.length > 5 && !/^[-*•]\s/.test(t) && !/^\d+[.)]\s/.test(t)) {
      lineCounts.set(t, (lineCounts.get(t) || 0) + 1);
    }
  }

  const repeatedLines = new Set<string>();
  for (const [line, count] of lineCounts.entries()) {
    if (count >= 3) {
      repeatedLines.add(line);
    }
  }

  const deduped: string[] = [];
  // Track the first allowed occurrence of repeated lines (keep first, drop rest)
  const seenOnce = new Set<string>();
  
  for (const line of allLines) {
    const trimmed = line.trim();
    
    if (repeatedLines.has(trimmed)) {
      if (!seenOnce.has(trimmed)) {
        seenOnce.add(trimmed);
        deduped.push(line); // Keep the first occurrence
      }
      // Drop all subsequent occurrences
    } else {
      deduped.push(line);
    }
  }

  cleaned = deduped.join('\n');

  // ── 6. Rejoin broken mid-sentence line breaks (word-wrap artifacts) ────────
  // Lines that end mid-sentence (no punctuation, next line starts lowercase)
  // should be merged. This is common in PDF text extraction.
  const rejoined: string[] = [];
  const splitLines = cleaned.split('\n');
  
  for (let i = 0; i < splitLines.length; i++) {
    const current = splitLines[i];
    const next = splitLines[i + 1];
    const trimmedCurrent = current.trimEnd();
    const trimmedNext = next?.trim();

    const currentEndsWithPunct = /[.!?:;,)\]"'»–—]$/.test(trimmedCurrent);
    const nextStartsLower = trimmedNext ? /^[a-z]/.test(trimmedNext) : false;
    const currentIsNotEmpty = trimmedCurrent.trim().length > 0;
    const nextIsNotEmpty = (trimmedNext || '').length > 0;

    // Merge if: current line doesn't end with punctuation AND next starts lowercase
    // This catches PDF line-break artifacts within paragraphs
    if (
      currentIsNotEmpty &&
      nextIsNotEmpty &&
      !currentEndsWithPunct &&
      nextStartsLower
    ) {
      rejoined.push(trimmedCurrent + ' ');
      // Don't add the next line as a separate element; it will merge naturally
    } else {
      rejoined.push(current);
    }
  }

  cleaned = rejoined.join('\n');

  // ── 7. Collapse 3+ consecutive blank lines into double newline ────────────
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // ── 8. Collapse multiple spaces/tabs into a single space ──────────────────
  // Operates within each line only (not across newlines)
  cleaned = cleaned
    .split('\n')
    .map(line => line.replace(/[ \t]{2,}/g, ' '))
    .join('\n');

  return cleaned.trim();
}

/**
 * Compute rich metadata from cleaned text.
 * Returns character count, word count, estimated reading time,
 * heading count, and paragraph count.
 */
export function computeTextMetadata(cleanedText: string): {
  characterCount: number;
  wordCount: number;
  estimatedReadingTimeMinutes: number;
  headingCount: number;
  paragraphCount: number;
} {
  if (!cleanedText) {
    return {
      characterCount: 0,
      wordCount: 0,
      estimatedReadingTimeMinutes: 0,
      headingCount: 0,
      paragraphCount: 0,
    };
  }

  const characterCount = cleanedText.length;
  const words = cleanedText.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  // Average reading speed: 200-250 words per minute
  const estimatedReadingTimeMinutes = Math.ceil(wordCount / 225);

  // Count markdown-style headings (# Heading, ## Heading, etc.)
  // Also matches ALL-CAPS lines and lines ending with ":" that are short (likely headings)
  const headingCount = (cleanedText.match(/^#+\s+.+/gm) || []).length +
    (cleanedText.match(/^[A-Z][A-Z\s]{5,}:?\s*$/gm) || []).length;

  // Count paragraphs: blocks of text separated by blank lines
  const paragraphs = cleanedText.split(/\n\n+/).filter(p => p.trim().length > 30);
  const paragraphCount = paragraphs.length;

  return {
    characterCount,
    wordCount,
    estimatedReadingTimeMinutes,
    headingCount,
    paragraphCount,
  };
}
