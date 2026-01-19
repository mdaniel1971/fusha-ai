# How to Add New Exercise Templates

This guide explains how to create new exercise templates for the FushaAI exercise system.

## Quick Start

Adding a new exercise template is simple - just insert a new row into the `exercise_templates` table. The system will automatically display it on the lessons landing page.

## Step-by-Step Guide

### 1. Design Your Exercise

Before adding to the database, plan:
- **Title**: Short, descriptive name (e.g., "Verb Conjugation - Present Tense")
- **Description**: What the exercise teaches (shown on card)
- **Difficulty Level**: beginner, intermediate, or advanced
- **Grammar Pattern**: Identifier for the pattern (e.g., "verb_present_tense")
- **Sentence Count**: How many sentences to generate (typically 10)

### 2. Write Grammar Instructions

This is the most important part. The instructions tell Claude how to generate sentences.

**Good Instructions Include:**
- Specific grammar pattern to follow
- Variety requirements (pronouns, definiteness, etc.)
- Progression guidance (simple → complex)
- Tashkeel requirements
- Natural language constraints

**Example Template:**
```
Create [grammar pattern] sentences using [specific structure].
Include variety: [list variations].
Progress from simple ([X] words) to complex ([Y] words).
All must include proper tashkeel.
Use natural, grammatically correct Arabic.
```

### 3. Insert into Database

Run this SQL in your Supabase SQL Editor:

```sql
INSERT INTO exercise_templates (
  title,
  description,
  difficulty_level,
  grammar_pattern,
  grammar_instructions,
  sentence_count
) VALUES (
  'Your Exercise Title',
  'Your description here',
  'beginner',  -- or 'intermediate', 'advanced'
  'your_pattern_identifier',
  'Your detailed instructions for Claude here...',
  10
);
```

### 4. Test the Template

1. Navigate to `/lessons`
2. Find your new template card
3. Click to start
4. Select a surah (try Al-Fatiha first)
5. Verify sentences generated correctly
6. Complete the exercise
7. Check that sentences follow your instructions

## Example Templates

### Example 1: Verb Conjugation (Present Tense)

```sql
INSERT INTO exercise_templates (
  title,
  description,
  difficulty_level,
  grammar_pattern,
  grammar_instructions,
  sentence_count
) VALUES (
  'Present Tense Verbs - Quranic Vocabulary',
  'Practice present tense verb conjugations using vocabulary from your chosen surahs',
  'intermediate',
  'verb_present_tense',
  'Create sentences using present tense verbs (الفعل المضارع) with various subjects. Include:
  - First person (أنا، نحن)
  - Second person (أنت، أنتِ، أنتم، أنتن)
  - Third person (هو، هي، هم، هن)
  Use only verbs from the provided vocabulary.
  Progress from simple subject-verb (2 words) to subject-verb-object (3-4 words).
  All verbs must be correctly conjugated with proper tashkeel.
  Ensure sentences are grammatically correct and meaningful.',
  10
);
```

### Example 2: Prepositions and Phrases

```sql
INSERT INTO exercise_templates (
  title,
  description,
  difficulty_level,
  grammar_pattern,
  grammar_instructions,
  sentence_count
) VALUES (
  'Prepositional Phrases - Quranic Vocabulary',
  'Practice using prepositions (حروف الجر) with Quranic vocabulary',
  'beginner',
  'prepositional_phrases',
  'Create phrases using prepositions (في، من، إلى، على، عن، ب) with nouns from the vocabulary.
  Include variety:
  - Different prepositions (في، من، إلى، على، عن، ب، ل)
  - Definite and indefinite nouns
  - Simple 2-word phrases progressing to 4-5 word phrases
  All must include proper tashkeel showing case endings after prepositions (genitive case).
  Use natural, meaningful phrases that could appear in Islamic contexts.',
  10
);
```

### Example 3: Adjective-Noun Agreement

```sql
INSERT INTO exercise_templates (
  title,
  description,
  difficulty_level,
  grammar_pattern,
  grammar_instructions,
  sentence_count
) VALUES (
  'Adjective-Noun Agreement - Quranic Vocabulary',
  'Practice matching adjectives with nouns in gender, number, and definiteness',
  'intermediate',
  'adjective_noun_agreement',
  'Create noun-adjective phrases showing proper agreement in:
  - Gender (masculine/feminine)
  - Number (singular/plural)
  - Definiteness (definite/indefinite)
  Use adjectives and nouns from the provided vocabulary.
  Include variety:
  - Masculine singular, feminine singular
  - Masculine plural, feminine plural
  - Both definite (ال + ال) and indefinite patterns
  All must include proper tashkeel showing case agreement.
  Progress from simple 2-word phrases to 4-5 word descriptive phrases.
  Use natural, grammatically correct Arabic.',
  10
);
```

### Example 4: Question Formation

```sql
INSERT INTO exercise_templates (
  title,
  description,
  difficulty_level,
  grammar_pattern,
  grammar_instructions,
  sentence_count
) VALUES (
  'Question Words - Quranic Vocabulary',
  'Practice forming questions using interrogative particles with Quranic vocabulary',
  'advanced',
  'question_formation',
  'Create questions using interrogative particles (مَن، ما، أين، متى، كيف، لماذا، هل).
  Include variety:
  - Different question words
  - Yes/no questions with هل
  - Information questions
  - Use vocabulary from the provided words
  All must include proper tashkeel.
  Progress from simple 2-3 word questions to more complex 5-6 word questions.
  Ensure questions are grammatically correct and would have meaningful answers.
  Use natural question formation patterns from Classical Arabic.',
  10
);
```

### Example 5: Reverse Translation (English → Arabic)

```sql
INSERT INTO exercise_templates (
  title,
  description,
  difficulty_level,
  grammar_pattern,
  grammar_instructions,
  sentence_count
) VALUES (
  'Reverse Translation - English to Arabic',
  'Translate from English to Arabic using vocabulary from your chosen surahs',
  'advanced',
  'reverse_translation',
  'Create simple English sentences that can be translated to Arabic using the provided vocabulary.
  The English sentences should:
  - Use only vocabulary that exists in the Arabic word list
  - Be simple and direct (no idioms or complex grammar)
  - Progress from 2-3 words to 4-5 words
  - Be grammatically correct English
  - Have clear, unambiguous translations
  For the Arabic translations:
  - Use proper tashkeel
  - Follow natural Arabic word order
  - Be grammatically correct
  Note: This template reverses the normal flow - show English, expect Arabic answer.',
  10
);
```

## Grammar Pattern Naming Convention

Use descriptive, lowercase identifiers with underscores:

**Good Examples:**
- `nominal_sentences`
- `verb_present_tense`
- `verb_past_tense`
- `prepositional_phrases`
- `adjective_noun_agreement`
- `question_formation`
- `verb_conjugation_subjunctive`
- `dual_number_practice`
- `case_endings_practice`

**Bad Examples:**
- `Exercise1` (not descriptive)
- `Verbs` (too vague)
- `hard-stuff` (use underscore, not hyphen)

## Difficulty Level Guidelines

### Beginner
- Simple 2-3 word constructions
- Basic grammar patterns (nominal sentences, simple phrases)
- Common vocabulary only
- Clear, unambiguous translations
- Repetitive structure helps learning

### Intermediate
- 3-5 word sentences
- More complex grammar (verb conjugation, adjective agreement)
- Varied sentence structures
- Some less common vocabulary
- Requires understanding of grammar rules

### Advanced
- 5+ word sentences
- Complex grammar (embedded clauses, multiple cases)
- Rare or specialized vocabulary
- Nuanced translations
- Requires deep grammatical knowledge

## Testing Your Template

After adding a template, test it with different surahs:

1. **Al-Fatiha (Surah 1)**: Short, common words - good baseline
2. **Juz Amma (78-114)**: Varied vocabulary - tests adaptability
3. **Long Surahs (2-3)**: Large vocabulary pool - tests word selection

**What to Check:**
- [ ] Sentences follow grammar instructions
- [ ] Proper tashkeel on all words
- [ ] Appropriate difficulty progression
- [ ] Natural Arabic (not word-salad)
- [ ] English translations are accurate
- [ ] Variety in sentence structures
- [ ] No made-up words (only from vocabulary list)

## Common Pitfalls

### ❌ Instructions Too Vague
**Bad:** "Create some Arabic sentences."
**Good:** "Create nominal sentences (جملة اسمية) using مُبْتَدَأ + خَبَر pattern with proper tashkeel."

### ❌ No Variety Specified
**Bad:** "Make 10 sentences."
**Good:** "Include variety: some with و (and), some with pronouns (أنا، أنت، هو، هي), some definite/indefinite."

### ❌ No Progression Guidance
**Bad:** "Use the vocabulary provided."
**Good:** "Progress from simple 2-3 word sentences to slightly more complex 4-5 word sentences."

### ❌ Missing Tashkeel Requirement
**Bad:** "Create Arabic sentences."
**Good:** "All Arabic must include proper tashkeel (diacritics) showing grammatical case and pronunciation."

### ❌ Too Specialized/Narrow
**Bad:** "Create sentences using dual form with مثنى adjectives in genitive case only."
**Good:** Start broader, then create advanced templates later as users progress.

## Updating Existing Templates

To modify an existing template:

```sql
UPDATE exercise_templates
SET
  title = 'New Title',
  description = 'New description',
  grammar_instructions = 'Updated instructions...'
WHERE id = 'your-template-id-here';
```

Or identify by title:

```sql
UPDATE exercise_templates
SET grammar_instructions = 'Updated instructions...'
WHERE title = 'Nominal Sentences - Quranic Vocabulary';
```

## Deleting Templates

⚠️ **Warning:** This will cascade delete all associated exercise instances and attempts.

```sql
DELETE FROM exercise_templates
WHERE id = 'your-template-id-here';
```

## Advanced: Custom Exercise Types

For more complex exercises (like multiple choice, fill-in-the-blank, etc.), you would need to:

1. Modify the API to support different response formats
2. Update `TranslationExercise.tsx` to handle different question types
3. Adjust the answer validation logic
4. Update the database schema to store different answer types

This is beyond the current scope but is possible with the architecture in place.

## Best Practices

1. **Start Simple**: Test with beginner templates first
2. **Iterate**: Improve instructions based on generated output
3. **Be Specific**: More detailed instructions = better results
4. **Test Thoroughly**: Try with different surahs and vocabulary sets
5. **Get Feedback**: Have Arabic learners test your templates
6. **Document**: Keep notes on what instructions work well

## Template Library Ideas

Consider creating templates for:

- **Grammar Focus:**
  - Verb moods (indicative, subjunctive, jussive)
  - Broken plurals
  - Construct phrases (إضافة)
  - Verb forms (I-X)
  - Derived forms

- **Skill Focus:**
  - Reading comprehension
  - Vocabulary building
  - Pronunciation practice
  - Root analysis
  - Morphology patterns

- **Context Focus:**
  - Prayer vocabulary
  - Hajj terminology
  - Islamic ethics terms
  - Quranic phrases
  - Prophetic narrations

## Support

If you create a great template, consider:
- Documenting it in this file
- Sharing with other educators
- Contributing to the project
- Creating a template library

For technical issues with the template system, refer to:
- `EXERCISE_SYSTEM.md` for architecture details
- `SETUP_EXERCISE_SYSTEM.md` for troubleshooting
- Database schema documentation
