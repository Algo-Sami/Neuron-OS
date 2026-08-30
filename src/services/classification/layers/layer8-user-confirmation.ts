import { SubjectClassificationResult, CandidateScore } from '../types';

/**
 * Layer 8 — User Confirmation / Uncategorized Safety Fallback
 *
 * When no deterministic, semantic, or LLM method achieves sufficient confidence,
 * or when evidence is ambiguous between multiple subjects, this layer safely
 * marks the document as "Needs Subject" without silently misclassifying it.
 */
export function buildUserConfirmationResult(
  folderName: string | null,
  labSubfolderName: string | null,
  candidates: CandidateScore[] = [],
  reason = 'Classification confidence is insufficient. User confirmation required.'
): SubjectClassificationResult {
  const candidateSubjects = candidates.map((c) => ({
    subjectId: c.subjectId,
    subjectName: c.subjectName,
    confidence: c.score,
  }));

  const topCandidate = candidates.length > 0 ? candidates[0] : null;

  return {
    subjectId: null, // Unassigned until user confirms
    subjectName: topCandidate ? topCandidate.subjectName : null,
    folderName,
    labSubfolderName,
    confidence: topCandidate ? topCandidate.score : 0.0,
    method: 'uncategorized',
    reason,
    needsUserConfirmation: true,
    candidateSubjects,
    evidence: topCandidate ? topCandidate.evidence : ['No conclusive subject evidence found.'],
  };
}
