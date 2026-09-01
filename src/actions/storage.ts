"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Strict allowlist of accepted avatar MIME types and their canonical file extensions.
 */
export const AVATAR_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

/**
 * Uploads a base64 encoded profile image to the Supabase storage 'avatars' bucket.
 * The image will be stored under the directory path: avatars/{userId}/{fileName}
 * Returns the public URL of the uploaded image.
 */
export async function uploadAvatar(
  base64Image: string,
  fileName?: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    const supabase = await createClient();
    
    // 1. Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized. Please sign in first." };
    }

    // 2. Parse base64 string
    const matches = base64Image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return { success: false, error: "Invalid image format. Expected data URI." };
    }

    const rawContentType = matches[1].toLowerCase().trim();
    const base64Data = matches[2];

    // 3. Strict MIME allowlist validation
    const fileExtension = AVATAR_EXTENSION_MAP[rawContentType];
    if (!fileExtension) {
      return {
        success: false,
        error: "Unsupported image format. Allowed formats: JPEG, PNG, WebP, SVG, GIF.",
      };
    }

    const buffer = Buffer.from(base64Data, "base64");

    // 4. Construct sanitized path: user_id/avatar_timestamp.extension
    const safeBaseName = fileName
      ? fileName.replace(/[/\\?%*:|"<>]/g, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60)
      : `avatar_${Date.now()}`;
    const cleanFileName = `${safeBaseName}.${fileExtension}`;
    const filePath = `${user.id}/${cleanFileName}`;

    // 5. Upload to 'avatars' bucket
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, buffer, {
        contentType: rawContentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase Storage upload error:", uploadError.message);
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // 6. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    // 7. Save public url to user profile row
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        profile_image: publicUrl,
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      console.warn("Storage upload completed, but profile URL save failed:", profileError.message);
    }

    return { success: true, publicUrl };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "An unexpected error occurred during upload.";
    console.error("Storage upload server exception:", err);
    return { success: false, error: errorMsg };
  }
}
