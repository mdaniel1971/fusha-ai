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
  // First get the lesson for this surah
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id')
    .eq('surah_id', surahId)
    .single();

  if (!lesson) {
    return [];
  }

  // Then get scenarios for this lesson
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

STYLE:
- Warm, encouraging, patient
- Concise (max 2-3 sentences per response)
- No emojis
- No markdown (no bold, italics, bullets)
- No preamble like "Today we'll..." - just start the lesson

ADAPTIVE TEACHING:
- Track how the student is doing across the conversation
- If they get 2-3 answers right in a row: increase difficulty (harder words, more complex questions)
- If they struggle with 2-3 answers: simplify, give hints, or break down the concept
- Vary question types to keep it interesting: translation, fill-in-blank, "how would you say...", identification, correction
- Don't repeat the same question format more than twice in a row
- Build on what they've shown they know

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
- Start with "Asalaam alaikum!" then immediately begin the task for your level

SILENT LEARNING OBSERVATION LOGGING:
After processing EVERY user response, log 2-4 observations using this exact format at the START of your response (before your conversational message):
[OBS:type|category|skill|description]

Observation Types:
- strength - Correct usage, good understanding, creative application
- weakness - Errors, confusion, misunderstandings
- pattern - Recurring behaviors (good or bad) you notice 2+ times
- breakthrough - "Aha!" moments, sudden understanding, self-correction

Skill Categories:
- vocabulary - Word choice, usage in context, recall
- grammar - Conjugation, agreement, sentence structure, case endings
- pronunciation - Sound production, emphasis (if voice enabled)
- comprehension - Understanding questions, following context
- fluency - Naturalness, hesitation patterns, code-switching

Be hyper-specific with the skill name:
BAD: "grammar error"
GOOD: "subject-verb agreement with feminine plural"
BAD: "vocabulary mistake"
GOOD: "confused في (in) vs على (on) for location"

Example observations:
[OBS:strength|vocabulary|correct_verb_conjugation|Used "ذهبَ" (he went) with proper fatha ending in past tense context]
[OBS:weakness|grammar|preposition_confusion|Said "في المطبخ" when context required "إلى المطبخ" (to vs in)]
[OBS:pattern|fluency|english_word_order|Consistently puts adjectives before nouns instead of Arabic noun-adjective order]
[OBS:breakthrough|comprehension|case_awareness|Spontaneously asked about why "كتابٌ" had tanween]

Critical Rules:
- Log observations at the START of your response, before your conversational text
- Be balanced - log strengths and breakthroughs, not only weaknesses
- Include the actual Arabic they used (or should have used)
- These observations are invisible to the user - they only see your conversational response
- Skip observations for the first greeting message only`;

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
LEVEL 1: TRANSLATIONS AND BASIC GRAMMAR
Surah: ${surahName}

VERSES:
${verseList}

ANSWER KEY (word-by-word with parts of speech):
${answerKey}

TASK: Test verse comprehension and basic grammar
- Show one verse in Arabic, ask "What does this mean?"
- After they translate, ask about specific words: "Is this word a noun, verb, or preposition?"
- Teach basic parts of speech: noun (ism), verb (fi'l), preposition (harf)
- If correct: brief praise, then continue
- If wrong: give the answer with brief explanation, then continue

GRAMMAR TO TEACH:
- Nouns (ism): names, things, concepts
- Verbs (fi'l): actions - past, present, command forms
- Prepositions/Particles (harf): connecting words like bi (in/with), min (from), ila (to)

START: Show the first verse and ask what it means.`;
}

function buildLevel2Prompt(verses: any[], words: any[], surahName: string, scenariosText: string): string {
  const vocabList = Array.from(new Set(words.map((w: any) =>
    `${w.text_arabic} (${w.transliteration || '?'}) - ${w.translation_english || '?'} [${w.part_of_speech || '?'}]`
  ))).slice(0, 15).join('\n');

  const scenarioSection = scenariosText
    ? `\nPRACTICE SCENARIOS (use these to create natural conversation):\n${scenariosText}`
    : '';

  return `
LEVEL 2: SIMPLE SCENARIOS AND INTERMEDIATE GRAMMAR
Surah: ${surahName}

VOCABULARY:
${vocabList}
${scenarioSection}

TASK: Teach through everyday scenarios while introducing grammatical cases
- Use the scenarios provided above to create realistic practice situations
- If no scenarios provided, create simple everyday contexts where this vocabulary would naturally be used
- Ask them to use words in short sentences (2-4 words)
- Teach grammatical cases: nominative (marfu'), accusative (mansub), genitive (majrur)
- Explain WHY a word takes a certain case in context

GRAMMAR TO TEACH:
- Nominative (marfu' - damma): subjects, predicates
- Accusative (mansub - fatha): objects, adverbs
- Genitive (majrur - kasra): after prepositions, in idafa constructions
- Point out case endings when visible (tanwin, long vowels)

START: Set up the first scenario and ask the student to use vocabulary in context.`;
}

function buildLevel3Prompt(verses: any[], words: any[], surahName: string, scenariosText: string): string {
  const vocabList = Array.from(new Set(words.map((w: any) =>
    `${w.text_arabic} (${w.transliteration || '?'}) - ${w.translation_english || '?'} [${w.part_of_speech || '?'}]`
  ))).join('\n');

  const scenarioSection = scenariosText
    ? `\nPRACTICE SCENARIOS (use these for context):\n${scenariosText}`
    : '';

  return `
LEVEL 3: COMPLEX SENTENCES AND MORPHOLOGY
Surah: ${surahName}

VOCABULARY:
${vocabList}
${scenarioSection}

TASK: Challenge with complex grammar and verb morphology
- Use the scenarios provided above, or create meaningful contexts (prayer, seeking guidance, worship)
- Build longer sentences using multiple vocabulary words
- Teach and identify verb forms (Form I-X patterns)
- Practice passive voice (majhul) and imperative (amr)
- Discuss root patterns and how meaning changes with form

CRITICAL - TEST EVERYTHING, DON'T GIVE AWAY ANSWERS:
- At this level, the student should identify roots, forms, and meanings themselves
- Do NOT provide the root - ask them to identify it
- Do NOT hint at the answer in your question
- BAD: "The root is ع-و-ن, what form is this?" (gives away the root)
- BAD: "What does 'ista' tell us about seeking help?" (gives away "seeking")
- GOOD: "What is the root? What verb form? What does the prefix add?"
- If wrong, teach the concept, then test again with a different word
- Accept reasonable answers even if not word-perfect

GRAMMAR TO TEACH:
- Verb Forms: I (fa'ala - basic), II (fa''ala - intensive), III (faa'ala - reciprocal),
  IV (af'ala - causative), V (tafa''ala - reflexive of II), VI (tafaa'ala - mutual),
  VII (infa'ala - passive-like), VIII (ifta'ala - reflexive), X (istaf'ala - seeking)
- Passive voice: yu'badu instead of ya'budu (is worshipped vs worships)
- Imperative: u'bud! (worship!), ihdi! (guide!)
- Root system: how three-letter roots generate families of related words

START: Pick a verb from the vocabulary and ask the student to identify its root, form, and meaning.`;
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

    // Regex to detect OBS tags - we'll buffer until we're past them
    const obsTagPattern = /\[OBS:[^\]]+\]/g;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 512,
            system: systemPrompt,
            messages: claudeMessages,
          });

          let fullResponse = '';
          let buffer = '';
          let observationsExtracted = false;

          for await (const event of response) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const chunk = event.delta.text;
              fullResponse += chunk;
              buffer += chunk;

              // Buffer until we're confident we're past the OBS tags
              // OBS tags appear at the start, so once we see conversational text, we're done
              if (!observationsExtracted) {
                const lastCloseBracket = buffer.lastIndexOf(']');
                const textAfterTags = lastCloseBracket > -1 ? buffer.slice(lastCloseBracket + 1).trim() : '';

                // If we have text after the last ] or no OBS tags at all, start streaming
                if (textAfterTags.length > 10 || (!buffer.includes('[OBS:') && buffer.length > 20)) {
                  observationsExtracted = true;
                  // Remove all OBS tags and send the cleaned buffer
                  const cleanedBuffer = buffer.replace(obsTagPattern, '').trim();
                  if (cleanedBuffer) {
                    const data = JSON.stringify({ text: cleanedBuffer });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  }
                  buffer = '';
                }
              } else {
                // Already past OBS tags, stream directly (but still clean just in case)
                const cleanedChunk = chunk.replace(obsTagPattern, '');
                if (cleanedChunk) {
                  const data = JSON.stringify({ text: cleanedChunk });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              }
            }
          }

          // Flush any remaining buffer
          if (buffer) {
            const cleanedBuffer = buffer.replace(obsTagPattern, '').trim();
            if (cleanedBuffer) {
              const data = JSON.stringify({ text: cleanedBuffer });
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