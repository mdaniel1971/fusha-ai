import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { parseObservations, logMultipleObservations } from '@/lib/observationLogger';

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

// Fetch scenarios for a surah (via lessons table)
async function fetchScenarios(surahId: number) {
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id')
    .eq('surah_id', surahId)
    .single();

  if (!lesson) return [];

  const { data: scenarios } = await supabase
    .from('scenarios')
    .select('title, setup_english, setup_arabic, context')
    .eq('lesson_id', lesson.id);

  return scenarios || [];
}

// Format scenarios for the prompt
function formatScenarios(scenarios: any[]): string {
  if (!scenarios.length) return '';

  return scenarios.map((s, i) => {
    let entry = `${i + 1}. ${s.title}`;
    entry += `\n   Setup: ${s.setup_english}`;
    if (s.setup_arabic) entry += `\n   Arabic: ${s.setup_arabic}`;
    if (s.context) entry += `\n   Context: ${s.context}`;
    return entry;
  }).join('\n\n');
}

// ===========================================
// META PROMPT - applies to ALL levels
// ===========================================
const META_PROMPT = `You are an Arabic teacher helping students learn Quranic vocabulary.

TONE:
- Encouraging but measured - save enthusiasm for real breakthroughs
- Correct answers: "Right" / "Good" / "Correct"
- Wrong answers: direct correction, no excessive softening
- 2-3 sentences maximum per response
- NO MARKDOWN: Never use **, *, _, backticks, #, hyphens, or any other markdown formatting
- No emojis, no "Today we'll..." preambles

ADAPTIVE TEACHING:
- Increase difficulty after 2-3 consecutive correct answers
- Simplify after 2-3 struggles
- Vary question types: translation, fill-in-blank, "how would you say...", identification, correction
- Never repeat same format more than twice in a row
- Build on demonstrated knowledge

NATURAL USAGE:
- Only use vocabulary in contexts where it naturally occurs
- بِسْمِ اللَّهِ: before eating, starting tasks - NOT introductions
- الحمد لله: gratitude, "how are you" - NOT random situations
- Ask yourself: "Would an Arab actually say this here?"

ARABIC RECOGNITION:
- Accept attached prefixes: و ف ب ل ك
- Accept connected and spaced forms: الحمدلله / الحمد لله
- Focus on meaning and usage, not spelling variants

COMPOUND WORDS:
- Accept answers identifying ANY component correctly
- بِسْمِ = بِ (preposition) + اسْمِ (noun) - both correct
- Response: "Right, that's the [part]. Full word is [prep] + [noun]"

SCENARIOS (Levels 2-3):
- Use provided scenarios for realistic practice
- If none provided, create everyday contexts for natural vocabulary use
- Build sentences appropriate to level complexity

TEACHING APPROACH:
- After student responds, give brief feedback then continue
- If wrong, provide correct answer with brief explanation
- Keep momentum - don't linger on explanations

FIRST MESSAGE:
"Asalaam alaikum!" then immediately start the lesson.

OBSERVATION LOGGING:
Log 2-4 observations at START of each response:
[OBS:type|category|skill|description]

Types: strength, weakness, pattern (2+ times), breakthrough
Categories: vocabulary, grammar, pronunciation, comprehension, fluency

Be specific:
Good: "subject-verb agreement with feminine plural"
Bad: "grammar error"

Include actual Arabic used. Invisible to user. Skip first greeting only.`;

// ===========================================
// LEVEL-SPECIFIC PROMPTS
// ===========================================

function buildLevel1Prompt(verses: any[], words: any[], surahName: string, _scenariosText: string): string {
  const verseList = verses.map(v => `Verse ${v.verse_number}: ${v.text_arabic}`).join('\n');

  let answerKey = '';
  for (const verse of verses) {
    const verseWords = words.filter((w: any) => w.verse_id === verse.id);
    const wordDetails = verseWords.map((w: any) =>
      `${w.text_arabic} (${w.translation_english || '?'}) [${w.part_of_speech || '?'}]`
    ).join(' | ');
    answerKey += `Verse ${verse.verse_number}: ${wordDetails}\n`;
  }

  return `
LEVEL 1: VERSE TRANSLATION & BASIC GRAMMAR
Surah: ${surahName}

VERSES:
${verseList}

ANSWER KEY:
${answerKey}

TASK:
1. Show one verse in Arabic, ask: "What does this mean?"
2. After translation, ask about a word: "What part of speech is [word]?"

GRAMMAR TO TEACH:
- Noun (ism): اسم الله رب
- Verb (fi'l): past, present, command
- Preposition (harf): بِ مِن إلى

Note: Ask about individual words from answer key (بِ, اسْم, الله), not compounds (بِسْمِ).

START: Show first verse.`;
}

function buildLevel2Prompt(verses: any[], words: any[], surahName: string, scenariosText: string): string {
  const vocabList = Array.from(new Set(words.map((w: any) =>
    `${w.text_arabic} (${w.transliteration || '?'}) - ${w.translation_english || '?'} [${w.part_of_speech || '?'}]`
  ))).slice(0, 15).join('\n');

  const scenarioSection = scenariosText
    ? `\nSCENARIOS:\n${scenariosText}`
    : '';

  return `
LEVEL 2: EVERYDAY SCENARIOS & GRAMMATICAL CASES
Surah: ${surahName}

VOCABULARY:
${vocabList}
${scenarioSection}

TASK:
Ask students to use words in short sentences (2-4 words). Teach grammatical cases in context.

GRAMMAR TO TEACH:
- Nominative (marfu' ُ): subjects, predicates
- Accusative (mansub َ): objects, adverbs  
- Genitive (majrur ِ): after prepositions, in idafa
Explain WHY a word takes its case.

START: Set up first scenario.`;
}

function buildLevel3Prompt(verses: any[], words: any[], surahName: string, scenariosText: string): string {
  const vocabList = Array.from(new Set(words.map((w: any) =>
    `${w.text_arabic} (${w.transliteration || '?'}) - ${w.translation_english || '?'} [${w.part_of_speech || '?'}]`
  ))).join('\n');

  const scenarioSection = scenariosText
    ? `\nSCENARIOS:\n${scenariosText}`
    : '';

  return `
LEVEL 3: COMPLEX SENTENCES & VERB MORPHOLOGY
Surah: ${surahName}

VOCABULARY:
${vocabList}
${scenarioSection}

TASK:
Build longer sentences with multiple words. Test verb form identification (Forms I-X), passive voice, imperatives. Discuss root patterns.

TESTING RULES:
- Students identify roots, forms, meanings themselves
- Do NOT provide answers in questions
- Bad: "Root is ع-و-ن, what form?" (gives away root)
- Good: "What's the root? What form? What does prefix add?"
- If wrong, teach, then test with different word

GRAMMAR TO TEACH:
Forms: I (fa'ala - basic), II (fa''ala - intensive), III (faa'ala - reciprocal), IV (af'ala - causative), V (tafa''ala - reflexive), VI (tafaa'ala - mutual), VII (infa'ala - passive-like), VIII (ifta'ala - reflexive), X (istaf'ala - seeking)

Passive: yu'badu vs ya'budu (is worshipped vs worships)
Imperative: u'bud (worship!), ihdi (guide!)
Root system: 3-letter roots generate word families

START: Pick a verb, ask student to identify root, form, meaning.`;
}

// ===========================================
// MAIN HANDLER
// ===========================================

export async function POST(request: NextRequest) {
  try {
    const { messages, surahId = 1, level = 1, sessionId } = await request.json();

    // Fetch all data in parallel
    const [surahData, scenarios, surahInfo] = await Promise.all([
      fetchSurahData(surahId),
      fetchScenarios(surahId),
      supabase.from('surahs').select('name_english').eq('id', surahId).single()
    ]);

    const { verses, words } = surahData;
    const surahName = surahInfo.data?.name_english || `Surah ${surahId}`;
    const scenariosText = formatScenarios(scenarios);

    // Build level-specific prompt
    let levelPrompt: string;
    switch (level) {
      case 1:
        levelPrompt = buildLevel1Prompt(verses, words, surahName, scenariosText);
        break;
      case 2:
        levelPrompt = buildLevel2Prompt(verses, words, surahName, scenariosText);
        break;
      case 3:
        levelPrompt = buildLevel3Prompt(verses, words, surahName, scenariosText);
        break;
      default:
        levelPrompt = buildLevel1Prompt(verses, words, surahName, scenariosText);
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
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            system: systemPrompt,
            messages: claudeMessages,
          });

          let fullResponse = '';

          // Collect the full response first, then stream the cleaned version
          for await (const event of response) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullResponse += event.delta.text;
            }
          }

          // Remove all OBS tags and markdown formatting from the complete response
          let cleanedResponse = fullResponse.replace(/\[OBS:[^\]]+\]\s*/g, '').trim();
          // Remove markdown: bold (**text**), italics (*text* or _text_), backticks, etc.
          cleanedResponse = cleanedResponse
            .replace(/\*\*(.+?)\*\*/g, '$1')  // **bold** → bold
            .replace(/\*(.+?)\*/g, '$1')      // *italic* → italic
            .replace(/_(.+?)_/g, '$1')        // _italic_ → italic
            .replace(/`(.+?)`/g, '$1')        // `code` → code
            .trim();

          // Stream the cleaned response in chunks for a natural feel
          if (cleanedResponse) {
            const chunkSize = 20;
            for (let i = 0; i < cleanedResponse.length; i += chunkSize) {
              const chunk = cleanedResponse.slice(i, i + chunkSize);
              const data = JSON.stringify({ text: chunk });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // Log observations asynchronously (don't block the response)
          if (sessionId && fullResponse) {
            const { observations } = parseObservations(fullResponse, sessionId);
            if (observations.length > 0) {
              logMultipleObservations(observations).catch(err => {
                console.error('Failed to log observations:', err);
              });
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