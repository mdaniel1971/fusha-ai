import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getOrCreateProfile } from '@/lib/db/messageQuota';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/ensure-profile
 * Ensures a profile exists for the authenticated user.
 * Called after successful login to create profile if it doesn't exist.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Create profile if it doesn't exist
    const profile = await getOrCreateProfile(user.id, user.email || undefined);

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        tier: profile.subscription_tier,
        messagesRemaining: profile.weekly_message_quota - profile.weekly_messages_used,
      },
    });
  } catch (error) {
    console.error('Error ensuring profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to ensure profile' },
      { status: 500 }
    );
  }
}
