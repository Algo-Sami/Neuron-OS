import { ViewMode } from "@/types/explorer";

export interface UserPreferences {
  viewMode: ViewMode;
  sortBy: "name" | "dateModified" | "dateCreated" | "size" | "type";
  sortOrder: "asc" | "desc";
  showQuickAccess: boolean;
  showHiddenItems?: boolean;
  showFileExtensions?: boolean;
  compactView?: boolean;
  // AI Automation Preferences
  aiAutoLectures: boolean;               // Auto-generate for lectures/notes/slides
  aiAutoAssessments: boolean;            // Auto-generate for assignments/quizzes (skips dialog)
  aiAssessmentRememberedChoice: 'generate' | 'skip' | null; // Remembered dialog choice
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  viewMode: "details",
  sortBy: "name",
  sortOrder: "asc",
  showQuickAccess: true,
  showHiddenItems: false,
  showFileExtensions: true,
  compactView: false,
  // AI defaults: auto for lectures, manual approval for assessments
  aiAutoLectures: true,
  aiAutoAssessments: false,
  aiAssessmentRememberedChoice: null,
};

/**
 * Get user preferences on the client-side.
 */
export function getClientPreferences(userId: string | undefined): UserPreferences {
  if (!userId) return DEFAULT_PREFERENCES;
  try {
    const cookieName = `neuron_pref_${userId}`;
    
    // First try localStorage
    const localVal = localStorage.getItem(cookieName);
    if (localVal) {
      return {
        ...DEFAULT_PREFERENCES,
        ...JSON.parse(localVal),
      };
    }
    
    // Fallback to cookie
    if (typeof document !== "undefined") {
      const cookiesList = document.cookie.split("; ");
      const cookie = cookiesList.find((row) => row.startsWith(`${cookieName}=`));
      if (cookie) {
        const val = decodeURIComponent(cookie.split("=")[1]);
        return {
          ...DEFAULT_PREFERENCES,
          ...JSON.parse(val),
        };
      }
    }
  } catch (e) {
    console.error("Failed to read client preferences", e);
  }
  return DEFAULT_PREFERENCES;
}

/**
 * Save user preferences on the client-side.
 */
export function setClientPreferences(userId: string | undefined, prefs: Partial<UserPreferences>) {
  if (!userId) return;
  try {
    const cookieName = `neuron_pref_${userId}`;
    const existing = getClientPreferences(userId);
    const updated = { ...existing, ...prefs };
    const serialized = encodeURIComponent(JSON.stringify(updated));
    
    // Set cookie (lasts 1 year)
    if (typeof document !== "undefined") {
      document.cookie = `${cookieName}=${serialized}; path=/; max-age=31536000; SameSite=Lax; Secure`;
    }
    
    // Set localStorage
    localStorage.setItem(cookieName, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save client preferences", e);
  }
}
