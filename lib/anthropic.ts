import Anthropic from '@anthropic-ai/sdk';

// Create Anthropic client for Claude API
// This is server-side only - never expose API key to browser
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Default model - Claude Sonnet is fast and capable
// Can upgrade to Opus for more complex reasoning if needed
export const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// Helper function to send a message to Claude
export async function chat(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
) {
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages,
  });

  // Extract the text content from the response
  const textBlock = response.content.find((block) => block.type === 'text');
  const text = textBlock?.type === 'text' ? textBlock.text : '';

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

export default anthropic;
