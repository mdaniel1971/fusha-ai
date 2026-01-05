-- Migration: Transform mistakes table into learning_observations
-- This enables granular tracking of student strengths, weaknesses, patterns, and breakthroughs

-- First, rename the table
ALTER TABLE mistakes RENAME TO learning_observations;

-- Add new columns for observation categorization
ALTER TABLE learning_observations
  ADD COLUMN observation_type TEXT NOT NULL DEFAULT 'weakness'
    CHECK (observation_type IN ('strength', 'weakness', 'pattern', 'breakthrough'));

ALTER TABLE learning_observations
  ADD COLUMN skill_category TEXT NOT NULL DEFAULT 'vocabulary'
    CHECK (skill_category IN ('vocabulary', 'grammar', 'pronunciation', 'comprehension', 'fluency'));

ALTER TABLE learning_observations
  ADD COLUMN confidence_level TEXT
    CHECK (confidence_level IN ('emerging', 'developing', 'strong', 'mastered'));

ALTER TABLE learning_observations
  ADD COLUMN context TEXT;

ALTER TABLE learning_observations
  ADD COLUMN arabic_example TEXT;

-- Rename existing columns for clarity
ALTER TABLE learning_observations
  RENAME COLUMN mistake_type TO specific_skill;

ALTER TABLE learning_observations
  RENAME COLUMN student_said TO student_response;

ALTER TABLE learning_observations
  RENAME COLUMN correction TO observed_behavior;

ALTER TABLE learning_observations
  RENAME COLUMN explanation TO teaching_note;

-- Update existing data to have required fields (if any rows exist)
UPDATE learning_observations
SET observation_type = 'weakness'
WHERE observation_type IS NULL;

UPDATE learning_observations
SET skill_category = 'vocabulary'
WHERE skill_category IS NULL;

-- Update indexes (drop old, create new with better names)
DROP INDEX IF EXISTS idx_mistakes_user;
DROP INDEX IF EXISTS idx_mistakes_type;

CREATE INDEX idx_learning_observations_user ON learning_observations(user_id);
CREATE INDEX idx_learning_observations_session ON learning_observations(session_id);
CREATE INDEX idx_learning_observations_type ON learning_observations(user_id, observation_type);
CREATE INDEX idx_learning_observations_category ON learning_observations(user_id, skill_category);

-- Update RLS policy name to match new table name
DROP POLICY IF EXISTS "Users can view own mistakes" ON learning_observations;
CREATE POLICY "Users can view own observations" ON learning_observations
  FOR ALL USING (auth.uid() = user_id);
