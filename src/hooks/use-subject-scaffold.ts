import { useState, useCallback, useRef } from "react";
import { scaffoldSubjectFoldersAction } from "@/actions/folders";

/**
 * Module-level in-flight tracker.
 * Persists across re-renders — prevents concurrent scaffold calls for the same subject
 * even if React re-renders the component multiple times during the async operation.
 */
const inFlightScaffolds = new Set<string>();

export function useSubjectScaffold() {
  const [scaffolding, setScaffolding] = useState(false);

  const scaffoldSubject = useCallback(async (subjectId: string) => {
    if (!subjectId) return;
    if (typeof window === "undefined") return;

    // ── Guard 1: In-flight lock (module-level — survives re-renders) ──────────
    if (inFlightScaffolds.has(subjectId)) {
      console.log(`[scaffold] Subject ${subjectId}: already in-flight, skipping`);
      return;
    }

    // ── Guard 2: localStorage (persists across page loads) ───────────────────
    const storageKey = `neuron_scaffolded_${subjectId}`;
    if (localStorage.getItem(storageKey) === "done") {
      return;
    }

    // ── Acquire lock immediately — BEFORE any async work ─────────────────────
    inFlightScaffolds.add(subjectId);
    console.log(`[scaffold] Subject ${subjectId}: starting scaffold`);

    setScaffolding(true);
    try {
      // All existence checking happens server-side with real DB state
      const result = await scaffoldSubjectFoldersAction(subjectId);

      if (result.success) {
        // Mark as done in localStorage so future loads skip the check entirely
        localStorage.setItem(storageKey, "done");
        console.log(
          `[scaffold] Subject ${subjectId}: complete.`,
          `Created: [${result.created.join(", ")}]`,
          `Skipped: [${result.skipped.join(", ")}]`
        );
      }
    } catch (error) {
      console.error(`[scaffold] Subject ${subjectId}: failed:`, error);
      // Do NOT set localStorage on error — allow retry on next visit
    } finally {
      inFlightScaffolds.delete(subjectId);
      setScaffolding(false);
    }
  }, []); // No dependencies — function is stable across all renders

  return { scaffolding, scaffoldSubject };
}
