-- Exercise system for Quran-vocabulary-based translation practice
-- Part 1: Exercise Templates

CREATE TABLE IF NOT EXISTS exercise_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  difficulty_level TEXT NOT NULL CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  grammar_pattern TEXT NOT NULL,
  grammar_instructions TEXT NOT NULL,
  sentence_count INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Part 2: Exercise Instances (generated attempts)

CREATE TABLE IF NOT EXISTS exercise_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_template_id UUID REFERENCES exercise_templates(id) ON DELETE CASCADE,
  user_id UUID,
  surah_ids INTEGER[] NOT NULL,
  generated_sentences JSONB NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Part 3: Exercise Attempts (track each answer)

CREATE TABLE IF NOT EXISTS exercise_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  exercise_instance_id UUID REFERENCES exercise_instances(id) ON DELETE CASCADE,
  sentence_number INTEGER NOT NULL,
  user_answer TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  attempted_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance

CREATE INDEX IF NOT EXISTS idx_exercise_instances_user_id ON exercise_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_instances_template_id ON exercise_instances(exercise_template_id);
CREATE INDEX IF NOT EXISTS idx_exercise_attempts_instance_id ON exercise_attempts(exercise_instance_id);
CREATE INDEX IF NOT EXISTS idx_exercise_attempts_user_id ON exercise_attempts(user_id);

-- Seed data: Create initial exercise template

INSERT INTO exercise_templates (
  title,
  description,
  difficulty_level,
  grammar_pattern,
  grammar_instructions,
  sentence_count
) VALUES (
  'Nominal Sentences - Quranic Vocabulary',
  'Practice basic nominal sentences using vocabulary from your chosen surahs',
  'beginner',
  'nominal_sentences',
  'Create nominal sentences (جملة اسمية) using مُبْتَدَأ + خَبَر pattern. Include variety: some with و (and), some with pronouns (أنا، أنت، هو، هي), some definite/indefinite. Progress from simple 2-3 word sentences to slightly more complex 4-5 word sentences. All must include proper tashkeel. Use natural, grammatically correct Arabic.',
  10
);
