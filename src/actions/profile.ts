"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getProfileCompletion, ProfileCompletionResult } from "@/lib/profile-completion";

export async function updateProfile({
  firstName,
  lastName,
  university,
  major,
  universityId,
  programId,
  semester,
}: {
  firstName: string;
  lastName: string;
  university: string;
  major: string;
  universityId?: string | null;
  programId?: string | null;
  semester?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const updatePayload: Record<string, any> = {
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
    university: university,
    major: major,
    degree_program: major,
    updated_at: new Date().toISOString(),
  };

  if (universityId !== undefined) {
    updatePayload.university_id = universityId;
  }
  if (programId !== undefined) {
    updatePayload.program_id = programId;
  }
  if (semester !== undefined) {
    updatePayload.semester = semester;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", user.id);

  if (error) {
    console.error("Failed to update profile:", error.message);
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  revalidatePath("/profile");
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function updateLeaderboardVisibility(visible: boolean) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      leaderboard_visibility: visible,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to update leaderboard visibility:", error.message);
    throw new Error(`Failed to update leaderboard visibility: ${error.message}`);
  }

  revalidatePath("/profile");
  revalidatePath("/leaderboard");

  return { success: true };
}

/**
 * Fetches the current user's profile row and returns a computed
 * completion score. Used by the ProfileCompletionModal and profile page.
 */
export async function getProfileCompletionData(): Promise<ProfileCompletionResult | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "full_name, username, university, degree_program, profile_image, avatar_url, interests, study_goals"
      )
      .eq("id", user.id)
      .maybeSingle();

    // email_confirmed_at being non-null means the email is verified
    const emailVerified = !!(user.email_confirmed_at);

    return getProfileCompletion(
      {
        email: user.email,
        emailVerified,
        full_name: profile?.full_name,
        username: profile?.username,
        university: profile?.university,
        degree_program: profile?.degree_program,
        profile_image: profile?.profile_image,
        avatar_url: profile?.avatar_url,
        interests: profile?.interests,
        study_goals: profile?.study_goals,
      },
      emailVerified
    );
  } catch {
    return null;
  }
}
