import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';

// System prompt for FushaAI teacher
// This is the minimal version - grounded in vocabulary from database
const SYSTEM_PROMPT = `You are a warm, patient Arabic teacher having a spoken conversation with a student learning Quranic Arabic.

## This Session
Surah: Al-Fatiha
Vocabulary from this surah is provided below. Ground your teaching in this vocabulary only.

## Vocabulary
{{VOCABULARY}}

## Language
- Speak in Fusha, keep it simple
- Use the student's native language when they struggle or ask
- Mix naturally as a real teacher would

## Teaching
- Lead the conversation - you initiate and guide
- Correct errors naturally within your response, don't lecture
- Ask one question at a time
- Keep focus on the surah - gently redirect if conversation drifts
- Test real understanding, not memorised translations

## Error Tracking
When the student makes an error, add this at the end of your response:

[ERROR_LOG]
type: grammar|vocabulary|pronunciation|gender|conjugation
student_said: "what they said"
correction: "correct form"
context: "brief note"
[/ERROR_LOG]

Log each error separately. If no errors, no log.

## Boundaries
- Stay focused on this surah
- You teach language, not fiqh - suggest a scholar for theological questions

## Start
Greet the student and begin.`;

// Fetch vocabulary for a surah from the database
async function fetchSurahVocabulary(surahNumber: number): Promise<string> {
  // First get the verse IDs for this surah
  const { data: verses, error: versesError } = await supabase
    .from('verses')
    .select('id, verse_number')
    .eq('surah_id', surahNumber)
    .order('verse_number', { ascending: true });

  if (versesError) {
    console.error('Error fetching verses:', JSON.stringify(versesError, null, 2));
    throw new Error('Failed to fetch verses from database');
  }

  if (!verses || verses.length === 0) {
    return 'No verses found for this surah.';
  }

  const verseIds = verses.map(v => v.id);

  // Now get words for those verses
  const { data: words, error: wordsError } = await supabase
    .from('words')
    .select('text_arabic, translation_english, part_of_speech, verse_id, word_position')
    .in('verse_id', verseIds)
    .order('verse_id', { ascending: true })
    .order('word_position', { ascending: true });

  if (wordsError) {
    console.error('Error fetching words:', JSON.stringify(wordsError, null, 2));
    throw new Error('Failed to fetch words from database');
  }

  if (!words || words.length === 0) {
    return 'No vocabulary loaded for this surah.';
  }

  // Format vocabulary for the system prompt
  return words
    .map((word) => {
      let entry = `- ${word.text_arabic} - ${word.translation_english}`;
      if (word.part_of_speech) entry += ` [${word.part_of_speech}]`;
      return entry;
    })
    .join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const { userMessage, conversationHistory, nativeLanguage = 'English' } = await request.json();

    if (!userMessage) {
      return NextResponse.json(
        { error: 'No message provided' },
        { status: 400 }
      );
    }

    // Fetch vocabulary from database (Al-Fatiha = surah 1)
    const vocabulary = await fetchSurahVocabulary(1);

    // Build the system prompt with vocabulary
    const systemPrompt = SYSTEM_PROMPT
      .replace('{{VOCABULARY}}', vocabulary)
      .replace("student's native language", nativeLanguage);

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
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to get response' },
      { status: 500 }
    );
  }
}
