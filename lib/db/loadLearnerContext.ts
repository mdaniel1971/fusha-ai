import { supabase } from '../supabase';
import type { LearnerContext, LearnerFact } from './types';

/**
 * Loads the complete learner context for building AI system prompts.
 * Fetches:
 * - All active learner facts (struggles, strengths, interests, preferences)
 * - Most recent lesson for continuity
 * - Aggregated grammar/translation patterns
 */
export async function loadLearnerContext(userId: string): Promise<LearnerContext> {
  // Fetch all data in parallel
  const [factsResult, lastLessonResult, grammarPatternsResult, translationStatsResult] = await Promise.all([
    fetchActiveFacts(userId),
    fetchLastLesson(userId),
    fetchGrammarPatterns(userId),
    fetchTranslationStats(userId),
  ]);

  // Organize facts by type
  const facts = {
    struggles: factsResult.filter(f => f.fact_type === 'struggle'),
    strengths: factsResult.filter(f => f.fact_type === 'strength'),
    interests: factsResult.filter(f => f.fact_type === 'interest'),
    preferences: factsResult.filter(f => f.fact_type === 'preference'),
  };

  return {
    userId,
    facts,
    lastLesson: lastLessonResult,
    patterns: {
      grammarAccuracy: grammarPatternsResult.overallAccuracy,
      translationAccuracy: translationStatsResult.accuracy,
      weakestGrammarFeatures: grammarPatternsResult.weakest,
      strongestGrammarFeatures: grammarPatternsResult.strongest,
      frequentMistakes: grammarPatternsResult.frequentMistakes,
    },
  };
}

/**
 * Fetch all active learner facts
 */
async function fetchActiveFacts(userId: string): Promise<LearnerFact[]> {
  const { data, error } = await supabase
    .from('learner_facts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('observation_count', { ascending: false });

  if (error) {
    console.error('Error fetching learner facts:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch the most recent lesson for continuity
 */
async function fetchLastLesson(userId: string): Promise<LearnerContext['lastLesson']> {
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('surah_id, topic_discussed, performance_summary, continuity_notes, ended_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (lessonError || !lesson) {
    return null;
  }

  // Get surah name if we have a surah_id
  let surahName: string | null = null;
  if (lesson.surah_id) {
    const { data: surah } = await supabase
      .from('surahs')
      .select('name_english')
      .eq('id', lesson.surah_id)
      .single();
    surahName = surah?.name_english || null;
  }

  return {
    surahId: lesson.surah_id,
    surahName,
    topicDiscussed: lesson.topic_discussed,
    performanceSummary: lesson.performance_summary,
    continuityNotes: lesson.continuity_notes,
    endedAt: lesson.ended_at,
  };
}

/**
 * Fetch aggregated grammar patterns from observations
 */
async function fetchGrammarPatterns(userId: string): Promise<{
  overallAccuracy: number;
  weakest: { feature: string; accuracy: number; count: number }[];
  strongest: { feature: string; accuracy: number; count: number }[];
  frequentMistakes: { student: string; correct: string; count: number }[];
}> {
  // Get all grammar observations for this user
  const { data, error } = await supabase
    .from('grammar_observations')
    .select('grammar_feature, student_answer, correct_answer, is_correct')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);  // Last 500 observations for pattern analysis

  if (error || !data || data.length === 0) {
    return {
      overallAccuracy: 0,
      weakest: [],
      strongest: [],
      frequentMistakes: [],
    };
  }

  // Calculate overall accuracy
  const correct = data.filter(d => d.is_correct).length;
  const overallAccuracy = Math.round((correct / data.length) * 100);

  // Group by feature
  const featureStats = new Map<string, { correct: number; total: number }>();
  const mistakePairs = new Map<string, number>();

  for (const obs of data) {
    // Feature stats
    if (!featureStats.has(obs.grammar_feature)) {
      featureStats.set(obs.grammar_feature, { correct: 0, total: 0 });
    }
    const stats = featureStats.get(obs.grammar_feature)!;
    stats.total++;
    if (obs.is_correct) stats.correct++;

    // Mistake pairs (only incorrect)
    if (!obs.is_correct) {
      const key = `${obs.student_answer}|${obs.correct_answer}`;
      mistakePairs.set(key, (mistakePairs.get(key) || 0) + 1);
    }
  }

  // Convert to arrays and sort
  const featureAccuracies = Array.from(featureStats.entries())
    .filter(([, stats]) => stats.total >= 3)  // At least 3 observations
    .map(([feature, stats]) => ({
      feature: formatFeatureName(feature),
      accuracy: Math.round((stats.correct / stats.total) * 100),
      count: stats.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const weakest = featureAccuracies.slice(0, 3);
  const strongest = featureAccuracies.slice(-3).reverse();

  // Top frequent mistakes
  const frequentMistakes = Array.from(mistakePairs.entries())
    .map(([key, count]) => {
      const [student, correct] = key.split('|');
      return { student, correct, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { overallAccuracy, weakest, strongest, frequentMistakes };
}

/**
 * Fetch translation accuracy stats
 */
async function fetchTranslationStats(userId: string): Promise<{ accuracy: number; total: number }> {
  const { data, error } = await supabase
    .from('translation_observations')
    .select('is_correct')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data || data.length === 0) {
    return { accuracy: 0, total: 0 };
  }

  const correct = data.filter(d => d.is_correct).length;
  return {
    accuracy: Math.round((correct / data.length) * 100),
    total: data.length,
  };
}

/**
 * Format grammar feature names for display
 */
function formatFeatureName(feature: string): string {
  const featureNames: Record<string, string> = {
    'part_of_speech': 'Parts of Speech',
    'grammatical_case': 'Grammatical Cases',
    'verb_form': 'Verb Forms',
    'verb_tense': 'Verb Tenses',
    'verb_voice': 'Active/Passive Voice',
    'gender': 'Gender',
    'number': 'Singular/Plural',
    'root': 'Root Letters',
  };
  return featureNames[feature] || feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Build a context string for the AI system prompt
 */
export function buildContextPrompt(context: LearnerContext): string {
  const sections: string[] = [];

  // Last lesson context
  if (context.lastLesson) {
    const { surahName, topicDiscussed, continuityNotes, endedAt } = context.lastLesson;
    const lastSessionInfo: string[] = [];

    if (surahName) lastSessionInfo.push(`Last studied: ${surahName}`);
    if (topicDiscussed) lastSessionInfo.push(`Topic: ${topicDiscussed}`);
    if (continuityNotes) lastSessionInfo.push(`Notes: ${continuityNotes}`);

    if (lastSessionInfo.length > 0) {
      sections.push(`PREVIOUS SESSION:\n${lastSessionInfo.join('\n')}`);
    }
  }

  // Learner struggles (most important for adaptation)
  if (context.facts.struggles.length > 0) {
    const struggles = context.facts.struggles
      .slice(0, 5)
      .map(f => {
        let line = `- ${f.fact_text}`;
        if (f.arabic_examples && f.arabic_examples.length > 0) {
          line += ` (e.g., ${f.arabic_examples.slice(0, 2).join(', ')})`;
        }
        return line;
      })
      .join('\n');
    sections.push(`LEARNER STRUGGLES (address carefully):\n${struggles}`);
  }

  // Learner strengths
  if (context.facts.strengths.length > 0) {
    const strengths = context.facts.strengths
      .slice(0, 3)
      .map(f => `- ${f.fact_text}`)
      .join('\n');
    sections.push(`LEARNER STRENGTHS (can build on):\n${strengths}`);
  }

  // Interests
  if (context.facts.interests.length > 0) {
    const interests = context.facts.interests
      .slice(0, 3)
      .map(f => `- ${f.fact_text}`)
      .join('\n');
    sections.push(`LEARNER INTERESTS:\n${interests}`);
  }

  // Pattern summary
  if (context.patterns.grammarAccuracy > 0 || context.patterns.translationAccuracy > 0) {
    const patternInfo: string[] = [];

    if (context.patterns.grammarAccuracy > 0) {
      patternInfo.push(`Grammar accuracy: ${context.patterns.grammarAccuracy}%`);
    }
    if (context.patterns.translationAccuracy > 0) {
      patternInfo.push(`Vocabulary accuracy: ${context.patterns.translationAccuracy}%`);
    }

    if (context.patterns.weakestGrammarFeatures.length > 0) {
      const weak = context.patterns.weakestGrammarFeatures
        .map(f => `${f.feature} (${f.accuracy}%)`)
        .join(', ');
      patternInfo.push(`Weak areas: ${weak}`);
    }

    if (context.patterns.frequentMistakes.length > 0) {
      const mistakes = context.patterns.frequentMistakes
        .slice(0, 3)
        .map(m => `"${m.student}" → "${m.correct}"`)
        .join(', ');
      patternInfo.push(`Common confusions: ${mistakes}`);
    }

    sections.push(`PERFORMANCE PATTERNS:\n${patternInfo.join('\n')}`);
  }

  if (sections.length === 0) {
    return 'NEW LEARNER: No previous history. Start with basics and gauge their level.';
  }

  return sections.join('\n\n');
}
