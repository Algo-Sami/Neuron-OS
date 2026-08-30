import { UserSubject, CandidateScore, SubjectProfileData } from '../types';
import { DEFAULT_SUBJECT_CONCEPTS, CLASSIFICATION_CONFIG } from '../config';

/**
 * Computes cosine similarity between two 1536-dimensional embedding vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Extracts and scores concept keyword density in text.
 */
function scoreConceptDensity(
  text: string,
  concepts: string[]
): { score: number; matchedConcepts: string[] } {
  if (!text || concepts.length === 0) {
    return { score: 0, matchedConcepts: [] };
  }

  const lowerText = ` ${text.toLowerCase()} `;
  const matched: string[] = [];

  for (const concept of concepts) {
    const normConcept = concept.toLowerCase().trim();
    if (normConcept.length < 2) continue;

    // Use word boundary regex for single words or phrase search for multi-word
    const regex = new RegExp(`\\b${normConcept}\\b`, 'i');
    if (regex.test(lowerText) || lowerText.includes(` ${normConcept} `)) {
      matched.push(concept);
    }
  }

  if (matched.length === 0) {
    return { score: 0, matchedConcepts: [] };
  }

  // Non-linear scoring based on number of distinct matched concepts
  // 1 concept = 0.40, 2 = 0.65, 3 = 0.80, 4+ = 0.90+
  let score = 0;
  if (matched.length === 1) score = 0.45;
  else if (matched.length === 2) score = 0.68;
  else if (matched.length === 3) score = 0.82;
  else if (matched.length === 4) score = 0.89;
  else score = Math.min(0.96, 0.90 + (matched.length - 4) * 0.015);

  return { score, matchedConcepts: matched };
}

/**
 * Layer 6 — Semantic Content Classification
 *
 * Compares extracted document text and representative chunks against
 * the user's subject semantic profiles, concept keywords, and embeddings.
 *
 * Confidence: 0.85 - 0.94
 * AI Calls: 0 (reuses already extracted text / embeddings)
 */
export function evaluateSemanticMatch(
  extractedText: string | undefined,
  chunks: Array<{ content: string; embedding?: number[] }> | undefined,
  userSubjects: UserSubject[],
  subjectProfiles?: SubjectProfileData[]
): {
  winner: CandidateScore | null;
  candidates: CandidateScore[];
  isAmbiguous: boolean;
} {
  if (!extractedText && (!chunks || chunks.length === 0)) {
    return { winner: null, candidates: [], isAmbiguous: false };
  }

  // Combine first 2-3 chunks or first 4,000 characters of extracted text as representative context
  const sampleContent =
    chunks && chunks.length > 0
      ? chunks.slice(0, 3).map((c) => c.content).join('\n')
      : (extractedText || '').substring(0, 4000);

  if (sampleContent.trim().length < 20) {
    return { winner: null, candidates: [], isAmbiguous: false };
  }

  const scoredCandidates: CandidateScore[] = [];

  for (const subject of userSubjects) {
    // 1. Gather all concepts for this subject
    const subjectConcepts: string[] = [];

    // From subject record
    if (subject.representativeConcepts && subject.representativeConcepts.length > 0) {
      subjectConcepts.push(...subject.representativeConcepts);
    }

    // From subject profiles
    const profile = subjectProfiles?.find((p) => p.subjectId === subject.id);
    if (profile?.representativeConcepts) {
      subjectConcepts.push(...profile.representativeConcepts);
    }

    // From default concepts mapped to subject name / aliases (using exact or long-token matching)
    const normSubjName = subject.name.toLowerCase();
    for (const [canonical, defaultConcepts] of Object.entries(DEFAULT_SUBJECT_CONCEPTS)) {
      const normCanonical = canonical.toLowerCase();
      const isCanonicalMatch =
        normSubjName === normCanonical ||
        normSubjName.includes(normCanonical) ||
        normCanonical.includes(normSubjName) ||
        (subject.aliases || []).some(
          (a) => {
            const normA = a.toLowerCase();
            return normA === normCanonical || (normA.length >= 4 && normCanonical.includes(normA));
          }
        );

      if (isCanonicalMatch) {
        subjectConcepts.push(...defaultConcepts);
      }
    }

    const uniqueConcepts = Array.from(new Set(subjectConcepts));
    const { score: conceptScore, matchedConcepts } = scoreConceptDensity(
      sampleContent,
      uniqueConcepts
    );

    // 2. Vector Embedding Similarity (if embeddings exist on both sides)
    let embeddingScore = 0;
    if (profile?.embedding && chunks && chunks.length > 0) {
      const chunkEmbeddings = chunks
        .filter((c) => c.embedding && c.embedding.length === 1536)
        .map((c) => c.embedding!);

      if (chunkEmbeddings.length > 0) {
        const simScores = chunkEmbeddings.map((emb) =>
          cosineSimilarity(emb, profile.embedding!)
        );
        embeddingScore = Math.max(...simScores);
      }
    }

    // Combined score: concept match + embedding similarity
    const finalScore =
      embeddingScore > 0
        ? Math.max(conceptScore, conceptScore * 0.4 + embeddingScore * 0.6)
        : conceptScore;

    if (finalScore >= 0.50) {
      const evidenceList: string[] = [];
      if (matchedConcepts.length > 0) {
        evidenceList.push(
          `Matched concepts: [${matchedConcepts.slice(0, 5).join(', ')}]`
        );
      }
      if (embeddingScore > 0) {
        evidenceList.push(
          `Vector similarity: ${(embeddingScore * 100).toFixed(1)}%`
        );
      }

      scoredCandidates.push({
        subjectId: subject.id,
        subjectName: subject.name,
        score: Number(finalScore.toFixed(2)),
        method: 'semantic_match',
        evidence: evidenceList,
      });
    }
  }

  // Sort candidates descending by score
  scoredCandidates.sort((a, b) => b.score - a.score);

  if (scoredCandidates.length === 0) {
    return { winner: null, candidates: [], isAmbiguous: false };
  }

  const top = scoredCandidates[0];
  const runnerUp = scoredCandidates.length > 1 ? scoredCandidates[1] : null;

  // Check candidate margin to avoid ambiguous routing
  const margin = runnerUp ? top.score - runnerUp.score : 1.0;
  const isAmbiguous = runnerUp !== null && margin < CLASSIFICATION_CONFIG.MIN_CANDIDATE_MARGIN;

  if (top.score >= CLASSIFICATION_CONFIG.AUTO_ROUTE_THRESHOLD && !isAmbiguous) {
    return {
      winner: top,
      candidates: scoredCandidates,
      isAmbiguous: false,
    };
  }

  return {
    winner: null,
    candidates: scoredCandidates,
    isAmbiguous,
  };
}
