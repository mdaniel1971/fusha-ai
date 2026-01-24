import { NextRequest, NextResponse } from 'next/server';
import { resetWeeklyQuotas } from '@/lib/db/resetWeeklyQuotas';

/**
 * POST /api/cron/reset-quotas
 * Resets weekly quotas for all users whose reset date has passed.
 *
 * Security: This endpoint should be protected by a secret key in production.
 * Pass the key via Authorization header or query param.
 *
 * Cron Schedule: Every Sunday at 00:00 UTC
 * Vercel cron syntax: 0 0 * * 0
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret in production
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      const querySecret = request.nextUrl.searchParams.get('secret');

      if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const result = await resetWeeklyQuotas();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Weekly quota reset complete`,
        usersReset: result.usersReset,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Cron reset-quotas error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also allow GET for easy testing (with auth)
export async function GET(request: NextRequest) {
  return POST(request);
}
