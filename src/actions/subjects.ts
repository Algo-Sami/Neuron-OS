"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createSubject(name: string, code: string, color: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("subjects")
    .insert({
      user_id: user.id,
      name,
      code,
      color,
    });

  if (error) {
    throw new Error(error.message || "Failed to create subject");
  }

  revalidatePath("/subjects");
  revalidatePath("/dashboard");
}

export async function renameSubject(subjectId: string, name: string, code: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("subjects")
    .update({ name: name.trim(), code: code.trim() || null })
    .eq("id", subjectId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Failed to rename subject");
  }

  revalidatePath("/subjects");
  revalidatePath("/dashboard");
}

export async function moveToRecycleBin(subjectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("subjects")
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq("id", subjectId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Failed to move subject to recycle bin");
  }

  revalidatePath("/subjects");
  revalidatePath("/dashboard");
  revalidatePath("/recycle-bin");
}

export async function restoreFromRecycleBin(subjectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("subjects")
    .update({
      deleted_at: null,
    })
    .eq("id", subjectId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Failed to restore subject");
  }

  revalidatePath("/subjects");
  revalidatePath("/dashboard");
  revalidatePath("/recycle-bin");
}

export async function deleteSubjectPermanently(subjectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", subjectId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message || "Failed to delete subject permanently");
  }

  revalidatePath("/subjects");
  revalidatePath("/dashboard");
  revalidatePath("/recycle-bin");
}

export async function cleanupExpiredRecycledItems(userId: string) {
  const supabase = await createClient();
  
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const tenDaysAgoStr = tenDaysAgo.toISOString();

  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .lt("deleted_at", tenDaysAgoStr);

  if (error) {
    console.error("Failed to run background recycle bin cleanup fallback:", error.message);
  }
}

