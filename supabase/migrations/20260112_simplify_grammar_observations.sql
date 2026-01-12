-- Migration: Simplify grammar_observations table
-- Removes redundant columns, renames for clarity

DROP TABLE IF EXISTS grammar_observations;

CREATE TABLE grammar_observations (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id UUID,
  word_id INTEGER REFERENCES words(id),  -- Links to tested word from database
  grammar_feature TEXT NOT NULL,          -- 'part_of_speech', 'case', 'verb_form', etc.
  student_answer TEXT NOT NULL,           -- What the student said
  correct_answer TEXT NOT NULL,           -- What it should be
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_grammar_obs_session ON grammar_observations(session_id);
CREATE INDEX idx_grammar_obs_word ON grammar_observations(word_id);
CREATE INDEX idx_grammar_obs_feature ON grammar_observations(grammar_feature);
CREATE INDEX idx_grammar_obs_created ON grammar_observations(created_at);

-- Disable RLS for now
ALTER TABLE grammar_observations DISABLE ROW LEVEL SECURITY;
