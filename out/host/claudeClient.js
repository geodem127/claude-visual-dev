"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamChat = streamChat;
exports.generateVariant = generateVariant;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
async function streamChat(messages, apiKey, model, onChunk) {
    const client = new sdk_1.default({ apiKey });
    let full = '';
    const stream = await client.messages.stream({
        model,
        max_tokens: 4096,
        messages: messages,
    });
    for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            onChunk(chunk.delta.text);
            full += chunk.delta.text;
        }
    }
    return full;
}
async function generateVariant(element, instruction, files, apiKey, model) {
    const client = new sdk_1.default({ apiKey });
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
    if (block.type !== 'text')
        throw new Error('Unexpected response type from Claude');
    return block.text;
}
