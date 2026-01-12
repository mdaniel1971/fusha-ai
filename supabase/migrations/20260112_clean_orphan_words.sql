-- Migration: Clean orphan words that don't belong to any verse
-- Words table should only contain words that are part of actual Quranic verses

-- Delete words that have no valid verse_id (orphan words)
DELETE FROM words
WHERE verse_id IS NULL;

-- Delete words whose verse_id doesn't exist in the verses table
DELETE FROM words
WHERE verse_id NOT IN (SELECT id FROM verses);

-- Add foreign key constraint to prevent future orphan words (if not exists)
-- First check if constraint exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'words_verse_id_fkey'
    AND table_name = 'words'
  ) THEN
    ALTER TABLE words
    ADD CONSTRAINT words_verse_id_fkey
    FOREIGN KEY (verse_id) REFERENCES verses(id) ON DELETE CASCADE;
  END IF;
END $$;
