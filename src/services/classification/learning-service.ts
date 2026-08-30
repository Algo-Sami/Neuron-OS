import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeFilenameTokens, isPurelyGeneric } from './layers/layer4-exact-match';
import { SubjectProfileService } from './profile-service';

export interface ClassificationEventPayload {
  documentId?: string;
  userId: string;
  predictedSubjectId?: string | null;
  finalSubjectId?: string | null;
  confidence?: number;
  method: string;
  userCorrected?: boolean;
  reason?: string;
}

/**
 * Learning Service
 * Logs classification events and securely learns new aliases from user confirmations and corrections.
 */
export class ClassificationLearningService {
  /**
   * Logs a classification event to classification_events.
   */
  static async recordEvent(
    supabase: SupabaseClient,
    payload: ClassificationEventPayload
  ): Promise<void> {
    try {
      await supabase.from('classification_events').insert({
        document_id: payload.documentId || null,
        user_id: payload.userId,
        predicted_subject_id: payload.predictedSubjectId || null,
        final_subject_id: payload.finalSubjectId || null,
        confidence: payload.confidence !== undefined ? payload.confidence : null,
        method: payload.method,
        user_corrected: !!payload.userCorrected,
        reason: payload.reason || null,
      });
    } catch (err) {
      console.warn('[ClassificationLearningService] Failed to log classification event:', err);
    }
  }

  /**
   * Evaluates and learns an alias for a subject when a user confirms or corrects routing.
   * Strictly filters out generic filenames like "lecture 5", "chapter 3", "final exam".
   */
  static async learnAliasFromDecision(
    supabase: SupabaseClient,
    subjectId: string,
    rawFilename: string,
    source: 'user' | 'confirmed' | 'learned' = 'confirmed'
  ): Promise<boolean> {
    const candidateAlias = normalizeFilenameTokens(rawFilename);

    // Filter out invalid or purely generic candidate aliases
    if (
      candidateAlias.length < 2 ||
      isPurelyGeneric(candidateAlias) ||
      /^(lecture|chapter|notes|unit|week|test|exam|paper|assignment)\s*\d*$/i.test(candidateAlias)
    ) {
      return false;
    }

    try {
      // Check if alias already exists for this subject
      const { data: existing } = await supabase
        .from('subject_aliases')
        .select('id, usage_count')
        .eq('subject_id', subjectId)
        .ilike('alias', candidateAlias)
        .maybeSingle();

      if (existing) {
        // Increment usage count
        await supabase
          .from('subject_aliases')
          .update({
            usage_count: (existing.usage_count || 1) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Insert new learned alias
        await supabase.from('subject_aliases').insert({
          subject_id: subjectId,
          alias: candidateAlias,
          source,
          confidence: 0.90,
          usage_count: 1,
          validated: source === 'user',
        });
      }

      SubjectProfileService.invalidate(subjectId);
      return true;
    } catch (err) {
      console.warn(`[ClassificationLearningService] Error learning alias "${candidateAlias}":`, err);
      return false;
    }
  }
}
