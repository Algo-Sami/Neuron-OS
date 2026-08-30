/**
 * Recovery and Lease Constants for Background AI Jobs (Phase 2B-4)
 */

// Primary job lease: 12 minutes.
// Long-running AI stages (sliding window summarization on large docs) can take
// 80-120 seconds. With a 60-second heartbeat interval, a 5-minute lease would
// expire mid-AI-call. 12 minutes gives 11 heartbeat windows before expiry.
export const JOB_LEASE_DURATION_MS = 12 * 60 * 1000; // 12 minutes
export const JOB_HEARTBEAT_INTERVAL_MS = 60 * 1000; // 60 seconds
export const JOB_MAX_ATTEMPTS = 3;

export const ASSET_JOB_LEASE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/**
 * All pipeline statuses considered actively in progress (not completed, failed, or cancelled).
 * If lock_expires_at is in the past for any of these, the task is considered stale.
 */
export const ACTIVE_PIPELINE_STATUSES = [
  'Queued',
  'queued',
  'pending',
  'processing',
  'Processing',
  'Downloading File',
  'Extracting Text',
  'Cleaning Text',
  'Validating',
  'Validating Text',
  'Saving Knowledge',
  'Saving Text',
  'Chunking Document',
  'Saving Chunks',
  'Verifying Document',
  'Generating Embeddings',
  'Verifying Knowledge',
  'Generating Summary',
  'Rendering PDF'
] as const;

export type ActivePipelineStatus = typeof ACTIVE_PIPELINE_STATUSES[number];
