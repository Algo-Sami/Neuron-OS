# Neuron OS — Comprehensive Codebase Bug Report

**Date:** September 1, 2026  
**Auditor:** Antigravity Senior Engineering Assistant  
**Status:** Audit Complete — No changes applied yet (Reporting Phase)

---

## 📊 Summary of Findings

| Severity | Count | Description |
| :--- | :---: | :--- |
| 🔴 **Critical** | **3** | Data corruption, shared identity collisions, and storage/resource leaks |
| 🟠 **High** | **5** | Impersonation vulnerabilities, infinite duplicate resource creation, desynchronized analytics |
| 🟡 **Medium** | **3** | Race conditions, broken deletion fallbacks, and past-timestamp logic errors |
| 🟢 **Low** | **2** | Environment-dependent worker failures and unsanitized MIME extensions |
| **TOTAL** | **13** | **Actionable bugs cataloged across all modules** |

---

## 🔴 Critical Severity

### 1. Shared `upload_id` Collision During Document & Folder Duplication
- **File & Line:** [`src/actions/folders.ts:510-532`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/actions/folders.ts#L510-L532) and [`src/actions/folders.ts:599-612`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/actions/folders.ts#L599-L612)
- **Description:** When duplicating a document or folder, `duplicateDocumentAction` and `duplicateFolderAction` spread the source document properties (`...rest`) into the new database row without deleting or unlinking `upload_id`.
- **Why it's a bug:**
  - *Expected Behavior:* Each cloned document must have an independent identity, with its own audit record or `upload_id: null`.
  - *Actual Behavior:* Two distinct documents now share the exact same `upload_id`. If the user later deletes one copy via `deleteUpload`, the shared audit record in `uploads` table is marked as `deleted`, corrupting the upload history for the active document copy.
- **Suggested Fix:**
  In `duplicateDocumentAction` and `duplicateFolderAction`, explicitly delete `rest.upload_id` (set to `null`) prior to inserting into `documents`.

---

### 2. Recycle Bin Restore Omits Associated AI-Generated Documents
- **File & Line:** [`src/actions/recycle-bin.ts:52-62`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/actions/recycle-bin.ts#L52-L62)
- **Description:** `restoreRecycleBinItemAction` only resets `deleted_at = null` on the primary `documents` row when restoring a file. It does not restore associated AI-generated documents (summaries, flashcards, quizzes, study guides, and dedicated subfolders under `AI Generated`).
- **Why it's a bug:**
  - *Expected Behavior:* Restoring a primary lecture document from the recycle bin should restore all associated AI study-pack assets in lockstep (matching the cascade restore behavior in `restoreDocumentFromRecycleBin` in `uploads.ts`).
  - *Actual Behavior:* The restored document reappears, but all of its AI-generated study assets remain stuck in the recycle bin with `deleted_at != null`, breaking the study pack view and file explorer navigation.
- **Suggested Fix:**
  Add lockstep restoration for AI-generated assets in `restoreRecycleBinItemAction`:
  ```ts
  const docShortId = id.substring(0, 8);
  await supabase.from("documents").update({ deleted_at: null }).eq("user_id", user.id).contains("tags", [`source_doc:${id}`]);
  await supabase.from("documents").update({ deleted_at: null }).eq("user_id", user.id).eq("ai_doc_type", "ai_generated").ilike("file_url", `%ai-gen-%${docShortId}%`);
  ```

---

### 3. Supabase Storage File Leak in Multiple Delete Actions
- **File & Line:** [`src/actions/recycle-bin.ts:124-141`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/actions/recycle-bin.ts#L124-L141) and [`src/actions/recycle-bin.ts:181-198`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/actions/recycle-bin.ts#L181-L198)
- **Description:** In `deleteMultipleItemsAction` and `emptyRecycleBinAction`, if `doc.upload_id` is null or missing, the code deletes rows from `documents` and AI metadata tables, but never invokes `supabase.storage.from("documents").remove(...)` to delete the physical binary file from storage.
- **Why it's a bug:**
  - *Expected Behavior:* Permanently deleting documents must remove both the database record and the corresponding physical file from Supabase Storage.
  - *Actual Behavior:* Orphan files permanently remain stored in the Supabase Storage bucket, consuming storage quota indefinitely with no database row pointing to them.
- **Suggested Fix:**
  Extract the storage path from `doc.file_url` and invoke `supabase.storage.from("documents").remove([storagePath])` before deleting the database row.

---

## 🟠 High Severity

### 4. Slash Command User Impersonation in Collaborative Study Rooms
- **File & Line:** [`src/actions/study-rooms.ts:291-297`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/actions/study-rooms.ts#L291-L297)
- **Description:** When an AI slash command (e.g. `/explain` or `/summarize`) is executed, the backend picks a user profile for the bot message using:
  ```ts
  const { data: systemUser } = await supabase.from("profiles").select("id").limit(1).single();
  const botUserId = systemUser?.id || senderId;
  ```
- **Why it's a bug:**
  - *Expected Behavior:* Bot messages should be attributed either to a dedicated system bot ID or to the invoking user (`senderId`).
  - *Actual Behavior:* `.limit(1).single()` selects an arbitrary random user in the database (usually the first registered user). The AI assistant's responses are posted under that user's name and avatar, impersonating them in the group chat.
- **Suggested Fix:**
  Set `botUserId = senderId` directly, or use a designated system account / null user ID for bot responses.

---

### 5. Infinite Duplicate Reminders Created on Study Plan Update
- **File & Line:** [`src/actions/study-coach.ts:69-128`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/actions/study-coach.ts#L69-L128)
- **Description:** Every time `saveStudyPlanAction` is called, it iterates through `weeklySchedule.dailyPlans.tasks` and executes `insert` on the `reminders` table without cleaning up previously generated AI study coach reminders.
- **Why it's a bug:**
  - *Expected Behavior:* Regenerating or updating an AI study plan should replace old study coach reminders with the newly generated schedule.
  - *Actual Behavior:* 20–50 new reminders are added every single time the user tweaks their preferences or regenerates their plan, causing duplicate reminders to pile up indefinitely.
- **Suggested Fix:**
  Before the insertion loop in `saveStudyPlanAction`, delete existing study coach reminders:
  ```ts
  await supabase.from("reminders").delete().eq("user_id", userId).eq("extracted_from_ai", true).ilike("title", "[Study Coach]%");
  ```

---

### 6. Inconsistent Taxonomy & Routing in Legacy Document Processor
- **File & Line:** [`src/app/api/process-document/route.ts:403-450`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/app/api/process-document/route.ts#L403-L450)
- **Description:** `process-document/route.ts` contains a legacy classification path that marks status as `auto_applied` at `confidence >= 0.80` and creates folders based on arbitrary Gemini output strings (`suggestedTopic`) rather than using the centralized 8-layer `SubjectClassifier` (0.90 threshold) and standard folders (`Lectures`, `Lab`, `Assignments`, `Quizzes`).
- **Why it's a bug:**
  - *Expected Behavior:* All document processing routes must route through the unified classification pipeline.
  - *Actual Behavior:* If `process-document` is invoked directly or by legacy consumers, it creates non-standard folder structures and bypasses the 8-layer classification rules.
- **Suggested Fix:**
  Replace the custom classification logic in `process-document/route.ts` with `SubjectClassifier.classify()`.

---

### 7. Dangling Foreign Key References After Duplicate Folder Merge
- **File & Line:** [`src/actions/folder-audit.ts:149-176`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/actions/folder-audit.ts#L149-L176)
- **Description:** When merging duplicate folders in `mergeDuplicateFoldersAction`, `documents.folder_id` is updated to the primary folder ID, but the `uploads` audit table (`uploads.folder_id`) is never updated before the duplicate folders are permanently deleted.
- **Why it's a bug:**
  - *Expected Behavior:* Merging folders should keep both `documents` and `uploads` in sync with the primary folder ID.
  - *Actual Behavior:* `uploads.folder_id` retains dangling references to deleted folder IDs, causing broken breadcrumbs and metadata in the upload history view.
- **Suggested Fix:**
  Update `uploads` during merge:
  ```ts
  await supabase.from("uploads").update({ folder_id: primary.id, folder_name: primary.name }).in("folder_id", dupeIds).eq("user_id", user.id);
  ```

---

### 8. Monthly XP Desynchronization on Quiz Completion
- **File & Line:** [`src/actions/quiz.ts:359-394`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/actions/quiz.ts#L359-L394)
- **Description:** When submitting a quiz, `awardXP` updates both `total_xp` and `monthly_xp`. However, when bonus XP (`extraXP`) is computed for streaks, combos, and speed bonuses, the direct update on lines 387-393 updates `total_xp` but forgets to add `extraXP` to `monthly_xp`.
- **Why it's a bug:**
  - *Expected Behavior:* All XP earned (including bonuses) must be added to both `total_xp` and `monthly_xp`.
  - *Actual Behavior:* Bonus XP is only added to `total_xp`, leaving `monthly_xp` lagging behind and distorting monthly leaderboard rankings.
- **Suggested Fix:**
  Update `monthly_xp` alongside `total_xp`:
  ```ts
  const currentMonthly = progress.monthly_xp || 0;
  await supabase.from("user_progress").update({
    total_xp: finalProgressXp,
    monthly_xp: currentMonthly + extraXP,
    current_level: tempLevel,
    updated_at: new Date().toISOString()
  }).eq("user_id", user.id);
  ```

---

## 🟡 Medium Severity

### 9. Race Condition in Daily Check-In Progress Updates
- **File & Line:** [`src/actions/gamification.ts:29-38`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/actions/gamification.ts#L29-L38)
- **Description:** `dailyCheckIn` calls `awardXP(user.id, "daily_activity")`, which updates `user_progress`, followed immediately by a second separate SQL query setting `last_check_in_date = todayStr`.
- **Why it's a bug:**
  - *Expected Behavior:* Check-in status and XP should be updated in a single atomic database operation.
  - *Actual Behavior:* If a background job or concurrent user action updates `user_progress` between the two queries, the second query overwrites those concurrent changes with stale data.
- **Suggested Fix:**
  Pass `last_check_in_date` directly into `awardXP` options or combine into a single update query.

---

### 10. Potential Exception in Storage Recursive Deletion During Account Removal
- **File & Line:** [`src/actions/auth.ts:208-216`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/actions/auth.ts#L208-L216)
- **Description:** `deleteRecursive` checks `if (!file.id || !file.metadata)` to identify folders. If a valid uploaded file has an empty metadata object or null ID, it is treated as a directory, prompting `supabase.storage.list()` on a file path, which throws an error and crashes account deletion.
- **Why it's a bug:**
  - *Expected Behavior:* File vs. directory identification should be resilient to varying Supabase Storage backend responses.
  - *Actual Behavior:* Account deletion can fail midway, leaving the user account in an inconsistent state.
- **Suggested Fix:**
  Wrap the recursive branch in a `try-catch` block and verify `listError` before halting the deletion process.

---

### 11. Past Timestamp Generation for Same-Day Study Planner Tasks
- **File & Line:** [`src/actions/study-coach.ts:77-103`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/actions/study-coach.ts#L77-L103)
- **Description:** When mapping a study plan task for the current day (`diffDays === 0`), if the task time (e.g. 09:00 AM) has already passed when the plan is generated (e.g. at 03:00 PM), the reminder is inserted with a `due_date` in the past.
- **Why it's a bug:**
  - *Expected Behavior:* Reminders generated for today should only be set for future time slots, or pushed to the next week if the time has already passed.
  - *Actual Behavior:* Overdue notifications trigger immediately for time slots that elapsed earlier in the day.
- **Suggested Fix:**
  If `diffDays === 0` and `reminderDate.getTime() < now.getTime()`, add 7 days (`targetDate.setDate(targetDate.getDate() + 7)`).

---

## 🟢 Low Severity

### 12. Unisolated Tesseract OCR Execution in Image Extractor
- **File & Line:** [`src/services/ai/extractors/image.ts:6-13`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/services/ai/extractors/image.ts#L6-L13)
- **Description:** `extractTextFromImage` calls `Tesseract.recognize(buffer, 'eng')` without configuring a local training data cache path.
- **Why it's a bug:**
  - *Expected Behavior:* OCR text extraction should function reliably in isolated server and container environments.
  - *Actual Behavior:* In environments with egress restrictions, downloading `eng.traineddata` dynamically causes the OCR extraction to hang or fail.
- **Suggested Fix:**
  Provide a pre-bundled `langPath` pointing to a local assets directory or gracefully fall back to Gemini OCR.

---

### 13. Unsanitized Avatar File Extension from Content-Type Header
- **File & Line:** [`src/actions/storage.ts:34-36`](file:///d:/Projects/FYP%20PROJECT/Neuron-OS/src/actions/storage.ts#L34-L36)
- **Description:** `uploadAvatar` parses `contentType.split("/")[1]` without mapping MIME types to clean file extensions (e.g. `image/svg+xml` produces `.svg+xml`).
- **Why it's a bug:**
  - *Expected Behavior:* Standard sanitized extensions like `.png`, `.jpg`, `.svg`.
  - *Actual Behavior:* Non-standard filenames saved to the `avatars` bucket.
- **Suggested Fix:**
  Use a lookup map: `{ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' }`.

---

## 🏁 Conclusion & Recommendations

The audit revealed **13 actionable issues**, of which **3 are Critical** (data corruption and storage leaks) and **5 are High** (security/impersonation and duplicate accumulation).

**Recommended Priority for Resolution:**
1. Fix `duplicateDocumentAction` & `duplicateFolderAction` `upload_id` copying (`src/actions/folders.ts`).
2. Implement lockstep restore for AI-generated assets in `recycle-bin.ts`.
3. Add physical file removal in `deleteMultipleItemsAction` & `emptyRecycleBinAction`.
4. Fix the bot profile ID selection in `study-rooms.ts` to prevent user impersonation.
5. Purge old study coach reminders when regenerating study plans in `study-coach.ts`.
