import { createClient, SupabaseClient } from '@supabase/supabase-js';

// These environment variables are set in .env.local
// NEXT_PUBLIC_ prefix makes them available in browser code

let supabaseInstance: SupabaseClient | null = null;

// Lazy initialization to avoid build-time errors when env vars aren't available
function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

// Export as a getter for backward compatibility
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  },
});
