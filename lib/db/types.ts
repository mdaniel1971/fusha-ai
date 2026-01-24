// Database types for FushaAI
// Matches the new schema with lessons, learner_facts, and observation tables

// ============================================================
// LESSONS (formerly sessions)
// ============================================================

export interface Lesson {
  id: string;
  user_id: string;
  surah_id: number | null;
  started_at: string;
  ended_at: string | null;
  learning_mode: 'grammar' | 'translation' | 'mix';
  difficulty_level: number;
  topic_discussed: string | null;
  performance_summary: string | null;
  continuity_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonInsert {
  user_id: string;
  surah_id?: number | null;
  learning_mode?: 'grammar' | 'translation' | 'mix';
  difficulty_level?: number;
  topic_discussed?: string | null;
  performance_summary?: string | null;
  continuity_notes?: string | null;
}

export interface LessonUpdate {
  ended_at?: string | null;
  topic_discussed?: string | null;
  performance_summary?: string | null;
  continuity_notes?: string | null;
}

// ============================================================
// LEARNER FACTS (the memory system)
// ============================================================

export type FactType = 'struggle' | 'strength' | 'interest' | 'personal' | 'preference';

export interface LearnerFact {
  id: string;
  user_id: string;
  fact_type: FactType;
  fact_text: string;
  category: string | null;  // e.g., 'grammar', 'vocabulary', 'pronunciation'
  arabic_examples: string[] | null;
  source_lesson_id: string | null;
  observation_count: number;
  success_count: number;
  first_observed: string;
  last_confirmed: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LearnerFactInsert {
  user_id: string;
  fact_type: FactType;
  fact_text: string;
  category?: string | null;
  arabic_examples?: string[] | null;
  source_lesson_id?: string | null;
  observation_count?: number;
  success_count?: number;
  is_active?: boolean;
}

export interface LearnerFactUpdate {
  fact_text?: string;
  category?: string | null;
  arabic_examples?: string[] | null;
  observation_count?: number;
  success_count?: number;
  last_confirmed?: string;
  is_active?: boolean;
}

// ============================================================
// GRAMMAR OBSERVATIONS
// ============================================================

export interface GrammarObservation {
  id: number;
  session_id: string;  // Now references lessons.id
  user_id: string | null;
  word_id: number | null;
  grammar_feature: string;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  created_at: string;
}

export interface GrammarObservationInsert {
  session_id: string;
  user_id?: string | null;
  word_id?: number | null;
  grammar_feature: string;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
}

// ============================================================
// TRANSLATION OBSERVATIONS
// ============================================================

export interface TranslationObservation {
  id: number;
  session_id: string;  // Now references lessons.id
  user_id: string | null;
  word_id: number | null;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  created_at: string;
}

export interface TranslationObservationInsert {
  session_id: string;
  user_id?: string | null;
  word_id?: number | null;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
}

// ============================================================
// QURAN DATA (existing tables)
// ============================================================

export interface Surah {
  id: number;
  name_arabic: string;
  name_english: string;
  name_transliteration: string;
  verse_count: number;
  revelation_type: 'meccan' | 'medinan';
}

export interface Verse {
  id: number;
  surah_id: number;
  verse_number: number;
  text_arabic: string;
  text_uthmani: string | null;
}

export interface Word {
  id: number;
  verse_id: number;
  word_position: number;
  text_arabic: string;
  transliteration: string | null;
  translation_english: string | null;
  part_of_speech: string | null;
  root_letters: string | null;
}

// ============================================================
// LEARNER CONTEXT (for AI prompts)
// ============================================================

export interface LearnerContext {
  userId: string;

  // Active facts about this learner
  facts: {
    struggles: LearnerFact[];
    strengths: LearnerFact[];
    interests: LearnerFact[];
    preferences: LearnerFact[];
  };

  // Last lesson info for continuity
  lastLesson: {
    surahId: number | null;
    surahName: string | null;
    topicDiscussed: string | null;
    performanceSummary: string | null;
    continuityNotes: string | null;
    endedAt: string | null;
  } | null;

  // Aggregated patterns from observations
  patterns: {
    grammarAccuracy: number;
    translationAccuracy: number;
    weakestGrammarFeatures: { feature: string; accuracy: number; count: number }[];
    strongestGrammarFeatures: { feature: string; accuracy: number; count: number }[];
    frequentMistakes: { student: string; correct: string; count: number }[];
  };
}

// ============================================================
// EXTRACTED FACTS (from lesson analysis)
// ============================================================

export interface ExtractedFact {
  factType: FactType;
  factText: string;
  category: string;
  arabicExamples: string[];
  isNew: boolean;  // true if newly created, false if updated existing
}

export interface LessonAnalysis {
  lessonId: string;
  userId: string;
  grammarObservations: GrammarObservation[];
  translationObservations: TranslationObservation[];
  extractedFacts: ExtractedFact[];
  performanceSummary: string;
}
