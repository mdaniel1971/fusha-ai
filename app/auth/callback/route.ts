import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getOrCreateProfile } from '@/lib/db/messageQuota';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // "next" param allows redirecting to a specific page after login
  const next = searchParams.get('next') ?? '/diagnostic_chat';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get the user and ensure profile exists
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        try {
          // Create profile if it doesn't exist
          await getOrCreateProfile(user.id, user.email || undefined);
        } catch (profileError) {
          console.error('Failed to create profile:', profileError);
          // Continue anyway - profile will be created on first API call
        }
      }

      // Determine the correct redirect URL based on environment
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      if (isLocalEnv) {
        // In local development, redirect to origin (localhost)
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        // In production (Vercel), use the forwarded host
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        // Fallback to origin
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // If there's no code or an error occurred, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
