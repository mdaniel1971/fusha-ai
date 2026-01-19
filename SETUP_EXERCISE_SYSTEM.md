# Exercise System Setup Guide

## Quick Start

Follow these steps to activate the new exercise system in FushaAI:

### 1. Apply Database Migration

You need to run the SQL migration to create the necessary tables in your Supabase database.

**Option A: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `supabase/migrations/20260119000000_create_exercise_system.sql`
4. Paste into the SQL Editor and click "Run"
5. Verify success - you should see "Success. No rows returned"

**Option B: Using Supabase CLI**
```bash
# If you have Supabase CLI installed and configured
supabase db push
```

### 2. Verify Tables Were Created

Run this query in your Supabase SQL Editor to verify:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('exercise_templates', 'exercise_instances', 'exercise_attempts');
```

You should see all three tables listed.

### 3. Verify Seed Data

Check that the initial exercise template was created:

```sql
SELECT * FROM exercise_templates;
```

You should see one row: "Nominal Sentences - Quranic Vocabulary"

### 4. Verify Your Quran Data

The exercise system relies on existing Quran vocabulary data. Verify it exists:

```sql
-- Check if you have surahs
SELECT COUNT(*) FROM surahs;

-- Check if you have verses
SELECT COUNT(*) FROM verses;

-- Check if you have words with translations
SELECT COUNT(*) FROM words WHERE translation_english IS NOT NULL;
```

If any of these return 0, you'll need to populate your Quran data first before the exercise system will work properly.

### 5. Start the Development Server

```bash
npm run dev
```

### 6. Test the Flow

1. Navigate to `http://localhost:3000/lesson`
2. Select a model (Haiku, Sonnet, or Opus)
3. You should see two new options:
   - **Diagnostic Chat** (existing functionality)
   - **Lessons** (new exercise system)
4. Click "Lessons"
5. You should see the exercise template card
6. Click "Start" to begin surah selection
7. Select one or more surahs (try "Juz Amma" quick select)
8. Click "Continue"
9. Review vocabulary flashcards
10. Complete the translation exercise
11. View your results

## Troubleshooting

### "No vocabulary found for selected surahs"

This means your `words` table doesn't have data for the surahs you selected. Solutions:
- Select Al-Fatiha (surah 1) if that's the only one with data
- Populate more Quran data in your database
- Check that the `words` table has:
  - `text_arabic` (Arabic text)
  - `translation_english` (English translation)
  - `part_of_speech` (word type)
  - `verse_id` (linking to verses)

### "Failed to generate exercise"

Check:
1. Your `ANTHROPIC_API_KEY` is set correctly in `.env.local`
2. You have API credits remaining
3. Check the browser console and server logs for detailed error messages

### Build Errors During `npm run build`

The existing codebase has some pre-existing SSR issues with other pages. These are unrelated to the new exercise system. The key things to verify:
- No TypeScript errors
- "✓ Compiled successfully" appears
- The pages compile (even if SSR warnings appear)

### Database Connection Issues

Verify your `.env.local` has:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Features Checklist

After setup, verify these features work:

- [ ] Mode selection screen appears after model selection
- [ ] "Lessons" button navigates to `/lessons`
- [ ] Exercise template card displays correctly
- [ ] Surah selection shows all 114 surahs
- [ ] Quick select buttons work (Juz Amma, First 10)
- [ ] "Continue" button is disabled until at least 1 surah selected
- [ ] API generates exercise with sentences
- [ ] Flashcards display with flip animation
- [ ] Translation exercise accepts answers
- [ ] Answer validation works (case-insensitive, punctuation-agnostic)
- [ ] Results page shows correct score
- [ ] Mistakes are displayed with Arabic + answers
- [ ] "Practice Again" generates a new exercise
- [ ] "Back to Chat" returns to diagnostic lesson

## Architecture Overview

```
User Flow:
┌─────────────────┐
│ Model Selection │
└────────┬────────┘
         │
┌────────▼────────┐
│ Mode Selection  │  ← NEW
└────┬────────┬───┘
     │        │
     │        └─────────────────┐
     │                          │
┌────▼──────────┐    ┌──────────▼────────┐
│ Diagnostic    │    │ Lessons Landing   │
│ Chat (old)    │    │ /lessons          │
└───────────────┘    └──────────┬────────┘
                                │
                     ┌──────────▼────────┐
                     │ Surah Selection   │
                     │ /lessons/[id]     │
                     └──────────┬────────┘
                                │
                     ┌──────────▼────────┐
                     │ API: Generate     │
                     │ Exercise          │
                     └──────────┬────────┘
                                │
                     ┌──────────▼────────┐
                     │ Vocab Flashcards  │
                     └──────────┬────────┘
                                │
                     ┌──────────▼────────┐
                     │ Translation       │
                     │ Exercise (10 Qs)  │
                     └──────────┬────────┘
                                │
                     ┌──────────▼────────┐
                     │ Results & Review  │
                     └───────────────────┘
```

## Database Schema

```
exercise_templates
  ├── id (UUID)
  ├── title
  ├── description
  ├── difficulty_level
  ├── grammar_pattern
  ├── grammar_instructions
  └── sentence_count

exercise_instances
  ├── id (UUID)
  ├── exercise_template_id → exercise_templates(id)
  ├── user_id (nullable)
  ├── surah_ids (integer[])
  ├── generated_sentences (JSONB)
  └── generated_at

exercise_attempts
  ├── id (UUID)
  ├── user_id (nullable)
  ├── exercise_instance_id → exercise_instances(id)
  ├── sentence_number
  ├── user_answer
  ├── correct_answer
  ├── is_correct
  └── attempted_at
```

## API Endpoints

- `POST /api/exercises/generate` - Generate new exercise instance
  - Input: exercise_template_id, surah_ids, user_id (optional)
  - Output: instance_id, vocabulary, sentence_count

## Next Steps

Once the system is working:

1. **Add More Templates**: Create more exercise templates for different grammar patterns
2. **Populate More Quran Data**: Add more surahs beyond Al-Fatiha
3. **User Authentication**: Integrate with Supabase Auth to track user progress
4. **Analytics Dashboard**: Build visualizations of user performance over time
5. **Mobile Optimization**: Test and optimize for mobile devices
6. **Additional Features**: See EXERCISE_SYSTEM.md "Future Enhancements" section

## Support

If you encounter issues:

1. Check browser console for client-side errors
2. Check server logs for API errors
3. Verify database tables and data exist
4. Ensure environment variables are set correctly
5. Review the detailed documentation in EXERCISE_SYSTEM.md
