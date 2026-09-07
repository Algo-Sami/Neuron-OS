"use server";

import { createClient } from "@/lib/supabase/server";

export interface UniversityItem {
  id: string;
  name: string;
}

export interface DegreeProgramItem {
  id: string;
  name: string;
  university_id: string;
}

/**
 * Fetch all verified universities ordered alphabetically.
 */
export async function getUniversities(): Promise<UniversityItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("universities")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching universities:", error.message);
      return [];
    }

    return (data as UniversityItem[]) || [];
  } catch (err) {
    console.error("Failed to get universities:", err);
    return [];
  }
}

/**
 * Fetch degree programs belonging to a specific university.
 */
export async function getDegreePrograms(universityId: string): Promise<DegreeProgramItem[]> {
  if (!universityId) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("degree_programs")
      .select("id, name, university_id")
      .eq("university_id", universityId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching degree programs:", error.message);
      return [];
    }

    return (data as DegreeProgramItem[]) || [];
  } catch (err) {
    console.error("Failed to get degree programs:", err);
    return [];
  }
}

/**
 * Submit a request to add a missing university to the system.
 */
export async function requestMissingUniversity(
  name: string,
  email: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  const trimmedName = name?.trim();
  const trimmedEmail = email?.trim();
  const trimmedNote = note?.trim() || null;

  if (!trimmedName || trimmedName.length < 2) {
    return { success: false, error: "Please enter a valid university name (at least 2 characters)." };
  }

  if (trimmedName.length > 255) {
    return { success: false, error: "University name cannot exceed 255 characters." };
  }

  if (!trimmedEmail || !trimmedEmail.includes("@") || trimmedEmail.length > 255) {
    return { success: false, error: "Please enter a valid email address." };
  }

  if (trimmedNote && trimmedNote.length > 1000) {
    return { success: false, error: "Note cannot exceed 1,000 characters." };
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "You must be signed in to request an institution." };
    }

    const { error: insertError } = await supabase
      .from("university_requests")
      .insert({
        name: trimmedName,
        email: trimmedEmail,
        note: trimmedNote,
      });

    if (insertError) {
      console.error("Failed to insert university request:", insertError.message);
      return { success: false, error: "Database error while saving request. Please try again." };
    }

    return { success: true };
  } catch (err) {
    console.error("Exception in requestMissingUniversity:", err);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}
