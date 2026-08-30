import { UserSubject, CandidateScore } from '../types';

/**
 * Layer 2 — Current Folder / Subject Context
 *
 * If the user uploads a document while browsing inside a specific subject folder,
 * the active folder context provides authoritative routing.
 *
 * Confidence: 1.0
 * AI Calls: 0
 */
export function evaluateFolderContext(
  currentSubjectId: string | undefined,
  userSubjects: UserSubject[]
): CandidateScore | null {
  if (!currentSubjectId) return null;

  const matchedSubject = userSubjects.find(
    (s) => s.id === currentSubjectId
  );

  if (!matchedSubject) {
    return null;
  }

  return {
    subjectId: matchedSubject.id,
    subjectName: matchedSubject.name,
    score: 1.0,
    method: 'folder_context',
    evidence: [`Upload initiated within subject context "${matchedSubject.name}"`],
  };
}
