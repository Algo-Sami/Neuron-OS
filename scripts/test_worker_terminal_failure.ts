import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { enqueueStudyPackJob } from '../src/lib/queue/study-pack-queue';
import { startStudyPackWorker, stopStudyPackWorker } from '../src/workers/study-pack-worker';

const envPath = resolve(process.cwd(), '.env.local');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabase = createClient(
  env['NEXT_PUBLIC_SUPABASE_URL'],
  env['SUPABASE_SERVICE_ROLE_KEY']
);

async function main() {
  console.log('--- TEST: Worker terminal failure on non-existent document ---');

  // 1. Get user
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr || !users?.users?.[0]) {
    throw new Error('No user found in Supabase auth');
  }
  const testUserId = users.users[0].id;

  // 2. Insert test document and mark it soft-deleted
  const { data: testDoc, error: docErr } = await supabase
    .from('documents')
    .insert({
      user_id: testUserId,
      title: `test_doc_${Date.now()}`,
      file_url: 'https://example.com/fake.pdf',
      file_type: 'pdf',
      size: 1024,
      deleted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (docErr || !testDoc) {
    throw new Error(`Failed to create test document: ${docErr?.message}`);
  }

  // 3. Insert test background task pointing to the soft-deleted document
  const { data: task, error: taskErr } = await supabase
    .from('background_tasks')
    .insert({
      user_id: testUserId,
      document_id: testDoc.id,
      task_type: 'study_pack',
      status: 'Queued',
      attempts: 0,
      max_attempts: 3,
    })
    .select()
    .single();

  if (taskErr || !task) {
    await supabase.from('documents').delete().eq('id', testDoc.id);
    throw new Error(`Failed to create test background task: ${taskErr?.message}`);
  }

  console.log(`Created test task ${task.id} for soft-deleted doc ${testDoc.id} with status: ${task.status}`);

  // 3. Start worker
  console.log('Starting worker instance...');
  const worker = startStudyPackWorker();
  if (!worker) {
    throw new Error('Worker failed to initialize (missing env vars?)');
  }

  // 4. Enqueue job for soft-deleted document
  console.log(`Enqueueing BullMQ job for taskId ${task.id}...`);
  await enqueueStudyPackJob({
    jobId: task.id,
    taskId: task.id,
    userId: testUserId,
    documentId: testDoc.id,
    fileUrl: 'https://example.com/fake.pdf',
    fileType: 'pdf',
    force: true,
  });

  // 5. Poll background_tasks until status is Failed
  console.log('Polling background_tasks for terminal failure status...');
  let finalStatus: string | null = null;
  let finalErrorMessage: string | null = null;

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const { data: currentTask } = await supabase
      .from('background_tasks')
      .select('status, error_message, updated_at')
      .eq('id', task.id)
      .single();

    if (currentTask) {
      console.log(`  [t=${i+1}s] status=${currentTask.status}, error_message=${currentTask.error_message}`);
      if (currentTask.status === 'Failed') {
        finalStatus = currentTask.status;
        finalErrorMessage = currentTask.error_message;
        break;
      }
    }
  }

  // 6. Stop worker
  console.log('Stopping study pack worker...');
  await stopStudyPackWorker('TEST_COMPLETE');

  // 7. Cleanup task & document
  await supabase.from('background_tasks').delete().eq('id', task.id);
  await supabase.from('documents').delete().eq('id', testDoc.id);
  console.log('Cleaned up test task and document.');

  // 8. Assertions
  if (finalStatus !== 'Failed') {
    console.error(`❌ FAILED: Expected task status 'Failed', got '${finalStatus}'`);
    process.exit(1);
  }

  if (!finalErrorMessage || !finalErrorMessage.includes('DOCUMENT_NOT_FOUND')) {
    console.error(`❌ FAILED: Expected error_message containing 'DOCUMENT_NOT_FOUND', got '${finalErrorMessage}'`);
    process.exit(1);
  }

  console.log('\n=============================================================');
  console.log('🎉 SUCCESS: Worker on("failed") successfully caught unrecoverable');
  console.log('error before scheduler and marked background_tasks as Failed');
  console.log(`Stored error_message: "${finalErrorMessage}"`);
  console.log('=============================================================\n');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Test error:', err);
  await stopStudyPackWorker('ERROR');
  process.exit(1);
});
