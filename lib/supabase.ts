import { createClient } from '@supabase/supabase-js';

// These environment variables are set in .env.local
// NEXT_PUBLIC_ prefix makes them available in browser code
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a single supabase client for the app
// This client is used for all database operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// The '!' after process.env tells TypeScript we're certain these exist
// If they don't, the app will fail at runtime - which is what we want
// (fail fast rather than silently malfunction)
