export const dynamic = "force-dynamic";
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
import {
  loadLearnerContext,
  buildContextPrompt,
  canSendMessage,
  incrementUsage,
} from "@/lib/db";

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
// DIAGNOSTIC TEACHING PROMPT
// ===========================================
const DIAGNOSTIC_PROMPT = `You are an Arabic teacher running a diagnostic assessment to understand a student's Quranic Arabic knowledge.

TONE:
- Encouraging but measured - save enthusiasm for real breakthroughs
- Correct answers: "Right" / "Good" / "Correct"
- Wrong answers: direct correction, no excessive softening
- 2-3 sentences maximum per response
- NO MARKDOWN: Never use **, *, _, backticks, #, hyphens, or any other markdown formatting
- No emojis, no "Today we'll..." preambles

ADAPTIVE DIFFICULTY:
Start with the easiest questions and progressively increase difficulty based on student performance.

QUESTION PROGRESSION (adapt based on answers):
1. BASIC VOCABULARY: "What does [Arabic word] mean?" (single words, Arabic → English)
2. REVERSE VOCAB: "How do you say [English] in Arabic?" (English → Arabic)
3. PARTS OF SPEECH: "In [phrase], what part of speech is [word]?" (noun, verb, particle, preposition, pronoun)
4. GRAMMATICAL CASES: "In [phrase], what case is [word] in?" (nominative/marfu', accusative/mansub, genitive/majrur)
5. PHRASE TRANSLATION: "What does [2-3 word phrase] mean?"
6. ROOTS: "What is the 3-letter root of [word]?"

ADAPTIVE RULES:
- If student gets 2-3 questions RIGHT in a row at current level, move UP one level
- If student gets 2 questions WRONG at current level, stay at that level or move DOWN
- Mix grammar and translation questions to assess both skills
- Track which specific words/concepts the student struggles with

ARABIC RECOGNITION:
- Accept attached prefixes: و ف ب ل ك
- Accept connected and spaced forms: الحمدلله / الحمد لله
- Focus on meaning and usage, not spelling variants

DEFINITENESS (CRITICAL):
- STANDALONE WORDS: "the X" = الـ + word | "a/an X" = word without ال
- Example: "the day" (standalone) = اليوم | "day/a day" = يوم

IDAFA EXCEPTION (VERY IMPORTANT):
- In idafa (construct state), the mudaaf (1st noun) NEVER takes ال
- The mudaaf gets definiteness from the mudaaf ilayhi (2nd noun)
- Example: يَوْمِ الدِّينِ = "the Day of Judgment" (يوم is definite via idafa, NOT via ال)
- WRONG: اليَوْمِ الدِّينِ (mudaaf cannot have ال)
- If student says يوم for "the Day" in context of يوم الدين, that is CORRECT
- Only require ال when the word stands alone, not in idafa

COMPOUND WORDS & ENCLITICS:
- If a string contains an attached pronoun (e.g., نا in اهْدِنَا), ask about parts specifically
- "In [phrase], what part of speech is the suffix نا?" NOT "what part of speech is اهْدِنَا?"
- بِسْمِ = بِ (preposition) + اسْمِ (noun) - treat as two parts

ANSWER FORMAT FLEXIBILITY:
- Accept Arabic in script OR transliteration (الحمد or alhamd)
- Accept grammar terms in English OR Arabic (nominative/marfu', genitive/majrur, accusative/mansub)
- Accept synonyms and close meanings

GRAMMAR CONTEXT RULE:
When asking grammar questions, ALWAYS provide the phrase context:
- BAD: "What case is اللَّهِ in?"
- GOOD: "In بِسْمِ اللَّهِ, what case is اللَّهِ in?"

FIRST MESSAGE:
"Asalaam alaikum! Let's see where you are with your Arabic. [Ask a basic vocabulary question]"`;

// ===========================================
// META PROMPT - LOGGING RULES
// ===========================================
const META_PROMPT = `
ABSOLUTE RULE - ANSWER KEY ONLY:
You may ONLY ask about words that appear in the ANSWER KEY above.
- ONLY use words from this surah's answer key - no exceptions
- If a word isn't listed in the answer key, you cannot ask about it
- Do not invent translations or grammar - use exactly what the answer key provides

LOGGING TAGS (required for every student response you evaluate):
Grammar: [GRAM:word_id|feature|student_answer|correct_answer|correct/incorrect]
Translation: [TRANS:word_id|student_answer|correct_answer|correct/incorrect]
- word_id = the NUMBER after "ID:" in answer key (e.g., ID:5 → use 5)
- feature = part_of_speech, grammatical_case, verb_form, root, or voice
- ALWAYS include a tag when evaluating a student's answer`;

// ===========================================
// SURAH-BASED PROMPT BUILDER
// ===========================================
function buildSurahPrompt(
  verses: any[],
  words: any[],
  surahName: string,
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

  return `
SURAH: ${surahName}

VERSES:
${verseList}

ANSWER KEY (YOUR ONLY SOURCE - DO NOT INVENT WORDS):
${answerKey}
FORMAT: ID:number Arabic_word (English_translation) [part_of_speech]
${META_PROMPT}

START: Greet the student and begin with a basic vocabulary question.`;
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
      lessonId,
      userId,
      model = "claude-haiku-4-5-20251001",
    } = await request.json();

    // Check quota if userId is provided
    if (userId) {
      const quotaCheck = await canSendMessage(userId);
      if (!quotaCheck.canSend) {
        // Return quota exceeded as a stream event
        const encoder = new TextEncoder();
        const errorStream = new ReadableStream({
          start(controller) {
            const errorData = JSON.stringify({
              type: "quota_exceeded",
              reason: quotaCheck.reason,
              quotaInfo: {
                messagesRemaining: quotaCheck.messagesRemaining,
                resetDate: quotaCheck.resetDate.toISOString(),
              },
            });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(errorStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }
    }

    const [surahData, surahInfo, learnerContext] = await Promise.all([
      fetchSurahData(surahId, 20),
      supabase.from("surahs").select("name_english").eq("id", surahId).single(),
      userId ? loadLearnerContext(userId) : Promise.resolve(null),
    ]);

    const { verses, words } = surahData;
    const surahName = surahInfo.data?.name_english || `Surah ${surahId}`;

    const surahPrompt = buildSurahPrompt(verses, words, surahName);

    // Build learner context for personalization
    let learnerContextPrompt = "";
    if (learnerContext) {
      const contextText = buildContextPrompt(learnerContext);
      learnerContextPrompt = `

=== LEARNER PROFILE ===
${contextText}

Use this information to personalize the diagnostic:
- Start at an appropriate difficulty based on their history
- Focus extra attention on their documented struggles
- Build on their known strengths
- Reference previous lessons for continuity`;
    }

    const systemPrompt =
      DIAGNOSTIC_PROMPT + learnerContextPrompt + "\n" + surahPrompt;

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

          // Increment usage if userId and lessonId are provided
          let quotaInfo = null;
          if (userId && lessonId) {
            const totalTokens = usage.input_tokens + usage.output_tokens;
            const usageResult = await incrementUsage(
              userId,
              lessonId,
              totalTokens,
            );
            quotaInfo = {
              messagesRemaining: usageResult.messagesRemaining,
            };
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
            quotaInfo,
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
