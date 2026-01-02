import { NextRequest } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;

// ElevenLabs voice IDs - you can change this to any voice
// "Rachel" is a good default, "Antoni" for male
// For Arabic, "Adam" or "Antoni" work reasonably well
const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam - works well for Arabic

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId = DEFAULT_VOICE_ID } = await request.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Call ElevenLabs streaming API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2', // Best for Arabic
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('ElevenLabs error:', error);
      return new Response(
        JSON.stringify({ error: 'TTS request failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Stream the audio response directly to the client
    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate speech' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}