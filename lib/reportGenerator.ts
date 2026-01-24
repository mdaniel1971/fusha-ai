import { supabase } from './supabase';

// Report interfaces
export interface WordMistake {
  word_id: number;
  arabic_text?: string;
  student_answer: string;
  correct_answer: string;
  count: number;
}

export interface GrammarBreakdown {
  feature: string;
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  mistakes: { student: string; correct: string; count: number }[];
}

export interface TranslationBreakdown {
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  strugglingWords: WordMistake[];
  masteredWords: { word_id: number; arabic_text?: string; correct_answer: string; count: number }[];
}

export interface SessionSummary {
  timeSpent: number;
  totalInteractions: number;
  overallScore: number;
  grammarAccuracy: number;
  translationAccuracy: number;
}

export interface LearningReport {
  sessionSummary: SessionSummary;
  grammarBreakdown: GrammarBreakdown[];
  translationBreakdown: TranslationBreakdown;
  topStrengths: string[];
  topWeaknesses: string[];
  generatedAt: Date;
}

// For backwards compatibility with component
export interface SkillBreakdown {
  category: string;
  skills: { name: string; frequency: number; examples: string[] }[];
}

export interface PatternInsight {
  pattern: string;
  frequency: number;
  impact: 'high' | 'medium' | 'low';
  explanation: string;
}

export interface Breakthrough {
  moment: string;
  timestamp: Date;
  context: string;
}

export interface StudyRecommendation {
  priority: number;
  skillArea: string;
  specificFocus: string;
  practicePrompt: string;
  estimatedTime: string;
}

// Fetch grammar observations for a session
async function fetchGrammarObservations(sessionId: string) {
  const { data, error } = await supabase
    .from('grammar_observations')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching grammar observations:', error);
    return [];
  }
  return data || [];
}

// Fetch translation observations for a session
async function fetchTranslationObservations(sessionId: string) {
  const { data, error } = await supabase
    .from('translation_observations')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching translation observations:', error);
    return [];
  }
  return data || [];
}

// Fetch word details by IDs
async function fetchWordDetails(wordIds: number[]) {
  if (wordIds.length === 0) return new Map<number, { arabic: string; english: string }>();

  const { data, error } = await supabase
    .from('words')
    .select('id, text_arabic, translation_english')
    .in('id', wordIds);

  if (error) {
    console.error('Error fetching word details:', error);
    return new Map<number, { arabic: string; english: string }>();
  }

  const wordMap = new Map<number, { arabic: string; english: string }>();
  for (const word of data || []) {
    wordMap.set(word.id, { arabic: word.text_arabic, english: word.translation_english });
  }
  return wordMap;
}

// Fetch session details
async function fetchSessionDetails(sessionId: string) {
  const { data, error } = await supabase
    .from('sessions')
    .select('started_at, ended_at')
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    return { startedAt: null, endedAt: null };
  }

  return {
    startedAt: data.started_at ? new Date(data.started_at) : null,
    endedAt: data.ended_at ? new Date(data.ended_at) : null,
  };
}

// Format grammar feature names for display
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

// Main report generation function
export async function generateReport(sessionId: string): Promise<LearningReport | null> {
  try {
    // Fetch all data in parallel
    const [grammarObs, translationObs, sessionDetails] = await Promise.all([
      fetchGrammarObservations(sessionId),
      fetchTranslationObservations(sessionId),
      fetchSessionDetails(sessionId),
    ]);

    // Calculate time spent
    let timeSpent = 0;
    if (sessionDetails.startedAt) {
      const endTime = sessionDetails.endedAt || new Date();
      timeSpent = Math.round((endTime.getTime() - sessionDetails.startedAt.getTime()) / 60000);
    }

    const totalInteractions = grammarObs.length + translationObs.length;

    // === GRAMMAR BREAKDOWN ===
    const grammarByFeature = new Map<string, {
      total: number;
      correct: number;
      mistakes: Map<string, { student: string; correct: string; count: number }>;
    }>();

    for (const obs of grammarObs) {
      const feature = obs.grammar_feature;
      if (!grammarByFeature.has(feature)) {
        grammarByFeature.set(feature, { total: 0, correct: 0, mistakes: new Map() });
      }
      const data = grammarByFeature.get(feature)!;
      data.total++;
      if (obs.is_correct) {
        data.correct++;
      } else {
        const key = `${obs.student_answer}→${obs.correct_answer}`;
        const existing = data.mistakes.get(key);
        if (existing) {
          existing.count++;
        } else {
          data.mistakes.set(key, { student: obs.student_answer, correct: obs.correct_answer, count: 1 });
        }
      }
    }

    const grammarBreakdown: GrammarBreakdown[] = Array.from(grammarByFeature.entries())
      .map(([feature, data]) => ({
        feature: formatFeatureName(feature),
        total: data.total,
        correct: data.correct,
        incorrect: data.total - data.correct,
        accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
        mistakes: Array.from(data.mistakes.values()).sort((a, b) => b.count - a.count).slice(0, 5),
      }))
      .sort((a, b) => a.accuracy - b.accuracy); // Sort by accuracy (lowest first = needs work)

    // === TRANSLATION BREAKDOWN ===
    const translationCorrect = translationObs.filter(o => o.is_correct).length;
    const translationTotal = translationObs.length;

    // Get struggling words (incorrect translations)
    const wordMistakes = new Map<number, { student: string; correct: string; count: number }>();
    const wordSuccesses = new Map<number, { correct: string; count: number }>();

    for (const obs of translationObs) {
      const wordId = obs.word_id;
      if (!wordId) continue;

      if (obs.is_correct) {
        const existing = wordSuccesses.get(wordId);
        if (existing) {
          existing.count++;
        } else {
          wordSuccesses.set(wordId, { correct: obs.correct_answer, count: 1 });
        }
      } else {
        const existing = wordMistakes.get(wordId);
        if (existing) {
          existing.count++;
        } else {
          wordMistakes.set(wordId, { student: obs.student_answer, correct: obs.correct_answer, count: 1 });
        }
      }
    }

    // Fetch word details for display
    const allWordIds = [...new Set([...wordMistakes.keys(), ...wordSuccesses.keys()])];
    const wordDetails = await fetchWordDetails(allWordIds);

    const strugglingWords: WordMistake[] = Array.from(wordMistakes.entries())
      .map(([wordId, data]) => ({
        word_id: wordId,
        arabic_text: wordDetails.get(wordId)?.arabic,
        student_answer: data.student,
        correct_answer: data.correct,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const masteredWords = Array.from(wordSuccesses.entries())
      .filter(([wordId]) => !wordMistakes.has(wordId)) // Only words never gotten wrong
      .map(([wordId, data]) => ({
        word_id: wordId,
        arabic_text: wordDetails.get(wordId)?.arabic,
        correct_answer: data.correct,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const translationBreakdown: TranslationBreakdown = {
      total: translationTotal,
      correct: translationCorrect,
      incorrect: translationTotal - translationCorrect,
      accuracy: translationTotal > 0 ? Math.round((translationCorrect / translationTotal) * 100) : 0,
      strugglingWords,
      masteredWords,
    };

    // === CALCULATE OVERALL SCORE ===
    const grammarAccuracy = grammarObs.length > 0
      ? Math.round((grammarObs.filter(o => o.is_correct).length / grammarObs.length) * 100)
      : 0;
    const translationAccuracy = translationBreakdown.accuracy;

    // Weighted average: 50% grammar, 50% translation (if both exist)
    let overallScore = 50; // Default
    if (grammarObs.length > 0 && translationObs.length > 0) {
      overallScore = Math.round((grammarAccuracy + translationAccuracy) / 2);
    } else if (grammarObs.length > 0) {
      overallScore = grammarAccuracy;
    } else if (translationObs.length > 0) {
      overallScore = translationAccuracy;
    }

    // === TOP STRENGTHS & WEAKNESSES ===
    const topStrengths: string[] = [];
    const topWeaknesses: string[] = [];

    // Grammar strengths/weaknesses
    for (const gb of grammarBreakdown) {
      if (gb.accuracy >= 80 && gb.total >= 2) {
        topStrengths.push(`${gb.feature} (${gb.accuracy}% accuracy)`);
      } else if (gb.accuracy < 60 && gb.total >= 2) {
        topWeaknesses.push(`${gb.feature} (${gb.accuracy}% accuracy)`);
      }
    }

    // Translation strengths/weaknesses
    if (translationBreakdown.accuracy >= 80 && translationBreakdown.total >= 3) {
      topStrengths.push(`Vocabulary (${translationBreakdown.accuracy}% accuracy)`);
    } else if (translationBreakdown.accuracy < 60 && translationBreakdown.total >= 3) {
      topWeaknesses.push(`Vocabulary (${translationBreakdown.accuracy}% accuracy)`);
    }

    // Add specific struggling words to weaknesses
    for (const word of strugglingWords.slice(0, 3)) {
      if (word.arabic_text) {
        topWeaknesses.push(`Word: ${word.arabic_text} = "${word.correct_answer}"`);
      }
    }

    return {
      sessionSummary: {
        timeSpent,
        totalInteractions,
        overallScore,
        grammarAccuracy,
        translationAccuracy,
      },
      grammarBreakdown,
      translationBreakdown,
      topStrengths: topStrengths.slice(0, 5),
      topWeaknesses: topWeaknesses.slice(0, 5),
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error('Failed to generate report:', error);
    return null;
  }
}

// Get a motivational message based on score
export function getMotivationalMessage(score: number): string {
  if (score >= 90) {
    return "Outstanding! You're mastering Arabic at an incredible pace!";
  } else if (score >= 75) {
    return "Excellent progress! Your dedication is really showing!";
  } else if (score >= 60) {
    return "Great work! You're building a strong foundation!";
  } else if (score >= 40) {
    return "Good effort! Every challenge is a learning opportunity!";
  } else {
    return "Keep going! The best learners embrace the struggle!";
  }
}
