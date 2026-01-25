SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'learner_facts'
ORDER BY ordinal_position;