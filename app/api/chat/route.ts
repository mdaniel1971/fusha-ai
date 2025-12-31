import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/anthropic';

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

// TODO: Replace with actual vocabulary from database
const FATIHA_VOCABULARY = `
- بِسْمِ (bismi) - in the name of
- اللَّهِ (Allah) - God
- الرَّحْمَٰنِ (ar-Rahman) - The Most Gracious
- الرَّحِيمِ (ar-Raheem) - The Most Merciful
- الْحَمْدُ (al-hamdu) - praise
- لِلَّهِ (lillahi) - to/for God
- رَبِّ (rabbi) - Lord
- الْعَالَمِينَ (al-'alameen) - the worlds
- مَالِكِ (maliki) - Master/Owner
- يَوْمِ (yawmi) - day
- الدِّينِ (ad-deen) - judgement/religion
- إِيَّاكَ (iyyaka) - You alone
- نَعْبُدُ (na'budu) - we worship
- نَسْتَعِينُ (nasta'een) - we seek help
- اهْدِنَا (ihdina) - guide us
- الصِّرَاطَ (as-sirat) - the path
- الْمُسْتَقِيمَ (al-mustaqeem) - the straight
- صِرَاطَ (sirat) - path
- الَّذِينَ (alladhina) - those who
- أَنْعَمْتَ (an'amta) - You have blessed
- عَلَيْهِمْ ('alayhim) - upon them
- غَيْرِ (ghayri) - not/other than
- الْمَغْضُوبِ (al-maghdubi) - those who earned anger
- الضَّالِّينَ (ad-dalleen) - those who went astray
`;

export async function POST(request: NextRequest) {
  try {
    const { userMessage, conversationHistory, nativeLanguage = 'English' } = await request.json();

    if (!userMessage) {
      return NextResponse.json(
        { error: 'No message provided' },
        { status: 400 }
      );
    }

    // Build the system prompt with vocabulary
    const systemPrompt = SYSTEM_PROMPT
      .replace('{{VOCABULARY}}', FATIHA_VOCABULARY)
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
