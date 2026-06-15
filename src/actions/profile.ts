"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile({
  firstName,
  lastName,
  university,
  major
}: {
  firstName: string;
  lastName: string;
  university: string;
  major: string;
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`.trim(),
      university: university,
      major: major,
      degree_program: major,
      updated_at: new Date().toISOString()
    })
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
