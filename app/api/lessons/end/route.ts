import { NextRequest, NextResponse } from 'next/server';
import { extractLessonFacts, reconcileFacts } from '@/lib/db';

/**
 * POST /api/lessons/end
 * Ends a lesson and extracts learner facts from observations
 *
 * Body: { lessonId: string, userId?: string }
 * Returns: { success: boolean, analysis?: LessonAnalysis, error?: string }
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

    // Extract facts from the lesson's observations
    const analysis = await extractLessonFacts(lessonId);

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: 'Failed to analyze lesson' },
        { status: 500 }
      );
    }

    // Reconcile facts to deactivate old struggles that have been improved
    if (userId || analysis.userId) {
      await reconcileFacts(userId || analysis.userId);
    }

    return NextResponse.json({
      success: true,
      analysis: {
        lessonId: analysis.lessonId,
        performanceSummary: analysis.performanceSummary,
        extractedFacts: analysis.extractedFacts,
        grammarObservationCount: analysis.grammarObservations.length,
        translationObservationCount: analysis.translationObservations.length,
      },
    });
  } catch (error) {
    console.error('Error ending lesson:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
