const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split(/\r?\n/).forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    envVars[key] = val;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log('=== RUNNING DUPLICATE AUDIT ===\n');

  // 1. Audit background_tasks duplicates on (user_id, document_id, task_type)
  const { data: allTasks, error: taskErr } = await supabase
    .from('background_tasks')
    .select('id, user_id, document_id, task_type, status, created_at, updated_at');

  if (taskErr) {
    console.error('Error querying background_tasks:', taskErr);
  } else {
    console.log(`Total background_tasks rows: ${allTasks ? allTasks.length : 0}`);
    const taskGroups = {};
    (allTasks || []).forEach(t => {
      const key = `${t.user_id}::${t.document_id}::${t.task_type}`;
      if (!taskGroups[key]) taskGroups[key] = [];
      taskGroups[key].push(t);
    });

    const duplicateTasks = Object.entries(taskGroups).filter(([_, items]) => items.length > 1);
    if (duplicateTasks.length === 0) {
      console.log('Result: No duplicate background_tasks logical keys found.');
    } else {
      console.log(`Result: Found ${duplicateTasks.length} duplicate background_tasks groups!`);
      duplicateTasks.forEach(([key, items], idx) => {
        console.log(` Group ${idx + 1} (${key}): ${items.length} records`);
        items.forEach(item => {
          console.log(`   - ID: ${item.id}, Status: ${item.status}, CreatedAt: ${item.created_at}`);
        });
      });
    }
  }

  console.log('\n----------------------------------------\n');

  // 2. Audit document_chunks duplicates on (document_id, chunk_index)
  const { data: allChunks, error: chunkErr } = await supabase
    .from('document_chunks')
    .select('id, document_id, chunk_index, created_at, embedding');

  if (chunkErr) {
    console.error('Error querying document_chunks:', chunkErr);
  } else {
    console.log(`Total document_chunks rows: ${allChunks ? allChunks.length : 0}`);
    const chunkGroups = {};
    (allChunks || []).forEach(c => {
      const key = `${c.document_id}::${c.chunk_index}`;
      if (!chunkGroups[key]) chunkGroups[key] = [];
      chunkGroups[key].push(c);
    });

    const duplicateChunks = Object.entries(chunkGroups).filter(([_, items]) => items.length > 1);
    if (duplicateChunks.length === 0) {
      console.log('Result: No duplicate document_chunks logical keys found.');
    } else {
      console.log(`Result: Found ${duplicateChunks.length} duplicate document_chunks groups!`);
      duplicateChunks.forEach(([key, items], idx) => {
        console.log(` Group ${idx + 1} (${key}): ${items.length} records`);
        items.forEach(item => {
          console.log(`   - ID: ${item.id}, Index: ${item.chunk_index}, HasEmbedding: ${!!item.embedding}, CreatedAt: ${item.created_at}`);
        });
      });
    }
  }

  console.log('\n=== AUDIT COMPLETE ===');
}

runAudit();
