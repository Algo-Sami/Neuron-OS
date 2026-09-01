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
    console.log("Starting account deletion");
    const supabase = await createClient();
    
    // 1. Verify authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Account deletion unauthorized access attempt or session expired:", userError);
      return { success: false, error: userError?.message || "Auth user not found" };
    }

    // 2. Cancel active background tasks
    console.log("Cancelling active background tasks...");
    const { error: cancelErr } = await supabase
      .from('background_tasks')
      .update({ 
        status: 'Cancelled',
        progress: { overallStatus: 'failed', errorMessage: 'Account deleted' }
      })
      .eq('user_id', user.id)
      .in('status', ['Queued', 'processing', 'Pending', 'pending']);
    
    if (cancelErr) {
      console.error("Failed to cancel active background tasks:", cancelErr.message);
      return { success: false, error: `Failed to cancel active tasks: ${cancelErr.message}` };
    }

    // Hardened helper for recursive storage clean-up of a user's directory
    const deleteRecursiveStoragePath = async (bucket: string, prefix: string) => {
      // User isolation security guard: prefix must be scoped to the authenticated user
      if (!prefix || !prefix.startsWith(user.id)) {
        console.warn(`[deleteRecursiveStoragePath] Security boundary: Blocked deletion for path "${prefix}" outside user scope "${user.id}"`);
        return;
      }

      try {
        const { data: items, error: listError } = await supabase.storage.from(bucket).list(prefix);
        if (listError) {
          console.warn(`[deleteRecursiveStoragePath] Non-fatal list warning for "${prefix}" in bucket "${bucket}":`, listError.message);
          return;
        }
        if (!items || items.length === 0) return;

        const filesToDelete: string[] = [];
        for (const item of items) {
          const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
          
          // Resilient detection: If item has explicit file metadata, mark for batch removal.
          // Otherwise, test whether it's a directory by attempting a child listing.
          const hasFileMetadata = item.metadata && (item.metadata.mimetype || typeof item.metadata.size === "number");

          if (hasFileMetadata) {
            filesToDelete.push(fullPath);
          } else {
            try {
              const { data: subItems, error: subListErr } = await supabase.storage.from(bucket).list(fullPath);
              if (!subListErr && subItems && subItems.length > 0) {
                // Non-empty folder -> recurse
                await deleteRecursiveStoragePath(bucket, fullPath);
              } else {
                // Either an empty folder, single leaf object, or metadata-less file -> mark for removal
                filesToDelete.push(fullPath);
              }
            } catch {
              filesToDelete.push(fullPath);
            }
          }
        }

        if (filesToDelete.length > 0) {
          try {
            const { error: removeError } = await supabase.storage.from(bucket).remove(filesToDelete);
            if (removeError) {
              console.warn(`[deleteRecursiveStoragePath] Non-fatal batch remove warning in "${prefix}":`, removeError.message);
            }
          } catch (batchErr) {
            console.warn(`[deleteRecursiveStoragePath] Batch remove exception in "${prefix}":`, batchErr);
          }
        }
      } catch (traversalErr: any) {
        console.warn(`[deleteRecursiveStoragePath] Non-fatal traversal error in bucket "${bucket}" path "${prefix}":`, traversalErr?.message);
      }
    };

    // 3. Delete generated AI resources & user uploaded files from Storage recursively
    console.log("Recursively deleting storage folders...");
    await deleteRecursiveStoragePath("documents", user.id);
    await deleteRecursiveStoragePath("avatars", user.id);

    // 4. Delete database records & authentication account
    console.log("Executing DB delete_user_account RPC...");
    const { data: rpcData, error: deleteError } = await supabase.rpc("delete_user_account");
    if (deleteError) {
      console.error("Database deletion error details:", deleteError);
      return { success: false, error: `Database error: ${deleteError.message} (Code: ${deleteError.code})` };
    }

    if (rpcData && (rpcData as any).success === false) {
      console.error("RPC deletion failed internally:", rpcData);
      return { success: false, error: (rpcData as any).error || "RPC execution failed" };
    }

    // 5. Sign the user out and clear session/cookies
    console.log("Signing user out after successful deletion");
    await supabase.auth.signOut();
    
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: any) {
    console.error("Account deletion exception details:", err);
    return { success: false, error: err?.message || "Unexpected server exception" };
  }
}
