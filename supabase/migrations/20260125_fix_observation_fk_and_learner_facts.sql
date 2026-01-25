-- Migration: Fix observation FK constraints and ensure learner_facts exists
-- The word_id FK was causing insert failures because Claude's parsed word IDs
-- may not always match the actual words table. We keep word_id for reference
-- but remove the strict FK constraint.

-- ============================================================
-- 1. FIX GRAMMAR OBSERVATIONS FK
-- ============================================================

-- Drop the existing FK constraint (may be named differently in actual DB)
ALTER TABLE grammar_observations
  DROP CONSTRAINT IF EXISTS grammar_observations_word_id_fkey;

-- ============================================================
-- 2. FIX TRANSLATION OBSERVATIONS FK
-- ============================================================

ALTER TABLE translation_observations
  DROP CONSTRAINT IF EXISTS translation_observations_word_id_fkey;

-- ============================================================
-- 3. ENSURE LEARNER_FACTS TABLE HAS REQUIRED COLUMNS
-- ============================================================

-- Add missing columns to learner_facts if they don't exist
DO $$
BEGIN
  -- Add category column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learner_facts' AND column_name = 'category'
  ) THEN
    ALTER TABLE learner_facts ADD COLUMN category TEXT;
  END IF;

  -- Add arabic_examples column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learner_facts' AND column_name = 'arabic_examples'
  ) THEN
    ALTER TABLE learner_facts ADD COLUMN arabic_examples TEXT[] DEFAULT '{}';
  END IF;

  -- Add source_lesson_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learner_facts' AND column_name = 'source_lesson_id'
  ) THEN
    ALTER TABLE learner_facts ADD COLUMN source_lesson_id UUID;
  END IF;

  -- Add observation_count column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learner_facts' AND column_name = 'observation_count'
  ) THEN
    ALTER TABLE learner_facts ADD COLUMN observation_count INTEGER DEFAULT 1;
  END IF;

  -- Add success_count column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learner_facts' AND column_name = 'success_count'
  ) THEN
    ALTER TABLE learner_facts ADD COLUMN success_count INTEGER DEFAULT 0;
  END IF;

  -- Add first_observed column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learner_facts' AND column_name = 'first_observed'
  ) THEN
    ALTER TABLE learner_facts ADD COLUMN first_observed TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  -- Add last_confirmed column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learner_facts' AND column_name = 'last_confirmed'
  ) THEN
    ALTER TABLE learner_facts ADD COLUMN last_confirmed TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  -- Add is_active column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learner_facts' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE learner_facts ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Create indexes (will skip if they exist)
CREATE INDEX IF NOT EXISTS idx_learner_facts_user ON learner_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_learner_facts_type ON learner_facts(user_id, fact_type);
CREATE INDEX IF NOT EXISTS idx_learner_facts_active ON learner_facts(user_id, is_active);

-- ============================================================
-- 4. ADD is_correct TO GRAMMAR_OBSERVATIONS IF MISSING
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grammar_observations' AND column_name = 'is_correct'
  ) THEN
    ALTER TABLE grammar_observations ADD COLUMN is_correct BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ============================================================
-- 5. ADD PERFORMANCE_SUMMARY TO LESSONS IF MISSING
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lessons' AND column_name = 'performance_summary'
  ) THEN
    ALTER TABLE lessons ADD COLUMN performance_summary TEXT;
  END IF;
END $$;
