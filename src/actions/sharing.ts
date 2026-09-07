"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface CohortSharedFile {
  id: string
  title: string
  file_type: string
  download_url: string
  shared_at: string
  user_id: string
  size: number | null
  author_name: string
  is_owner: boolean
}

export type ActionResult<T = unknown> = {
  success: boolean
  data?: T
  error?: string
}

/**
 * Extracts the storage path inside the 'documents' bucket from a stored file_url.
 * Handles both full Supabase URLs (.../documents/<path>) and relative paths.
 */
function extractStoragePath(fileUrl: string): string {
  if (!fileUrl) return ""
  const marker = "/documents/"
  const idx = fileUrl.indexOf(marker)
  if (idx !== -1) {
    return decodeURIComponent(fileUrl.substring(idx + marker.length))
  }
  return fileUrl
}

/**
 * Opt-in action to share a document with the student's cohort.
 * Rejects with 'join_cohort_first' if caller is not assigned to a cohort.
 * Enforces ownership check: user can only share their own documents.
 */
export async function shareDocument(documentId: string): Promise<ActionResult<{ id: string; title: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: "unauthorized" }
    }

    // 1. Fetch user's cohort_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("cohort_id")
      .eq("id", user.id)
      .single()

    if (profileError || !profile?.cohort_id) {
      return { success: false, error: "join_cohort_first" }
    }

    // 2. Update document with ownership guard
    const nowIso = new Date().toISOString()
    const { data: updatedDocs, error: updateError } = await supabase
      .from("documents")
      .update({
        is_shared: true,
        shared_cohort_id: profile.cohort_id,
        shared_at: nowIso,
      })
      .eq("id", documentId)
      .eq("user_id", user.id)
      .select("id, title, is_shared, shared_cohort_id, shared_at")

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    if (!updatedDocs || updatedDocs.length === 0) {
      return { success: false, error: "not_found_or_not_owner" }
    }

    revalidatePath("/uploads")
    revalidatePath("/leaderboard")

    return {
      success: true,
      data: {
        id: updatedDocs[0].id,
        title: updatedDocs[0].title,
      },
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "internal_error",
    }
  }
}

/**
 * Self-serve action to unshare a document.
 * Only the owner can unshare their document.
 */
export async function unshareDocument(documentId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: "unauthorized" }
    }

    const { data: updatedDocs, error: updateError } = await supabase
      .from("documents")
      .update({
        is_shared: false,
        shared_cohort_id: null,
        shared_at: null,
      })
      .eq("id", documentId)
      .eq("user_id", user.id)
      .select("id")

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    if (!updatedDocs || updatedDocs.length === 0) {
      return { success: false, error: "not_found_or_not_owner" }
    }

    revalidatePath("/uploads")
    revalidatePath("/leaderboard")

    return {
      success: true,
      data: { id: updatedDocs[0].id },
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "internal_error",
    }
  }
}

/**
 * Fetches all shared files for the given cohort.
 * Gated by Supabase RLS on `documents`.
 * For each shared document, generates a fresh, short-lived signed URL (300 seconds / 5 mins)
 * so that raw storage URLs are never permanently exposed and unsharing revokes access.
 */
export async function getCohortSharedFiles(cohortId?: string | null): Promise<ActionResult<CohortSharedFile[]>> {
  try {
    if (!cohortId) {
      return { success: true, data: [] }
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: "unauthorized", data: [] }
    }

    // Query shared documents for this cohort; RLS also ensures peer visibility
    const { data: docs, error: queryError } = await supabase
      .from("documents")
      .select(`
        id,
        title,
        file_type,
        file_url,
        shared_at,
        user_id,
        size,
        profiles:user_id (
          first_name,
          last_name
        )
      `)
      .eq("is_shared", true)
      .eq("shared_cohort_id", cohortId)
      .is("deleted_at", null)
      .order("shared_at", { ascending: false })

    if (queryError) {
      return { success: false, error: queryError.message, data: [] }
    }

    if (!docs || docs.length === 0) {
      return { success: true, data: [] }
    }

    // Generate short-lived signed URLs for each shared document
    const filePromises = docs.map(async (doc) => {
      const storagePath = extractStoragePath(doc.file_url)
      let downloadUrl = doc.file_url // fallback

      if (storagePath) {
        const { data: signedData } = await supabase.storage
          .from("documents")
          .createSignedUrl(storagePath, 300) // 5-minute expiry

        if (signedData?.signedUrl) {
          downloadUrl = signedData.signedUrl
        }
      }

      // Supabase returns related profile as an object or array depending on relation
      const prof = Array.isArray(doc.profiles) ? doc.profiles[0] : doc.profiles
      const firstName = (prof as { first_name?: string | null } | null)?.first_name || ""
      const lastName = (prof as { last_name?: string | null } | null)?.last_name || ""
      const authorName = `${firstName} ${lastName}`.trim() || "Classmate"

      const fileItem: CohortSharedFile = {
        id: doc.id,
        title: doc.title,
        file_type: doc.file_type || "pdf",
        download_url: downloadUrl,
        shared_at: doc.shared_at || new Date().toISOString(),
        user_id: doc.user_id,
        size: doc.size ?? null,
        author_name: authorName,
        is_owner: doc.user_id === user.id,
      }
      return fileItem
    })

    const sharedFiles = await Promise.all(filePromises)
    return { success: true, data: sharedFiles }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "internal_error",
      data: [],
    }
  }
}

/**
 * Reports a shared file for inappropriate content, copyright infringement, etc.
 * Inserts a record into public.shared_file_reports.
 * Validates reason length between 3 and 500 characters.
 */
export async function reportSharedFile(documentId: string, reason: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: "unauthorized" }
    }

    const trimmedReason = (reason || "").trim()
    if (trimmedReason.length < 3 || trimmedReason.length > 500) {
      return {
        success: false,
        error: "Reason must be between 3 and 500 characters.",
      }
    }

    const { error: insertError } = await supabase
      .from("shared_file_reports")
      .insert({
        document_id: documentId,
        reporter_id: user.id,
        reason: trimmedReason,
      })

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "internal_error",
    }
  }
}
