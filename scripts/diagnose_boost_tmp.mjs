import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = 'd:/Projects/FYP PROJECT/Neuron-OS/.env.local';
let SUPABASE_URL = '', SERVICE_ROLE_KEY = '';
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const [k, ...v] = t.split('=');
  const key = k.trim(), val = v.join('=').trim();
  if (key === 'NEXT_PUBLIC_SUPABASE_URL') SUPABASE_URL = val;
  if (key === 'SUPABASE_SERVICE_ROLE_KEY') SERVICE_ROLE_KEY = val;
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: row } = await admin.from('profiles').select('*').limit(1).single();
console.log('Columns:', Object.keys(row));
console.log('boost_upload_limit in row:', 'boost_upload_limit' in row);
const { data: upd, error: updErr } = await admin.from('profiles').update({ boost_upload_limit: 999 }).eq('id', row.id).select('id, boost_upload_limit');
console.log('updErr:', updErr?.message ?? 'none'); console.log('upd:', JSON.stringify(upd));
const { data: rr } = await admin.from('profiles').select('id,boost_upload_limit').eq('id', row.id).single();
console.log('reread:', JSON.stringify(rr));
await admin.from('profiles').update({ boost_upload_limit: null }).eq('id', row.id);
