import { SupabaseClient } from '@supabase/supabase-js';
import {
  ClassificationInput,
  SubjectClassificationResult,
  UserSubject,
  CandidateScore,
} from './types';
import { CLASSIFICATION_CONFIG } from './config';
import { evaluateExplicitSelection } from './layers/layer1-explicit';
import { evaluateFolderContext } from './layers/layer2-folder-context';
import { evaluateCourseCode } from './layers/layer3-course-code';
import { evaluateExactMatch } from './layers/layer4-exact-match';
import { evaluateFuzzyMatch } from './layers/layer5-fuzzy-match';
import { evaluateSemanticMatch } from './layers/layer6-semantic-match';
import { buildUserConfirmationResult } from './layers/layer8-user-confirmation';

/**
 * Keyword mappings for destination folder category resolution.
 */
interface FolderKeywordMapping {
  keywords: string[];
  folderName: string;
}

const DEFAULT_FOLDER_MAPPINGS: FolderKeywordMapping[] = [
  { keywords: ['presentation', 'ppt', 'pptx', 'slides', 'seminar'], folderName: 'Presentations' },
  { keywords: ['assignment', 'homework', 'task', 'project-milestone'], folderName: 'Assignments' },
  { keywords: ['lecture', 'lec', 'class'], folderName: 'Lectures' },
  { keywords: ['quiz', 'exam', 'test', 'assessment', 'midterm', 'final'], folderName: 'Quizzes' },
  { keywords: ['project', 'capstone', 'implementation'], folderName: 'Projects' },
];

/**
 * Resolves destination folder category (Lectures, Assignments, Lab, etc.) from filename.
 */
export function resolveFolderCategory(fileName: string): {
  folderName: string | null;
  labSubfolderName: string | null;
} {
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
  const isLab = /\b(lab|laboratory|practicals|practical)\b/i.test(nameWithoutExt);

  let labSubfolder: string | null = null;
  if (isLab) {
    const lower = nameWithoutExt.toLowerCase();
    if (/\b(terminal|terminals)\b/i.test(lower)) labSubfolder = 'Terminals';
    else if (/\b(viva|oral|oral[\s-]exam)\b/i.test(lower)) labSubfolder = 'Viva';
    else if (/\b(task|tasks|report|reports|sheet|sheets|session|sessions|experiment|experiments)\b/i.test(lower))
      labSubfolder = 'Lab Tasks';
    else if (/\b(manual|manuals|guide|guides|instruction|instructions)\b/i.test(lower))
      labSubfolder = 'Lab Manuals';
    else labSubfolder = 'Other Lab Files';
  }

  for (const mapping of DEFAULT_FOLDER_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      const regex = new RegExp(
        `\\b${keyword}\\b|_${keyword}_|-${keyword}-|\\b${keyword}(?=\\d)|(?<=\\d)${keyword}\\b`,
        'i'
      );
      if (regex.test(nameWithoutExt)) {
        return {
          folderName: isLab ? 'Lab' : mapping.folderName,
          labSubfolderName: labSubfolder,
        };
      }
    }
  }

  return {
    folderName: isLab ? 'Lab' : null,
    labSubfolderName: labSubfolder,
  };
}

/**
 * Production-Grade Intelligent Subject Classifier
 */
export class SubjectClassifier {
  /**
   * Fetches active user subjects along with their aliases and metadata.
   */
  static async loadUserSubjects(
    supabase: SupabaseClient,
    userId: string
  ): Promise<UserSubject[]> {
    let rawSubjects: any[] | null = null;

    // Try fetching with extended columns first
    const { data: extSubjects, error: extError } = await supabase
      .from('subjects')
      .select('id, name, code, color, description, representative_concepts')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!extError && extSubjects) {
      rawSubjects = extSubjects;
    } else {
      // Graceful fallback to baseline columns if migration hasn't been executed yet
      const { data: baseSubjects, error: baseError } = await supabase
        .from('subjects')
        .select('id, name, code, color')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (baseError || !baseSubjects) {
        console.warn(`[SubjectClassifier] Failed to load subjects for user ${userId}:`, baseError?.message || extError?.message);
        return [];
      }
      rawSubjects = baseSubjects;
    }

    // Fetch aliases safely (ignoring table non-existence if migration not yet run)
    const subjectIds = rawSubjects.map((s) => s.id);
    const aliasesBySubjectId: Record<string, string[]> = {};

    if (subjectIds.length > 0) {
      try {
        const { data: aliases } = await supabase
          .from('subject_aliases')
          .select('subject_id, alias')
          .in('subject_id', subjectIds);

        if (aliases) {
          for (const item of aliases) {
            if (!aliasesBySubjectId[item.subject_id]) {
              aliasesBySubjectId[item.subject_id] = [];
            }
            aliasesBySubjectId[item.subject_id].push(item.alias);
          }
        }
      } catch {
        // Non-fatal if subject_aliases table doesn't exist yet
      }
    }

    return rawSubjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code || null,
      color: s.color || null,
      description: s.description || null,
      representativeConcepts: s.representative_concepts || null,
      aliases: aliasesBySubjectId[s.id] || [],
    }));
  }

  /**
   * Classifies a document against the user's actual subjects using the 8-layer pipeline.
   */
  static async classify(
    input: ClassificationInput,
    options: {
      supabase?: SupabaseClient;
      userSubjects?: UserSubject[];
      allowAI?: boolean;
    } = {}
  ): Promise<SubjectClassificationResult> {
    const t0 = performance.now();
    const { filename, subjectId, folderId, currentSubjectId, extractedText, chunks } = input;
    const { folderName, labSubfolderName } = resolveFolderCategory(filename);

    console.log(`[SubjectClassifier] ═══════════════════════════════════════════`);
    console.log(`[SubjectClassifier] Evaluating document: "${filename}" for user: ${input.userId}`);

    // 1. Resolve User Subjects
    let userSubjects = options.userSubjects;
    if (!userSubjects && options.supabase) {
      userSubjects = await this.loadUserSubjects(options.supabase, input.userId);
    }
    userSubjects = userSubjects || [];

    if (userSubjects.length === 0) {
      console.log(`[SubjectClassifier] No active subjects found for user. Returning uncategorized.`);
      return buildUserConfirmationResult(
        folderName,
        labSubfolderName,
        [],
        'User has no active subjects created.'
      );
    }

    // ── LAYER 1: Explicit User Subject Selection ────────────────────────────
    const explicitChoice = evaluateExplicitSelection(subjectId, userSubjects);
    if (explicitChoice) {
      console.log(`[SubjectClassifier] Layer 1 Match -> Explicit Selection: "${explicitChoice.subjectName}" (Conf: ${explicitChoice.score})`);
      return {
        subjectId: explicitChoice.subjectId,
        subjectName: explicitChoice.subjectName,
        folderName,
        labSubfolderName,
        confidence: explicitChoice.score,
        method: 'explicit_selection',
        reason: explicitChoice.evidence[0],
        evidence: explicitChoice.evidence,
      };
    }

    // ── LAYER 2: Current Folder / Subject Context ───────────────────────────
    const contextSubjectId = currentSubjectId || (folderId ? undefined : undefined);
    const contextChoice = evaluateFolderContext(contextSubjectId, userSubjects);
    if (contextChoice) {
      console.log(`[SubjectClassifier] Layer 2 Match -> Folder Context: "${contextChoice.subjectName}" (Conf: ${contextChoice.score})`);
      return {
        subjectId: contextChoice.subjectId,
        subjectName: contextChoice.subjectName,
        folderName,
        labSubfolderName,
        confidence: contextChoice.score,
        method: 'folder_context',
        reason: contextChoice.evidence[0],
        evidence: contextChoice.evidence,
      };
    }

    // ── LAYER 3: Course Code / Strong Metadata ──────────────────────────────
    const courseCodeChoice = evaluateCourseCode(filename, userSubjects);
    if (courseCodeChoice && courseCodeChoice.score >= CLASSIFICATION_CONFIG.AUTO_ROUTE_THRESHOLD) {
      console.log(`[SubjectClassifier] Layer 3 Match -> Course Code: "${courseCodeChoice.subjectName}" (Conf: ${courseCodeChoice.score})`);
      return {
        subjectId: courseCodeChoice.subjectId,
        subjectName: courseCodeChoice.subjectName,
        folderName,
        labSubfolderName,
        confidence: courseCodeChoice.score,
        method: 'course_code',
        reason: courseCodeChoice.evidence[0],
        evidence: courseCodeChoice.evidence,
      };
    }

    // ── LAYER 4: Normalized Exact Match ─────────────────────────────────────
    const exactChoice = evaluateExactMatch(filename, userSubjects);
    if (exactChoice && exactChoice.score >= CLASSIFICATION_CONFIG.AUTO_ROUTE_THRESHOLD) {
      console.log(`[SubjectClassifier] Layer 4 Match -> Exact Match: "${exactChoice.subjectName}" (Conf: ${exactChoice.score})`);
      return {
        subjectId: exactChoice.subjectId,
        subjectName: exactChoice.subjectName,
        folderName,
        labSubfolderName,
        confidence: exactChoice.score,
        method: 'exact_match',
        reason: exactChoice.evidence[0],
        evidence: exactChoice.evidence,
      };
    }

    // ── LAYER 5: Fuzzy Match ────────────────────────────────────────────────
    const fuzzyChoice = evaluateFuzzyMatch(filename, userSubjects);
    if (fuzzyChoice && fuzzyChoice.score >= CLASSIFICATION_CONFIG.VERIFY_THRESHOLD) {
      console.log(`[SubjectClassifier] Layer 5 Match -> Fuzzy Match: "${fuzzyChoice.subjectName}" (Conf: ${fuzzyChoice.score})`);
      return {
        subjectId: fuzzyChoice.subjectId,
        subjectName: fuzzyChoice.subjectName,
        folderName,
        labSubfolderName,
        confidence: fuzzyChoice.score,
        method: 'fuzzy_match',
        reason: fuzzyChoice.evidence[0],
        evidence: fuzzyChoice.evidence,
      };
    }

    // Collect deterministic candidates for potential confirmation dialog
    const candidatePool: CandidateScore[] = [];
    if (fuzzyChoice) candidatePool.push(fuzzyChoice);
    if (exactChoice) candidatePool.push(exactChoice);
    if (courseCodeChoice) candidatePool.push(courseCodeChoice);

    // ── LAYER 6: Semantic Content Matching ──────────────────────────────────
    if (extractedText || (chunks && chunks.length > 0)) {
      console.log(`[SubjectClassifier] Executing Layer 6: Semantic Content Matching...`);
      const semanticResult = evaluateSemanticMatch(
        extractedText,
        chunks,
        userSubjects
      );

      if (semanticResult.winner) {
        console.log(`[SubjectClassifier] Layer 6 Match -> Semantic Match: "${semanticResult.winner.subjectName}" (Conf: ${semanticResult.winner.score})`);
        return {
          subjectId: semanticResult.winner.subjectId,
          subjectName: semanticResult.winner.subjectName,
          folderName,
          labSubfolderName,
          confidence: semanticResult.winner.score,
          method: 'semantic_match',
          reason: semanticResult.winner.evidence[0],
          evidence: semanticResult.winner.evidence,
        };
      }

      if (semanticResult.candidates.length > 0) {
        candidatePool.push(...semanticResult.candidates);
      }
    }

    // ── LAYER 7: Constrained LLM Classification (Fallback) ───────────────────
    if (options.allowAI && (extractedText || filename)) {
      console.log(`[SubjectClassifier] Executing Layer 7: Constrained LLM Fallback...`);
      const sampleText = extractedText || (chunks ? chunks.map((c) => c.content).join('\n') : '');
      const llmResult = await evaluateLLMFallback(filename, sampleText, userSubjects);

      if (llmResult.winner && llmResult.winner.score >= CLASSIFICATION_CONFIG.AUTO_ROUTE_THRESHOLD) {
        console.log(`[SubjectClassifier] Layer 7 Match -> LLM Match: "${llmResult.winner.subjectName}" (Conf: ${llmResult.winner.score})`);
        return {
          subjectId: llmResult.winner.subjectId,
          subjectName: llmResult.winner.subjectName,
          folderName,
          labSubfolderName,
          confidence: llmResult.winner.score,
          method: 'llm',
          reason: llmResult.reason || llmResult.winner.evidence[0],
          evidence: llmResult.winner.evidence,
        };
      }

      if (llmResult.winner) {
        candidatePool.push(llmResult.winner);
      }
    }

    // ── LAYER 8: User Confirmation / Needs Review ───────────────────────────
    // De-duplicate and sort accumulated candidates
    const uniqueCandidates = Array.from(
      new Map(candidatePool.map((c) => [c.subjectId, c])).values()
    ).sort((a, b) => b.score - a.score);

    console.log(
      `[SubjectClassifier] Classification uncertain (Top score: ${uniqueCandidates[0]?.score ?? 0.0}). Handing off to Layer 8 (User Review). Total elapsed: ${(performance.now() - t0).toFixed(0)}ms`
    );

    return buildUserConfirmationResult(
      folderName,
      labSubfolderName,
      uniqueCandidates,
      'Classification confidence is below threshold. User confirmation required.'
    );
  }
}
