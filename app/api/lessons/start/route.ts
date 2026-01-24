import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { canSendMessage, getQuotaInfo } from '@/lib/db/messageQuota';
import { loadLearnerContext, buildContextPrompt } from '@/lib/db';

/**
 * POST /api/lessons/start
 * Start a new lesson, checking quota first.
 *
 * Body: {
 *   userId: string,
 *   surahId?: number,
 *   learningMode?: 'grammar' | 'translation' | 'mix'
 * }
 *
 * Returns:
 * - Success: { success: true, lessonId, learnerContext, quotaInfo }
 * - Quota exceeded: { success: false, error: 'quota_exceeded', limitType, quotaInfo }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, surahId = 1, learningMode = 'mix' } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    // Check if user can send messages
    const quotaCheck = await canSendMessage(userId);

    if (!quotaCheck.canSend) {
      // Quota exceeded - return error with quota info
      const quotaInfo = await getQuotaInfo(userId);
      return NextResponse.json({
        success: false,
        error: 'quota_exceeded',
        limitType: quotaCheck.reason,
        quotaInfo: {
          tier: quotaInfo.tier,
          messagesRemaining: quotaInfo.messagesRemaining,
          messageQuota: quotaInfo.messageQuota,
          resetDate: quotaInfo.resetDate.toISOString(),
        },
      });
    }

    // Generate lesson ID
    const lessonId = crypto.randomUUID();

    // Create lesson record
    const { error: lessonError } = await supabaseServer
      .from('lessons')
      .insert({
        id: lessonId,
        user_id: userId,
        surah_id: surahId,
        learning_mode: learningMode,
        started_at: new Date().toISOString(),
        messages_count: 0,
        tokens_used: 0,
      });

    if (lessonError) {
      console.error('Failed to create lesson:', lessonError);
      return NextResponse.json(
        { success: false, error: 'Failed to create lesson', details: lessonError.message },
        { status: 500 }
      );
    }

    // Load learner context for personalization
    const learnerContext = await loadLearnerContext(userId);
    const contextPrompt = learnerContext ? buildContextPrompt(learnerContext) : null;

    // Get quota info for response
    const quotaInfo = await getQuotaInfo(userId);

    return NextResponse.json({
      success: true,
      lessonId,
      learnerContext: {
        hasHistory: !!learnerContext?.lastLesson,
        contextPrompt,
        facts: learnerContext?.facts || null,
        patterns: learnerContext?.patterns || null,
      },
      quotaInfo: {
        messagesRemaining: quotaInfo.messagesRemaining,
        resetDate: quotaInfo.resetDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error starting lesson:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
