-- Drop the FK constraint on learner_facts.source_lesson_id
-- This constraint is causing issues because observations may be stored
-- with session IDs that don't exist in the lessons table

ALTER TABLE learner_facts
  DROP CONSTRAINT IF EXISTS learner_facts_source_lesson_id_fkey;

-- Make source_lesson_id nullable if it isn't already
ALTER TABLE learner_facts
  ALTER COLUMN source_lesson_id DROP NOT NULL;
