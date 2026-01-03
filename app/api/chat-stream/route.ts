import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Fetch vocabulary for a surah from the database
async function fetchSurahVocabulary(surahId: number): Promise<{vocabulary: string, answerKey: string}> {
  // Get verse IDs for this surah
  const { data: verses, error: versesError } = await supabase
    .from('verses')
    .select('id')
    .eq('surah_id', surahId)
    .order('verse_number', { ascending: true });

  if (versesError) {
    console.error('Error fetching verses:', versesError);
    throw new Error('Failed to fetch verses from database');
  }

  if (!verses || verses.length === 0) {
    return { vocabulary: 'No verses found.', answerKey: '' };
  }

  const verseIds = verses.map(v => v.id);

  // Get unique words for those verses
  const { data: words, error: wordsError } = await supabase
    .from('words')
    .select('text_arabic, transliteration, translation_english, part_of_speech')
    .in('verse_id', verseIds)
    .order('verse_id', { ascending: true })
    .order('word_position', { ascending: true });

  if (wordsError) {
    console.error('Error fetching words:', wordsError);
    throw new Error('Failed to fetch words from database');
  }

  if (!words || words.length === 0) {
    return { vocabulary: 'No vocabulary loaded.', answerKey: '' };
  }

  // Deduplicate by Arabic text
  const seen = new Set<string>();
  const uniqueWords = words.filter(word => {
    if (seen.has(word.text_arabic)) return false;
    seen.add(word.text_arabic);
    return true;
  });

  // Build vocabulary list (no translations)
  const vocabulary = uniqueWords
    .map((word) => {
      const transliteration = word.transliteration ? ` (${word.transliteration})` : '';
      return `- ${word.text_arabic}${transliteration}`;
    })
    .join('\n');

  // Build answer key (with translations)
  const answerKey = uniqueWords
    .map((word) => {
      const translation = word.translation_english || 'no translation';
      return `${word.text_arabic}: ${translation}`;
    })
    .join('\n');

  return { vocabulary, answerKey };
}

// Build system prompt with vocabulary from database
function buildSystemPrompt(vocabulary: string, answerKey: string, surahName: string): string {
  return `You are an Arabic teacher testing Quranic vocabulary.

WORDS TO TEST (Arabic and transliteration only - you don't know the meanings yet):
${vocabulary}

ANSWER KEY (use this to check their answers, but NEVER reveal until they attempt):
${answerKey}

RULES:
1. Ask what a word means. Do NOT give the translation - you're testing them.
2. Wait for their answer.
3. If correct: "Good!" then test the next word.
4. If wrong or they don't know: tell them the meaning, then move on.
5. One word at a time. Maximum 2 sentences per response.
6. No emojis. No markdown.

FIRST MESSAGE FORMAT:
"Asalaam alaikum! What does [arabicword] ([transliteration]) mean?"

NEVER say "which means" or "it means" in your first message or when asking a question.`;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, surahId = 1 } = await request.json();

    // Fetch vocabulary from database
    const { vocabulary, answerKey } = await fetchSurahVocabulary(surahId);
    
    // Fetch surah name from database
    const { data: surah } = await supabase
      .from('surahs')
      .select('name_english')
      .eq('id', surahId)
      .single();
    
    const surahName = surah?.name_english || `Surah ${surahId}`;
    
    // Build system prompt with fetched vocabulary
    const systemPrompt = buildSystemPrompt(vocabulary, answerKey, surahName);

    // Build message array for Claude
    const claudeMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Create streaming response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 512,
            system: systemPrompt,
            messages: claudeMessages,
          });

          for await (const event of response) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const data = JSON.stringify({ text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          console.error('Stream error:', error);
          const errorData = JSON.stringify({ error: 'Stream failed' });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get response' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}