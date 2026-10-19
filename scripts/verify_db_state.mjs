import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
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
  console.log('=== 1. Testing error_message column on background_tasks ===');
  // Find a task to test or check columns
  const { data: tasks, error: taskErr } = await supabase
    .from('background_tasks')
    .select('id, status, error_message')
    .limit(1);

  if (taskErr) {
    console.error('Error selecting background_tasks:', taskErr);
  } else {
    console.log('Successfully selected background_tasks:', tasks);
    if (tasks && tasks[0]) {
      const testId = tasks[0].id;
      const originalErr = tasks[0].error_message;
      const testMsg = `test_probe_${Date.now()}`;
      
      const { data: updateData, error: updateErr } = await supabase
        .from('background_tasks')
        .update({ error_message: testMsg })
        .eq('id', testId)
        .select('id, error_message')
        .single();

      if (updateErr) {
        console.error('❌ FAILED to update error_message column:', updateErr);
      } else {
        console.log('✅ Successfully wrote to error_message column:', updateData);
        // revert
        await supabase
          .from('background_tasks')
          .update({ error_message: originalErr })
          .eq('id', testId);
        console.log('✅ Reverted test update cleanly.');
      }
    }
  }

  console.log('\n=== 2. Testing reminders constraint (uq_reminders_user_title_due) ===');
  // Get an existing user_id
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
  const testUserId = users?.users?.[0]?.id;
  if (!testUserId) {
    console.log('No user found for reminder test.');
  } else {
    const testTitle = `dup_test_${Date.now()}`;
    const testDate = new Date().toISOString();

    const { data: r1, error: r1Err } = await supabase
      .from('reminders')
      .insert({
        user_id: testUserId,
        title: testTitle,
        due_date: testDate,
        reminder_type: 'generic',
        completed_status: false
      })
      .select()
      .single();

    if (r1Err) {
      console.error('Failed to insert initial reminder:', r1Err);
    } else {
      console.log('Inserted initial reminder:', r1.id);
      
      // Attempt duplicate insert
      const { data: r2, error: r2Err } = await supabase
        .from('reminders')
        .insert({
          user_id: testUserId,
          title: testTitle,
          due_date: testDate,
          reminder_type: 'generic',
          completed_status: false
        })
        .select()
        .single();

      if (r2Err) {
        console.log('✅ Duplicate insert correctly REJECTED by DB constraint!');
        console.log('   Error code:', r2Err.code, '| Message:', r2Err.message);
      } else {
        console.log('⚠️ Duplicate insert SUCCEEDED — unique constraint is NOT enforced in DB!');
        console.log('   Second reminder ID:', r2?.id);
        // Clean up second reminder
        if (r2?.id) await supabase.from('reminders').delete().eq('id', r2.id);
      }

      // Clean up first reminder
      if (r1?.id) await supabase.from('reminders').delete().eq('id', r1.id);
      console.log('Cleaned up test reminders.');
    }
  }
}

main().catch(console.error);
