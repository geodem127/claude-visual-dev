import { spawn } from 'child_process';
import type { ClaudeMessage, ElementContext, AttachedFile } from './types';

function formatMessages(messages: ClaudeMessage[]): string {
  return messages.map(m => {
    const role = m.role === 'user' ? 'Human' : 'Assistant';
    const content = typeof m.content === 'string'
      ? m.content
      : m.content
          .filter(b => b.type === 'text')
          .map(b => b.text ?? '')
          .join('');
    return `${role}: ${content}`;
  }).join('\n\n');
}

function runClaude(
  prompt: string,
  model: string,
  onChunk: ((chunk: string) => void) | null
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['--print', prompt, '--model', model, '--output-format', 'stream-json'];
    const proc = spawn('claude', args, { env: process.env });
    let full = '';
    let errBuf = '';

    proc.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const obj = JSON.parse(line) as {
            type: string;
            message?: { content?: { type: string; text?: string }[] };
          };
          if (obj.type === 'assistant' && obj.message?.content) {
            for (const block of obj.message.content) {
              if (block.type === 'text' && block.text) {
                onChunk?.(block.text);
                full += block.text;
              }
            }
          }
        } catch {
          // non-JSON line — skip
        }
      }
    });

    proc.stderr.on('data', (data: Buffer) => { errBuf += data.toString(); });
    proc.on('close', code => {
      if (code === 0) resolve(full);
      else reject(new Error(`claude CLI exited ${code}: ${errBuf.trim()}`));
    });
    proc.on('error', err => reject(new Error(`Failed to spawn claude CLI: ${err.message}. Is Claude Code installed?`)));
  });
}

export async function streamChat(
  messages: ClaudeMessage[],
  model: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const prompt = formatMessages(messages);
  return runClaude(prompt, model, onChunk);
}

export async function generateVariant(
  element: ElementContext,
  instruction: string,
  files: AttachedFile[],
  model: string
): Promise<string> {
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

  return runClaude(prompt, model, null);
}
