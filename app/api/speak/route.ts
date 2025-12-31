import { NextRequest, NextResponse } from 'next/server';
import { textToSpeech } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'nova' } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    // Convert text to speech
    const audioBuffer = await textToSpeech(text, voice);

    // Return audio as a binary response
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
