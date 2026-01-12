-- Migration: Create translation_observations table
-- Tracks student progress on word translations

CREATE TABLE IF NOT EXISTS translation_observations (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID,
  word_id INTEGER REFERENCES words(id),  -- Links to tested word from database
  student_answer TEXT NOT NULL,           -- What the student said
  correct_answer TEXT NOT NULL,           -- The correct translation
  is_correct BOOLEAN NOT NULL,            -- Whether the answer was correct
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_translation_obs_session ON translation_observations(session_id);
CREATE INDEX idx_translation_obs_word ON translation_observations(word_id);
CREATE INDEX idx_translation_obs_correct ON translation_observations(is_correct);
CREATE INDEX idx_translation_obs_created ON translation_observations(created_at);

-- Disable RLS for now
ALTER TABLE translation_observations DISABLE ROW LEVEL SECURITY;
