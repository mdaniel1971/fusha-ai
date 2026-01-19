# FushaAI Exercise System

## Overview

The Exercise System is a comprehensive Quran-vocabulary-based translation practice feature for FushaAI. It allows learners to:

1. Select surahs they want to practice vocabulary from
2. Study vocabulary flashcards before exercises
3. Complete structured translation exercises (Arabic → English)
4. Review their performance with detailed feedback

## Architecture

### Database Schema

Three main tables power the exercise system:

#### `exercise_templates`
Defines the grammar pattern and difficulty for exercises.
- `id` (UUID): Primary key
- `title` (TEXT): Exercise title
- `description` (TEXT): Exercise description
- `difficulty_level` (TEXT): beginner/intermediate/advanced
- `grammar_pattern` (TEXT): Grammar pattern identifier
- `grammar_instructions` (TEXT): Detailed instructions for LLM
- `sentence_count` (INTEGER): Number of sentences to generate (default 10)
- `created_at` (TIMESTAMP): Creation timestamp

#### `exercise_instances`
Stores generated exercise attempts with their sentences.
- `id` (UUID): Primary key
- `exercise_template_id` (UUID): Foreign key to exercise_templates
- `user_id` (UUID): User identifier (nullable for anonymous users)
- `surah_ids` (INTEGER[]): Array of selected surah numbers
- `generated_sentences` (JSONB): Array of sentence objects
- `generated_at` (TIMESTAMP): Generation timestamp

Sentence object structure:
```json
{
  "sentence_number": 1,
  "arabic_text": "اللَّهُ رَحِيمٌ",
  "english_translation": "Allah is merciful"
}
```

#### `exercise_attempts`
Tracks individual answer attempts for each sentence.
- `id` (UUID): Primary key
- `user_id` (UUID): User identifier (nullable)
- `exercise_instance_id` (UUID): Foreign key to exercise_instances
- `sentence_number` (INTEGER): Which sentence in the exercise
- `user_answer` (TEXT): What the user typed
- `correct_answer` (TEXT): The correct translation
- `is_correct` (BOOLEAN): Whether the answer was correct
- `attempted_at` (TIMESTAMP): Attempt timestamp

### User Flow

1. **Model Selection** → User selects Claude model (Haiku/Sonnet/Opus)
2. **Mode Selection** → User chooses "Diagnostic Chat" or "Lessons"
3. **Exercise Selection** (`/lessons`) → User sees available exercise templates
4. **Surah Selection** (`/lessons/[template_id]`) → User selects which surahs to practice from
5. **Exercise Generation** → API generates sentences using Claude + selected vocabulary
6. **Flashcard Study** → User reviews vocabulary that will appear in the exercise
7. **Translation Exercise** → User translates 10 Arabic sentences to English
8. **Results & Review** → User sees score and reviews mistakes

## API Routes

### POST `/api/exercises/generate`

Generates a new exercise instance using vocabulary from selected surahs.

**Request Body:**
```json
{
  "exercise_template_id": "uuid",
  "surah_ids": [1, 78, 112],
  "user_id": "uuid (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "instance_id": "uuid",
  "vocabulary": [
    {
      "arabic": "اللَّهِ",
      "english": "Allah",
      "word_type": "noun",
      "surahs": [1, 112]
    }
  ],
  "sentence_count": 10
}
```

**Process:**
1. Fetches exercise template from database
2. Queries Quran words table for vocabulary from selected surahs
3. Deduplicates and limits to ~50 most useful words
4. Constructs prompt for Claude API with vocabulary and grammar instructions
5. Calls Claude Haiku 4.5 to generate sentences
6. Validates and parses JSON response
7. Stores in `exercise_instances` table
8. Returns instance ID and vocabulary list

## Components

### `/app/lessons/page.tsx`
Landing page showing available exercise templates as cards. Each card displays:
- Title
- Description
- Difficulty badge (color-coded)
- Sentence count
- "Start" button

### `/app/lessons/[template_id]/page.tsx`
Multi-step page handling surah selection and exercise flow:

**Step 1: Surah Selection**
- Grid of all 114 surahs with checkboxes
- Arabic name, transliteration, English name
- Quick select buttons: "Juz Amma", "First 10 Surahs", "Clear Selection"
- "Continue" button (disabled until at least 1 surah selected)

**Step 2: Flashcards** (renders `VocabFlashcards` component)

**Step 3: Exercise** (renders `TranslationExercise` component)

### `/components/exercises/VocabFlashcards.tsx`
Interactive flashcard system for vocabulary review.

**Features:**
- Card flip animation on click
- Front: Large Arabic text with tashkeel
- Back: English translation, word type, surahs it appears in
- Navigation: Previous/Next buttons
- Progress bar and counter
- "I've Studied These" button to continue

### `/components/exercises/TranslationExercise.tsx`
Main translation practice interface.

**Features:**
- Displays Arabic sentence in large Amiri font with RTL
- Text input for English translation
- "Check Answer" button
- Real-time score tracking (X/10)
- Progress indicator
- Feedback system:
  - ✓ Green for correct answers
  - ✗ Red for incorrect with correct answer shown
- Answer validation:
  - Case-insensitive
  - Punctuation-agnostic
  - Whitespace normalized
- Automatic navigation to results after last question

### `/components/exercises/ExerciseResults.tsx`
Performance summary and mistake review.

**Features:**
- Large score display with percentage and color coding:
  - 90-100%: Green - "Excellent!"
  - 70-89%: Blue - "Good work!"
  - 50-69%: Orange - "Keep practicing"
  - <50%: Red - "Study the vocabulary again"
- Perfect score celebration (if 100%)
- Detailed mistake review:
  - Arabic sentence
  - Your answer (red)
  - Correct answer (green)
- Action buttons:
  - "Practice Again" - new exercise with same surahs
  - "Choose Different Surahs" - back to surah selection
  - "Back to Chat" - return to diagnostic chat

## Data Files

### `/lib/surahs-data.ts`
Complete list of all 114 surahs with metadata:
- Arabic name
- English name
- Transliteration
- Constants for quick selection (Juz Amma starts at 78, First 10 = 1-10)

## Styling

**Consistent Design System:**
- Primary color: `#3b82f6` (blue)
- Success: `#22c55e` (green)
- Warning: `#f59e0b` (orange)
- Error: `#ef4444` (red)
- Neutral: `#6b7280` (gray)

**Typography:**
- Arabic: Amiri font (1.4em) with RTL support
- English: Arial, sans-serif
- All inline CSS using React.CSSProperties

**Responsive:**
- Max-width containers (600-1400px depending on component)
- Grid layouts for surah selection (auto-fill minmax(200px, 1fr))
- Mobile-friendly padding and spacing

## Migration

To set up the database tables, run:

```bash
# The migration file is located at:
supabase/migrations/20260119000000_create_exercise_system.sql

# Apply it to your Supabase database through the Supabase dashboard
# or using the Supabase CLI:
supabase db push
```

The migration includes:
- Table creation with proper constraints
- Indexes for performance optimization
- Seed data for the initial "Nominal Sentences" exercise template

## Future Enhancements

Potential additions to the system:

1. **More Exercise Templates:**
   - Verb conjugation exercises
   - Grammatical case identification
   - Phrase construction
   - Reverse translation (English → Arabic)

2. **User Accounts:**
   - Track progress over time
   - Spaced repetition scheduling
   - Achievement badges
   - Leaderboards

3. **Enhanced Vocabulary:**
   - Audio pronunciation for flashcards
   - Root word analysis
   - Related word families
   - Example sentences from Quran

4. **Adaptive Difficulty:**
   - Adjust sentence complexity based on performance
   - Focus on weak vocabulary
   - Progressive unlocking of harder templates

5. **Social Features:**
   - Share exercises with friends
   - Collaborative study groups
   - Teacher assignment system

6. **Analytics:**
   - Detailed progress reports
   - Vocabulary mastery tracking
   - Time-based performance graphs
   - Comparison with other learners

## Development Notes

- The exercise generation uses Claude Haiku 4.5 for cost efficiency
- Vocabulary is limited to 50 words max to stay within context limits
- Answer validation is flexible to accept reasonable variations
- All user interactions are logged for future analytics
- The system works with anonymous users (no authentication required)
- Integration with existing FushaAI diagnostic chat is seamless through mode selection

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Exercise templates appear on landing page
- [ ] Surah selection allows multi-select with quick buttons
- [ ] API generates valid sentences from selected surahs
- [ ] Flashcards display correctly with flip animation
- [ ] Translation exercise validates answers properly
- [ ] Results page shows accurate score and mistakes
- [ ] Navigation flow works end-to-end
- [ ] Mode selection correctly routes to lessons or diagnostic chat
- [ ] Mobile responsiveness on all screens
