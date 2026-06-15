"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Validates whether a username is already taken.
 * Returns true if available, false if taken.
 */
export async function validateUsername(username: string): Promise<{ available: boolean; error?: string }> {
  if (!username || username.trim().length < 3) {
    return { available: false, error: "Username must be at least 3 characters." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      console.error("Error checking username:", error.message);
      return { available: false, error: "Database error." };
    }

    return { available: !data };
  } catch (err: unknown) {
    console.error("Username validation exception:", err);
    return { available: false, error: "Server error." };
  }
}

/**
 * Sign In with Email and Password
 */
export async function signInWithEmail(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: unknown) {
    console.error("Login server error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Custom Multi-step Registration and Onboarding Action
 */
export async function signUpAndOnboard(fields: {
  fullName: string;
  username: string;
  email: string;
  password: string;
  bio: string;
  university: string;
  degreeProgram: string;
  semester: string;
  profileImage: string | null;
  interests: string[];
  studyGoals: string[];
  country: string;
  timezone: string;
}) {
  const supabase = await createClient();

  // 1. Double check username availability
  const check = await validateUsername(fields.username);
  if (!check.available) {
    return { success: false, error: "Username is already taken." };
  }

  // 2. Perform SignUp
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email: fields.email,
    password: fields.password,
    options: {
      data: {
        full_name: fields.fullName,
        username: fields.username.trim().toLowerCase(),
        university: fields.university,
        degree_program: fields.degreeProgram,
        semester: fields.semester,
        country: fields.country,
        timezone: fields.timezone,
        bio: fields.bio,
      },
    },
  });

  if (signUpError) {
    return { success: false, error: signUpError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { success: false, error: "Could not create user account." };
  }

  // 3. Immediately update public.profiles with the full onboarding fields.
  // This handles case where the DB trigger is fully applied or if we need to supplement details
  // like array interests & goals which aren't easily parsed inside simple triggers.
  try {
    const firstName = fields.fullName.split(" ")[0] || "Scholar";
    const lastName = fields.fullName.split(" ").slice(1).join(" ") || "Student";
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        full_name: fields.fullName,
        username: fields.username.trim().toLowerCase(),
        email: fields.email,
        bio: fields.bio,
        university: fields.university,
        major: fields.degreeProgram,
        degree_program: fields.degreeProgram,
        semester: fields.semester,
        profile_image: fields.profileImage,
        interests: fields.interests,
        study_goals: fields.studyGoals,
        country: fields.country,
        timezone: fields.timezone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileError) {
      console.warn("Soft warning: Trigger did create profile, but supplementary update failed:", profileError.message);
      // We don't fail the signup here since auth was successful and trigger provides base schema fallback
    }
  } catch (profileUpdateErr) {
    console.error("Supplementary profile update error:", profileUpdateErr);
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Log out of Neuron OS
 */
export async function signOutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Completely delete the authenticated user's account and all associated data.
 */
export async function deleteUserAccountAction() {
  try {
    const supabase = await createClient();
    
    // 1. Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: "Unauthorized or session expired." };
    }

    // 2. Execute RPC function to delete account in auth.users
    const { error: deleteError } = await supabase.rpc("delete_user_account");
    if (deleteError) {
      console.error("Database deletion error:", deleteError.message);
      
      // Handle the case where the SQL function hasn't been set up yet
      if (deleteError.message.includes("does not exist") || deleteError.code === "P0001") {
        return { 
          success: false, 
          error: "Database function 'delete_user_account' is missing. Please run the SQL commands in delete_user_account.sql in your Supabase SQL editor first." 
        };
      }
      return { success: false, error: deleteError.message || "Failed to delete account from database." };
    }

    // 3. Log out and clear session/cookies
    await supabase.auth.signOut();
    
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: unknown) {
    console.error("Account deletion exception:", err);
    return { success: false, error: "An unexpected error occurred during account deletion." };
  }
}
