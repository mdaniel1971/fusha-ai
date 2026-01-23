-- Check columns in supporting_words table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'supporting_words'
ORDER BY ordinal_position;