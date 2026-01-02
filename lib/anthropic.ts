import Anthropic from '@anthropic-ai/sdk';

// Create Anthropic client for Claude API
// This is server-side only - never expose API key to browser
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Default model - Claude Sonnet is fast and capable
export const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// Non-streaming chat (kept for backwards compatibility)
export async function chat(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
) {
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 256, // Reduced for concise responses
    system: systemPrompt,
    messages: messages,
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const text = textBlock?.type === 'text' ? textBlock.text : '';

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// Streaming chat - yields text chunks as they arrive
export async function* chatStream(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): AsyncGenerator<{ type: 'text' | 'done'; content: string; usage?: { input: number; output: number } }> {
  const stream = await anthropic.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 256,
    system: systemPrompt,
    messages: messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield { type: 'text', content: event.delta.text };
    }
  }

  const finalMessage = await stream.finalMessage();
  yield { 
    type: 'done', 
    content: '',
    usage: {
      input: finalMessage.usage.input_tokens,
      output: finalMessage.usage.output_tokens,
    }
  };
}

export default anthropic;