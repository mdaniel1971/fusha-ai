import { supabase } from './supabase';

// Types for the vocabulary system
export interface QuranWord {
  id: number;
  surah_id: number;
  surah_part: number;
  word_arabic: string;
  word_english: string;
  word_type: string;
}

export interface SupportingWord {
  id: number;
  word_arabic: string;
  word_english: string;
  word_type: string;
  exercise_name: string;
  exercise_order: number;
}

export interface SurahPart {
  surah_id: number;
  surah_part: number;
}

export interface ExerciseInfo {
  exercise_name: string;
  exercise_order: number;
}

export interface VocabWord {
  arabic: string;
  english: string;
  word_type: string;
  source: 'quran' | 'supporting';
}

// Get all available surah parts for selection UI
export async function getAvailableSurahParts(): Promise<SurahPart[]> {
  const { data, error } = await supabase
    .from('quran_words')
    .select('surah_id, surah_part')
    .order('surah_id', { ascending: true })
    .order('surah_part', { ascending: true });

  if (error) {
    console.error('Error fetching surah parts:', error);
    return [];
  }

  // Get distinct combinations
  const seen = new Set<string>();
  const distinct: SurahPart[] = [];

  for (const row of data || []) {
    const key = `${row.surah_id}-${row.surah_part}`;
    if (!seen.has(key)) {
      seen.add(key);
      distinct.push({ surah_id: row.surah_id, surah_part: row.surah_part });
    }
  }

  return distinct;
}

// Get all available exercises for selection UI
export async function getAvailableExercises(): Promise<ExerciseInfo[]> {
  const { data, error } = await supabase
    .from('supporting_words')
    .select('exercise_name, exercise_order')
    .order('exercise_order', { ascending: true });

  if (error) {
    console.error('Error fetching exercises:', error);
    return [];
  }

  // Get distinct exercises
  const seen = new Set<string>();
  const distinct: ExerciseInfo[] = [];

  for (const row of data || []) {
    if (!seen.has(row.exercise_name)) {
      seen.add(row.exercise_name);
      distinct.push({ exercise_name: row.exercise_name, exercise_order: row.exercise_order });
    }
  }

  return distinct;
}

// Get words for FLASHCARDS - NEW words only (current exercise's supporting words)
export async function getFlashcardWords(
  surahParts: SurahPart[],
  exerciseName: string
): Promise<VocabWord[]> {
  const words: VocabWord[] = [];

  // 1. Get Quran words from selected surah parts
  if (surahParts.length > 0) {
    // Build OR conditions for surah_id AND surah_part pairs
    const conditions = surahParts.map(sp =>
      `and(surah_id.eq.${sp.surah_id},surah_part.eq.${sp.surah_part})`
    ).join(',');

    const { data: quranWords, error: quranError } = await supabase
      .from('quran_words')
      .select('word_arabic, word_english, word_type')
      .or(conditions);

    if (quranError) {
      console.error('Error fetching quran words:', quranError);
    } else if (quranWords) {
      for (const word of quranWords) {
        words.push({
          arabic: word.word_arabic,
          english: word.word_english,
          word_type: word.word_type || 'unknown',
          source: 'quran',
        });
      }
    }
  }

  // 2. Get supporting words for THIS exercise ONLY (for flashcards)
  const { data: supportingWords, error: supportingError } = await supabase
    .from('supporting_words')
    .select('word_arabic, word_english, word_type')
    .eq('exercise_name', exerciseName);

  if (supportingError) {
    console.error('Error fetching supporting words:', supportingError);
  } else if (supportingWords) {
    for (const word of supportingWords) {
      words.push({
        arabic: word.word_arabic,
        english: word.word_english,
        word_type: word.word_type || 'unknown',
        source: 'supporting',
      });
    }
  }

  // Deduplicate by Arabic text
  const seen = new Set<string>();
  const unique: VocabWord[] = [];
  for (const word of words) {
    if (!seen.has(word.arabic)) {
      seen.add(word.arabic);
      unique.push(word);
    }
  }

  return unique;
}

// Get words for CLAUDE - CUMULATIVE (all supporting words up to and including current exercise)
export async function getClaudeWordPool(
  surahParts: SurahPart[],
  exerciseOrder: number
): Promise<VocabWord[]> {
  const words: VocabWord[] = [];

  // 1. Get Quran words from selected surah parts
  if (surahParts.length > 0) {
    // Build OR conditions for surah_id AND surah_part pairs
    const conditions = surahParts.map(sp =>
      `and(surah_id.eq.${sp.surah_id},surah_part.eq.${sp.surah_part})`
    ).join(',');

    const { data: quranWords, error: quranError } = await supabase
      .from('quran_words')
      .select('word_arabic, word_english, word_type')
      .or(conditions);

    if (quranError) {
      console.error('Error fetching quran words:', quranError);
    } else if (quranWords) {
      for (const word of quranWords) {
        words.push({
          arabic: word.word_arabic,
          english: word.word_english,
          word_type: word.word_type || 'unknown',
          source: 'quran',
        });
      }
    }
  }

  // 2. Get ALL supporting words from exercises 1 through current (CUMULATIVE)
  const { data: supportingWords, error: supportingError } = await supabase
    .from('supporting_words')
    .select('word_arabic, word_english, word_type')
    .lte('exercise_order', exerciseOrder);

  if (supportingError) {
    console.error('Error fetching supporting words:', supportingError);
  } else if (supportingWords) {
    for (const word of supportingWords) {
      words.push({
        arabic: word.word_arabic,
        english: word.word_english,
        word_type: word.word_type || 'unknown',
        source: 'supporting',
      });
    }
  }

  // Deduplicate by Arabic text
  const seen = new Set<string>();
  const unique: VocabWord[] = [];
  for (const word of words) {
    if (!seen.has(word.arabic)) {
      seen.add(word.arabic);
      unique.push(word);
    }
  }

  return unique;
}

// Get exercise order by name
export async function getExerciseOrder(exerciseName: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('supporting_words')
    .select('exercise_order')
    .eq('exercise_name', exerciseName)
    .limit(1)
    .single();

  if (error || !data) {
    console.error('Error fetching exercise order:', error);
    return null;
  }

  return data.exercise_order;
}
