import { SupabaseClient } from '@supabase/supabase-js';
import { SubjectProfileData, UserSubject } from './types';
import { DEFAULT_SUBJECT_CONCEPTS } from './config';
import { getEmbedding } from '@/services/ai/embeddings';

/**
 * Subject Profile Service
 * Manages semantic profiles, representative concepts, and vector embeddings for user subjects.
 */
export class SubjectProfileService {
  private static cache: Map<string, { profile: SubjectProfileData; cachedAt: number }> = new Map();
  private static CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Retrieves or builds the subject semantic profile.
   */
  static async getProfile(
    supabase: SupabaseClient,
    subject: UserSubject
  ): Promise<SubjectProfileData | null> {
    const cacheKey = subject.id;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.profile;
    }

    try {
      // 1. Check database for existing profile
      const { data: dbProfile } = await supabase
        .from('subject_profiles')
        .select('subject_id, profile_text, representative_concepts, embedding')
        .eq('subject_id', subject.id)
        .maybeSingle();

      if (dbProfile && dbProfile.representative_concepts) {
        const profile: SubjectProfileData = {
          subjectId: dbProfile.subject_id,
          profileText: dbProfile.profile_text || subject.name,
          representativeConcepts: dbProfile.representative_concepts || [],
          embedding: dbProfile.embedding || undefined,
        };
        this.cache.set(cacheKey, { profile, cachedAt: Date.now() });
        return profile;
      }

      // 2. Build default representative concepts
      const concepts: string[] = [...(subject.representativeConcepts || [])];
      for (const [canonical, defaultConcepts] of Object.entries(DEFAULT_SUBJECT_CONCEPTS)) {
        if (
          subject.name.toLowerCase().includes(canonical.toLowerCase()) ||
          canonical.toLowerCase().includes(subject.name.toLowerCase())
        ) {
          concepts.push(...defaultConcepts);
        }
      }

      const uniqueConcepts = Array.from(new Set(concepts));
      const profileText = `${subject.name}. ${subject.code || ''}. ${subject.description || ''}. Key topics: ${uniqueConcepts.join(', ')}`;

      // Generate embedding if concepts exist
      let embedding: number[] | undefined;
      try {
        if (uniqueConcepts.length > 0) {
          embedding = await getEmbedding(profileText);
        }
      } catch {
        // Non-fatal if embedding generation fails
      }

      // 3. Upsert profile in DB
      await supabase
        .from('subject_profiles')
        .upsert(
          {
            subject_id: subject.id,
            profile_text: profileText,
            representative_concepts: uniqueConcepts,
            embedding: embedding || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'subject_id' }
        );

      const profile: SubjectProfileData = {
        subjectId: subject.id,
        profileText,
        representativeConcepts: uniqueConcepts,
        embedding: embedding || undefined,
      };

      this.cache.set(cacheKey, { profile, cachedAt: Date.now() });
      return profile;
    } catch (err) {
      console.warn(`[SubjectProfileService] Error fetching profile for ${subject.name}:`, err);
      return null;
    }
  }

  /**
   * Invalidate profile cache on subject update.
   */
  static invalidate(subjectId: string) {
    this.cache.delete(subjectId);
  }
}
