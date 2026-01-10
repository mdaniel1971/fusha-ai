import { supabase } from './supabase';

// Types matching the database schema
export type PerformanceLevel = 'mastered' | 'emerging' | 'struggling';
export type ContextType = 'production' | 'correction_accepted' | 'correction_rejected';

export interface GrammarObservation {
  session_id: string;
  user_id?: string;
  word_id?: number;
  grammar_feature: string;
  grammar_value: string;
  performance_level: PerformanceLevel;
  context_type: ContextType;
  student_attempt?: string;
  correct_form?: string;
  error_type?: string;
}

// Grammar features we track (matching words table columns)
export const GRAMMAR_FEATURES = [
  'verb_form',      // Form I, II, III, IV, V, VI, VII, VIII, IX, X
  'person',         // first_person, second_person, third_person
  'number',         // singular, dual, plural
  'gender',         // masculine, feminine
  'grammatical_case', // nominative, accusative, genitive
  'verb_mood',      // indicative, subjunctive, jussive, imperative
  'verb_tense',     // past, present, future
  'verb_voice',     // active, passive
  'part_of_speech', // noun, verb, particle, adjective, etc.
] as const;

export type GrammarFeature = typeof GRAMMAR_FEATURES[number];

// Regex to extract grammar observations from Claude's response
// Format: [GRAM:feature|value|level|context|attempt|correct|error_type]
// Example: [GRAM:verb_tense|past|mastered|production|ذَهَبْتُ||]
const GRAM_REGEX = /\[GRAM:([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]*)\|([^|]*)\|([^\]]*)\]/g;

// Parse grammar observation tags from Claude's response
export function parseGrammarObservations(
  text: string,
  sessionId: string,
  userId?: string
): {
  observations: GrammarObservation[];
  cleanedText: string;
} {
  const observations: GrammarObservation[] = [];
  let match;

  // Reset regex state
  GRAM_REGEX.lastIndex = 0;

  while ((match = GRAM_REGEX.exec(text)) !== null) {
    const [, feature, value, level, context, attempt, correct, errorType] = match;

    // Validate performance level
    if (!['mastered', 'emerging', 'struggling'].includes(level)) {
      console.warn(`Invalid performance level: ${level}`);
      continue;
    }

    // Validate context type
    if (!['production', 'correction_accepted', 'correction_rejected', 'identification'].includes(context)) {
      console.warn(`Invalid context type: ${context}`);
      continue;
    }

    observations.push({
      session_id: sessionId,
      user_id: userId,
      grammar_feature: feature.trim(),
      grammar_value: value.trim(),
      performance_level: level as PerformanceLevel,
      context_type: context as ContextType,
      student_attempt: attempt?.trim() || undefined,
      correct_form: correct?.trim() || undefined,
      error_type: errorType?.trim() || undefined,
    });
  }

  // Remove all GRAM tags from the text
  const cleanedText = text.replace(GRAM_REGEX, '').trim();

  return { observations, cleanedText };
}

// Log multiple grammar observations to the database
export async function logGrammarObservations(
  observations: GrammarObservation[]
): Promise<{ success: boolean; logged: number; errors: string[] }> {
  if (observations.length === 0) {
    return { success: true, logged: 0, errors: [] };
  }

  const errors: string[] = [];
  let logged = 0;

  try {
    const { error, data } = await supabase
      .from('grammar_observations')
      .insert(observations)
      .select();

    if (error) {
      console.error('Failed to log grammar observations:', error);
      errors.push(error.message);
    } else {
      logged = data?.length || observations.length;
    }
  } catch (err) {
    console.error('Error logging grammar observations:', err);
    errors.push(String(err));
  }

  return {
    success: errors.length === 0,
    logged,
    errors,
  };
}

// Get struggling grammar features for a user
export async function getStrugglingFeatures(
  userId: string,
  limit = 10
): Promise<{ feature: string; value: string; count: number }[]> {
  const { data, error } = await supabase
    .from('grammar_observations')
    .select('grammar_feature, grammar_value')
    .eq('user_id', userId)
    .eq('performance_level', 'struggling')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) {
    console.error('Failed to fetch struggling features:', error);
    return [];
  }

  // Count occurrences of each feature+value combination
  const counts = new Map<string, number>();
  for (const row of data) {
    const key = `${row.grammar_feature}|${row.grammar_value}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  // Sort by count and return top results
  return Array.from(counts.entries())
    .map(([key, count]) => {
      const [feature, value] = key.split('|');
      return { feature, value, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Get mastered words for a user (to exclude from drills)
export async function getMasteredWordIds(userId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('grammar_observations')
    .select('word_id')
    .eq('user_id', userId)
    .eq('performance_level', 'mastered')
    .not('word_id', 'is', null);

  if (error || !data) {
    console.error('Failed to fetch mastered words:', error);
    return [];
  }

  return Array.from(new Set(data.map(d => d.word_id).filter(Boolean))) as number[];
}

// Get grammar feature statistics for a user
export async function getGrammarStats(userId: string): Promise<{
  feature: string;
  mastered: number;
  emerging: number;
  struggling: number;
}[]> {
  const { data, error } = await supabase
    .from('grammar_observations')
    .select('grammar_feature, performance_level')
    .eq('user_id', userId);

  if (error || !data) {
    console.error('Failed to fetch grammar stats:', error);
    return [];
  }

  // Group by feature and count performance levels
  const stats = new Map<string, { mastered: number; emerging: number; struggling: number }>();

  for (const row of data) {
    if (!stats.has(row.grammar_feature)) {
      stats.set(row.grammar_feature, { mastered: 0, emerging: 0, struggling: 0 });
    }
    const featureStats = stats.get(row.grammar_feature)!;
    featureStats[row.performance_level as PerformanceLevel]++;
  }

  return Array.from(stats.entries()).map(([feature, counts]) => ({
    feature,
    ...counts,
  }));
}
