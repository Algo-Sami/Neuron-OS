"use server";

import { createClient } from "@/lib/supabase/server";

export interface CohortLeaderboardEntry {
  user_id: string;
  rank: number;
  score: number;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  university: string;
  major: string;
  is_current_user: boolean;
}

export interface CohortLeaderboardResponse {
  success: boolean;
  cohortId: string;
  weekStart: string;
  totalParticipants: number;
  currentUserRank: number | null;
  currentUserScore: number;
  currentUserVisible: boolean;
  entries: CohortLeaderboardEntry[];
  error?: string;
}

/**
 * Fetches the ranked weekly leaderboard for a specific cohort and week boundary.
 *
 * Requirements:
 * - Orders by score DESC, with updated_at ASC as the deterministic tiebreaker
 *   (earliest student to achieve the score wins the higher rank).
 * - Excludes students whose leaderboard_visibility is false from the returned list,
 *   while preserving their rank position so subsequent students' relative ranks
 *   are not distorted.
 * - Respects Row-Level Security (RLS) automatically via the user-scoped server client.
 */
export async function getCohortLeaderboard(
  cohortId: string,
  weekStart: string
): Promise<CohortLeaderboardResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    if (!cohortId || !weekStart) {
      return {
        success: false,
        cohortId,
        weekStart,
        totalParticipants: 0,
        currentUserRank: null,
        currentUserScore: 0,
        currentUserVisible: true,
        entries: [],
        error: "Cohort ID and Week Start are required.",
      };
    }

    // Query weekly_scores with deterministic tiebreaker (score DESC, updated_at ASC)
    const { data: rows, error: queryError } = await supabase
      .from("weekly_scores")
      .select("id, user_id, cohort_id, week_start, score, updated_at")
      .eq("cohort_id", cohortId)
      .eq("week_start", weekStart)
      .order("score", { ascending: false })
      .order("updated_at", { ascending: true });

    if (queryError) {
      console.error("[getCohortLeaderboard] Query failed:", queryError.message);
      return {
        success: false,
        cohortId,
        weekStart,
        totalParticipants: 0,
        currentUserRank: null,
        currentUserScore: 0,
        currentUserVisible: true,
        entries: [],
        error: queryError.message,
      };
    }

    // Fetch corresponding profiles for participants
    const profilesMap = new Map<string, any>();
    if (rows && rows.length > 0) {
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      
      const { data: profiles, error: pError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url, university, major, leaderboard_visibility")
        .in("id", userIds);

      if (pError) {
        console.error("[getCohortLeaderboard] Profile fetch error:", pError.message);
        return {
          success: false,
          cohortId,
          weekStart,
          totalParticipants: 0,
          currentUserRank: null,
          currentUserScore: 0,
          currentUserVisible: true,
          entries: [],
          error: "Failed to resolve participant privacy settings.",
        };
      }

      for (const p of profiles || []) {
        profilesMap.set(p.id, p);
      }
    }

    let currentRank = 0;
    let currentUserRank: number | null = null;
    let currentUserScore = 0;
    let currentUserVisible = true;
    const entries: CohortLeaderboardEntry[] = [];

    for (const row of rows || []) {
      currentRank++;
      const profile = profilesMap.get(row.user_id);
      const isCurrentUser = row.user_id === user.id;
      const isVisible = profile?.leaderboard_visibility ?? true;

      if (isCurrentUser) {
        currentUserRank = currentRank;
        currentUserScore = row.score;
        currentUserVisible = isVisible;
      }

      // If student opted out of leaderboard visibility, omit their identity
      // but retain their rank position so subsequent students keep their true relative rank.
      if (isVisible) {
        entries.push({
          user_id: row.user_id,
          rank: currentRank,
          score: row.score,
          first_name: profile?.first_name || "Scholar",
          last_name: profile?.last_name || "Student",
          avatar_url: profile?.avatar_url || null,
          university: profile?.university || "Neuron Academy",
          major: profile?.major || "Computer Science",
          is_current_user: isCurrentUser,
        });
      }
    }

    return {
      success: true,
      cohortId,
      weekStart,
      totalParticipants: (rows || []).length,
      currentUserRank,
      currentUserScore,
      currentUserVisible,
      entries,
    };
  } catch (err: any) {
    console.error("[getCohortLeaderboard] Unexpected error:", err);
    return {
      success: false,
      cohortId,
      weekStart,
      totalParticipants: 0,
      currentUserRank: null,
      currentUserScore: 0,
      currentUserVisible: true,
      entries: [],
      error: err?.message || "Failed to load cohort leaderboard.",
    };
  }
}
