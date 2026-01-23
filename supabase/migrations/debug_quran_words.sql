-- Check columns in quran_words table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'quran_words'
ORDER BY ordinal_position;

-- Check sample data from quran_words (first 10 rows)
-- SELECT * FROM quran_words LIMIT 10;

-- Check count of quran_words
-- SELECT COUNT(*) FROM quran_words;

-- Check distinct surah_id and surah_part combinations
-- SELECT DISTINCT surah_id, surah_part FROM quran_words ORDER BY surah_id, surah_part;