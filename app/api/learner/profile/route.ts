export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadLearnerContext, buildContextPrompt } from '@/lib/db';

/**
 * GET /api/learner/profile
 * Get the authenticated user's learner profile including facts and patterns.
 * Used to display learner progress on sign-in and to inform starting difficulty.
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

    // Load the full learner context
    const context = await loadLearnerContext(user.id);

    // Build the context prompt (used by the AI)
    const contextPrompt = buildContextPrompt(context);

    // Calculate recommended starting difficulty
    let recommendedDifficulty = 1; // Default: basic
    const grammarAccuracy = context.patterns.grammarAccuracy;
    const translationAccuracy = context.patterns.translationAccuracy;
    const avgAccuracy = (grammarAccuracy + translationAccuracy) / 2;

    if (avgAccuracy >= 80) {
      recommendedDifficulty = 4; // Advanced
    } else if (avgAccuracy >= 60) {
      recommendedDifficulty = 3; // Intermediate
    } else if (avgAccuracy >= 40) {
      recommendedDifficulty = 2; // Basic+
    }

    // If they have active struggles, don't go too high
    if (context.facts.struggles.length >= 3) {
      recommendedDifficulty = Math.max(1, recommendedDifficulty - 1);
    }

    return NextResponse.json({
      userId: user.id,
      facts: {
        struggles: context.facts.struggles.slice(0, 5).map(f => ({
          id: f.id,
          text: f.fact_text,
          category: f.category,
          examples: f.arabic_examples,
          observationCount: f.observation_count,
        })),
        strengths: context.facts.strengths.slice(0, 5).map(f => ({
          id: f.id,
          text: f.fact_text,
          category: f.category,
          observationCount: f.observation_count,
        })),
      },
      patterns: {
        grammarAccuracy: context.patterns.grammarAccuracy,
        translationAccuracy: context.patterns.translationAccuracy,
        weakestAreas: context.patterns.weakestGrammarFeatures.slice(0, 3),
        strongestAreas: context.patterns.strongestGrammarFeatures.slice(0, 3),
        commonMistakes: context.patterns.frequentMistakes.slice(0, 3),
      },
      lastLesson: context.lastLesson ? {
        surahName: context.lastLesson.surahName,
        topicDiscussed: context.lastLesson.topicDiscussed,
        performanceSummary: context.lastLesson.performanceSummary,
        endedAt: context.lastLesson.endedAt,
      } : null,
      recommendedDifficulty,
      hasHistory: context.facts.struggles.length > 0 || context.facts.strengths.length > 0,
      contextPrompt, // For debugging, can remove in production
    });
  } catch (error) {
    console.error('Error fetching learner profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch learner profile' },
      { status: 500 }
    );
  }
}
