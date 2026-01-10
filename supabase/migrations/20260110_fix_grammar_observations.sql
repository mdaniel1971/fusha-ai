-- Migration: Fix grammar_observations table to remove FK constraint on session_id
-- This allows grammar observations to be logged without requiring a sessions table entry
-- Run this in Supabase SQL Editor

-- Drop and recreate the table with TEXT session_id (no FK constraint)
DROP TABLE IF EXISTS grammar_observations;

CREATE TABLE grammar_observations (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,  -- Client-generated UUID, no FK constraint
  user_id UUID,              -- Optional, no FK for now
  word_id INTEGER,           -- Reference to words table (optional)
  grammar_feature TEXT NOT NULL,  -- e.g., 'part_of_speech', 'verb_form', 'case'
  grammar_value TEXT NOT NULL,    -- e.g., 'noun', 'Form I', 'nominative'
  performance_level TEXT NOT NULL
    CHECK (performance_level IN ('mastered', 'emerging', 'struggling')),
  context_type TEXT NOT NULL
    CHECK (context_type IN ('production', 'correction_accepted', 'correction_rejected')),
  student_attempt TEXT,      -- What the student said/wrote
  correct_form TEXT,         -- The correct answer
  error_type TEXT,           -- Type of error made
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_grammar_observations_session ON grammar_observations(session_id);
CREATE INDEX idx_grammar_observations_feature ON grammar_observations(grammar_feature);
CREATE INDEX idx_grammar_observations_level ON grammar_observations(performance_level);
CREATE INDEX idx_grammar_observations_created ON grammar_observations(created_at);
CREATE INDEX idx_grammar_observations_user ON grammar_observations(user_id);

-- Disable RLS for now (no auth in current app)
ALTER TABLE grammar_observations DISABLE ROW LEVEL SECURITY;
