import { supabase } from './supabase';

// Grammar observation - tracks student answers on grammar questions
export interface GrammarObservation {
  session_id: string;
  user_id?: string;
  word_id?: number;
  grammar_feature: string;  // 'part_of_speech', 'case', 'verb_form', etc.
  student_answer: string;   // What the student said
  correct_answer: string;   // What it should be
  is_correct: boolean;      // Whether the answer was correct
}

// Grammar features we track
export const GRAMMAR_FEATURES = [
  'part_of_speech', // noun, verb, particle, adjective, etc.
  'grammatical_case', // nominative, accusative, genitive
  'verb_form',      // Form I, II, III, IV, V, VI, VII, VIII, IX, X
  'verb_tense',     // past, present
  'verb_voice',     // active, passive
  'gender',         // masculine, feminine
  'number',         // singular, dual, plural
] as const;

export type GrammarFeature = typeof GRAMMAR_FEATURES[number];

// Regex to extract grammar observations from Claude's response
// Format: [GRAM:word_id|feature|student_answer|correct_answer|correct/incorrect]
// Example: [GRAM:42|part_of_speech|verb|noun|incorrect]
const GRAM_REGEX = /\[GRAM:(\d+)\|([^|]+)\|([^|]+)\|([^|]+)\|(correct|incorrect)\]/g;

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
    const [, wordId, feature, studentAnswer, correctAnswer, result] = match;

    observations.push({
      session_id: sessionId,
      user_id: userId,
      word_id: parseInt(wordId, 10),
      grammar_feature: feature.trim(),
      student_answer: studentAnswer.trim(),
      correct_answer: correctAnswer.trim(),
      is_correct: result === 'correct',
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

// Get mistake counts by grammar feature
export async function getMistakesByFeature(
  sessionId?: string,
  userId?: string
): Promise<{ feature: string; count: number }[]> {
  let query = supabase
    .from('grammar_observations')
    .select('grammar_feature');

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }
  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Failed to fetch mistakes by feature:', error);
    return [];
  }

  // Count by feature
  const counts = new Map<string, number>();
  for (const row of data) {
    counts.set(row.grammar_feature, (counts.get(row.grammar_feature) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([feature, count]) => ({ feature, count }))
    .sort((a, b) => b.count - a.count);
}

// Get commonly confused pairs (student_answer -> correct_answer)
export async function getConfusedPairs(
  userId?: string,
  limit = 10
): Promise<{ studentAnswer: string; correctAnswer: string; count: number }[]> {
  let query = supabase
    .from('grammar_observations')
    .select('student_answer, correct_answer');

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.limit(100);

  if (error || !data) {
    console.error('Failed to fetch confused pairs:', error);
    return [];
  }

  // Count pairs
  const counts = new Map<string, number>();
  for (const row of data) {
    const key = `${row.student_answer}|${row.correct_answer}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([key, count]) => {
      const [studentAnswer, correctAnswer] = key.split('|');
      return { studentAnswer, correctAnswer, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Get words that were answered incorrectly (for drill targeting)
export async function getMistakenWordIds(
  sessionId?: string,
  userId?: string
): Promise<number[]> {
  let query = supabase
    .from('grammar_observations')
    .select('word_id')
    .eq('is_correct', false)
    .not('word_id', 'is', null);

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }
  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Failed to fetch mistaken words:', error);
    return [];
  }

  return Array.from(new Set(data.map(d => d.word_id).filter(Boolean))) as number[];
}

// Get grammar accuracy stats
export async function getGrammarStats(
  sessionId?: string,
  userId?: string
): Promise<{ total: number; correct: number; accuracy: number }> {
  let query = supabase
    .from('grammar_observations')
    .select('is_correct');

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }
  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Failed to fetch grammar stats:', error);
    return { total: 0, correct: 0, accuracy: 0 };
  }

  const total = data.length;
  const correct = data.filter(d => d.is_correct).length;
  const accuracy = total > 0 ? (correct / total) * 100 : 0;

  return { total, correct, accuracy };
}
