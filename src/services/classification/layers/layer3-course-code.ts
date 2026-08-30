import { UserSubject, CandidateScore } from '../types';

/**
 * Normalizes course codes into standard uppercase format without separators.
 * e.g. "CS-301", "cs 301", "CS_301", "cs301" -> "CS301"
 */
export function normalizeCourseCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const cleaned = code.trim().toUpperCase().replace(/[\s\-_.:]/g, '');
  // Course codes generally consist of 2-5 letters followed by 2-4 digits (optionally with trailing letter e.g. CS101A)
  if (/^[A-Z]{2,5}\d{2,4}[A-Z]?$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Extracts potential course code tokens from a string or filename.
 */
export function extractCourseCodes(text: string): string[] {
  const matches: string[] = [];
  // Match standard academic course code patterns like CS-301, CS301, SE 201, CSE-402, EE_101
  const regex = /\b([A-Za-z]{2,5})[\s\-_]?(\d{2,4}[A-Za-z]?)\b/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = `${match[1]}${match[2]}`.toUpperCase();
    const normalized = normalizeCourseCode(raw);
    if (normalized && !matches.includes(normalized)) {
      matches.push(normalized);
    }
  }

  return matches;
}

/**
 * Layer 3 — Course Code / Strong Metadata Matching
 *
 * Compares extracted course codes from the filename against the current user's
 * subject course codes.
 *
 * Confidence: 0.95
 * AI Calls: 0
 */
export function evaluateCourseCode(
  filename: string,
  userSubjects: UserSubject[]
): CandidateScore | null {
  const extractedCodes = extractCourseCodes(filename);
  if (extractedCodes.length === 0) return null;

  for (const subject of userSubjects) {
    if (!subject.code) continue;
    const normalizedSubjectCode = normalizeCourseCode(subject.code);
    if (!normalizedSubjectCode) continue;

    for (const code of extractedCodes) {
      if (code === normalizedSubjectCode) {
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          score: 0.95,
          method: 'course_code',
          evidence: [
            `Extracted course code "${code}" matches subject "${subject.name}" (${subject.code})`,
          ],
        };
      }
    }
  }

  return null;
}
