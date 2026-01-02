import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/anthropic';
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
    
    // Add grammar details
    const grammar: string[] = [];
    if (w.part_of_speech) grammar.push(w.part_of_speech);
    if (w.verb_form) grammar.push(`Form ${w.verb_form}`);
    if (w.person) grammar.push(`${w.person} person`);
    if (w.number) grammar.push(w.number);
    if (w.gender) grammar.push(w.gender);
    if (w.grammatical_case) grammar.push(w.grammatical_case);
    
    if (grammar.length > 0) {
      entry += ` [${grammar.join(', ')}]`;
    }
    
    if (w.grammar_notes) {
      entry += `\n  Note: ${w.grammar_notes}`;
    }
    
    return entry;
  }).join('\n');
}

// Format scenarios for system prompt
function formatScenarios(scenarios: any[]): string {
  return scenarios.map((s, i) => {
    let entry = `${i + 1}. ${s.title}`;
    entry += `\n   English: ${s.setup_english}`;
    if (s.setup_arabic) entry += `\n   Arabic: ${s.setup_arabic}`;
    return entry;
  }).join('\n\n');
}

// Build the system prompt from lesson data
function buildSystemPrompt(lesson: any, vocabulary: string, scenarios: string, nativeLanguage: string): string {
  return `You are a warm, patient Arabic teacher having a spoken conversation with a student learning Quranic Arabic.

## This Lesson
Title: ${lesson.title}
${lesson.title_arabic ? `Arabic: ${lesson.title_arabic}` : ''}
Surah: ${lesson.surahs?.name_english || 'Al-Fatiha'} (${lesson.surahs?.name_arabic || 'الفاتحة'})
Objective: ${lesson.objectives}

## Target Vocabulary
Focus on helping the student use these words naturally:

${vocabulary}

## Practice Scenarios
Use one of these scenarios to create natural conversation:

${scenarios}

## Language
- Speak primarily in Fusha (Modern Standard Arabic)
- Keep your Arabic at the student's level - simple sentences
- Use ${nativeLanguage} when the student struggles or asks for clarification
- Mix languages naturally as a real bilingual teacher would

## Teaching Approach
- Lead the conversation within the chosen scenario
- Work target vocabulary into the conversation naturally
- When the student uses a target word correctly, briefly acknowledge it
- Correct errors naturally within your response - don't stop and lecture
- Ask one question at a time
- Test real understanding, not memorised translations
- If the student drifts off topic, gently guide back to the scenario

## Error Tracking
When the student makes an error, add this at the end of your response:

[ERROR_LOG]
type: grammar|vocabulary|pronunciation|gender|conjugation
student_said: "what they said"
correction: "correct form"
context: "brief note"
[/ERROR_LOG]

Log each error separately. If no errors, do not include an ERROR_LOG block.

## Boundaries
- You teach the language of the Quran, not the Quran itself
- For theological or fiqh questions, suggest consulting a scholar
- Keep scenarios everyday and practical

## Start
Greet the student warmly in Arabic, introduce the lesson topic briefly, then set up the first scenario and begin the conversation.`;
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
      return NextResponse.json(
        { error: 'No message provided' },
        { status: 400 }
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

    // Send to Claude
    const result = await chat(systemPrompt, messages);

    // Parse out any error logs (they're for our database, not the student)
    const errorLogMatch = result.text.match(/\[ERROR_LOG\]([\s\S]*?)\[\/ERROR_LOG\]/g);
    const cleanResponse = result.text.replace(/\[ERROR_LOG\][\s\S]*?\[\/ERROR_LOG\]/g, '').trim();
    
    // Parse errors for database storage
    const errors = errorLogMatch?.map(log => {
      const typeMatch = log.match(/type:\s*(\w+)/);
      const saidMatch = log.match(/student_said:\s*"([^"]*)"/);
      const correctionMatch = log.match(/correction:\s*"([^"]*)"/);
      const contextMatch = log.match(/context:\s*"([^"]*)"/);
      
      return {
        type: typeMatch?.[1] || 'unknown',
        student_said: saidMatch?.[1] || '',
        correction: correctionMatch?.[1] || '',
        context: contextMatch?.[1] || '',
      };
    }) || [];

    return NextResponse.json({
      response: cleanResponse,
      errors,
      tokensUsed: result.inputTokens + result.outputTokens,
      lessonId,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to get response' },
      { status: 500 }
    );
  }
}