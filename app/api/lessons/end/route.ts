import { NextRequest, NextResponse } from 'next/server';
import { extractLessonFacts, reconcileFacts, getQuotaInfo } from '@/lib/db';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * POST /api/lessons/end
 * Ends a lesson and extracts learner facts from observations
 *
 * Body: { lessonId: string, userId?: string }
 * Returns: { success: boolean, analysis?, lessonSummary?, quotaInfo?, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { lessonId, userId } = await request.json();

    if (!lessonId) {
      return NextResponse.json(
        { success: false, error: 'lessonId is required' },
        { status: 400 }
      );
    }

    // Set ended_at timestamp and get lesson stats
    const { data: lesson, error: updateError } = await supabaseServer
      .from('lessons')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', lessonId)
      .select('messages_count, tokens_used, user_id')
      .single();

    if (updateError) {
      console.error('Failed to update lesson:', updateError);
    }

    // Extract facts from the lesson's observations
    const analysis = await extractLessonFacts(lessonId);

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'Failed to analyze lesson' },
        { status: 500 }
      );
    }

    // Reconcile facts to deactivate old struggles that have been improved
    const effectiveUserId = userId || analysis.userId || lesson?.user_id;
    if (effectiveUserId) {
      await reconcileFacts(effectiveUserId);
    }

    // Get quota info for response
    let quotaInfo = null;
    if (effectiveUserId) {
      const quota = await getQuotaInfo(effectiveUserId);
      quotaInfo = {
        messagesRemaining: quota.messagesRemaining,
        resetDate: quota.resetDate.toISOString(),
      };
    }

    return NextResponse.json({
      success: true,
      lessonSummary: {
        messagesUsed: lesson?.messages_count || 0,
        tokensUsed: lesson?.tokens_used || 0,
      },
      analysis: {
        lessonId: analysis.lessonId,
        performanceSummary: analysis.performanceSummary,
        extractedFacts: analysis.extractedFacts,
        grammarObservationCount: analysis.grammarObservations.length,
        translationObservationCount: analysis.translationObservations.length,
      },
      quotaInfo,
    });
  } catch (error) {
    console.error('Error ending lesson:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
