SELECT
    tc.table_name, 
    kcu.column_name, 
    cc.check_clause,
    tc.constraint_type
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    LEFT JOIN information_schema.check_constraints AS cc
      ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name IN ('profiles', 'lessons');