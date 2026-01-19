import { supabase } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';
import { getClaudeWordPool, getFlashcardWords, getExerciseOrder, SurahPart } from '@/lib/exercise-vocab';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface GenerateRequest {
  surah_parts: SurahPart[];  // Array of {surah_id, surah_part}
  exercise_name: string;
  user_id?: string;
}

interface GeneratedSentence {
  sentence_number: number;
  arabic_text: string;
  english_translation: string;
}

export async function POST(request: Request) {
  try {
    const body: GenerateRequest = await request.json();
    const { surah_parts, exercise_name, user_id } = body;

    // Validation
    if (!surah_parts || surah_parts.length === 0 || !exercise_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: surah_parts and exercise_name' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Get exercise order for cumulative word pool
    const exerciseOrder = await getExerciseOrder(exercise_name);
    if (exerciseOrder === null) {
      return new Response(
        JSON.stringify({ error: 'Exercise not found', details: exercise_name }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Get vocabulary
    // Flashcard words = Quran words + THIS exercise's supporting words only
    const flashcardWords = await getFlashcardWords(surah_parts, exercise_name);

    // Claude word pool = Quran words + ALL supporting words from exercises 1 through current (cumulative)
    const claudeWordPool = await getClaudeWordPool(surah_parts, exerciseOrder);

    if (claudeWordPool.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No vocabulary found for selected surah parts and exercise' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Separate Quran words and supporting words for the prompt
    const quranWords = claudeWordPool.filter(w => w.source === 'quran');
    const supportingWords = claudeWordPool.filter(w => w.source === 'supporting');

    // Step 3: Construct prompt for Claude
    const quranWordsList = quranWords.length > 0
      ? quranWords.map((v, idx) => `${idx + 1}. ${v.arabic} = "${v.english}" [${v.word_type}]`).join('\n')
      : '(No Quran words selected)';

    const supportingWordsList = supportingWords.length > 0
      ? supportingWords.map((v, idx) => `${idx + 1}. ${v.arabic} = "${v.english}" [${v.word_type}]`).join('\n')
      : '(No supporting words available)';

    // All Arabic words combined for reference
    const allArabicWords = claudeWordPool.map(v => v.arabic).join(' | ');

    const prompt = `You are creating Arabic translation exercises for Quranic vocabulary learning.

CRITICAL CONSTRAINT - THIS IS MANDATORY:
Generate sentences using ONLY these words. Never create new Arabic words.

QURAN WORDS (${quranWords.length} words):
${quranWordsList}

SUPPORTING WORDS (${supportingWords.length} words):
${supportingWordsList}

ALL ARABIC WORDS YOU CAN USE (copy exactly as written with their tashkeel):
${allArabicWords}

You may also use these common words:
- Pronouns: أنا، أنت، أنتِ، هو، هي، نحن، أنتم، هم، هُوَ، هِيَ
- Conjunction: و (and)
- Preposition: في، من، إلى، على، ب، ل
- The definite article ال is already included in words that have it

EXERCISE: ${exercise_name}

INSTRUCTIONS: Create nominal sentences (جملة اسمية) using مُبْتَدَأ + خَبَر pattern. Include variety: some with و (and), some with pronouns, some definite/indefinite. Progress from simple 2-3 word sentences to slightly more complex 4-5 word sentences. All must include proper tashkeel. Use natural, grammatically correct Arabic.

STRICT REQUIREMENTS:
1. Create exactly 10 sentences
2. EVERY Arabic word in your sentences MUST come from the vocabulary lists above (except pronouns, و, and basic prepositions)
3. Do NOT invent or add any new Arabic words - this is critical
4. Copy the Arabic words exactly as they appear in the vocabulary (with their exact tashkeel)
5. Each sentence must be grammatically correct
6. Progress from simple (2-3 words) to more complex (4-5 words)
7. English translations must be accurate and natural

VALIDATION CHECK: Before outputting, verify that EVERY Arabic word (except pronouns/و/prepositions) appears exactly in the vocabulary lists above. If a word is not in the list, do not use it.

Return ONLY a valid JSON array (no markdown, no explanations):
[
  {"sentence_number": 1, "arabic_text": "...", "english_translation": "..."},
  {"sentence_number": 2, "arabic_text": "...", "english_translation": "..."}
]`;

    // Step 4: Call Claude API (using Haiku 4.5 for cost efficiency)
    let generatedSentences: GeneratedSentence[] = [];
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount < maxRetries) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        const textContent = response.content.find((block) => block.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text content in Claude response');
        }

        const responseText = textContent.text.trim();

        // Remove markdown code blocks if present
        const cleanedText = responseText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        // Parse JSON
        generatedSentences = JSON.parse(cleanedText);

        // Validate structure
        if (!Array.isArray(generatedSentences) || generatedSentences.length !== 10) {
          throw new Error('Invalid response structure or incorrect sentence count');
        }

        // Validate each sentence has required fields
        for (const sentence of generatedSentences) {
          if (
            typeof sentence.sentence_number !== 'number' ||
            typeof sentence.arabic_text !== 'string' ||
            typeof sentence.english_translation !== 'string'
          ) {
            throw new Error('Invalid sentence structure');
          }
        }

        // Success! Break out of retry loop
        break;
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          console.error('Failed to generate sentences after retries:', error);
          return new Response(
            JSON.stringify({
              error: 'Failed to generate valid sentences',
              details: error instanceof Error ? error.message : 'Unknown error',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Step 5: Insert into exercise_instances table
    const { data: instance, error: instanceError } = await supabase
      .from('exercise_instances')
      .insert({
        user_id: user_id || null,
        surah_ids: surah_parts.map(sp => sp.surah_id),
        generated_sentences: generatedSentences,
        // Store exercise metadata
        exercise_template_id: null, // No longer using templates table for this
      })
      .select()
      .single();

    if (instanceError || !instance) {
      return new Response(
        JSON.stringify({
          error: 'Failed to save exercise instance',
          details: instanceError?.message,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 6: Return the instance_id and vocabulary used
    console.log(`[Exercise Generate] Surah Parts: ${surah_parts.map(sp => `${sp.surah_id}-${sp.surah_part}`).join(', ')}`);
    console.log(`[Exercise Generate] Exercise: ${exercise_name} (order: ${exerciseOrder})`);
    console.log(`[Exercise Generate] Claude word pool: ${claudeWordPool.length} words (${quranWords.length} Quran + ${supportingWords.length} supporting)`);
    console.log(`[Exercise Generate] Flashcard words: ${flashcardWords.length} words`);

    return new Response(
      JSON.stringify({
        success: true,
        instance_id: instance.id,
        flashcard_vocabulary: flashcardWords,  // For flashcards (current exercise only)
        claude_vocabulary: claudeWordPool,      // For reference (cumulative)
        sentence_count: generatedSentences.length,
        exercise_name,
        exercise_order: exerciseOrder,
        debug: {
          surah_parts_queried: surah_parts,
          quran_words_count: quranWords.length,
          supporting_words_count: supportingWords.length,
          total_claude_pool: claudeWordPool.length,
          flashcard_words_count: flashcardWords.length,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in /api/exercises/generate:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
