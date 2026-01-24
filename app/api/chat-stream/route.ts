import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import {
  parseGrammarObservations,
  logGrammarObservations,
} from "@/lib/grammarObservationLogger";
import {
  parseTranslationObservations,
  logTranslationObservations,
} from "@/lib/translationObservationLogger";
import { loadLearnerContext, buildContextPrompt } from "@/lib/db";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Fetch verses and words for a surah (up to 20 words)
async function fetchSurahData(surahId: number, maxWords = 20) {
  const { data: verses, error: versesError } = await supabase
    .from("verses")
    .select("id, verse_number, text_arabic")
    .eq("surah_id", surahId)
    .order("verse_number", { ascending: true });

  if (versesError || !verses?.length) {
    return { verses: [], words: [] };
  }

  const verseIds = verses.map((v) => v.id);
  const { data: words } = await supabase
    .from("words")
    .select(
      "id, verse_id, word_position, text_arabic, transliteration, translation_english, part_of_speech",
    )
    .in("verse_id", verseIds)
    .order("verse_id", { ascending: true })
    .order("word_position", { ascending: true })
    .limit(maxWords);

  return { verses, words: words || [] };
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

DEFINITENESS (CRITICAL):
- "the X" in English = الـ + word in Arabic (definite article required)
- "a/an X" or just "X" = word without ال (indefinite)
- Example: "the day" = اليوم | "day/a day" = يوم
- Example: "the Lord" = الرب | "Lord/a lord" = رب
- If you ask "How do you say 'the Day'?" the answer MUST include ال
- If student provides اليوم for "the day", that is CORRECT
- If student provides يوم for "the day", that is WRONG (missing ال)
- Never claim definiteness comes from "context" - Arabic marks it explicitly with ال

COMPOUND WORDS & ENCLITICS:
- Be precise with strings containing attached pronouns or prefixes.
- If a string contains an attached pronoun (e.g., نا in اهْدِنَا or كَ in إِيَّاكَ), you MUST NOT ask "what part of speech is [entire string]".
- Instead, isolate the specific part: "In [phrase], what part of speech is the suffix نا?"
- Accept answers identifying ANY component correctly.
- بِسْمِ = بِ (preposition) + اسْمِ (noun) - treat as two parts.

TEACHING APPROACH:
- After student responds, give brief feedback then continue
- If wrong, provide correct answer with brief explanation
- Keep momentum - don't linger on explanations

FIRST MESSAGE:
"Asalaam alaikum!" then immediately ask a question.`;

// ===========================================
// META PROMPT - COMMON RULES FOR ALL MODES
// ===========================================

const META_PROMPT = `
ABSOLUTE RULE - ANSWER KEY ONLY:
You may ONLY ask about words that appear in the ANSWER KEY above.
- ONLY use words from this surah's answer key - no exceptions
- If a word isn't listed in the answer key, you cannot ask about it
- Do not invent translations or grammar - use exactly what the answer key provides

MORPHOLOGICAL AWARENESS:
- Arabic strings often combine multiple parts of speech.
- If asking about a fused word (e.g., Verb+Pronoun), specify which part you want.
- BAD: "What part of speech is اهْدِنَا?"
- GOOD: "In the word اهْدِنَا, what part of speech is the first part, اهْدِ?" 

ANSWER FORMAT FLEXIBILITY:
- Accept Arabic in script OR transliteration (الحمد or alhamd)
- Accept grammar terms in English OR Arabic (nominative/marfu', genitive/majrur, accusative/mansub)
- Accept synonyms and close meanings

GRAMMAR CONTEXT RULE:
When asking grammar questions, ALWAYS provide the phrase context:
- BAD: "What case is اللَّهِ in?"
- GOOD: "In بِسْمِ اللَّهِ, what case is اللَّهِ in?"

LOGGING TAGS (required for every student response):
Grammar: [GRAM:word_id|feature|student_answer|correct_answer|correct/incorrect]
Translation: [TRANS:word_id|student_answer|correct_answer|correct/incorrect]
- word_id = the NUMBER after "ID:" in answer key (e.g., ID:5 → use 5)
- feature = part_of_speech, grammatical_case, verb_form, root, or voice`;

// ===========================================
// LEVEL-SPECIFIC INSTRUCTIONS
// ===========================================

const GRAMMAR_LEVELS: Record<number, string> = {
  1: `LEVEL 1: PARTS OF SPEECH
Ask ONLY: "In [phrase], what part of speech is [segment]?"
- If the word in the key is compound (e.g., اهْدِنَا), ask about one part specifically (the verb or the suffix pronoun).
- Answers: noun, verb, particle, preposition, pronoun (use [part_of_speech] from answer key)
Do NOT ask about cases, verb forms, or roots at this level.`,

  2: `LEVEL 2: GRAMMATICAL CASES
Ask ONLY: "In [phrase], what grammatical case is [word] in?"
Answers:
- nominative (مرفوع/marfu') - subject, predicate
- accusative (منصوب/mansub) - object, after إن
- genitive (مجرور/majrur) - after preposition, in idafa
Do NOT ask about verb forms or roots at this level.`,

  3: `LEVEL 3: VERB FORMS (I-X)
Ask ONLY: "What form (I-X) is [verb]?" for verbs in the answer key
Form I (فَعَلَ): basic | Form II (فَعَّلَ): doubled middle | Form III (فَاعَلَ): alif after 1st
Form IV (أَفْعَلَ): hamza prefix | Form V (تَفَعَّلَ): ta + doubled | Form VI (تَفَاعَلَ): ta + alif
Form VII (اِنْفَعَلَ): in prefix | Form VIII (اِفْتَعَلَ): infixed ta | Form X (اِسْتَفْعَلَ): ista prefix
Do NOT ask about roots or voice at this level.`,

  4: `LEVEL 4: ROOTS AND VOICE
Ask about:
- "What is the 3-letter root of [word]?" (e.g., ح-م-د for الحمد)
- "Is [verb] active or passive voice?" (مَعْلُوم/ma'lum or مَجْهُول/majhul)
This is the most advanced grammar level.`,
};

const TRANSLATION_LEVELS: Record<number, string> = {
  1: `LEVEL 1: SINGLE WORDS (Arabic → English)
Ask ONLY: "What does [Arabic word] mean?"
Use single words from the answer key.
Accept answers matching or close to the (translation) in answer key.`,

  2: `LEVEL 2: REVERSE TRANSLATION (English → Arabic)
Ask ONLY: "How do you say [English] in Arabic?" or "Which word means [definition]?"
Use translations from the answer key, student provides Arabic word.
CRITICAL: If asking for "the X", the correct answer MUST include ال (e.g., "the day" = اليوم, NOT يوم).`,

  3: `LEVEL 3: TWO-WORD PHRASES
Ask ONLY about 2 consecutive words from a verse.
Example: "What does بِسْمِ اللَّهِ mean?"
Build expected answer from both words' translations in answer key.`,

  4: `LEVEL 4: FULL PHRASES
Ask about 3+ word sequences from the verses.
Example: "Translate: الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ"
Build expected answer by combining translations from answer key.`,
};

// ===========================================
// MODE-SPECIFIC PROMPTS
// ===========================================

const GRAMMAR_MODE_PROMPT = `
MODE: GRAMMAR ONLY
Ask ONLY grammar questions. Do NOT ask translation questions.
Use [GRAM:...] tags for logging.`;

const TRANSLATION_MODE_PROMPT = `
MODE: TRANSLATION ONLY
Ask ONLY translation questions. Do NOT ask grammar questions.
Use [TRANS:...] tags for logging.`;

const MIX_MODE_PROMPT = `
MODE: MIXED (alternate grammar and translation)
Alternate between grammar and translation questions each turn.
Use [GRAM:...] for grammar, [TRANS:...] for translation.`;

// ===========================================
// SURAH-BASED PROMPT BUILDER
// ===========================================

type LearningMode = "grammar" | "translation" | "mix";

function buildSurahPrompt(
  verses: any[],
  words: any[],
  surahName: string,
  learningMode: LearningMode,
  startLevel: number = 1,
): string {
  const verseList = verses
    .map((v) => `Verse ${v.verse_number}: ${v.text_arabic}`)
    .join("\n");

  // Build answer key with word IDs
  let answerKey = "";
  for (const verse of verses) {
    const verseWords = words.filter((w: any) => w.verse_id === verse.id);
    const wordDetails = verseWords
      .map(
        (w: any) =>
          `ID:${w.id} ${w.text_arabic} (${w.translation_english || "?"}) [${w.part_of_speech || "?"}]`,
      )
      .join(" | ");
    if (wordDetails) {
      answerKey += `Verse ${verse.verse_number}: ${wordDetails}\n`;
    }
  }

  // Select mode-specific prompt and level instructions
  let modePrompt: string;
  let levelInstructions: string;

  switch (learningMode) {
    case "grammar":
      modePrompt = GRAMMAR_MODE_PROMPT;
      levelInstructions = GRAMMAR_LEVELS[startLevel] || GRAMMAR_LEVELS[1];
      break;
    case "translation":
      modePrompt = TRANSLATION_MODE_PROMPT;
      levelInstructions =
        TRANSLATION_LEVELS[startLevel] || TRANSLATION_LEVELS[1];
      break;
    case "mix":
    default:
      modePrompt = MIX_MODE_PROMPT;
      // For mix mode, combine both level instructions
      const gramLevel = GRAMMAR_LEVELS[startLevel] || GRAMMAR_LEVELS[1];
      const transLevel =
        TRANSLATION_LEVELS[startLevel] || TRANSLATION_LEVELS[1];
      levelInstructions = `FOR GRAMMAR QUESTIONS:\n${gramLevel}\n\nFOR TRANSLATION QUESTIONS:\n${transLevel}`;
  }

  return `
SURAH: ${surahName}

VERSES:
${verseList}

ANSWER KEY (YOUR ONLY SOURCE - DO NOT INVENT WORDS):
${answerKey}
FORMAT: ID:number Arabic_word (English_translation) [part_of_speech]
${META_PROMPT}
${modePrompt}

YOUR CURRENT LEVEL:
${levelInstructions}

START: Greet the student and ask your first question at this level.`;
}

// ===========================================
// MAIN HANDLER
// ===========================================

export async function POST(request: NextRequest) {
  try {
    const {
      messages,
      surahId = 1,
      sessionId,
      userId,
      model = "claude-haiku-4-5-20251001",
      learningMode = "mix",
      startLevel = 1,
    } = await request.json();

    const [surahData, surahInfo, learnerContext] = await Promise.all([
      fetchSurahData(surahId, 20),
      supabase.from("surahs").select("name_english").eq("id", surahId).single(),
      userId ? loadLearnerContext(userId) : Promise.resolve(null),
    ]);

    const { verses, words } = surahData;
    const surahName = surahInfo.data?.name_english || `Surah ${surahId}`;

    const surahPrompt = buildSurahPrompt(
      verses,
      words,
      surahName,
      learningMode as LearningMode,
      startLevel,
    );

    let learnerContextPrompt = "";
    if (learnerContext) {
      const contextText = buildContextPrompt(learnerContext);
      learnerContextPrompt = `\n\n=== LEARNER PROFILE ===\n${contextText}\n\nUse this information to personalize your teaching. Address struggles carefully, build on strengths, and maintain continuity with previous lessons.`;
    }

    const systemPrompt =
      BASE_PROMPT + learnerContextPrompt + "\n" + surahPrompt;

    const claudeMessages = messages.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }),
    );

    const encoder = new TextEncoder();

    const MODEL_PRICING: Record<string, { input: number; output: number }> = {
      "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },
      "claude-sonnet-4-5-20250929": { input: 3.0, output: 15.0 },
      "claude-opus-4-5-20251101": { input: 5.0, output: 25.0 },
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

          let fullResponse = "";

          for await (const event of response) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullResponse += event.delta.text;
            }
          }

          const finalMessage = await response.finalMessage();
          const usage = finalMessage.usage;
          const pricing =
            MODEL_PRICING[model] || MODEL_PRICING["claude-haiku-4-5-20251001"];
          const inputCost = (usage.input_tokens / 1_000_000) * pricing.input;
          const outputCost = (usage.output_tokens / 1_000_000) * pricing.output;

          let cleanedResponse = fullResponse
            .replace(/\[GRAM:[^\]]+\]\s*/g, "")
            .replace(/\[TRANS:[^\]]+\]\s*/g, "")
            .trim();

          cleanedResponse = cleanedResponse
            .replace(/\*\*(.+?)\*\*/g, "$1")
            .replace(/\*(.+?)\*/g, "$1")
            .replace(/_(.+?)_/g, "$1")
            .replace(/`(.+?)`/g, "$1")
            .trim();

          if (cleanedResponse) {
            const chunkSize = 20;
            for (let i = 0; i < cleanedResponse.length; i += chunkSize) {
              const chunk = cleanedResponse.slice(i, i + chunkSize);
              const data = JSON.stringify({ text: chunk });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          const usageData = JSON.stringify({
            usage: {
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
              totalTokens: usage.input_tokens + usage.output_tokens,
              inputCost: inputCost.toFixed(6),
              outputCost: outputCost.toFixed(6),
              totalCost: (inputCost + outputCost).toFixed(6),
              model,
            },
          });
          controller.enqueue(encoder.encode(`data: ${usageData}\n\n`));

          if (sessionId && fullResponse) {
            const gramMatch = fullResponse.match(/\[GRAM:[^\]]+\]/g);
            if (gramMatch) {
              const { observations: grammarObs } = parseGrammarObservations(
                fullResponse,
                sessionId,
                userId,
              );
              if (grammarObs.length > 0) {
                logGrammarObservations(grammarObs).catch((err: Error) =>
                  console.error(err),
                );
              }
            }

            const transMatch = fullResponse.match(/\[TRANS:[^\]]+\]/g);
            if (transMatch) {
              const { observations: transObs } = parseTranslationObservations(
                fullResponse,
                sessionId,
                userId,
              );
              if (transObs.length > 0) {
                logTranslationObservations(transObs).catch((err: Error) =>
                  console.error(err),
                );
              }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream failed" })}\n\n`,
            ),
          );
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to get response" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
