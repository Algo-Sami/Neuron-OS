import { UserSubject, CandidateScore } from '../types';

/**
 * Layer 1 — Explicit User Subject Selection
 *
 * If the user explicitly selected a subject during the upload flow,
 * that selection is authoritative and takes absolute precedence.
 *
 * Confidence: 1.0
 * AI Calls: 0
 */
export function evaluateExplicitSelection(
  explicitSubjectId: string | undefined,
  userSubjects: UserSubject[]
): CandidateScore | null {
  if (!explicitSubjectId) return null;

  const matchedSubject = userSubjects.find(
    (s) => s.id === explicitSubjectId
  );

  if (!matchedSubject) {
    // Explicit ID provided does not belong to user's active subjects
    return null;
  }

  return {
    subjectId: matchedSubject.id,
    subjectName: matchedSubject.name,
    score: 1.0,
    method: 'explicit_selection',
    evidence: [`User explicitly selected subject "${matchedSubject.name}"`],
  };
}
