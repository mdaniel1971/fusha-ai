-- Migration: Create learning_observations table (standalone, no FK constraints)
-- This enables granular tracking of student strengths, weaknesses, patterns, and breakthroughs
-- Run this if the mistakes table doesn't exist

-- Drop old table if it exists (from previous migration attempts)
DROP TABLE IF EXISTS learning_observations;

-- Create the table fresh
CREATE TABLE learning_observations (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,  -- Client-generated UUID, no FK constraint
  user_id UUID,              -- Optional, no FK for now
  ayah_id INTEGER,
  vocabulary_id INTEGER,
  observation_type TEXT NOT NULL DEFAULT 'weakness'
    CHECK (observation_type IN ('strength', 'weakness', 'pattern', 'breakthrough')),
  skill_category TEXT NOT NULL DEFAULT 'vocabulary'
    CHECK (skill_category IN ('vocabulary', 'grammar', 'pronunciation', 'comprehension', 'fluency')),
  specific_skill TEXT NOT NULL,
  student_response TEXT,
  observed_behavior TEXT NOT NULL,
  teaching_note TEXT,
  confidence_level TEXT
    CHECK (confidence_level IN ('emerging', 'developing', 'strong', 'mastered')),
  context TEXT,
  arabic_example TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_learning_observations_session ON learning_observations(session_id);
CREATE INDEX idx_learning_observations_type ON learning_observations(observation_type);
CREATE INDEX idx_learning_observations_category ON learning_observations(skill_category);
CREATE INDEX idx_learning_observations_created ON learning_observations(created_at);

-- Disable RLS for now (no auth in current app)
ALTER TABLE learning_observations DISABLE ROW LEVEL SECURITY;
