import OpenAI from 'openai';

// Create OpenAI client for Whisper (speech-to-text) and TTS (text-to-speech)
// This is server-side only - never expose API key to browser
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Transcribe audio to text using Whisper
// Whisper handles Arabic well and auto-detects language
export async function transcribe(audioFile: File): Promise<{
  text: string;
  language: string;
}> {
  const response = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    response_format: 'verbose_json', // Includes language detection
  });

  return {
    text: response.text,
    language: response.language || 'unknown',
  };
}

// Convert text to speech
// Returns audio as a buffer that can be sent to the client
export async function textToSpeech(
  text: string,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'
): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: voice,
    input: text,
  });

  // Convert response to buffer
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export default openai;
