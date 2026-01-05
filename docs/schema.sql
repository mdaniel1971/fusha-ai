-- FushaAI Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- Users table
-- Stores learner profiles and settings
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  native_language TEXT DEFAULT 'en',  -- Language for explanations
  token_balance INTEGER DEFAULT 10000, -- Free tier starting balance
  subscription_tier TEXT DEFAULT 'free', -- free | premium
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Surahs table
-- Reference data for all 114 surahs
CREATE TABLE surahs (
  id SERIAL PRIMARY KEY,
  number INTEGER UNIQUE NOT NULL, -- 1-114
  name_arabic TEXT NOT NULL,
  name_transliterated TEXT NOT NULL,
  name_english TEXT NOT NULL,
  ayah_count INTEGER NOT NULL,
  revelation_type TEXT -- meccan | medinan
);

-- Ayat table
-- Every ayah in the Quran
CREATE TABLE ayat (
  id SERIAL PRIMARY KEY,
  surah_id INTEGER REFERENCES surahs(id) ON DELETE CASCADE,
  ayah_number INTEGER NOT NULL,
  text_arabic TEXT NOT NULL,
  text_uthmani TEXT, -- Uthmani script variant if needed
  audio_url TEXT, -- Link to recitation audio
  UNIQUE(surah_id, ayah_number)
);

-- Vocabulary table
-- Words from the Quran with grammar details
CREATE TABLE vocabulary (
  id SERIAL PRIMARY KEY,
  ayah_id INTEGER REFERENCES ayat(id) ON DELETE CASCADE,
  word_position INTEGER NOT NULL, -- Position in the ayah (1, 2, 3...)
  word_arabic TEXT NOT NULL,
  word_uthmani TEXT,
  root TEXT, -- Three/four letter root
  pattern TEXT, -- Morphological pattern (verb form, noun pattern)
  part_of_speech TEXT, -- noun | verb | particle | etc
  meaning TEXT NOT NULL,
  grammar_notes TEXT,
  UNIQUE(ayah_id, word_position)
);

-- User progress table
-- Tracks where each user is in each surah
CREATE TABLE user_progress (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  surah_id INTEGER REFERENCES surahs(id) ON DELETE CASCADE,
  current_ayah INTEGER DEFAULT 1,
  status TEXT DEFAULT 'not_started', -- not_started | in_progress | completed
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  last_session_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, surah_id)
);

-- Sessions table
-- Each lesson/conversation session
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  surah_id INTEGER REFERENCES surahs(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  tokens_used INTEGER DEFAULT 0,
  ayat_covered INTEGER[] DEFAULT '{}' -- Array of ayah_ids covered
);

-- Learning Observations table (formerly mistakes)
-- Granular tracking of strengths, weaknesses, patterns, and breakthroughs
CREATE TABLE learning_observations (
  id SERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ayah_id INTEGER REFERENCES ayat(id),
  vocabulary_id INTEGER REFERENCES vocabulary(id),
  observation_type TEXT NOT NULL DEFAULT 'weakness'
    CHECK (observation_type IN ('strength', 'weakness', 'pattern', 'breakthrough')),
  skill_category TEXT NOT NULL DEFAULT 'vocabulary'
    CHECK (skill_category IN ('vocabulary', 'grammar', 'pronunciation', 'comprehension', 'fluency')),
  specific_skill TEXT NOT NULL, -- e.g., "subject-verb agreement with feminine plural"
  student_response TEXT,
  observed_behavior TEXT NOT NULL,
  teaching_note TEXT,
  confidence_level TEXT
    CHECK (confidence_level IN ('emerging', 'developing', 'strong', 'mastered')),
  context TEXT,
  arabic_example TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Homework table
-- Assigned practice based on mistakes
CREATE TABLE homework (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  homework_type TEXT NOT NULL, -- memorise_words | practice_conjugation | translate_sentences | review_grammar
  content JSONB NOT NULL, -- Flexible structure for different homework types
  status TEXT DEFAULT 'assigned', -- assigned | completed | tested
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Conversation logs table
-- Full transcript of each session
CREATE TABLE conversation_logs (
  id SERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- user | assistant
  content TEXT NOT NULL,
  tokens INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_user_progress_user ON user_progress(user_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_learning_observations_user ON learning_observations(user_id);
CREATE INDEX idx_learning_observations_session ON learning_observations(session_id);
CREATE INDEX idx_learning_observations_type ON learning_observations(user_id, observation_type);
CREATE INDEX idx_learning_observations_category ON learning_observations(user_id, skill_category);
CREATE INDEX idx_homework_user_status ON homework(user_id, status);
CREATE INDEX idx_vocabulary_ayah ON vocabulary(ayah_id);
CREATE INDEX idx_ayat_surah ON ayat(surah_id);

-- Row Level Security (RLS)
-- Ensures users can only see their own data

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_logs ENABLE ROW LEVEL SECURITY;

-- Policies (users can only access their own rows)
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own progress" ON user_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own sessions" ON sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own observations" ON learning_observations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own homework" ON homework FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own conversations" ON conversation_logs FOR ALL USING (
  session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
);

-- Public read access for reference data
CREATE POLICY "Anyone can view surahs" ON surahs FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Anyone can view ayat" ON ayat FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Anyone can view vocabulary" ON vocabulary FOR SELECT TO PUBLIC USING (true);
