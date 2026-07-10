/**
 * AI Version Manifest — Neuron OS
 *
 * ═══════════════════════════════════════════════════════════════════
 * THIS IS THE ONLY FILE YOU EVER NEED TO CHANGE to trigger automatic
 * regeneration of all AI resources across the entire platform.
 * ═══════════════════════════════════════════════════════════════════
 *
 * ARCHITECTURE OVERVIEW
 * ─────────────────────
 * Every AI-generated resource in Neuron OS (summaries, flashcards, MCQs,
 * definitions, key points, examples, study guides, and all future resource
 * types) goes through the same centralized versioning workflow:
 *
 *   Resource Requested
 *     ↓
 *   AssetGenerationManager.assess() called with (userId, documentId, assetType)
 *     ↓
 *   Stored generation_version read from knowledge_assets table
 *     ↓
 *   Compared against getEffectiveVersion(assetType) — pure integer comparison
 *     ↓
 *   Match    → return_cached instantly (no AI, no DB read, milliseconds)
 *   Mismatch → mark 'outdated' → trigger regeneration via existing pipeline
 *     ↓
 *   New resource generated → validated → stored with current version
 *     ↓
 *   Old files cleaned from storage → student receives latest version
 *
 * This workflow is IDENTICAL for every resource type. There is no
 * Summary-specific, Flashcard-specific, or Quiz-specific branching.
 * The version manager operates purely on generic resource metadata.
 *
 * HOW TO UPGRADE THE AI PIPELINE
 * ───────────────────────────────
 * Step 1: Improve prompts / rendering / retrieval / models
 * Step 2: Increment AI_GENERATION_VERSION below (the ONLY change)
 * Step 3: Deploy
 *
 * Result: Every stored resource (regardless of type) is automatically
 * detected as outdated and regenerated on next request. Students receive
 * the improved version without any manual action.
 *
 * WHEN TO INCREMENT AI_GENERATION_VERSION
 * ─────────────────────────────────────────
 * ✓ Significant prompt improvements (any resource type)
 * ✓ PDF / Markdown rendering upgrades
 * ✓ Context builder or retrieval pipeline improvements
 * ✓ AI model upgrades that materially change output quality
 * ✓ Any change that should cause existing resources to be refreshed
 *
 * WHEN NOT TO INCREMENT
 * ──────────────────────
 * ✗ Bug fixes that don't affect output quality
 * ✗ UI/UX or frontend-only changes
 * ✗ Database schema changes unrelated to AI quality
 * ✗ Performance optimisations with identical output
 * ✗ Infrastructure or deployment changes
 *
 * VERSION HISTORY
 * ───────────────
 * v1 — Initial generation pipeline
 * v2 — Professor-quality summary prompts + full Markdown PDF renderer
 */

// ── Global Generation Version ─────────────────────────────────────────────────
//
// Increment this single number to trigger automatic regeneration of ALL
// AI-generated resources platform-wide (summaries, flashcards, MCQs,
// definitions, key points, examples, study guides, and future types).
//
// The application ALWAYS explicitly writes this value at generation time.
// The database column DEFAULT is a safety fallback only — the application
// is always the authoritative source of truth for generation version.
//
export const AI_GENERATION_VERSION = 2;

// ── Per-Asset-Type Version Overrides (future expansion) ───────────────────────
//
// When individual resource types need their own independent version cadence
// (e.g., only summaries need regeneration after a prompt change), add entries
// here without changing AI_GENERATION_VERSION or any other service.
//
// Leave this map EMPTY to apply AI_GENERATION_VERSION to all resource types.
//
// Future per-resource version fields can be added here as the platform grows:
//   'summary'            → summary-specific generation version
//   'flashcards'         → flashcard-specific generation version
//   'quiz'               → quiz-specific generation version
//   'definitions'        → definitions-specific generation version
//   'key_points'         → key-points-specific generation version
//   'examples'           → examples-specific generation version
//   'study_guide'        → study-guide-specific generation version
//   'revision_notes'     → revision-notes-specific generation version
//   (future types)       → any future AI resource type
//
// Example — only summaries need regeneration at v3 while all others stay at v2:
//   export const ASSET_VERSION_OVERRIDES = { summary: 3 };
//
export const ASSET_VERSION_OVERRIDES: Partial<Record<string, number>> = {};

// ── Prompt Version Identifier ─────────────────────────────────────────────────
//
// Human-readable identifier for the current prompt generation. Stored in the
// knowledge_assets.prompt_version column for observability and debugging.
// This does NOT control regeneration — use AI_GENERATION_VERSION for that.
//
export const CURRENT_PROMPT_VERSION = `prof-v${AI_GENERATION_VERSION}`;

// ── Version Resolver ──────────────────────────────────────────────────────────

/**
 * Returns the effective generation version for a given asset type.
 *
 * Checks ASSET_VERSION_OVERRIDES first for a per-type override.
 * Falls back to AI_GENERATION_VERSION if no override is defined.
 *
 * This function is the single point of version resolution for the entire
 * platform. It is called by:
 *   - AssetGenerationManager.assess()      → version comparison at request time
 *   - KnowledgeAssetRegistry.register()   → version written at generation time
 *
 * @param assetType - The asset type identifier (e.g. 'summary', 'flashcards',
 *                    'quiz', 'definitions', 'key_points', 'examples', etc.)
 * @returns The generation version integer that stored assets must match.
 */
export function getEffectiveVersion(assetType: string): number {
  return ASSET_VERSION_OVERRIDES[assetType] ?? AI_GENERATION_VERSION;
}

/**
 * Returns true if the stored version is outdated relative to the current version.
 *
 * This is a pure, synchronous, lightweight comparison — no DB calls, no AI
 * calls, no network. The decision completes in under 1ms.
 *
 * Used exclusively by AssetGenerationManager.assess() to determine whether
 * a cached 'ready' asset should be served or regenerated.
 *
 * @param storedVersion  - The generation_version stored on the knowledge_asset row.
 *                         Null/undefined is treated as version 0 (always outdated).
 * @param assetType      - The asset type being checked.
 * @returns true if the stored version is older than the current effective version.
 */
export function isVersionOutdated(storedVersion: number | null | undefined, assetType: string): boolean {
  if (storedVersion === null || storedVersion === undefined) return true;
  return storedVersion < getEffectiveVersion(assetType);
}

/**
 * Returns a structured log line for version decision events.
 * Keeps all version-related log messages uniform across all resource types.
 *
 * @param assetType      - The resource type being checked
 * @param storedVersion  - The version stored in the database
 * @param decision       - 'CACHED' | 'OUTDATED'
 */
export function formatVersionLog(
  assetType: string,
  storedVersion: number | null | undefined,
  decision: 'CACHED' | 'OUTDATED'
): string {
  const stored = storedVersion ?? 0;
  const current = getEffectiveVersion(assetType);
  return (
    `[VersionCheck] ${assetType} | ` +
    `Stored: gen_v${stored} | ` +
    `Current: gen_v${current} | ` +
    `Decision: ${decision}`
  );
}
