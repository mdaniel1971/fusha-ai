import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-side Supabase client using service role key
// This bypasses RLS and should ONLY be used in server-side code (API routes)

let supabaseServerInstance: SupabaseClient | null = null;

// Lazy initialization to avoid build-time errors when env vars aren't available
function getSupabaseServer(): SupabaseClient {
  if (!supabaseServerInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    supabaseServerInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseServerInstance;
}

// Export as a getter for backward compatibility
export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getSupabaseServer()[prop as keyof SupabaseClient];
  },
});
