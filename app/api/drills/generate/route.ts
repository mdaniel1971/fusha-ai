import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

// Drill types
export type DrillType = 'multiple_choice' | 'fill_in_blank' | 'case_selection';

export interface DrillOption {
  id: string;
  text: string;
  textArabic: string;
  isCorrect: boolean;
}

export interface Drill {
  id: string;
  grammarFeature: string;
  grammarValue: string;
  drillType: DrillType;
  question: string;
  questionArabic?: string;
  options: DrillOption[];
  correctAnswer: string;
  correctAnswerArabic: string;
  explanation: string;
  wordId?: number;
  transliteration?: string;
}

// Grammar feature to drill type mapping
const FEATURE_DRILL_TYPES: Record<string, DrillType[]> = {
  grammatical_case: ['case_selection', 'multiple_choice'],
  verb_tense: ['multiple_choice', 'fill_in_blank'],
  verb_form: ['multiple_choice'],
  person: ['multiple_choice', 'fill_in_blank'],
  number: ['multiple_choice'],
  gender: ['multiple_choice'],
  verb_mood: ['multiple_choice'],
  verb_voice: ['multiple_choice'],
  part_of_speech: ['multiple_choice'],
};

// Case ending explanations
const CASE_EXPLANATIONS: Record<string, string> = {
  nominative: 'Nominative case (marfu) is used for subjects and predicates. Marked with damma (ُ).',
  accusative: 'Accusative case (mansub) is used for objects and adverbs. Marked with fatha (َ).',
  genitive: 'Genitive case (majrur) is used after prepositions and in idafa constructions. Marked with kasra (ِ).',
};

// Generate case selection drill
function generateCaseSelectionDrill(
  word: any,
  targetCase: string,
  allWords: any[]
): Drill | null {
  // Find other words with different cases for distractors
  const otherCases = allWords
    .filter(w => w.grammatical_case && w.grammatical_case !== targetCase && w.id !== word.id)
    .slice(0, 2);

  if (otherCases.length < 2) return null;

  const options: DrillOption[] = [
    {
      id: 'correct',
      text: targetCase,
      textArabic: word.text_arabic,
      isCorrect: true,
    },
    ...otherCases.map((w, i) => ({
      id: `distractor_${i}`,
      text: w.grammatical_case,
      textArabic: w.text_arabic,
      isCorrect: false,
    })),
  ];

  // Shuffle options
  options.sort(() => Math.random() - 0.5);

  return {
    id: `case_${word.id}_${Date.now()}`,
    grammarFeature: 'grammatical_case',
    grammarValue: targetCase,
    drillType: 'case_selection',
    question: `What grammatical case is "${word.translation_english}"?`,
    questionArabic: word.text_arabic,
    options,
    correctAnswer: targetCase,
    correctAnswerArabic: word.text_arabic,
    explanation: CASE_EXPLANATIONS[targetCase] || `The correct case is ${targetCase}.`,
    wordId: word.id,
    transliteration: word.transliteration,
  };
}

// Generate multiple choice drill for any feature
function generateMultipleChoiceDrill(
  word: any,
  feature: string,
  value: string,
  allWords: any[]
): Drill | null {
  // Find distractors with different values for the same feature
  const distractors = allWords
    .filter(w => w[feature] && w[feature] !== value && w.id !== word.id)
    .slice(0, 3);

  if (distractors.length < 2) return null;

  // Get unique values for options
  const uniqueValues = new Set([value, ...distractors.map(d => d[feature])]);
  const valueArray = Array.from(uniqueValues).slice(0, 4);

  const options: DrillOption[] = valueArray.map((v, i) => ({
    id: `option_${i}`,
    text: formatFeatureValue(feature, v),
    textArabic: v === value ? word.text_arabic : (distractors.find(d => d[feature] === v)?.text_arabic || ''),
    isCorrect: v === value,
  }));

  // Shuffle options
  options.sort(() => Math.random() - 0.5);

  const questionTemplates: Record<string, string> = {
    verb_tense: `What tense is the verb "${word.translation_english}"?`,
    verb_form: `What verb form (wazn) is "${word.translation_english}"?`,
    person: `What person is the verb "${word.translation_english}"?`,
    number: `What number (singular/dual/plural) is "${word.translation_english}"?`,
    gender: `What gender is "${word.translation_english}"?`,
    verb_mood: `What mood is the verb "${word.translation_english}"?`,
    verb_voice: `What voice (active/passive) is "${word.translation_english}"?`,
    part_of_speech: `What part of speech is "${word.translation_english}"?`,
  };

  return {
    id: `mc_${feature}_${word.id}_${Date.now()}`,
    grammarFeature: feature,
    grammarValue: value,
    drillType: 'multiple_choice',
    question: questionTemplates[feature] || `Identify the ${feature} of this word:`,
    questionArabic: word.text_arabic,
    options,
    correctAnswer: formatFeatureValue(feature, value),
    correctAnswerArabic: word.text_arabic,
    explanation: getFeatureExplanation(feature, value),
    wordId: word.id,
    transliteration: word.transliteration,
  };
}

// Generate fill in the blank drill
function generateFillInBlankDrill(
  word: any,
  feature: string,
  value: string,
  relatedWords: any[]
): Drill | null {
  // Find a related word to create context
  const contextWord = relatedWords.find(w => w.id !== word.id);
  if (!contextWord) return null;

  const options: DrillOption[] = [
    {
      id: 'correct',
      text: word.translation_english,
      textArabic: word.text_arabic,
      isCorrect: true,
    },
  ];

  // Add distractors
  const distractors = relatedWords
    .filter(w => w.id !== word.id && w[feature] !== value)
    .slice(0, 3);

  distractors.forEach((d, i) => {
    options.push({
      id: `distractor_${i}`,
      text: d.translation_english,
      textArabic: d.text_arabic,
      isCorrect: false,
    });
  });

  if (options.length < 3) return null;

  options.sort(() => Math.random() - 0.5);

  return {
    id: `fib_${feature}_${word.id}_${Date.now()}`,
    grammarFeature: feature,
    grammarValue: value,
    drillType: 'fill_in_blank',
    question: `Fill in the blank with the correct ${formatFeatureValue(feature, value)} form:`,
    questionArabic: `_____ ${contextWord.text_arabic}`,
    options,
    correctAnswer: word.translation_english,
    correctAnswerArabic: word.text_arabic,
    explanation: `The correct answer is "${word.text_arabic}" (${word.transliteration}) because it is ${formatFeatureValue(feature, value)}.`,
    wordId: word.id,
    transliteration: word.transliteration,
  };
}

// Format feature values for display
function formatFeatureValue(feature: string, value: string): string {
  const formatters: Record<string, Record<string, string>> = {
    verb_tense: { past: 'Past Tense', present: 'Present Tense', future: 'Future Tense' },
    person: { first_person: 'First Person', second_person: 'Second Person', third_person: 'Third Person' },
    number: { singular: 'Singular', dual: 'Dual', plural: 'Plural' },
    gender: { masculine: 'Masculine', feminine: 'Feminine' },
    grammatical_case: { nominative: 'Nominative (Marfu)', accusative: 'Accusative (Mansub)', genitive: 'Genitive (Majrur)' },
    verb_mood: { indicative: 'Indicative', subjunctive: 'Subjunctive', jussive: 'Jussive', imperative: 'Imperative' },
    verb_voice: { active: 'Active Voice', passive: 'Passive Voice' },
  };

  return formatters[feature]?.[value] || value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Get explanation for a feature value
function getFeatureExplanation(feature: string, value: string): string {
  const explanations: Record<string, Record<string, string>> = {
    grammatical_case: CASE_EXPLANATIONS,
    verb_tense: {
      past: 'Past tense (al-madi) describes completed actions.',
      present: 'Present tense (al-mudari) describes ongoing or habitual actions.',
      future: 'Future tense is formed by adding "sa-" or "sawfa" before present tense.',
    },
    verb_form: {
      Form_I: 'Form I (fa\'ala) is the basic verb form.',
      Form_II: 'Form II (fa\'\'ala) often indicates intensification or causation.',
      Form_III: 'Form III (faa\'ala) often indicates reciprocal action.',
      Form_IV: 'Form IV (af\'ala) often indicates causation.',
      Form_V: 'Form V (tafa\'\'ala) is often reflexive of Form II.',
      Form_VI: 'Form VI (tafaa\'ala) indicates mutual or pretended action.',
      Form_VII: 'Form VII (infa\'ala) often indicates a passive-like meaning.',
      Form_VIII: 'Form VIII (ifta\'ala) often indicates reflexive action.',
      Form_X: 'Form X (istaf\'ala) often indicates seeking or considering.',
    },
    person: {
      first_person: 'First person refers to the speaker (I/we).',
      second_person: 'Second person refers to the addressee (you).',
      third_person: 'Third person refers to someone/something else (he/she/they).',
    },
  };

  return explanations[feature]?.[value] || `This word demonstrates ${formatFeatureValue(feature, value)}.`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '5');
    const feature = searchParams.get('feature'); // Optional: target specific feature

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get struggling grammar features for this user
    const { data: observations, error: obsError } = await supabase
      .from('grammar_observations')
      .select('grammar_feature, grammar_value, word_id')
      .eq('user_id', userId)
      .eq('performance_level', 'struggling')
      .order('created_at', { ascending: false })
      .limit(50);

    if (obsError) {
      console.error('Failed to fetch observations:', obsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user data' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Count feature+value combinations to prioritize
    const featureCounts = new Map<string, { count: number; wordIds: number[] }>();
    for (const obs of observations || []) {
      const key = `${obs.grammar_feature}|${obs.grammar_value}`;
      const existing = featureCounts.get(key) || { count: 0, wordIds: [] };
      existing.count++;
      if (obs.word_id) existing.wordIds.push(obs.word_id);
      featureCounts.set(key, existing);
    }

    // Sort by count (most struggled with first)
    const sortedFeatures = Array.from(featureCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .filter(([key]) => !feature || key.startsWith(feature))
      .slice(0, limit);

    // Get mastered word IDs to exclude
    const { data: masteredData } = await supabase
      .from('grammar_observations')
      .select('word_id')
      .eq('user_id', userId)
      .eq('performance_level', 'mastered')
      .not('word_id', 'is', null);

    const masteredWordIds = new Set((masteredData || []).map(d => d.word_id));

    // Fetch words for drills
    const { data: allWords, error: wordsError } = await supabase
      .from('words')
      .select('id, text_arabic, transliteration, translation_english, part_of_speech, verb_form, person, number, gender, grammatical_case, verb_mood, verb_tense, verb_voice')
      .limit(500);

    if (wordsError || !allWords) {
      console.error('Failed to fetch words:', wordsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch words' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Filter out mastered words
    const availableWords = allWords.filter(w => !masteredWordIds.has(w.id));

    // Generate drills
    const drills: Drill[] = [];

    for (const [key] of sortedFeatures) {
      if (drills.length >= limit) break;

      const [grammarFeature, grammarValue] = key.split('|');

      // Find words matching this feature+value
      const matchingWords = availableWords.filter(
        w => w[grammarFeature as keyof typeof w] === grammarValue
      );

      if (matchingWords.length === 0) continue;

      // Pick a random word
      const word = matchingWords[Math.floor(Math.random() * matchingWords.length)];

      // Determine drill type
      const possibleTypes = FEATURE_DRILL_TYPES[grammarFeature] || ['multiple_choice'];
      const drillType = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];

      let drill: Drill | null = null;

      switch (drillType) {
        case 'case_selection':
          drill = generateCaseSelectionDrill(word, grammarValue, availableWords);
          break;
        case 'fill_in_blank':
          drill = generateFillInBlankDrill(word, grammarFeature, grammarValue, availableWords);
          break;
        case 'multiple_choice':
        default:
          drill = generateMultipleChoiceDrill(word, grammarFeature, grammarValue, availableWords);
          break;
      }

      if (drill) {
        drills.push(drill);
      }
    }

    // If no struggling features found, generate general drills
    if (drills.length === 0 && availableWords.length > 0) {
      // Generate some general drills from random words
      const shuffledWords = [...availableWords].sort(() => Math.random() - 0.5);

      for (const word of shuffledWords.slice(0, limit)) {
        // Find a feature this word has
        for (const feat of Object.keys(FEATURE_DRILL_TYPES)) {
          const value = word[feat as keyof typeof word];
          if (value && typeof value === 'string') {
            const drill = generateMultipleChoiceDrill(word, feat, value, availableWords);
            if (drill) {
              drills.push(drill);
              break;
            }
          }
        }
        if (drills.length >= limit) break;
      }
    }

    return new Response(
      JSON.stringify({
        drills,
        targetedFeatures: sortedFeatures.map(([key, data]) => ({
          feature: key.split('|')[0],
          value: key.split('|')[1],
          struggleCount: data.count,
        })),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Drill generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate drills' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST endpoint to record drill completion
export async function POST(request: NextRequest) {
  try {
    const { sessionId, userId, wordId, grammarFeature, grammarValue, isCorrect, userAnswer } = await request.json();

    if (!sessionId || !userId || !grammarFeature || !grammarValue) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log the drill result as a grammar observation
    const { error } = await supabase
      .from('grammar_observations')
      .insert({
        session_id: sessionId,
        user_id: userId,
        word_id: wordId || null,
        grammar_feature: grammarFeature,
        grammar_value: grammarValue,
        performance_level: isCorrect ? 'mastered' : 'struggling',
        context_type: 'production',
        student_attempt: userAnswer || null,
      });

    if (error) {
      console.error('Failed to log drill result:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to record result' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Drill completion error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
