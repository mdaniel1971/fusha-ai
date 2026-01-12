-- Migration: Add is_correct column to grammar_observations
-- Tracks whether the student's grammar answer was correct

ALTER TABLE grammar_observations
ADD COLUMN is_correct BOOLEAN NOT NULL DEFAULT false;

-- Create index for filtering by correctness
CREATE INDEX idx_grammar_obs_correct ON grammar_observations(is_correct);
