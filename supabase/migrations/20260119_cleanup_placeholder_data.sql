-- Cleanup migration: Remove placeholder/scenario vocabulary that is not from the Quran
-- This removes the fake "Scenario Vocabulary Placeholder" verse and its associated words

-- Step 1: Delete words associated with the placeholder verse (verse_id = 0)
DELETE FROM words WHERE verse_id = 0;

-- Step 2: Delete the placeholder verse itself
DELETE FROM verses WHERE id = 0;

-- Alternative: Delete any verse with verse_number = 0 (placeholder verses)
DELETE FROM words WHERE verse_id IN (SELECT id FROM verses WHERE verse_number = 0);
DELETE FROM verses WHERE verse_number = 0;

-- Verify cleanup (run these as separate queries to check):
-- SELECT COUNT(*) FROM words WHERE verse_id = 0;  -- Should return 0
-- SELECT COUNT(*) FROM verses WHERE verse_number = 0;  -- Should return 0
-- SELECT * FROM verses WHERE surah_id = 1 ORDER BY verse_number;  -- Should show only real Fatiha verses (1-7)
