import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Querying public.background_tasks...');
  const { data: tasks, error } = await supabase
    .from('background_tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching background_tasks:', error);
    process.exit(1);
  }

  console.log(`Found ${tasks.length} total tasks in database.`);
  const now = Date.now();
  const twoMinutesMs = 2 * 60 * 1000;

  const summary = {
    total: tasks.length,
    byStatus: {},
    stuckQueuedOver2Min: 0,
    stuckProcessingStaleHeartbeatOver2Min: 0,
    completed: 0,
    failed: 0,
    other: 0,
  };

  const stuckList = [];

  for (const t of tasks) {
    const status = t.status || 'unknown';
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;

    const createdAt = t.created_at ? new Date(t.created_at).getTime() : 0;
    const updatedAt = t.updated_at ? new Date(t.updated_at).getTime() : 0;
    const heartbeatAt = t.heartbeat_at ? new Date(t.heartbeat_at).getTime() : 0;
    const lastActivity = Math.max(updatedAt, heartbeatAt, createdAt);
    const ageMs = now - lastActivity;
    const ageMinutes = Math.round(ageMs / 60000);

    const normStatus = status.toLowerCase().trim();

    if (normStatus === 'queued') {
      if (ageMs > twoMinutesMs) {
        summary.stuckQueuedOver2Min++;
        stuckList.push({ id: t.id, document_id: t.document_id, status: t.status, ageMinutes, worker_id: t.worker_id, created_at: t.created_at });
      }
    } else if (normStatus === 'processing') {
      if (ageMs > twoMinutesMs) {
        summary.stuckProcessingStaleHeartbeatOver2Min++;
        stuckList.push({ id: t.id, document_id: t.document_id, status: t.status, ageMinutes, worker_id: t.worker_id, heartbeat_at: t.heartbeat_at, updated_at: t.updated_at });
      }
    } else if (normStatus === 'completed') {
      summary.completed++;
    } else if (normStatus === 'failed') {
      summary.failed++;
    } else {
      summary.other++;
    }
  }

  console.log('\nTask Statistics Summary:\n', JSON.stringify(summary, null, 2));

  if (stuckList.length > 0) {
    console.log(`\nCurrently Stuck Tasks (${stuckList.length} total):`);
    console.log(JSON.stringify(stuckList.slice(0, 10), null, 2));
  } else {
    console.log('\nNo currently stuck tasks found.');
  }

  console.log('\nLast 5 Most Recent Tasks:');
  for (const t of tasks.slice(0, 5)) {
    console.log({
      id: t.id,
      document_id: t.document_id,
      status: t.status,
      worker_id: t.worker_id,
      created_at: t.created_at,
      updated_at: t.updated_at,
      heartbeat_at: t.heartbeat_at,
      error_message: t.error_message,
    });
  }
}

main().catch(console.error);
