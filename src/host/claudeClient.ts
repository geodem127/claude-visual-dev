import Anthropic from '@anthropic-ai/sdk';
import type { ClaudeMessage, ElementContext, AttachedFile } from './types';

export async function streamChat(
  messages: ClaudeMessage[],
  apiKey: string,
  model: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const client = new Anthropic({ apiKey });
  let full = '';
  const stream = await client.messages.stream({
    model,
    max_tokens: 4096,
    messages: messages as Anthropic.MessageParam[],
  });
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      onChunk(chunk.delta.text);
      full += chunk.delta.text;
    }
  }
  return full;
}

export async function generateVariant(
  element: ElementContext,
  instruction: string,
  files: AttachedFile[],
  apiKey: string,
  model: string
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const fileContext = files.map(f => `// FILE: ${f.path}\n${f.content}`).join('\n\n---\n\n');
  const prompt = `You are a React/TypeScript developer. Modify the component at ${element.filePath} based on this instruction.

ELEMENT SELECTED:
- Component: ${element.componentName}
- Selector: ${element.selector}
- Computed styles: ${JSON.stringify(element.computedStyles, null, 2)}
${element.props ? `- Props: ${JSON.stringify(element.props, null, 2)}` : ''}

INSTRUCTION: ${instruction}

CURRENT FILES:
${fileContext}

Return ONLY the complete modified file content for ${element.filePath}, no explanation, no markdown fences.`;

  const response = await client.messages.create({
    model,
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
  return block.text;
}
