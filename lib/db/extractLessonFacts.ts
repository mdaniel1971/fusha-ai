import { supabase } from '../supabase';
import type {
  LearnerFact,
  LearnerFactInsert,
  GrammarObservation,
  TranslationObservation,
  ExtractedFact,
  LessonAnalysis,
  FactType,
} from './types';

/**
 * Analyzes a completed lesson and extracts/updates learner facts.
 * This is the "memory extraction" system that synthesizes observations into insights.
 * @param lessonId - The lesson/session ID (used to find observations)
 * @param providedUserId - Optional user ID (if not provided, will be fetched from lesson)
 */
export async function extractLessonFacts(
  lessonId: string,
  providedUserId?: string
): Promise<LessonAnalysis | null> {
  let userId = providedUserId;

  // If no userId provided, try to get it from the lesson
  if (!userId) {
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('id, user_id')
      .eq('id', lessonId)
      .single();

    if (lesson) {
      userId = lesson.user_id;
    } else {
      console.log('Lesson not found, trying to get userId from observations');
      // Try to get userId from observations instead
      const { data: obs } = await supabase
        .from('grammar_observations')
        .select('user_id')
        .eq('session_id', lessonId)
        .not('user_id', 'is', null)
        .limit(1)
        .single();

      if (obs?.user_id) {
        userId = obs.user_id;
      } else {
        // Try translation observations
        const { data: transObs } = await supabase
          .from('translation_observations')
          .select('user_id')
          .eq('session_id', lessonId)
          .not('user_id', 'is', null)
          .limit(1)
          .single();

        if (transObs?.user_id) {
          userId = transObs.user_id;
        }
      }
    }
  }

  if (!userId) {
    console.error('Could not determine userId for lesson:', lessonId);
    return null;
  }

  // Fetch all observations from this lesson
  const [grammarObs, translationObs] = await Promise.all([
    fetchLessonGrammarObservations(lessonId),
    fetchLessonTranslationObservations(lessonId),
  ]);

  if (grammarObs.length === 0 && translationObs.length === 0) {
    console.log('No observations found for lesson:', lessonId);
    return {
      lessonId,
      userId,
      grammarObservations: [],
      translationObservations: [],
      extractedFacts: [],
      performanceSummary: 'No observations recorded.',
    };
  }

  // Analyze observations and extract facts
  const extractedFacts: ExtractedFact[] = [];

  // Analyze grammar patterns
  const grammarFacts = analyzeGrammarObservations(grammarObs);
  extractedFacts.push(...grammarFacts);

  // Analyze translation patterns
  const translationFacts = analyzeTranslationObservations(translationObs);
  extractedFacts.push(...translationFacts);

  // Save facts to database (create new or update existing)
  const savedFacts = await saveFacts(userId, lessonId, extractedFacts);

  // Generate performance summary
  const performanceSummary = generatePerformanceSummary(grammarObs, translationObs);

  // Update the lesson with performance summary
  await supabase
    .from('lessons')
    .update({
      performance_summary: performanceSummary,
      ended_at: new Date().toISOString(),
    })
    .eq('id', lessonId);

  return {
    lessonId,
    userId,
    grammarObservations: grammarObs,
    translationObservations: translationObs,
    extractedFacts: savedFacts,
    performanceSummary,
  };
}

/**
 * Fetch grammar observations for a specific lesson
 */
async function fetchLessonGrammarObservations(lessonId: string): Promise<GrammarObservation[]> {
  const { data, error } = await supabase
    .from('grammar_observations')
    .select('*')
    .eq('session_id', lessonId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching grammar observations:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch translation observations for a specific lesson
 */
async function fetchLessonTranslationObservations(lessonId: string): Promise<TranslationObservation[]> {
  const { data, error } = await supabase
    .from('translation_observations')
    .select('*')
    .eq('session_id', lessonId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching translation observations:', error);
    return [];
  }

  return data || [];
}

/**
 * Analyze grammar observations and extract facts
 */
function analyzeGrammarObservations(observations: GrammarObservation[]): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  if (observations.length === 0) return facts;

  // Group by feature
  const byFeature = new Map<string, { correct: number; incorrect: number; examples: string[] }>();

  for (const obs of observations) {
    if (!byFeature.has(obs.grammar_feature)) {
      byFeature.set(obs.grammar_feature, { correct: 0, incorrect: 0, examples: [] });
    }
    const data = byFeature.get(obs.grammar_feature)!;

    if (obs.is_correct) {
      data.correct++;
    } else {
      data.incorrect++;
      // Store example mistakes
      if (data.examples.length < 3) {
        data.examples.push(`${obs.student_answer} → ${obs.correct_answer}`);
      }
    }
  }

  // Extract facts based on patterns
  console.log('Analyzing grammar observations by feature:', Object.fromEntries(byFeature));

  for (const [feature, data] of byFeature) {
    const total = data.correct + data.incorrect;
    const accuracy = (data.correct / total) * 100;
    const featureName = formatFeatureName(feature);

    console.log(`Feature ${feature}: ${data.correct}/${total} correct (${accuracy.toFixed(0)}%)`);

    // Struggle: accuracy < 60% with at least 1 observation
    if (accuracy < 60 && total >= 1 && data.incorrect > 0) {
      facts.push({
        factType: 'struggle',
        factText: `Struggles with ${featureName}`,
        category: 'grammar',
        arabicExamples: data.examples,
        isNew: true,  // Will be determined when saving
      });
    }

    // Strength: accuracy >= 75% with at least 2 observations
    if (accuracy >= 75 && total >= 2) {
      facts.push({
        factType: 'strength',
        factText: `Strong understanding of ${featureName}`,
        category: 'grammar',
        arabicExamples: [],
        isNew: true,
      });
    }
  }

  // Look for specific confusion patterns
  const confusions = new Map<string, number>();
  for (const obs of observations) {
    if (!obs.is_correct) {
      const key = `${obs.student_answer}|${obs.correct_answer}`;
      confusions.set(key, (confusions.get(key) || 0) + 1);
    }
  }

  // Add recurring confusions as struggles
  for (const [key, count] of confusions) {
    if (count >= 2) {
      const [student, correct] = key.split('|');
      facts.push({
        factType: 'struggle',
        factText: `Confuses "${student}" with "${correct}"`,
        category: 'grammar',
        arabicExamples: [],
        isNew: true,
      });
    }
  }

  return facts;
}

/**
 * Analyze translation observations and extract facts
 */
function analyzeTranslationObservations(observations: TranslationObservation[]): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  if (observations.length === 0) return facts;

  const correct = observations.filter(o => o.is_correct).length;
  const incorrect = observations.filter(o => !o.is_correct).length;
  const total = observations.length;
  const accuracy = (correct / total) * 100;

  console.log(`Translation observations: ${correct}/${total} correct (${accuracy.toFixed(0)}%)`);

  // Overall vocabulary assessment - lowered thresholds for testing
  if (accuracy < 60 && total >= 1 && incorrect > 0) {
    facts.push({
      factType: 'struggle',
      factText: 'Needs more vocabulary practice',
      category: 'vocabulary',
      arabicExamples: [],
      isNew: true,
    });
  } else if (accuracy >= 75 && total >= 2) {
    facts.push({
      factType: 'strength',
      factText: 'Good vocabulary retention',
      category: 'vocabulary',
      arabicExamples: [],
      isNew: true,
    });
  }

  // Track specific words that were missed
  const missedWords = new Map<string, { arabic: string; count: number }>();
  for (const obs of observations) {
    if (!obs.is_correct && obs.correct_answer) {
      const key = obs.correct_answer;
      if (!missedWords.has(key)) {
        missedWords.set(key, { arabic: obs.correct_answer, count: 0 });
      }
      missedWords.get(key)!.count++;
    }
  }

  // Add specific word struggles - lowered from 2 to 1 for testing
  const frequentlyMissed = Array.from(missedWords.values())
    .filter(w => w.count >= 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  if (frequentlyMissed.length > 0) {
    facts.push({
      factType: 'struggle',
      factText: `Repeatedly misses these words: ${frequentlyMissed.map(w => w.arabic).join(', ')}`,
      category: 'vocabulary',
      arabicExamples: frequentlyMissed.map(w => w.arabic),
      isNew: true,
    });
  }

  return facts;
}

/**
 * Save extracted facts to database (create or update)
 */
async function saveFacts(
  userId: string,
  lessonId: string,
  extractedFacts: ExtractedFact[]
): Promise<ExtractedFact[]> {
  const savedFacts: ExtractedFact[] = [];

  for (const fact of extractedFacts) {
    // Check if a similar fact already exists
    const { data: existing } = await supabase
      .from('learner_facts')
      .select('*')
      .eq('user_id', userId)
      .eq('fact_type', fact.factType)
      .eq('category', fact.category)
      .ilike('fact_text', `%${fact.factText.slice(0, 30)}%`)
      .eq('is_active', true)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing fact
      const existingFact = existing[0] as LearnerFact;

      // Merge Arabic examples
      const mergedExamples = [
        ...new Set([
          ...(existingFact.arabic_examples || []),
          ...fact.arabicExamples,
        ]),
      ].slice(0, 5);

      const updateData: Record<string, unknown> = {
        observation_count: existingFact.observation_count + 1,
        last_confirmed: new Date().toISOString(),
        arabic_examples: mergedExamples,
        source_lesson_id: lessonId,
      };

      // If it's a strength, also increment success_count
      if (fact.factType === 'strength') {
        updateData.success_count = existingFact.success_count + 1;
      }

      await supabase
        .from('learner_facts')
        .update(updateData)
        .eq('id', existingFact.id);

      savedFacts.push({ ...fact, isNew: false });
    } else {
      // Create new fact
      const insertData: LearnerFactInsert = {
        user_id: userId,
        fact_type: fact.factType,
        fact_text: fact.factText,
        category: fact.category,
        arabic_examples: fact.arabicExamples,
        source_lesson_id: lessonId,
        observation_count: 1,
        success_count: fact.factType === 'strength' ? 1 : 0,
        is_active: true,
      };

      const { error } = await supabase.from('learner_facts').insert(insertData);

      if (error) {
        console.error('Error inserting fact:', error);
      } else {
        savedFacts.push({ ...fact, isNew: true });
      }
    }
  }

  return savedFacts;
}

/**
 * Generate a performance summary for the lesson
 */
function generatePerformanceSummary(
  grammarObs: GrammarObservation[],
  translationObs: TranslationObservation[]
): string {
  const parts: string[] = [];

  if (grammarObs.length > 0) {
    const correct = grammarObs.filter(o => o.is_correct).length;
    const accuracy = Math.round((correct / grammarObs.length) * 100);
    parts.push(`Grammar: ${correct}/${grammarObs.length} (${accuracy}%)`);
  }

  if (translationObs.length > 0) {
    const correct = translationObs.filter(o => o.is_correct).length;
    const accuracy = Math.round((correct / translationObs.length) * 100);
    parts.push(`Vocabulary: ${correct}/${translationObs.length} (${accuracy}%)`);
  }

  if (parts.length === 0) {
    return 'No questions answered.';
  }

  const total = grammarObs.length + translationObs.length;
  const totalCorrect = grammarObs.filter(o => o.is_correct).length +
                       translationObs.filter(o => o.is_correct).length;
  const overallAccuracy = Math.round((totalCorrect / total) * 100);

  parts.push(`Overall: ${overallAccuracy}%`);

  return parts.join(' | ');
}

/**
 * Mark old facts as inactive if the learner has improved
 * Call this periodically or when a strength contradicts a struggle
 */
export async function reconcileFacts(userId: string): Promise<void> {
  // Get all active struggles
  const { data: struggles } = await supabase
    .from('learner_facts')
    .select('*')
    .eq('user_id', userId)
    .eq('fact_type', 'struggle')
    .eq('is_active', true);

  // Get all active strengths
  const { data: strengths } = await supabase
    .from('learner_facts')
    .select('*')
    .eq('user_id', userId)
    .eq('fact_type', 'strength')
    .eq('is_active', true);

  if (!struggles || !strengths) return;

  // Find contradictions (same category topic)
  for (const struggle of struggles) {
    for (const strength of strengths) {
      if (
        struggle.category === strength.category &&
        strength.last_confirmed > struggle.last_confirmed &&
        strength.observation_count >= struggle.observation_count
      ) {
        // Learner has improved - deactivate the struggle
        await supabase
          .from('learner_facts')
          .update({ is_active: false })
          .eq('id', struggle.id);

        console.log(`Deactivated struggle "${struggle.fact_text}" - learner improved`);
      }
    }
  }
}

/**
 * Format grammar feature names for display
 */
function formatFeatureName(feature: string): string {
  const featureNames: Record<string, string> = {
    'part_of_speech': 'parts of speech',
    'grammatical_case': 'grammatical cases',
    'verb_form': 'verb forms',
    'verb_tense': 'verb tenses',
    'verb_voice': 'active/passive voice',
    'gender': 'gender agreement',
    'number': 'singular/plural',
    'root': 'root identification',
  };
  return featureNames[feature] || feature.replace(/_/g, ' ');
}
