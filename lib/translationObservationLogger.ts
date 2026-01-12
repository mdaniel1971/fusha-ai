import { supabase } from './supabase';

// Translation observation - tracks student answers on word translations
export interface TranslationObservation {
  session_id: string;
  user_id?: string;
  word_id?: number;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
}

// Regex to extract translation observations from Claude's response
// Format: [TRANS:word_id|student_answer|correct_answer|correct/incorrect]
// Example: [TRANS:42|mercy|The Most Merciful|incorrect]
const TRANS_REGEX = /\[TRANS:(\d+)\|([^|]+)\|([^|]+)\|(correct|incorrect)\]/g;

// Parse translation observation tags from Claude's response
export function parseTranslationObservations(
  text: string,
  sessionId: string,
  userId?: string
): {
  observations: TranslationObservation[];
  cleanedText: string;
} {
  const observations: TranslationObservation[] = [];
  let match;

  // Reset regex state
  TRANS_REGEX.lastIndex = 0;

  while ((match = TRANS_REGEX.exec(text)) !== null) {
    const [, wordId, studentAnswer, correctAnswer, result] = match;

    observations.push({
      session_id: sessionId,
      user_id: userId,
      word_id: parseInt(wordId, 10),
      student_answer: studentAnswer.trim(),
      correct_answer: correctAnswer.trim(),
      is_correct: result === 'correct',
    });
  }

  // Remove all TRANS tags from the text
  const cleanedText = text.replace(TRANS_REGEX, '').trim();

  return { observations, cleanedText };
}

// Log multiple translation observations to the database
export async function logTranslationObservations(
  observations: TranslationObservation[]
): Promise<{ success: boolean; logged: number; errors: string[] }> {
  if (observations.length === 0) {
    return { success: true, logged: 0, errors: [] };
  }

  const errors: string[] = [];
  let logged = 0;

  try {
    const { error, data } = await supabase
      .from('translation_observations')
      .insert(observations)
      .select();

    if (error) {
      console.error('Failed to log translation observations:', error);
      errors.push(error.message);
    } else {
      logged = data?.length || observations.length;
    }
  } catch (err) {
    console.error('Error logging translation observations:', err);
    errors.push(String(err));
  }

  return {
    success: errors.length === 0,
    logged,
    errors,
  };
}

// Get translation accuracy stats
export async function getTranslationStats(
  sessionId?: string,
  userId?: string
): Promise<{ total: number; correct: number; accuracy: number }> {
  let query = supabase
    .from('translation_observations')
    .select('is_correct');

  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }
  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Failed to fetch translation stats:', error);
    return { total: 0, correct: 0, accuracy: 0 };
  }

  const total = data.length;
  const correct = data.filter(d => d.is_correct).length;
  const accuracy = total > 0 ? (correct / total) * 100 : 0;

  return { total, correct, accuracy };
}

// Get words that were translated incorrectly (for review)
export async function getMistakenTranslationWordIds(
  sessionId?: string,
  userId?: string
): Promise<number[]> {
  let query = supabase
    .from('translation_observations')
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
    console.error('Failed to fetch mistaken translation words:', error);
    return [];
  }

  return Array.from(new Set(data.map(d => d.word_id).filter(Boolean))) as number[];
}
