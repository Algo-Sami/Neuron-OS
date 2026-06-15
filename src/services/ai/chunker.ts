/**
 * Structural Semantic Chunker for Neuron OS RAG.
 * Instead of splitting at arbitrary character indices which breaks sentences and words,
 * this chunker splits along natural paragraph boundaries (\n\n), heading demarcations (#, ##, ###),
 * and list sections, then aggregates them into contextual blocks of bounded size.
 * 
 * @param text The raw extracted document text.
 * @param maxChunkSize Target maximum size per chunk (default 1200 chars).
 * @param overlap Target overlap size to preserve context between chunks (default 200 chars).
 * @returns Array of clean, contextual text chunks.
 */
export function chunkText(
  text: string, 
  maxChunkSize: number = 1200, 
  overlap: number = 200
): string[] {
  if (!text) return [];

  // Normalize newlines
  const normalizedText = text.replace(/\r\n/g, '\n').trim();
  
  // Split the document into sections based on structural boundaries (headings or paragraphs)
  // Split using a regex that captures headings and paragraph breaks
  const rawSections = normalizedText.split(/(?=(?:^|\n)(?:#{1,6}\s+|-\s+|\*\s+|\n\n))/);
  
  const sections: string[] = [];
  for (const rawSec of rawSections) {
    const trimmed = rawSec.trim();
    if (trimmed) {
      // If a single paragraph is larger than maxChunkSize, we split it by sentences
      if (trimmed.length > maxChunkSize) {
        const sentences = trimmed.split(/(?<=[.!?])\s+/);
        let temp = '';
        for (const sent of sentences) {
          if ((temp + sent).length > maxChunkSize) {
            if (temp.trim()) sections.push(temp.trim());
            temp = sent;
          } else {
            temp += (temp ? ' ' : '') + sent;
          }
        }
        if (temp.trim()) sections.push(temp.trim());
      } else {
        sections.push(trimmed);
      }
    }
  }

  const chunks: string[] = [];
  let currentChunk = '';

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];

    if (!currentChunk) {
      currentChunk = sec;
    } else if ((currentChunk + '\n\n' + sec).length <= maxChunkSize) {
      // Append section to current chunk if it fits
      currentChunk += '\n\n' + sec;
    } else {
      // Push completed chunk
      chunks.push(currentChunk);

      // Construct next chunk starting with overlap from the end of currentChunk
      if (overlap > 0 && currentChunk.length > overlap) {
        const overlapText = currentChunk.slice(-overlap);
        // Clean overlap to start at a word boundary
        const spaceIdx = overlapText.indexOf(' ');
        const cleanOverlap = spaceIdx !== -1 ? overlapText.slice(spaceIdx + 1) : overlapText;
        currentChunk = cleanOverlap + '\n\n' + sec;
      } else {
        currentChunk = sec;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
