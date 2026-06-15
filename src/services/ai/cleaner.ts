// Cleans and normalizes extracted text for LLM usage

export function cleanExtractedText(rawText: string): string {
  if (!rawText) return "";

  let cleaned = rawText;

  // 1. Remove null bytes and non-printable characters
  cleaned = cleaned.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, " ");

  // 2. Replace multiple newlines with a single double-newline (paragraphs)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // 3. Replace multiple spaces/tabs with a single space
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ");

  // 4. Remove standalone isolated weird unicode symbols or broken characters
  cleaned = cleaned.replace(/[\uFFFD\u200B\u200E\u200F]/g, "");

  // 5. Trim leading and trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}
