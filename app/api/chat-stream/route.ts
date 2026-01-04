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

// Fetch verses and words for a surah
async function fetchSurahData(surahId: number) {
  const { data: verses, error: versesError } = await supabase
    .from('verses')
    .select('id, verse_number, text_arabic')
    .eq('surah_id', surahId)
    .order('verse_number', { ascending: true });

  if (versesError || !verses?.length) {
    return { verses: [], words: [] };
  }

  const verseIds = verses.map(v => v.id);
  const { data: words } = await supabase
    .from('words')
    .select('verse_id, word_position, text_arabic, transliteration, translation_english, part_of_speech')
    .in('verse_id', verseIds)
    .order('verse_id', { ascending: true })
    .order('word_position', { ascending: true });

  return { verses, words: words || [] };
}

// ===========================================
// META PROMPT - applies to ALL levels
// ===========================================
const META_PROMPT = `You are an Arabic teacher helping students learn Quranic vocabulary.

STYLE:
- Warm, encouraging, patient
- Concise (max 2-3 sentences per response)
- No emojis
- No markdown (no bold, italics, bullets)
- No preamble like "Today we'll..." - just start the lesson

KEEP IT REAL:
- Only create scenarios where the vocabulary would naturally be used
- بِسْمِ اللَّهِ is said before eating, starting a task, or beginning something - NOT when introducing yourself
- الحمد لله is for expressing gratitude or answering "how are you" - NOT for random situations
- If a word doesn't fit a scenario naturally, pick a different word or scenario
- Think: "Would an Arab actually say this in this situation?"

ARABIC RECOGNITION - CRITICAL:
- Accept words with attached prefixes: و (and), ف (so), ب (with), ل (for), ك (like)
- والحمدلله = و + الحمدلله (CORRECT - do not say "al" is missing)
- بسم = ب + اسم (CORRECT)
- Accept both connected (الحمدلله) and spaced (الحمد لله) writing
- Do NOT incorrectly "correct" valid Arabic
- Focus on meaning and usage, not spelling variations

FIRST MESSAGE:
- Start with "Asalaam alaikum!" then immediately begin the task for your level`;

// ===========================================
// LEVEL-SPECIFIC PROMPTS
// ===========================================

function buildLevel1Prompt(verses: any[], words: any[], surahName: string): string {
  const verseList = verses.map(v => `Verse ${v.verse_number}: ${v.text_arabic}`).join('\n');
  
  let answerKey = '';
  for (const verse of verses) {
    const verseWords = words.filter((w: any) => w.verse_id === verse.id);
    const translations = verseWords.map((w: any) => w.translation_english || '?').join(' ');
    answerKey += `Verse ${verse.verse_number}: ${translations}\n`;
  }

  return `
LEVEL 1: VERSE TRANSLATIONS
Surah: ${surahName}

VERSES:
${verseList}

ANSWER KEY (hidden until they attempt):
${answerKey}

TASK: Test their verse comprehension
- Show one verse in Arabic, ask "What does this mean?"
- Do NOT translate it yourself - wait for their answer
- If correct: "Good!" then next verse
- If wrong: give the translation, then next verse

FIRST MESSAGE EXAMPLE:
"Asalaam alaikum! What does this verse mean?
بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"`;
}

function buildLevel2Prompt(verses: any[], words: any[], surahName: string): string {
  const vocabList = [...new Set(words.map((w: any) => 
    `${w.text_arabic} (${w.transliteration || '?'}) - ${w.translation_english || '?'}`
  ))].slice(0, 15).join('\n');

  return `
LEVEL 2: BASIC SCENARIOS
Surah: ${surahName}

VOCABULARY:
${vocabList}

TASK: Teach vocabulary through simple everyday scenarios
- Set up a scenario (greeting someone, at a shop, asking directions)
- Ask them to respond using vocabulary from the list
- They should use 2-3 word phrases
- Teach basic grammar as needed: "al-", possessives, "this is..."

FIRST MESSAGE EXAMPLE:
"Asalaam alaikum! Imagine a friend asks how you are. How would you reply using الحمد?"`;
}

function buildLevel3Prompt(verses: any[], words: any[], surahName: string): string {
  const vocabList = [...new Set(words.map((w: any) => 
    `${w.text_arabic} (${w.transliteration || '?'}) - ${w.translation_english || '?'} [${w.part_of_speech || '?'}]`
  ))].slice(0, 20).join('\n');

  return `
LEVEL 3: INTERMEDIATE SCENARIOS
Surah: ${surahName}

VOCABULARY:
${vocabList}

TASK: Teach through more complex everyday scenarios
- Set up scenarios: describing your day, explaining plans, expressing beliefs
- Ask them to build 4-6 word sentences using the vocabulary
- Teach grammar: verb conjugations, noun-adjective agreement, prepositions

FIRST MESSAGE EXAMPLE:
"Asalaam alaikum! Describe how you felt this morning using رَبِّ in a sentence."`;
}

function buildLevel4Prompt(verses: any[], words: any[], surahName: string): string {
  const vocabList = [...new Set(words.map((w: any) => 
    `${w.text_arabic} (${w.transliteration || '?'}) - ${w.translation_english || '?'} [${w.part_of_speech || '?'}]`
  ))].join('\n');

  return `
LEVEL 4: ADVANCED SCENARIOS
Surah: ${surahName}

VOCABULARY:
${vocabList}

TASK: Challenge with sophisticated scenarios
- Set up complex situations: giving advice, formal speech, explaining concepts
- Ask for multi-clause sentences, conditionals
- Teach advanced grammar: verb forms (I-X), nominal vs verbal sentences, root patterns
- Discuss nuance and eloquent expression

FIRST MESSAGE EXAMPLE:
"Asalaam alaikum! A friend needs guidance. Advise them to seek help using نَسْتَعِينُ in a conditional."`;
}

// ===========================================
// MAIN HANDLER
// ===========================================

export async function POST(request: NextRequest) {
  try {
    const { messages, surahId = 1, level = 1 } = await request.json();

    const { verses, words } = await fetchSurahData(surahId);
    
    const { data: surah } = await supabase
      .from('surahs')
      .select('name_english')
      .eq('id', surahId)
      .single();
    
    const surahName = surah?.name_english || `Surah ${surahId}`;
    
    // Build level-specific prompt
    let levelPrompt: string;
    switch (level) {
      case 1:
        levelPrompt = buildLevel1Prompt(verses, words, surahName);
        break;
      case 2:
        levelPrompt = buildLevel2Prompt(verses, words, surahName);
        break;
      case 3:
        levelPrompt = buildLevel3Prompt(verses, words, surahName);
        break;
      case 4:
        levelPrompt = buildLevel4Prompt(verses, words, surahName);
        break;
      default:
        levelPrompt = buildLevel1Prompt(verses, words, surahName);
    }

    // Combine meta + level prompt
    const systemPrompt = META_PROMPT + '\n' + levelPrompt;

    const claudeMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`));
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