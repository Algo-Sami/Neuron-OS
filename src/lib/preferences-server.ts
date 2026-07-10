import { cookies } from "next/headers";
import { UserPreferences, DEFAULT_PREFERENCES } from "./preferences";

/**
 * Get user preferences on the server-side during SSR.
 */
export async function getServerPreferences(userId: string | undefined): Promise<UserPreferences> {
  if (!userId) return DEFAULT_PREFERENCES;
  try {
    const cookieStore = await cookies();
    const cookieName = `neuron_pref_${userId}`;
    const cookieVal = cookieStore.get(cookieName)?.value;
    if (cookieVal) {
      return {
        ...DEFAULT_PREFERENCES,
        ...JSON.parse(decodeURIComponent(cookieVal)),
      };
    }
  } catch (e) {
    console.error("Failed to read server preferences", e);
  }
  return DEFAULT_PREFERENCES;
}
