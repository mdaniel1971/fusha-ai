import { supabase } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface GenerateRequest {
  exercise_template_id: string;
  surah_ids: number[];
  user_id?: string;
}

interface VocabWord {
  arabic: string;
  english: string;
  word_type: string;
  surahs: number[];
}

interface GeneratedSentence {
  sentence_number: number;
  arabic_text: string;
  english_translation: string;
}

export async function POST(request: Request) {
  try {
    const body: GenerateRequest = await request.json();
    const { exercise_template_id, surah_ids, user_id } = body;

    // Validation
    if (!exercise_template_id || !surah_ids || surah_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: exercise_template_id and surah_ids' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Fetch exercise template
    const { data: template, error: templateError } = await supabase
      .from('exercise_templates')
      .select('*')
      .eq('id', exercise_template_id)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ error: 'Exercise template not found', details: templateError?.message }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Fetch vocabulary from selected surahs
    // IMPORTANT: Exclude verse_number = 0 which contains placeholder/scenario vocabulary
    const { data: verses, error: versesError } = await supabase
      .from('verses')
      .select('id, surah_id, verse_number')
      .in('surah_id', surah_ids)
      .gt('verse_number', 0);  // Exclude placeholder verses (verse_number = 0)

    if (versesError || !verses || verses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No verses found for selected surahs', details: versesError?.message }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Filter out any verse with id = 0 as well (extra safety)
    const verseIds = verses.filter(v => v.id !== 0).map(v => v.id);

    // Fetch words from these verses
    const { data: words, error: wordsError } = await supabase
      .from('words')
      .select('text_arabic, translation_english, part_of_speech, verse_id')
      .in('verse_id', verseIds);

    if (wordsError || !words || words.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No vocabulary found for selected surahs', details: wordsError?.message }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Process vocabulary: deduplicate and group by surah
    const vocabMap = new Map<string, VocabWord>();

    words.forEach((word) => {
      const key = word.text_arabic;
      const verse = verses.find(v => v.id === word.verse_id);
      const surahId = verse?.surah_id;

      if (!surahId) return;

      if (vocabMap.has(key)) {
        const existing = vocabMap.get(key)!;
        if (!existing.surahs.includes(surahId)) {
          existing.surahs.push(surahId);
        }
      } else {
        vocabMap.set(key, {
          arabic: word.text_arabic,
          english: word.translation_english,
          word_type: word.part_of_speech || 'unknown',
          surahs: [surahId],
        });
      }
    });

    const vocabulary = Array.from(vocabMap.values());

    // Limit to ~50 most useful words if list is very long
    const limitedVocab = vocabulary.slice(0, 50);

    if (limitedVocab.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid vocabulary extracted from selected surahs' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Construct prompt for Claude
    // Format vocabulary as a clear reference list
    const vocabList = limitedVocab
      .map((v, idx) => `${idx + 1}. ${v.arabic} = "${v.english}" [${v.word_type}]`)
      .join('\n');

    // Create a simple Arabic-only list for emphasis
    const arabicOnlyList = limitedVocab.map(v => v.arabic).join(' | ');

    const prompt = `You are creating Arabic translation exercises for Quranic vocabulary learning.

CRITICAL CONSTRAINT - THIS IS MANDATORY:
You may ONLY use Arabic words from this exact vocabulary list. Do NOT use ANY Arabic words that are not in this list.

ALLOWED VOCABULARY (${limitedVocab.length} words total):
${vocabList}

ARABIC WORDS YOU CAN USE (copy exactly as written with their tashkeel):
${arabicOnlyList}

You may also use these common words:
- Pronouns: أنا، أنت، أنتِ، هو، هي، نحن، أنتم، هم، هُوَ، هِيَ
- Conjunction: و (and)
- The definite article ال is already included in words that have it

GRAMMAR PATTERN: ${template.grammar_pattern}

INSTRUCTIONS: ${template.grammar_instructions}

STRICT REQUIREMENTS:
1. Create exactly ${template.sentence_count} sentences
2. EVERY Arabic word in your sentences MUST come from the vocabulary list above (except pronouns and و)
3. Do NOT invent or add any new Arabic words - this is critical
4. Copy the Arabic words exactly as they appear in the vocabulary (with their exact tashkeel)
5. Each sentence must be grammatically correct
6. Progress from simple (2-3 words) to more complex (4-5 words)
7. English translations must be accurate and natural

VALIDATION CHECK: Before outputting, verify that EVERY Arabic word (except pronouns/و) appears exactly in the vocabulary list above. If a word is not in the list, do not use it.

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
        if (!Array.isArray(generatedSentences) || generatedSentences.length !== template.sentence_count) {
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
        exercise_template_id,
        user_id: user_id || null,
        surah_ids,
        generated_sentences: generatedSentences,
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
    // Log for debugging
    console.log(`[Exercise Generate] Surah IDs: ${surah_ids.join(', ')}`);
    console.log(`[Exercise Generate] Found ${verses.length} verses, ${words.length} words`);
    console.log(`[Exercise Generate] Unique vocabulary: ${limitedVocab.length} words`);
    console.log(`[Exercise Generate] Vocabulary sample: ${limitedVocab.slice(0, 5).map(v => v.arabic).join(', ')}`);

    return new Response(
      JSON.stringify({
        success: true,
        instance_id: instance.id,
        vocabulary: limitedVocab,
        sentence_count: generatedSentences.length,
        debug: {
          surah_ids_queried: surah_ids,
          verses_found: verses.length,
          words_found: words.length,
          unique_vocab_count: limitedVocab.length,
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
