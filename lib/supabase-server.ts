import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using service role key
// This bypasses RLS and should ONLY be used in server-side code (API routes)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create a server-side client that bypasses RLS
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
