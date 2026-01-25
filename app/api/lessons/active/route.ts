export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveLesson, getQuotaInfo, endLesson } from '@/lib/db/messageQuota';
import { extractLessonFacts, reconcileFacts } from '@/lib/db';

/**
 * GET /api/lessons/active
 * Get the active lesson for the authenticated user along with quota info.
 *
 * Returns:
 * - Success: { lesson, quotaInfo }
 * - No lesson: { lesson: null, quotaInfo }
 * - Error: { error: string }
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const [lesson, quotaInfo] = await Promise.all([
      getActiveLesson(user.id),
      getQuotaInfo(user.id),
    ]);

    return NextResponse.json({
      lesson,
      quotaInfo: {
        tier: quotaInfo.tier,
        messagesUsed: quotaInfo.messagesUsed,
        messageQuota: quotaInfo.messageQuota,
        messagesRemaining: quotaInfo.messagesRemaining,
        tokensUsed: quotaInfo.tokensUsed,
        tokenQuota: quotaInfo.tokenQuota,
        tokensRemaining: quotaInfo.tokensRemaining,
        resetDate: quotaInfo.resetDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting active lesson:', error);
    return NextResponse.json(
      { error: 'Failed to get active lesson' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/lessons/active
 * End the active lesson for the authenticated user.
 *
 * Body: { lessonId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { lessonId } = await request.json();

    if (!lessonId) {
      return NextResponse.json(
        { error: 'lessonId is required' },
        { status: 400 }
      );
    }

    await endLesson(lessonId);

    // Extract facts from observations and save to learner_facts
    // Pass user.id to ensure we can find/save facts even if lesson lookup fails
    const analysis = await extractLessonFacts(lessonId, user.id);

    // Reconcile facts (deactivate old struggles that have improved)
    const effectiveUserId = analysis?.userId || user.id;
    if (effectiveUserId) {
      await reconcileFacts(effectiveUserId);
    }

    return NextResponse.json({
      success: true,
      analysis: analysis ? {
        performanceSummary: analysis.performanceSummary,
        extractedFacts: analysis.extractedFacts.length,
        grammarObservationCount: analysis.grammarObservations.length,
        translationObservationCount: analysis.translationObservations.length,
      } : null,
    });
  } catch (error) {
    console.error('Error ending lesson:', error);
    return NextResponse.json(
      { error: 'Failed to end lesson' },
      { status: 500 }
    );
  }
}
