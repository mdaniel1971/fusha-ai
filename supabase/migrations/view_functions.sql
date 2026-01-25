SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public';