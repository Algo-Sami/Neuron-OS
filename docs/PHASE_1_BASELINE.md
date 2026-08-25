# NEURON OS — PHASE 1 IMPLEMENTATION BASELINE

> **Document Version:** 1.0.0 — Pre-Implementation Baseline  
> **Date:** August 25, 2026  
> **Scope:** Exact state of background processing, scheduler entry points, API routes, database tables, and logging prior to Phase 1 modernization.

---

## 1. Current Background Processing Architecture

```text
User Drop File (UploadCenter)
       ↓
saveUploadMetadata() Server Action
       ↓
POST /api/generate-study-pack
       ↓
Captures session tokens
       ↓
setImmediate(runScheduler)  ← [CRITICAL SERVERLESS VULNERABILITY]
       ↓
AIJobScheduler.run(fileUrl, fileType)
       ↓
In-Process Multi-Stage Pipeline:
  Stage 1: DocumentExtractionService (pdf-parse -> pdfjs-dist -> Gemini OCR)
  Stage 2: chunkText (4000 max / 500 overlap)
  Stage 3: EmbeddingService (gemini-embedding-001 1536d batch)
  Stage 4: SummarySkillService (SlidingWindowSummarizer -> OpenRouter / Gemini)
  Stage 5: generateSummaryPDF (@react-pdf/renderer)
  Stage 6: Storage upload (Summary.pdf)
  Stage 7: FolderSyncService (AI Generated / Category / DocName)
       ↓
background_tasks.status = 'Completed'
```

---

## 2. Current Scheduler Entry Point & Instantiation

- **File:** [`src/services/ai/pipeline/scheduler.ts`](file:///d:/FYP%20Project/neuron/src/services/ai/pipeline/scheduler.ts)
- **Class:** `AIJobScheduler`
- **Constructor Signature:**
  ```typescript
  constructor(
    private supabase: SupabaseClient,
    private documentId: string,
    private userId: string,
    private taskId: string,
    private options: SchedulerOptions = {}
  )
  ```
- **Execution Method:** `scheduler.run(fileUrl: string, fileType: string): Promise<TaskProgress>`
- **Lease & Heartbeat Mechanism:**
  - `JobRecoveryService.claimTask(supabase, taskId, workerId)`: Acquires atomic 5-minute lease (`lock_expires_at = now() + 5 min`).
  - `JobRecoveryService.sendHeartbeat(supabase, taskId, workerId)`: Transmits 60s heartbeats via `setInterval(..., 60000)`.
  - `JobRecoveryService.completeTask(supabase, taskId, workerId)`: Finalizes task and unlocks row.
  - `JobRecoveryService.recoverStaleJobs(supabase, userId)`: Watchdog resets tasks with expired leases if `attempts < 3`.

---

## 3. Current API Route Flow

- **File:** [`src/app/api/generate-study-pack/route.ts`](file:///d:/FYP%20Project/neuron/src/app/api/generate-study-pack/route.ts)
- **Execution Flow:**
  1. Reads `{ documentId, fileUrl, fileType, force }` from request body.
  2. Authenticates user via `serverSupabase.auth.getUser()`.
  3. Verifies document ownership and subject assignment.
  4. Runs `JobRecoveryService.recoverStaleJobs(serverSupabase, userId)`.
  5. Performs database idempotency check on `background_tasks (user_id, document_id, task_type)`.
  6. Inserts or updates task to `Queued`.
  7. Spawns `runScheduler` via `setImmediate()`.
  8. Returns HTTP 200 `{ success: true, message: 'Study pack queued', taskId }`.

---

## 4. Existing Database Task Tables

1. **`public.background_tasks`**:
   - `id (UUID PK)`
   - `user_id (UUID FK profiles.id)`
   - `document_id (UUID FK documents.id)`
   - `task_type (TEXT)` (e.g. `'study_pack'`)
   - `status (TEXT)` (e.g. `'pending'`, `'Queued'`, `'Extracting Text'`, `'Completed'`, `'Failed'`)
   - `progress (JSONB)` (Stage-by-stage checkpoint data)
   - `locked_by (TEXT)` (Worker identifier)
   - `locked_at (TIMESTAMPTZ)`
   - `lock_expires_at (TIMESTAMPTZ)`
   - `heartbeat_at (TIMESTAMPTZ)`
   - `attempts (INTEGER DEFAULT 0)`
   - `error_message (TEXT)`
   - `created_at`, `updated_at`
   - **Unique Constraint:** `(user_id, document_id, task_type)`
2. **`public.asset_generation_jobs`**:
   - Stores granular asset-level locks (`summary`, `flashcards`, `quiz`, etc.).

---

## 5. Current Logging Mechanism

- **Hardcoded Path:** `fs.appendFileSync('d:/FYP Project/neuron/background_logs.txt', formatted)` in `scheduler.ts:84`.
- **Database Logs:** Appended to JSON arrays in `background_tasks.logs` and `document_knowledge.logs`.

---

## 6. Files Target Classification

### Files to be Modified in Phase 1
- `package.json` (add `bullmq`, `ioredis`, `tsx`, `@types/ioredis`, `"worker"` script)
- `.env.example` (add `REDIS_URL`, `WORKER_CONCURRENCY`, `JOB_MAX_ATTEMPTS`, `JOB_RETRY_BASE_DELAY_MS`)
- `src/app/api/generate-study-pack/route.ts` (remove `setImmediate`, add BullMQ enqueue)
- `src/services/ai/pipeline/scheduler.ts` (remove hardcoded Windows disk path, route to structured stdout logger)

### New Files to be Created in Phase 1
- `src/lib/queue/types.ts` (strongly-typed job payloads and contracts)
- `src/lib/queue/redis.ts` (Redis connection manager with auto-reconnect and health checks)
- `src/lib/queue/study-pack-queue.ts` (BullMQ Queue wrapper, bounded retention, enqueue helper)
- `src/workers/study-pack-worker.ts` (standalone BullMQ Worker process, concurrency, signal handling)
- `docs/PHASE_1_BASELINE.md` (this baseline)
- `docs/PHASE_1_WORKER_ARCHITECTURE.md` (complete worker architecture documentation)
- `docs/PHASE_1_OPERATIONS.md` (operational guide for Redis, worker CLI, troubleshooting)
- `docs/PHASE_1_IMPLEMENTATION_REPORT.md` (final verification and delivery report)

### Files Intentionally Left Untouched (Zero AI Pipeline / UX Changes)
- `src/services/ai/extractors/*` (pdf, docx, pptx, image extractors untouched)
- `src/services/ai/chunker.ts` (chunking logic untouched)
- `src/services/ai/embeddings.ts` (vector embeddings untouched)
- `src/services/ai/search.ts` (RAG search untouched)
- `src/services/ai/router.ts` (AI gateway untouched)
- `src/services/ai/pipeline/summary-skill-service.ts` (summarization untouched)
- `src/services/pdf/study-pack-pdf.tsx` (PDF renderer untouched)
- `src/services/ai/pipeline/folder-sync-service.ts` (folder sync untouched)
- All UI components, pages, dashboard, study rooms, gamification, and auth flows.

---
