import { UserSubject, CandidateScore } from '../types';
import {
  IGNORE_WORDS,
  GENERIC_WORDS_BLACKLIST,
  DEFAULT_LEGACY_SYNONYMS,
  DEFAULT_SUBJECT_CONCEPTS,
} from '../config';

/**
 * Escapes regex special characters in a string.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks for token / acronym match using non-alphanumeric boundaries.
 * Correctly handles underscores (_), hyphens (-), dots (.), spaces, brackets, and string start/end.
 *
 * Example:
 *   matchesWordBoundary("PP_lecture_6.pdf", "PP") -> true
 *   matchesWordBoundary("PP-lecture-6.pdf", "PP") -> true
 *   matchesWordBoundary("Lecture_6_PP.pdf", "PP") -> true
 *   matchesWordBoundary("Apple_lecture.pdf", "PP") -> false
 */
export function matchesWordBoundary(rawText: string, target: string): boolean {
  if (!target || target.trim().length === 0) return false;
  const escaped = escapeRegex(target.trim());
  const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:[^a-zA-Z0-9]|$)`, 'i');
  return regex.test(rawText);
}

/**
 * Extracts a candidate acronym from multi-word subject names.
 * Example: "Parallel Programming" -> "PP", "Data Structures" -> "DS"
 */
export function extractSubjectAcronym(subjectName: string): string | null {
  const words = subjectName
    .replace(/[_\-\.:/\\]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !IGNORE_WORDS.includes(w.toLowerCase()));

  if (words.length >= 2) {
    const acronym = words.map((w) => w.charAt(0)).join('').toUpperCase();
    if (acronym.length >= 2 && !GENERIC_WORDS_BLACKLIST.has(acronym.toLowerCase())) {
      return acronym;
    }
  }
  return null;
}

/**
 * Normalizes a filename or subject string for deterministic matching.
 */
export function normalizeFilenameTokens(text: string): string {
  let cleaned = text.toLowerCase();

  // Remove extension if present
  cleaned = cleaned.replace(/\.[a-z0-9]+$/i, '');

  // Replace common separators with spaces
  cleaned = cleaned.replace(/[_\-\.:/\\]+/g, ' ');

  // Remove ignore words with word boundaries
  for (const word of IGNORE_WORDS) {
    const escapedWord = escapeRegex(word);
    const regex = new RegExp(`(?:^|\\s)${escapedWord}(?:\\s|$)`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }

  // Remove standalone numbers (e.g. "03", "4", "2026")
  cleaned = cleaned.replace(/\b\d+\b/g, ' ');

  // Collapse spaces & trim
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Check if a candidate match phrase consists solely of generic blacklist words.
 */
export function isPurelyGeneric(phrase: string): boolean {
  const tokens = phrase.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => GENERIC_WORDS_BLACKLIST.has(t));
}

/**
 * Checks if a string contains an alias or subject name with word boundary semantics.
 */
export function containsPhrase(text: string, phrase: string): boolean {
  const normText = ` ${normalizeFilenameTokens(text)} `;
  const normPhrase = ` ${normalizeFilenameTokens(phrase)} `;
  if (normPhrase.trim().length === 0) return false;
  return normText.includes(normPhrase);
}

/**
 * Layer 4 — Normalized Exact & Deterministic Matching
 *
 * Evaluates the filename against the user's actual subjects:
 *   1. Direct subject name (including short 2-character names like PP, OS, AI, ML, CN, SE, DB, PF)
 *   2. Dynamically generated subject acronyms (e.g. "Parallel Programming" -> PP)
 *   3. User-defined custom aliases (from subject_aliases table)
 *   4. System/legacy synonym mappings mapped to user's subjects
 *   5. Core domain concepts (e.g. "circular queue", "openmp", "deadlock")
 *
 * Implements non-alphanumeric boundary protection to handle underscore/hyphen/dot delimited filenames.
 *
 * Confidence: 0.92 - 0.96
 * AI Calls: 0
 */
export function evaluateExactMatch(
  rawFilename: string,
  userSubjects: UserSubject[]
): CandidateScore | null {
  const normFilename = normalizeFilenameTokens(rawFilename);

  for (const subject of userSubjects) {
    const normSubjectName = normalizeFilenameTokens(subject.name);

    // 1. Direct Subject Name Match (handles "PP", "Data Structure", "Operating Systems", etc.)
    if (normSubjectName.length >= 2 && !isPurelyGeneric(normSubjectName)) {
      // 1a. Normalized whole equality
      if (normFilename === normSubjectName) {
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          score: 0.96,
          method: 'exact_match',
          evidence: [`Filename directly matches subject name "${subject.name}"`],
        };
      }

      // 1b. Word-boundary token match in raw filename (handles "PP_lecture_6.pdf", "PP-Notes.docx", etc.)
      if (matchesWordBoundary(rawFilename, subject.name)) {
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          score: 0.95,
          method: 'exact_match',
          evidence: [`Filename contains subject name "${subject.name}" with boundary matching`],
        };
      }

      // 1c. Normalized phrase inclusion
      if (containsPhrase(rawFilename, subject.name)) {
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          score: 0.94,
          method: 'exact_match',
          evidence: [`Filename contains normalized phrase for subject "${subject.name}"`],
        };
      }
    }

    // 2. Direct Subject Course Code (e.g. CS301, PP101)
    if (subject.code && subject.code.trim().length >= 2) {
      if (matchesWordBoundary(rawFilename, subject.code.trim())) {
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          score: 0.95,
          method: 'exact_match',
          evidence: [`Filename contains subject course code "${subject.code}"`],
        };
      }
    }

    // 3. Dynamically Generated Subject Acronym (e.g. "Parallel Programming" -> "PP", "Data Structures" -> "DS")
    const generatedAcronym = extractSubjectAcronym(subject.name);
    if (generatedAcronym && matchesWordBoundary(rawFilename, generatedAcronym)) {
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        score: 0.93,
        method: 'exact_match',
        evidence: [`Filename matches acronym "${generatedAcronym}" for subject "${subject.name}"`],
      };
    }

    // 4. User-specific custom / learned aliases
    const aliases = subject.aliases || [];
    for (const alias of aliases) {
      const normAlias = normalizeFilenameTokens(alias);
      if (normAlias.length < 2 || isPurelyGeneric(normAlias)) continue;

      if (
        normFilename === normAlias ||
        matchesWordBoundary(rawFilename, alias) ||
        containsPhrase(rawFilename, alias)
      ) {
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          score: 0.93,
          method: 'exact_match',
          evidence: [`Filename matches user alias "${alias}" for subject "${subject.name}"`],
        };
      }
    }

    // 5. Legacy / System default synonyms matching against user's actual subject
    for (const [canonicalSubject, synonyms] of Object.entries(DEFAULT_LEGACY_SYNONYMS)) {
      // Check if user subject corresponds to this canonical subject
      const isSubjectMatched =
        normalizeFilenameTokens(subject.name) === normalizeFilenameTokens(canonicalSubject) ||
        synonyms.some(
          (syn) => normalizeFilenameTokens(syn) === normalizeFilenameTokens(subject.name)
        ) ||
        (extractSubjectAcronym(canonicalSubject) &&
          normalizeFilenameTokens(subject.name) ===
            normalizeFilenameTokens(extractSubjectAcronym(canonicalSubject)!));

      if (!isSubjectMatched) continue;

      // Check if filename matches any synonym
      for (const synonym of synonyms) {
        const normSynonym = normalizeFilenameTokens(synonym);
        if (normSynonym.length < 2 || isPurelyGeneric(normSynonym)) continue;

        if (
          normFilename === normSynonym ||
          matchesWordBoundary(rawFilename, synonym) ||
          containsPhrase(rawFilename, synonym)
        ) {
          return {
            subjectId: subject.id,
            subjectName: subject.name,
            score: 0.92,
            method: 'exact_match',
            evidence: [
              `Filename matches synonym "${synonym}" mapped to user subject "${subject.name}"`,
            ],
          };
        }
      }
    }

    // 6. Core domain concept phrase matching from subject concepts (e.g. "circular queue", "openmp", "cuda", "deadlock")
    const concepts: string[] = [...(subject.representativeConcepts || [])];
    for (const [canonical, defaultConcepts] of Object.entries(DEFAULT_SUBJECT_CONCEPTS)) {
      const normCanonical = canonical.toLowerCase();
      const normSubj = subject.name.toLowerCase();
      if (
        normSubj === normCanonical ||
        normSubj.includes(normCanonical) ||
        normCanonical.includes(normSubj) ||
        (extractSubjectAcronym(canonical)?.toLowerCase() === normSubj)
      ) {
        concepts.push(...defaultConcepts);
      }
    }

    for (const concept of concepts) {
      const normConcept = normalizeFilenameTokens(concept);
      // Only match multi-word or distinct non-generic concepts of length >= 3
      if (normConcept.length < 3 || isPurelyGeneric(normConcept)) continue;

      if (containsPhrase(rawFilename, concept) || matchesWordBoundary(rawFilename, concept)) {
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          score: 0.92,
          method: 'exact_match',
          evidence: [
            `Filename contains core subject concept "${concept}" for subject "${subject.name}"`,
          ],
        };
      }
    }
  }

  return null;
}
