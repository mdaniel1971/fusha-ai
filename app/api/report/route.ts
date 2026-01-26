export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { generateReport, getMotivationalMessage } from '@/lib/reportGenerator';
import { extractLessonFacts, reconcileFacts } from '@/lib/db';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, lessonId, userId } = await request.json();

    console.log('[report] Received IDs:', { sessionId, lessonId, userId });

    // Use lessonId for observations (new flow) or fall back to sessionId (legacy)
    const observationSessionId = lessonId || sessionId;
    console.log('[report] Using observationSessionId:', observationSessionId);

    if (!observationSessionId) {
      return new Response(
        JSON.stringify({ error: 'Session ID or Lesson ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate the report from observations
    const report = await generateReport(observationSessionId);

    if (!report) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate report' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract and save learner_facts from this lesson's observations
    let learnerFacts: any[] = [];
    let analysis = null;

    // Use lessonId if available, otherwise fall back to sessionId
    const factSessionId = lessonId || sessionId;
    if (factSessionId && userId) {
      // Debug: Check what observations exist for this session
      const { data: gramObs } = await supabaseServer
        .from('grammar_observations')
        .select('id, session_id, grammar_feature, is_correct')
        .eq('session_id', factSessionId);
      const { data: transObs } = await supabaseServer
        .from('translation_observations')
        .select('id, session_id, is_correct')
        .eq('session_id', factSessionId);
      console.log('[report] Observations in DB for session:', {
        factSessionId,
        grammarCount: gramObs?.length || 0,
        translationCount: transObs?.length || 0,
        grammarObs: gramObs?.slice(0, 3),
      });

      console.log('[report] Extracting facts for session:', factSessionId, 'user:', userId);
      analysis = await extractLessonFacts(factSessionId, userId);

      const effectiveUserId = analysis?.userId || userId;
      if (effectiveUserId) {
        // Reconcile facts (deactivate old struggles that have improved)
        await reconcileFacts(effectiveUserId);

        // Fetch all active learner_facts for this user
        const { data: facts } = await supabaseServer
          .from('learner_facts')
          .select('*')
          .eq('user_id', effectiveUserId)
          .eq('is_active', true)
          .order('last_confirmed', { ascending: false });

        learnerFacts = facts || [];
      }
    }

    const motivationalMessage = getMotivationalMessage(report.sessionSummary.overallScore);

    return new Response(
      JSON.stringify({
        ...report,
        motivationalMessage,
        learnerFacts,
        analysisResults: analysis ? {
          performanceSummary: analysis.performanceSummary,
          newFactsCount: analysis.extractedFacts.filter((f: any) => f.isNew).length,
          updatedFactsCount: analysis.extractedFacts.filter((f: any) => !f.isNew).length,
        } : null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Report error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate report' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}