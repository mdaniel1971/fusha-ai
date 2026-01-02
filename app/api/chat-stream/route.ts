import { NextRequest } from 'next/server';
import { chatStream } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';

// Fetch lesson details from database
async function fetchLesson(lessonId: number) {
  const { data: lesson, error } = await supabase
    .from('lessons')
    .select(`
      id,
      lesson_number,
      title,
      title_arabic,
      objectives,
      surahs (
        name_english,
        name_arabic
      )
    `)
    .eq('id', lessonId)
    .single();

  if (error) {
    console.error('Error fetching lesson:', JSON.stringify(error, null, 2));
    throw new Error('Failed to fetch lesson');
  }

  return lesson;
}

// Fetch target vocabulary for a lesson with full grammar details
async function fetchLessonVocabulary(lessonId: number) {
  const { data: words, error } = await supabase
    .from('lesson_vocabulary')
    .select(`
      priority,
      words (
        id,
        text_arabic,
        transliteration,
        translation_english,
        part_of_speech,
        verb_form,
        person,
        number,
        gender,
        grammatical_case,
        verb_mood,
        verb_tense,
        verb_voice,
        grammar_notes
      )
    `)
    .eq('lesson_id', lessonId)
    .order('priority', { ascending: true });

  if (error) {
    console.error('Error fetching vocabulary:', JSON.stringify(error, null, 2));
    throw new Error('Failed to fetch vocabulary');
  }

  return words;
}

// Fetch scenarios for a lesson
async function fetchScenarios(lessonId: number) {
  const { data: scenarios, error } = await supabase
    .from('scenarios')
    .select('title, setup_english, setup_arabic, context')
    .eq('lesson_id', lessonId);

  if (error) {
    console.error('Error fetching scenarios:', JSON.stringify(error, null, 2));
    throw new Error('Failed to fetch scenarios');
  }

  return scenarios;
}

// Format vocabulary for system prompt
function formatVocabulary(words: any[]): string {
  return words.map(item => {
    const w = item.words;
    let entry = `- ${w.text_arabic}`;
    if (w.transliteration) entry += ` (${w.transliteration})`;
    entry += ` - ${w.translation_english}`;
    
    const grammar: string[] = [];
    if (w.part_of_speech) grammar.push(w.part_of_speech);
    if (w.verb_form) grammar.push(`Form ${w.verb_form}`);
    if (w.person) grammar.push(`${w.person} person`);
    if (w.number) grammar.push(w.number);
    
    if (grammar.length > 0) {
      entry += ` [${grammar.join(', ')}]`;
    }
    
    return entry;
  }).join('\n');
}

// Format scenarios for system prompt
function formatScenarios(scenarios: any[]): string {
  return scenarios.map((s, i) => {
    return `${i + 1}. ${s.title}: ${s.setup_english}`;
  }).join('\n');
}

// Build concise system prompt optimised for conversation
function buildSystemPrompt(lesson: any, vocabulary: string, scenarios: string, nativeLanguage: string): string {
  return `You are a friendly Arabic teacher having a spoken conversation. Be natural and conversational.

## Lesson: ${lesson.title}
Surah: ${lesson.surahs?.name_english || 'Al-Fatiha'}

## Target Words
${vocabulary}

## Scenarios
${scenarios}

## Rules
- Speak in Fusha, keep it VERY simple
- Use ${nativeLanguage} when student struggles
- BE CONCISE: 1-2 short sentences per response
- One question at a time
- Correct errors naturally, briefly
- Sound like a real conversation, not a lecture

## Error Tracking (hidden from student)
If student makes an error, append:
[ERROR_LOG]
type: grammar|vocabulary|gender|conjugation
student_said: "x"
correction: "y"
context: "z"
[/ERROR_LOG]

Start with a brief Arabic greeting and one simple question about the scenario.`;
}

export async function POST(request: NextRequest) {
  try {
    const { 
      userMessage, 
      conversationHistory, 
      lessonId = 1,
      nativeLanguage = 'English' 
    } = await request.json();

    if (!userMessage) {
      return new Response(
        JSON.stringify({ error: 'No message provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch lesson data from database
    const [lesson, vocabularyData, scenarios] = await Promise.all([
      fetchLesson(lessonId),
      fetchLessonVocabulary(lessonId),
      fetchScenarios(lessonId),
    ]);

    // Format data for prompt
    const vocabulary = formatVocabulary(vocabularyData);
    const scenariosText = formatScenarios(scenarios);

    // Build the system prompt
    const systemPrompt = buildSystemPrompt(lesson, vocabulary, scenariosText, nativeLanguage);

    // Format conversation history for Claude
    const messages = [
      ...conversationHistory.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of chatStream(systemPrompt, messages)) {
            if (chunk.type === 'text') {
              // Send text chunk
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: chunk.content })}\n\n`));
            } else if (chunk.type === 'done') {
              // Send done signal with usage
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', usage: chunk.usage })}\n\n`));
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Stream failed' })}\n\n`));
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