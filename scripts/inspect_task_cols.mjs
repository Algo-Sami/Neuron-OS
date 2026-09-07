import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase.from('background_tasks').select('*').limit(1);
  if (data && data[0]) {
    console.log('Columns on background_tasks:', Object.keys(data[0]));
    console.log('Row sample:', data[0]);
  }
}
main();
