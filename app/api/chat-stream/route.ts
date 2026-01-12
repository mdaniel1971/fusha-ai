import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { parseGrammarObservations, logGrammarObservations } from '@/lib/grammarObservationLogger';
import { parseTranslationObservations, logTranslationObservations } from '@/lib/translationObservationLogger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Fetch verses and words for a surah (up to 20 words)
async function fetchSurahData(surahId: number, maxWords = 20) {
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
    .select('id, verse_id, word_position, text_arabic, transliteration, translation_english, part_of_speech')
    .in('verse_id', verseIds)
    .order('verse_id', { ascending: true })
    .order('word_position', { ascending: true })
    .limit(maxWords);

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
// BASE TEACHING PROMPT
// ===========================================
const BASE_PROMPT = `You are an Arabic teacher helping students learn Quranic vocabulary.

TONE:
- Encouraging but measured - save enthusiasm for real breakthroughs
- Correct answers: "Right" / "Good" / "Correct"
- Wrong answers: direct correction, no excessive softening
- 2-3 sentences maximum per response
- NO MARKDOWN: Never use **, *, _, backticks, #, hyphens, or any other markdown formatting
- No emojis, no "Today we'll..." preambles

NATURAL USAGE:
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

TEACHING APPROACH:
- After student responds, give brief feedback then continue
- If wrong, provide correct answer with brief explanation
- Keep momentum - don't linger on explanations

FIRST MESSAGE:
"Asalaam alaikum!" then immediately ask a question.`;

// ===========================================
// LEARNING MODE PROMPTS
// ===========================================

const GRAMMAR_MODE_PROMPT = `
FOCUS: GRAMMAR ONLY
Ask ONLY about grammar concepts. Do NOT ask translation questions.

QUESTION TYPES:
- "What part of speech is [word]?" (noun/verb/preposition/adjective)
- "What grammatical case is [word] in?" (nominative/accusative/genitive)
- "What verb form is this?" (Forms I-X)
- "Is this active or passive voice?"

ADAPTIVE DIFFICULTY:
- Start with: part of speech (noun/ism, verb/fi'l, preposition/harf)
- After 2-3 correct: grammatical cases (nominative/marfu', accusative/mansub, genitive/majrur)
- After more success: verb forms (I-X), roots, passive voice

LOGGING - USE GRAM TAG (required):
When student answers a grammar question, log with GRAM tag.
Format: [GRAM:word_id|feature|student_answer|correct_answer|correct/incorrect]

The word_id is the NUMBER after "ID:" in the ANSWER KEY.
Example: If student says "verb" but correct answer is "noun" for word ID:5:
[GRAM:5|part_of_speech|verb|noun|incorrect]

If student answers correctly:
[GRAM:5|part_of_speech|noun|noun|correct]

CRITICAL: The first value MUST be a number (the ID from answer key). Never use "undefined".
Log EVERY grammar response.`;

const TRANSLATION_MODE_PROMPT = `
FOCUS: TRANSLATION ONLY
Ask ONLY about word meanings. Do NOT ask grammar questions.

QUESTION TYPES:
- "What does [Arabic word] mean?"
- "How do you say [English] in Arabic?"
- "What word means [definition]?"
- Fill in the blank: "الحمد means ___"

ADAPTIVE DIFFICULTY:
- Start with: simple "what does X mean?" questions
- After 2-3 correct: reverse (English to Arabic)
- After more success: context-based usage questions

LOGGING - USE TRANS TAG (required):
When student answers a translation question, log with TRANS tag.
Format: [TRANS:word_id|student_answer|correct_answer|correct/incorrect]

The word_id is the NUMBER after "ID:" in the ANSWER KEY.
Example: If student says "mercy" for الرحمن (correct answer is "The Most Merciful"):
[TRANS:3|mercy|The Most Merciful|incorrect]

If student answers correctly:
[TRANS:3|The Most Merciful|The Most Merciful|correct]

CRITICAL: The first value MUST be a number (the ID from answer key). Never use "undefined".
Log EVERY translation response.`;

const MIX_MODE_PROMPT = `
FOCUS: MIXED (50% grammar, 50% translation)
Alternate between grammar and translation questions.

GRAMMAR QUESTIONS:
- "What part of speech is [word]?"
- "What grammatical case is [word] in?"

TRANSLATION QUESTIONS:
- "What does [Arabic word] mean?"
- "How do you say [English] in Arabic?"

ADAPTIVE DIFFICULTY:
- Start simple with both types
- Increase complexity as student demonstrates competence
- If struggling with one type, give more practice on that

LOGGING - USE BOTH TAGS:
For grammar questions, use GRAM tag:
[GRAM:word_id|feature|student_answer|correct_answer|correct/incorrect]

For translation questions, use TRANS tag:
[TRANS:word_id|student_answer|correct_answer|correct/incorrect]

CRITICAL: The first value MUST be a number (the ID from answer key). Never use "undefined".
Log EVERY response with the appropriate tag.`;

// ===========================================
// SURAH-BASED PROMPT BUILDER
// ===========================================

type LearningMode = 'grammar' | 'translation' | 'mix';

function buildSurahPrompt(verses: any[], words: any[], surahName: string, learningMode: LearningMode): string {
  const verseList = verses.map(v => `Verse ${v.verse_number}: ${v.text_arabic}`).join('\n');

  // Build answer key with word IDs
  let answerKey = '';
  for (const verse of verses) {
    const verseWords = words.filter((w: any) => w.verse_id === verse.id);
    const wordDetails = verseWords.map((w: any) =>
      `ID:${w.id} ${w.text_arabic} (${w.translation_english || '?'}) [${w.part_of_speech || '?'}]`
    ).join(' | ');
    if (wordDetails) {
      answerKey += `Verse ${verse.verse_number}: ${wordDetails}\n`;
    }
  }

  // Select mode-specific prompt
  let modePrompt: string;
  switch (learningMode) {
    case 'grammar':
      modePrompt = GRAMMAR_MODE_PROMPT;
      break;
    case 'translation':
      modePrompt = TRANSLATION_MODE_PROMPT;
      break;
    case 'mix':
    default:
      modePrompt = MIX_MODE_PROMPT;
  }

  return `
SURAH: ${surahName}

VERSES:
${verseList}

ANSWER KEY (words with IDs - use these for testing):
${answerKey}

CRITICAL RULES:
1. ONLY test words that appear in the ANSWER KEY above
2. Each word has an ID (e.g., ID:2) - use this in your logging tags
3. Log EVERY student response with the appropriate tag
${modePrompt}

START: Greet the student and ask your first question.`;
}

// ===========================================
// MAIN HANDLER
// ===========================================

export async function POST(request: NextRequest) {
  try {
    const { messages, surahId = 1, sessionId, model = 'claude-haiku-4-5-20251001', learningMode = 'mix', systemOverride } = await request.json();

    let systemPrompt: string;

    // If systemOverride is provided, use it directly (for scenario mode)
    if (systemOverride) {
      systemPrompt = systemOverride;
    } else {
      // Fetch all data in parallel for standard lesson mode (up to 20 words)
      const [surahData, surahInfo] = await Promise.all([
        fetchSurahData(surahId, 20),
        supabase.from('surahs').select('name_english').eq('id', surahId).single()
      ]);

      const { verses, words } = surahData;
      const surahName = surahInfo.data?.name_english || `Surah ${surahId}`;

      // Build surah prompt with learning mode
      const surahPrompt = buildSurahPrompt(verses, words, surahName, learningMode as LearningMode);

      // Combine base + surah prompt
      systemPrompt = BASE_PROMPT + '\n' + surahPrompt;
    }

    const claudeMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const encoder = new TextEncoder();

    // Pricing per million tokens (from Anthropic console, Jan 2026)
    const MODEL_PRICING: Record<string, { input: number; output: number }> = {
      'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
      'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
      'claude-opus-4-5-20251101': { input: 5.00, output: 25.00 },
    };

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.stream({
            model,
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

          // Get final message with usage info
          const finalMessage = await response.finalMessage();
          const usage = finalMessage.usage;
          const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-haiku-4-5-20251001'];
          const inputCost = (usage.input_tokens / 1_000_000) * pricing.input;
          const outputCost = (usage.output_tokens / 1_000_000) * pricing.output;
          const totalCost = inputCost + outputCost;

          // Remove all GRAM and TRANS tags and markdown formatting from the complete response
          let cleanedResponse = fullResponse
            .replace(/\[GRAM:[^\]]+\]\s*/g, '')
            .replace(/\[TRANS:[^\]]+\]\s*/g, '')
            .trim();
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

          // Send usage data as a separate event
          const usageData = JSON.stringify({
            usage: {
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
              totalTokens: usage.input_tokens + usage.output_tokens,
              inputCost: inputCost.toFixed(6),
              outputCost: outputCost.toFixed(6),
              totalCost: totalCost.toFixed(6),
              model,
            }
          });
          controller.enqueue(encoder.encode(`data: ${usageData}\n\n`));

          // Log observations asynchronously (don't block the response)
          if (sessionId && fullResponse) {
            // Log grammar observations (GRAM tags)
            const gramMatch = fullResponse.match(/\[GRAM:[^\]]+\]/g);
            if (gramMatch) {
              console.log('Raw GRAM tags found:', gramMatch);
              const { observations: grammarObs } = parseGrammarObservations(fullResponse, sessionId);
              console.log('GRAM tags parsed:', grammarObs.length);
              if (grammarObs.length > 0) {
                logGrammarObservations(grammarObs).catch((err: Error) => {
                  console.error('Failed to log grammar observations:', err);
                });
              }
            }

            // Log translation observations (TRANS tags)
            const transMatch = fullResponse.match(/\[TRANS:[^\]]+\]/g);
            if (transMatch) {
              console.log('Raw TRANS tags found:', transMatch);
              const { observations: transObs } = parseTranslationObservations(fullResponse, sessionId);
              console.log('TRANS tags parsed:', transObs.length);
              if (transObs.length > 0) {
                logTranslationObservations(transObs).catch((err: Error) => {
                  console.error('Failed to log translation observations:', err);
                });
              }
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