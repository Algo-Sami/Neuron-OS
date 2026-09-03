/**
 * profile-completion.ts
 *
 * Pure utility — no DB calls, no side effects.
 * Calculates a weighted profile completion score from a profiles row.
 *
 * Scoring breakdown (totals 100%):
 *   Email verified      15%
 *   Full name set       15%
 *   Username set        10%
 *   University + Degree 20%  (10% each)
 *   Avatar uploaded     15%
 *   Interests ≥ 1       15%
 *   Study goals ≥ 1     10%
 */

export interface ProfileCompletionInput {
  email?: string | null;
  emailVerified?: boolean; // from auth.user.email_confirmed_at
  full_name?: string | null;
  username?: string | null;
  university?: string | null;
  degree_program?: string | null;
  profile_image?: string | null;
  avatar_url?: string | null;
  interests?: string[] | null;
  study_goals?: string[] | null;
}

export interface ProfileCompletionResult {
  /** Rounded integer 0–100 */
  percentage: number;
  /** Human-readable labels of incomplete fields */
  missing: string[];
  /** Single most impactful next action to show in the modal CTA */
  nextStep: string;
  /** URL to deep-link to (always /profile) */
  nextStepHref: string;
}

interface ScoredItem {
  label: string;
  weight: number;
  complete: boolean;
}

export function getProfileCompletion(
  profile: ProfileCompletionInput,
  emailVerified = false
): ProfileCompletionResult {
  const items: ScoredItem[] = [
    {
      label: "Verify your email",
      weight: 15,
      complete: emailVerified,
    },
    {
      label: "Add your full name",
      weight: 15,
      complete: !!(profile.full_name && profile.full_name.trim().length > 1),
    },
    {
      label: "Choose a username",
      weight: 10,
      complete: !!(profile.username && profile.username.trim().length >= 3),
    },
    {
      label: "Add your university",
      weight: 10,
      complete: !!(
        profile.university &&
        profile.university.trim().length > 0 &&
        profile.university !== "Neuron Academy" // default placeholder
      ),
    },
    {
      label: "Add your degree / major",
      weight: 10,
      complete: !!(
        profile.degree_program &&
        profile.degree_program.trim().length > 0 &&
        profile.degree_program !== "Computer Science" // default placeholder
      ),
    },
    {
      label: "Upload a profile photo",
      weight: 15,
      complete: !!(profile.profile_image || profile.avatar_url),
    },
    {
      label: "Select your academic interests",
      weight: 15,
      complete: Array.isArray(profile.interests) && profile.interests.length >= 1,
    },
    {
      label: "Set your study goals",
      weight: 10,
      complete: Array.isArray(profile.study_goals) && profile.study_goals.length >= 1,
    },
  ];

  const earned = items
    .filter((i) => i.complete)
    .reduce((sum, i) => sum + i.weight, 0);

  const missing = items.filter((i) => !i.complete).map((i) => i.label);

  // The most impactful incomplete item (highest weight among incomplete)
  const nextItem = items
    .filter((i) => !i.complete)
    .sort((a, b) => b.weight - a.weight)[0];

  return {
    percentage: Math.round(earned),
    missing,
    nextStep: nextItem?.label ?? "Your profile is complete!",
    nextStepHref: "/profile",
  };
}
