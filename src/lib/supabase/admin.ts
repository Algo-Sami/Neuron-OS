import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client initialized with SUPABASE_SERVICE_ROLE_KEY.
 * Bypasses Row Level Security (RLS) for internal system mutations such as
 * incrementing weekly leaderboard scores or running background tasks.
 *
 * NEVER import or expose this client to the browser/client-side code.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('[Supabase Admin] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined.');
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
