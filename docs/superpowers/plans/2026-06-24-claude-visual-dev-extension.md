# Claude Visual Dev Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VS Code extension with a 3-panel webview UI for visual development with Claude — left panel (chat/design ref/file attach), center panel (live iframe preview + annotation), right panel (element properties + variant generation).

**Architecture:** Extension host (Node.js) handles all privileged ops (Claude API, Figma REST API, Puppeteer, git, file I/O) and communicates with a React webview via a typed postMessage protocol. The webview is a single WebviewPanel built with Vite + React + Zustand.

**Tech Stack:** TypeScript, VS Code Extension API, React 18, Zustand, Vite, @anthropic-ai/sdk, simple-git, Puppeteer, node-fetch

## Global Constraints

- TypeScript strict mode throughout
- VS Code engine: `^1.85.0`
- Node: `>=18`
- Claude model default: `claude-sonnet-4-6`
- All webview ↔ host messages must be typed (no `any` on message types)
- No direct DOM manipulation in React components — use React state
- Git required in workspace for variant branch flow
- Figma REST API base: `https://api.figma.com/v1`

---

## File Map

```
claude-dev/
├── package.json                        # extension manifest + npm scripts
├── tsconfig.json                       # host TypeScript config
├── tsconfig.webview.json              # webview TypeScript config
├── vite.config.ts                     # webview bundle config
├── .vscodeignore
├── src/
│   ├── extension.ts                   # activation point, registers WebviewPanel
│   ├── host/
│   │   ├── types.ts                   # shared message protocol types
│   │   ├── messageHandler.ts          # routes incoming webview messages
│   │   ├── claudeClient.ts            # Anthropic SDK wrapper + streaming
│   │   ├── figmaClient.ts             # Figma REST API
│   │   ├── screenshotter.ts           # Puppeteer URL → base64
│   │   ├── gitClient.ts               # simple-git branch ops
│   │   └── fileSystem.ts             # workspace file read/write
│   └── webview/
│       ├── index.html                 # webview entry HTML
│       ├── main.tsx                   # React root
│       ├── bridge.ts                  # typed postMessage wrapper
│       ├── store.ts                   # Zustand global state
│       └── components/
│           ├── App.tsx                # 3-panel layout shell
│           ├── LeftPanel/
│           │   ├── index.tsx
│           │   ├── DesignReference.tsx
│           │   ├── FileAttach.tsx
│           │   ├── ChatThread.tsx
│           │   └── FileTree.tsx
│           ├── CenterPanel/
│           │   ├── index.tsx
│           │   ├── PreviewToolbar.tsx
│           │   ├── LivePreview.tsx
│           │   ├── ClaudeOutputTab.tsx
│           │   └── BranchBanner.tsx
│           └── RightPanel/
│               ├── index.tsx
│               ├── ElementHeader.tsx
│               ├── PropertiesInspector.tsx
│               ├── InstructionBox.tsx
│               └── VariantHistory.tsx
└── dist/                              # compiled webview assets (gitignored)
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.webview.json`
- Create: `vite.config.ts`
- Create: `.vscodeignore`
- Create: `src/extension.ts` (stub)
- Create: `src/host/types.ts`

**Interfaces:**
- Produces: `HostMessage`, `WebviewMessage` union types consumed by all subsequent tasks

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "claude-visual-dev",
  "displayName": "Claude Visual Dev",
  "description": "Visual development with Claude — live preview, element annotation, AI-generated variants",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": ["onCommand:claudeDev.open"],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "claudeDev.open",
        "title": "Claude Visual Dev: Open"
      }
    ],
    "configuration": {
      "title": "Claude Visual Dev",
      "properties": {
        "claudeDev.claudeApiKey": {
          "type": "string",
          "default": "",
          "description": "Anthropic API key"
        },
        "claudeDev.figmaApiKey": {
          "type": "string",
          "default": "",
          "description": "Figma personal access token"
        },
        "claudeDev.defaultDevServerPort": {
          "type": "number",
          "default": 3000,
          "description": "Default dev server port for live preview"
        },
        "claudeDev.claudeModel": {
          "type": "string",
          "default": "claude-sonnet-4-6",
          "description": "Claude model ID"
        }
      }
    }
  },
  "scripts": {
    "build:host": "tsc -p tsconfig.json",
    "build:webview": "vite build",
    "build": "npm run build:host && npm run build:webview",
    "watch:host": "tsc -p tsconfig.json --watch",
    "watch:webview": "vite build --watch",
    "package": "vsce package"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.27.0",
    "node-fetch": "^3.3.2",
    "puppeteer": "^22.0.0",
    "simple-git": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.85.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json (host)**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2020"]
  },
  "exclude": ["src/webview", "node_modules", "dist"]
}
```

- [ ] **Step 3: Create tsconfig.webview.json**

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2020",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src/webview/**/*"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/webview',
  build: {
    outDir: resolve(__dirname, 'dist/webview'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/webview/index.html'),
    },
  },
});
```

- [ ] **Step 5: Create src/host/types.ts**

```ts
// Messages sent from webview to host
export type WebviewMessage =
  | { type: 'CLAUDE_CHAT'; id: string; payload: { messages: ClaudeMessage[]; context?: ElementContext } }
  | { type: 'FETCH_FIGMA'; id: string; payload: { url: string } }
  | { type: 'SCREENSHOT_URL'; id: string; payload: { url: string } }
  | { type: 'PREVIEW_VARIANT'; id: string; payload: { element: ElementContext; instruction: string; files: AttachedFile[] } }
  | { type: 'APPLY_BRANCH'; id: string; payload: { branch: string; filePath: string } }
  | { type: 'DISCARD_BRANCH'; id: string; payload: { branch: string } }
  | { type: 'READ_FILE'; id: string; payload: { path: string } }
  | { type: 'OPEN_FILE'; id: string; payload: { path: string; line?: number } }
  | { type: 'LIST_FILES'; id: string; payload: { dir: string } };

// Messages sent from host to webview
export type HostMessage =
  | { type: 'RESPONSE'; id: string; result: unknown }
  | { type: 'ERROR'; id: string; error: string }
  | { type: 'STREAM_CHUNK'; id: string; chunk: string }
  | { type: 'STREAM_END'; id: string };

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
}

export interface ClaudeContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: { type: 'base64'; media_type: string; data: string };
}

export interface ElementContext {
  selector: string;
  componentName: string;
  filePath: string;
  computedStyles: Record<string, string>;
  props?: Record<string, unknown>;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface AttachedFile {
  path: string;
  content: string;
}

export interface VariantResult {
  branch: string;
  filePath: string;
  generatedContent: string;
}
```

- [ ] **Step 6: Create stub src/extension.ts**

```ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('claudeDev.open', () => {
    vscode.window.showInformationMessage('Claude Visual Dev — coming soon');
  });
  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
```

- [ ] **Step 7: Create .vscodeignore**

```
.vscode/**
src/**
node_modules/**
docs/**
tsconfig*.json
vite.config.ts
**/*.map
```

- [ ] **Step 8: Install dependencies**

```bash
cd /Users/geodem/Claude/Projects/vscode/extentions/claude-dev
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 9: Verify host compiles**

```bash
npm run build:host
```

Expected: `out/extension.js` created.

- [ ] **Step 10: Commit**

```bash
git init
git add package.json tsconfig.json tsconfig.webview.json vite.config.ts .vscodeignore src/extension.ts src/host/types.ts
git commit -m "feat: scaffold extension project with types"
```

---

### Task 2: Extension Host — Core Services

**Files:**
- Create: `src/host/fileSystem.ts`
- Create: `src/host/gitClient.ts`
- Create: `src/host/figmaClient.ts`
- Create: `src/host/screenshotter.ts`
- Create: `src/host/claudeClient.ts`

**Interfaces:**
- Consumes: `ElementContext`, `AttachedFile`, `ClaudeMessage`, `VariantResult` from `src/host/types.ts`
- Produces:
  - `readFile(absPath: string): Promise<string>`
  - `writeFile(absPath: string, content: string): Promise<void>`
  - `listDir(absPath: string): Promise<string[]>`
  - `createBranch(repoPath: string, branch: string): Promise<void>`
  - `applyVariant(repoPath: string, branch: string, filePath: string): Promise<void>`
  - `deleteBranch(repoPath: string, branch: string): Promise<void>`
  - `fetchFigmaScreenshot(fileKey: string, apiKey: string): Promise<string>` (base64)
  - `screenshotUrl(url: string): Promise<string>` (base64)
  - `streamChat(messages: ClaudeMessage[], apiKey: string, model: string, onChunk: (c:string)=>void): Promise<string>`
  - `generateVariant(element: ElementContext, instruction: string, files: AttachedFile[], apiKey: string, model: string): Promise<string>`

- [ ] **Step 1: Create src/host/fileSystem.ts**

```ts
import * as fs from 'fs/promises';
import * as path from 'path';

export async function readFile(absPath: string): Promise<string> {
  return fs.readFile(absPath, 'utf-8');
}

export async function writeFile(absPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, 'utf-8');
}

export async function listDir(absPath: string): Promise<string[]> {
  const entries = await fs.readdir(absPath, { withFileTypes: true });
  return entries.map(e => (e.isDirectory() ? e.name + '/' : e.name));
}
```

- [ ] **Step 2: Create src/host/gitClient.ts**

```ts
import simpleGit from 'simple-git';
import * as fs from 'fs/promises';

export async function createBranch(repoPath: string, branch: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.checkoutLocalBranch(branch);
}

export async function checkoutMain(repoPath: string): Promise<void> {
  const git = simpleGit(repoPath);
  const branches = await git.branchLocal();
  const main = branches.all.find(b => b === 'main' || b === 'master') ?? 'main';
  await git.checkout(main);
}

export async function applyVariant(repoPath: string, branch: string, filePath: string): Promise<void> {
  const git = simpleGit(repoPath);
  // Read file from variant branch, write to current branch
  const content = await git.show([`${branch}:${filePath}`]);
  const absPath = `${repoPath}/${filePath}`;
  await fs.writeFile(absPath, content, 'utf-8');
  await checkoutMain(repoPath);
  await deleteBranch(repoPath, branch);
}

export async function deleteBranch(repoPath: string, branch: string): Promise<void> {
  const git = simpleGit(repoPath);
  const current = (await git.branchLocal()).current;
  if (current === branch) {
    await checkoutMain(repoPath);
  }
  await git.deleteLocalBranch(branch, true);
}

export async function commitFile(repoPath: string, filePath: string, message: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.add(filePath);
  await git.commit(message);
}
```

- [ ] **Step 3: Create src/host/figmaClient.ts**

```ts
import fetch from 'node-fetch';

const FIGMA_BASE = 'https://api.figma.com/v1';

export async function fetchFigmaScreenshot(fileKey: string, apiKey: string): Promise<string> {
  // Get node IDs from file
  const fileRes = await fetch(`${FIGMA_BASE}/files/${fileKey}`, {
    headers: { 'X-Figma-Token': apiKey },
  });
  if (!fileRes.ok) throw new Error(`Figma API error: ${fileRes.status} ${fileRes.statusText}`);
  const file = await fileRes.json() as { document: { children: { id: string }[] } };
  const nodeId = file.document.children[0]?.id;
  if (!nodeId) throw new Error('No nodes found in Figma file');

  // Export as PNG
  const imgRes = await fetch(`${FIGMA_BASE}/images/${fileKey}?ids=${nodeId}&format=png&scale=2`, {
    headers: { 'X-Figma-Token': apiKey },
  });
  if (!imgRes.ok) throw new Error(`Figma images API error: ${imgRes.status}`);
  const imgData = await imgRes.json() as { images: Record<string, string> };
  const imageUrl = Object.values(imgData.images)[0];
  if (!imageUrl) throw new Error('No image URL returned from Figma');

  // Download and convert to base64
  const download = await fetch(imageUrl);
  const buffer = await download.buffer();
  return buffer.toString('base64');
}

export function extractFigmaFileKey(url: string): string {
  const match = url.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  if (!match) throw new Error('Invalid Figma URL');
  return match[1];
}
```

- [ ] **Step 4: Create src/host/screenshotter.ts**

```ts
import puppeteer from 'puppeteer';

export async function screenshotUrl(url: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    return Buffer.from(buffer).toString('base64');
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 5: Create src/host/claudeClient.ts**

```ts
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
```

- [ ] **Step 6: Build host**

```bash
cd /Users/geodem/Claude/Projects/vscode/extentions/claude-dev
npm run build:host
```

Expected: No TypeScript errors. `out/` updated.

- [ ] **Step 7: Commit**

```bash
git add src/host/
git commit -m "feat: add host services (file, git, figma, screenshot, claude)"
```

---

### Task 3: Extension Host — Message Handler + WebviewPanel

**Files:**
- Create: `src/host/messageHandler.ts`
- Modify: `src/extension.ts`

**Interfaces:**
- Consumes: all services from Task 2, `WebviewMessage`/`HostMessage` from `types.ts`
- Produces: `createPanel(context: vscode.ExtensionContext): vscode.WebviewPanel`

- [ ] **Step 1: Create src/host/messageHandler.ts**

```ts
import * as vscode from 'vscode';
import * as path from 'path';
import type { WebviewMessage, HostMessage, VariantResult } from './types';
import * as fs from './fileSystem';
import * as git from './gitClient';
import * as figma from './figmaClient';
import { screenshotUrl } from './screenshotter';
import { streamChat, generateVariant } from './claudeClient';

function send(panel: vscode.WebviewPanel, msg: HostMessage): void {
  panel.webview.postMessage(msg);
}

function cfg(key: string): string {
  return vscode.workspace.getConfiguration('claudeDev').get<string>(key) ?? '';
}

function cfgNum(key: string, def: number): number {
  return vscode.workspace.getConfiguration('claudeDev').get<number>(key) ?? def;
}

function workspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!folder) throw new Error('No workspace folder open');
  return folder;
}

export function registerMessageHandler(panel: vscode.WebviewPanel): vscode.Disposable {
  return panel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
    try {
      switch (msg.type) {
        case 'READ_FILE': {
          const content = await fs.readFile(msg.payload.path);
          send(panel, { type: 'RESPONSE', id: msg.id, result: content });
          break;
        }
        case 'LIST_FILES': {
          const entries = await fs.listDir(msg.payload.dir);
          send(panel, { type: 'RESPONSE', id: msg.id, result: entries });
          break;
        }
        case 'OPEN_FILE': {
          const uri = vscode.Uri.file(msg.payload.path);
          await vscode.window.showTextDocument(uri, {
            selection: msg.payload.line
              ? new vscode.Range(msg.payload.line - 1, 0, msg.payload.line - 1, 0)
              : undefined,
          });
          send(panel, { type: 'RESPONSE', id: msg.id, result: true });
          break;
        }
        case 'FETCH_FIGMA': {
          const apiKey = cfg('figmaApiKey');
          if (!apiKey) throw new Error('Figma API key not configured');
          const fileKey = figma.extractFigmaFileKey(msg.payload.url);
          const base64 = await figma.fetchFigmaScreenshot(fileKey, apiKey);
          send(panel, { type: 'RESPONSE', id: msg.id, result: base64 });
          break;
        }
        case 'SCREENSHOT_URL': {
          const base64 = await screenshotUrl(msg.payload.url);
          send(panel, { type: 'RESPONSE', id: msg.id, result: base64 });
          break;
        }
        case 'CLAUDE_CHAT': {
          const apiKey = cfg('claudeApiKey');
          const model = cfg('claudeModel') || 'claude-sonnet-4-6';
          if (!apiKey) throw new Error('Claude API key not configured');
          let full = '';
          full = await streamChat(msg.payload.messages, apiKey, model, chunk => {
            send(panel, { type: 'STREAM_CHUNK', id: msg.id, chunk });
          });
          send(panel, { type: 'STREAM_END', id: msg.id });
          send(panel, { type: 'RESPONSE', id: msg.id, result: full });
          break;
        }
        case 'PREVIEW_VARIANT': {
          const apiKey = cfg('claudeApiKey');
          const model = cfg('claudeModel') || 'claude-sonnet-4-6';
          if (!apiKey) throw new Error('Claude API key not configured');
          const root = workspaceRoot();
          const branch = `claude/variant-${Date.now()}`;
          const generatedContent = await generateVariant(
            msg.payload.element,
            msg.payload.instruction,
            msg.payload.files,
            apiKey,
            model
          );
          await git.createBranch(root, branch);
          const absPath = path.join(root, msg.payload.element.filePath);
          await fs.writeFile(absPath, generatedContent);
          await git.commitFile(root, msg.payload.element.filePath, `feat: claude variant for ${msg.payload.element.componentName}`);
          const result: VariantResult = { branch, filePath: msg.payload.element.filePath, generatedContent };
          send(panel, { type: 'RESPONSE', id: msg.id, result });
          break;
        }
        case 'APPLY_BRANCH': {
          const root = workspaceRoot();
          await git.applyVariant(root, msg.payload.branch, msg.payload.filePath);
          send(panel, { type: 'RESPONSE', id: msg.id, result: true });
          break;
        }
        case 'DISCARD_BRANCH': {
          const root = workspaceRoot();
          await git.deleteBranch(root, msg.payload.branch);
          send(panel, { type: 'RESPONSE', id: msg.id, result: true });
          break;
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      send(panel, { type: 'ERROR', id: msg.id, error });
    }
  });
}
```

- [ ] **Step 2: Rewrite src/extension.ts**

```ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { registerMessageHandler } from './host/messageHandler';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('claudeDev.open', () => {
    const panel = vscode.window.createWebviewPanel(
      'claudeVisualDev',
      'Claude Visual Dev',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview'))],
      }
    );
    panel.webview.html = getWebviewHtml(panel.webview, context);
    const handler = registerMessageHandler(panel);
    panel.onDidDispose(() => handler.dispose(), null, context.subscriptions);
  });
  context.subscriptions.push(disposable);
}

function getWebviewHtml(webview: vscode.Webview, context: vscode.ExtensionContext): string {
  const distPath = path.join(context.extensionPath, 'dist', 'webview');
  const indexPath = path.join(distPath, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf-8');
  // Rewrite asset paths to webview URIs
  html = html.replace(/(src|href)="([^"]+)"/g, (match, attr, val) => {
    if (val.startsWith('http') || val.startsWith('//')) return match;
    const assetUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, val)));
    return `${attr}="${assetUri}"`;
  });
  // Inject CSP
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: https:; script-src 'unsafe-inline' ${webview.cspSource}; style-src 'unsafe-inline' ${webview.cspSource}; frame-src *;">`;
  html = html.replace('<head>', `<head>${csp}`);
  return html;
}

export function deactivate(): void {}
```

- [ ] **Step 3: Build and verify**

```bash
npm run build:host
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/extension.ts src/host/messageHandler.ts
git commit -m "feat: webview panel + message handler routing"
```

---

### Task 4: Webview — Bridge + Store + Shell

**Files:**
- Create: `src/webview/index.html`
- Create: `src/webview/main.tsx`
- Create: `src/webview/bridge.ts`
- Create: `src/webview/store.ts`
- Create: `src/webview/components/App.tsx`

**Interfaces:**
- Consumes: `HostMessage`, `WebviewMessage`, `ElementContext`, `VariantResult`, `AttachedFile` from `src/host/types.ts` (copied/imported via relative path)
- Produces:
  - `bridge.send(msg: WebviewMessage): void`
  - `bridge.request<T>(msg: WebviewMessage): Promise<T>`
  - `bridge.onStream(id: string, onChunk: (c:string)=>void, onEnd: ()=>void): ()=>void`
  - Zustand store: `useStore()` with full state shape

- [ ] **Step 1: Create src/webview/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Claude Visual Dev</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { overflow: hidden; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); }
      #root { height: 100vh; width: 100vw; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create src/webview/bridge.ts**

```ts
import type { WebviewMessage, HostMessage } from '../host/types';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

type Resolver = { resolve: (v: unknown) => void; reject: (e: Error) => void };
const pending = new Map<string, Resolver>();
const streamListeners = new Map<string, { onChunk: (c: string) => void; onEnd: () => void }>();

window.addEventListener('message', (event: MessageEvent<HostMessage>) => {
  const msg = event.data;
  if (msg.type === 'STREAM_CHUNK') {
    streamListeners.get(msg.id)?.onChunk(msg.chunk);
    return;
  }
  if (msg.type === 'STREAM_END') {
    streamListeners.get(msg.id)?.onEnd();
    streamListeners.delete(msg.id);
    return;
  }
  if (msg.type === 'RESPONSE') {
    pending.get(msg.id)?.resolve(msg.result);
    pending.delete(msg.id);
    return;
  }
  if (msg.type === 'ERROR') {
    pending.get(msg.id)?.reject(new Error(msg.error));
    pending.delete(msg.id);
  }
});

export function send(msg: WebviewMessage): void {
  vscode.postMessage(msg);
}

export function request<T>(msg: WebviewMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    pending.set(msg.id, { resolve: resolve as (v: unknown) => void, reject });
    vscode.postMessage(msg);
  });
}

export function onStream(
  id: string,
  onChunk: (chunk: string) => void,
  onEnd: () => void
): () => void {
  streamListeners.set(id, { onChunk, onEnd });
  return () => streamListeners.delete(id);
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
```

- [ ] **Step 3: Create src/webview/store.ts**

```ts
import { create } from 'zustand';
import type { ElementContext, AttachedFile, VariantResult } from '../host/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export interface VariantHistoryEntry {
  id: string;
  timestamp: number;
  element: ElementContext;
  instruction: string;
  variant: VariantResult;
  status: 'pending' | 'applied' | 'discarded';
}

interface State {
  // Left panel
  designReferenceBase64: string | null;
  designReferenceType: 'figma' | 'upload' | 'url' | null;
  attachedFiles: AttachedFile[];
  chatMessages: ChatMessage[];
  pinnedElement: ElementContext | null;

  // Center panel
  devServerUrl: string;
  viewport: 'desktop' | 'tablet' | 'mobile';
  annotationMode: boolean;
  activeTab: 'preview' | 'output';
  activeVariant: VariantResult | null;

  // Right panel
  selectedElement: ElementContext | null;
  variantHistory: VariantHistoryEntry[];

  // Actions
  setDesignReference: (base64: string, type: 'figma' | 'upload' | 'url') => void;
  clearDesignReference: () => void;
  addAttachedFile: (file: AttachedFile) => void;
  removeAttachedFile: (path: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  appendStreamChunk: (chunk: string) => void;
  finishStream: () => void;
  setPinnedElement: (el: ElementContext | null) => void;
  setDevServerUrl: (url: string) => void;
  setViewport: (v: 'desktop' | 'tablet' | 'mobile') => void;
  setAnnotationMode: (on: boolean) => void;
  setActiveTab: (tab: 'preview' | 'output') => void;
  setActiveVariant: (v: VariantResult | null) => void;
  setSelectedElement: (el: ElementContext | null) => void;
  addVariantHistory: (entry: VariantHistoryEntry) => void;
  updateVariantStatus: (id: string, status: VariantHistoryEntry['status']) => void;
}

export const useStore = create<State>((set) => ({
  designReferenceBase64: null,
  designReferenceType: null,
  attachedFiles: [],
  chatMessages: [],
  pinnedElement: null,
  devServerUrl: 'http://localhost:3000',
  viewport: 'desktop',
  annotationMode: false,
  activeTab: 'preview',
  activeVariant: null,
  selectedElement: null,
  variantHistory: [],

  setDesignReference: (base64, type) => set({ designReferenceBase64: base64, designReferenceType: type }),
  clearDesignReference: () => set({ designReferenceBase64: null, designReferenceType: null }),
  addAttachedFile: (file) => set(s => ({ attachedFiles: [...s.attachedFiles.filter(f => f.path !== file.path), file] })),
  removeAttachedFile: (path) => set(s => ({ attachedFiles: s.attachedFiles.filter(f => f.path !== path) })),
  addChatMessage: (msg) => set(s => ({ chatMessages: [...s.chatMessages, msg] })),
  appendStreamChunk: (chunk) => set(s => {
    const msgs = [...s.chatMessages];
    const last = msgs[msgs.length - 1];
    if (last?.streaming) {
      msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
    } else {
      msgs.push({ role: 'assistant', content: chunk, streaming: true });
    }
    return { chatMessages: msgs };
  }),
  finishStream: () => set(s => {
    const msgs = [...s.chatMessages];
    const last = msgs[msgs.length - 1];
    if (last?.streaming) msgs[msgs.length - 1] = { ...last, streaming: false };
    return { chatMessages: msgs };
  }),
  setPinnedElement: (el) => set({ pinnedElement: el }),
  setDevServerUrl: (url) => set({ devServerUrl: url }),
  setViewport: (v) => set({ viewport: v }),
  setAnnotationMode: (on) => set({ annotationMode: on }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveVariant: (v) => set({ activeVariant: v }),
  setSelectedElement: (el) => set({ selectedElement: el }),
  addVariantHistory: (entry) => set(s => ({ variantHistory: [entry, ...s.variantHistory] })),
  updateVariantStatus: (id, status) => set(s => ({
    variantHistory: s.variantHistory.map(e => e.id === id ? { ...e, status } : e),
  })),
}));
```

- [ ] **Step 4: Create src/webview/components/App.tsx**

```tsx
import React from 'react';
import LeftPanel from './LeftPanel';
import CenterPanel from './CenterPanel';
import RightPanel from './RightPanel';

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr 300px',
    height: '100vh',
    overflow: 'hidden',
    gap: '1px',
    background: 'var(--vscode-panel-border)',
  },
  panel: {
    background: 'var(--vscode-editor-background)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
};

export default function App(): React.ReactElement {
  return (
    <div style={styles.root}>
      <div style={styles.panel}><LeftPanel /></div>
      <div style={styles.panel}><CenterPanel /></div>
      <div style={styles.panel}><RightPanel /></div>
    </div>
  );
}
```

- [ ] **Step 5: Create src/webview/main.tsx**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';

const root = document.getElementById('root');
if (!root) throw new Error('No root element');
createRoot(root).render(<App />);
```

- [ ] **Step 6: Create stub panel files so build succeeds**

Create `src/webview/components/LeftPanel/index.tsx`:
```tsx
import React from 'react';
export default function LeftPanel() { return <div style={{padding:8,color:'var(--vscode-editor-foreground)'}}>Left Panel</div>; }
```

Create `src/webview/components/CenterPanel/index.tsx`:
```tsx
import React from 'react';
export default function CenterPanel() { return <div style={{padding:8,color:'var(--vscode-editor-foreground)'}}>Center Panel</div>; }
```

Create `src/webview/components/RightPanel/index.tsx`:
```tsx
import React from 'react';
export default function RightPanel() { return <div style={{padding:8,color:'var(--vscode-editor-foreground)'}}>Right Panel</div>; }
```

- [ ] **Step 7: Build webview**

```bash
npm run build:webview
```

Expected: `dist/webview/index.html` and JS bundle created, no errors.

- [ ] **Step 8: Commit**

```bash
git add src/webview/
git commit -m "feat: webview bridge, store, and app shell"
```

---

### Task 5: Left Panel — Design Reference + File Attach

**Files:**
- Modify: `src/webview/components/LeftPanel/index.tsx`
- Create: `src/webview/components/LeftPanel/DesignReference.tsx`
- Create: `src/webview/components/LeftPanel/FileAttach.tsx`

**Interfaces:**
- Consumes: `useStore`, `bridge.request`, `bridge.uid`

- [ ] **Step 1: Create DesignReference.tsx**

```tsx
import React, { useState } from 'react';
import { useStore } from '../../store';
import * as bridge from '../../bridge';

const s: Record<string, React.CSSProperties> = {
  root: { padding: '8px 0' },
  label: { fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 1 },
  tabs: { display: 'flex', gap: 4, marginBottom: 8 },
  tab: { flex: 1, padding: '4px 0', fontSize: 11, background: 'none', border: '1px solid var(--vscode-panel-border)', color: 'var(--vscode-editor-foreground)', cursor: 'pointer', borderRadius: 3 },
  tabActive: { background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: '1px solid transparent' },
  input: { width: '100%', padding: '4px 6px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 3, fontSize: 12 },
  btn: { width: '100%', marginTop: 6, padding: '4px 0', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
  preview: { marginTop: 8, width: '100%', borderRadius: 4, border: '1px solid var(--vscode-panel-border)' },
  error: { marginTop: 4, fontSize: 11, color: 'var(--vscode-errorForeground)' },
};

type Tab = 'figma' | 'url';

export default function DesignReference(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('figma');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { designReferenceBase64, setDesignReference, clearDesignReference } = useStore();

  async function handleFetch() {
    setError(''); setLoading(true);
    try {
      if (tab === 'figma') {
        const base64 = await bridge.request<string>({ type: 'FETCH_FIGMA', id: bridge.uid(), payload: { url: value } });
        setDesignReference(base64, 'figma');
      } else {
        const base64 = await bridge.request<string>({ type: 'SCREENSHOT_URL', id: bridge.uid(), payload: { url: value } });
        setDesignReference(base64, 'url');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      setDesignReference(base64, 'upload');
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={s.root}>
      <div style={s.label}>Design Reference</div>
      <div style={s.tabs}>
        {(['figma', 'url'] as Tab[]).map(t => (
          <button key={t} style={tab === t ? { ...s.tab, ...s.tabActive } : s.tab} onClick={() => setTab(t)}>
            {t === 'figma' ? 'Figma' : 'URL'}
          </button>
        ))}
      </div>
      {tab === 'figma' || tab === 'url' ? (
        <>
          <input style={s.input} placeholder={tab === 'figma' ? 'Figma file URL' : 'https://...'} value={value} onChange={e => setValue(e.target.value)} />
          <button style={s.btn} disabled={!value || loading} onClick={handleFetch}>
            {loading ? 'Loading...' : 'Fetch'}
          </button>
        </>
      ) : null}
      <div style={{ marginTop: 4 }}>
        <input type="file" accept="image/*,.pdf" id="design-upload" style={{ display: 'none' }} onChange={handleUpload} />
        <label htmlFor="design-upload" style={{ ...s.btn, display: 'block', textAlign: 'center' as const, cursor: 'pointer' }}>
          Upload Image / PDF
        </label>
      </div>
      {error && <div style={s.error}>{error}</div>}
      {designReferenceBase64 && (
        <>
          <img src={`data:image/png;base64,${designReferenceBase64}`} alt="Design reference" style={s.preview} />
          <button style={{ ...s.btn, background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)' }} onClick={clearDesignReference}>
            Clear
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create FileAttach.tsx**

```tsx
import React, { useRef } from 'react';
import { useStore } from '../../store';
import * as bridge from '../../bridge';

const s: Record<string, React.CSSProperties> = {
  root: { padding: '8px 0' },
  label: { fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 1 },
  dropZone: { border: '1px dashed var(--vscode-panel-border)', borderRadius: 4, padding: '8px', textAlign: 'center' as const, fontSize: 11, cursor: 'pointer', color: 'var(--vscode-descriptionForeground)' },
  fileList: { marginTop: 6, display: 'flex', flexDirection: 'column' as const, gap: 3 },
  fileItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--vscode-badge-background)', borderRadius: 3, padding: '2px 6px', fontSize: 11 },
  removeBtn: { background: 'none', border: 'none', color: 'var(--vscode-errorForeground)', cursor: 'pointer', fontSize: 13, lineHeight: 1 },
};

export default function FileAttach(): React.ReactElement {
  const { attachedFiles, addAttachedFile, removeAttachedFile } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(paths: string[]) {
    for (const p of paths) {
      try {
        const content = await bridge.request<string>({ type: 'READ_FILE', id: bridge.uid(), payload: { path: p } });
        addAttachedFile({ path: p, content });
      } catch { /* skip unreadable */ }
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // files from input have path via webkitRelativePath or name — use name as fallback
    handleFiles(files.map(f => (f as unknown as { path?: string }).path ?? f.name));
    e.target.value = '';
  }

  return (
    <div style={s.root}>
      <div style={s.label}>Attached Files</div>
      <div style={s.dropZone} onClick={() => inputRef.current?.click()}>
        Click to attach files
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={handleChange} />
      </div>
      {attachedFiles.length > 0 && (
        <div style={s.fileList}>
          {attachedFiles.map(f => (
            <div key={f.path} style={s.fileItem}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {f.path.split('/').pop()}
              </span>
              <button style={s.removeBtn} onClick={() => removeAttachedFile(f.path)}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update LeftPanel/index.tsx (partial — design + attach only)**

```tsx
import React, { useState } from 'react';
import DesignReference from './DesignReference';
import FileAttach from './FileAttach';

const s: React.CSSProperties = { padding: 12, overflowY: 'auto' as const, height: '100%', display: 'flex', flexDirection: 'column' as const, gap: 12 };

export default function LeftPanel(): React.ReactElement {
  return (
    <div style={s}>
      <DesignReference />
      <hr style={{ border: 'none', borderTop: '1px solid var(--vscode-panel-border)' }} />
      <FileAttach />
    </div>
  );
}
```

- [ ] **Step 4: Build**

```bash
npm run build:webview
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/webview/components/LeftPanel/
git commit -m "feat: left panel design reference + file attach"
```

---

### Task 6: Left Panel — Chat Thread

**Files:**
- Create: `src/webview/components/LeftPanel/ChatThread.tsx`
- Modify: `src/webview/components/LeftPanel/index.tsx`

**Interfaces:**
- Consumes: `useStore`, `bridge.request`, `bridge.onStream`, `bridge.uid`

- [ ] **Step 1: Create ChatThread.tsx**

```tsx
import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store';
import * as bridge from '../../bridge';
import type { ClaudeMessage } from '../../../host/types';

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column' as const, flex: 1, minHeight: 0 },
  label: { fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 1 },
  thread: { flex: 1, overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 8, paddingBottom: 8, minHeight: 120, maxHeight: 300 },
  msg: (role: string): React.CSSProperties => ({
    padding: '6px 8px', borderRadius: 4, fontSize: 12, lineHeight: 1.5,
    background: role === 'user' ? 'var(--vscode-button-background)' : 'var(--vscode-badge-background)',
    color: role === 'user' ? 'var(--vscode-button-foreground)' : 'var(--vscode-editor-foreground)',
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    maxWidth: '90%', whiteSpace: 'pre-wrap' as const,
  }),
  pinChip: { display: 'flex', alignItems: 'center', gap: 4, background: 'var(--vscode-badge-background)', borderRadius: 3, padding: '2px 6px', fontSize: 11, marginBottom: 4 },
  dismissBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vscode-descriptionForeground)', fontSize: 13 },
  inputRow: { display: 'flex', gap: 4, marginTop: 4 },
  textarea: { flex: 1, resize: 'none' as const, background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 3, padding: '4px 6px', fontSize: 12, fontFamily: 'inherit' },
  sendBtn: { padding: '4px 10px', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
};

export default function ChatThread(): React.ReactElement {
  const { chatMessages, pinnedElement, setPinnedElement, addChatMessage, appendStreamChunk, finishStream, attachedFiles, designReferenceBase64 } = useStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [chatMessages]);

  async function send() {
    if (!input.trim() || sending) return;
    const userText = pinnedElement
      ? `Element: ${pinnedElement.componentName} (${pinnedElement.filePath})\nSelector: ${pinnedElement.selector}\n\n${input}`
      : input;
    addChatMessage({ role: 'user', content: userText });
    setInput('');
    setSending(true);

    const history: ClaudeMessage[] = chatMessages.map(m => ({ role: m.role, content: m.content }));
    const userMsg: ClaudeMessage = { role: 'user', content: designReferenceBase64
      ? [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: designReferenceBase64 } },
          { type: 'text', text: userText },
        ]
      : userText,
    };
    const messages = [...history, userMsg];
    const id = bridge.uid();
    const unsub = bridge.onStream(id, appendStreamChunk, () => { finishStream(); setSending(false); });
    bridge.send({ type: 'CLAUDE_CHAT', id, payload: { messages, context: pinnedElement ?? undefined } });
    return () => unsub();
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div style={s.root}>
      <div style={s.label}>Claude Chat</div>
      <div ref={threadRef} style={s.thread}>
        {chatMessages.map((m, i) => (
          <div key={i} style={s.msg(m.role)}>{m.content}{m.streaming && <span style={{ opacity: 0.5 }}>▌</span>}</div>
        ))}
      </div>
      {pinnedElement && (
        <div style={s.pinChip}>
          <span>📌 {pinnedElement.componentName}</span>
          <button style={s.dismissBtn} onClick={() => setPinnedElement(null)}>×</button>
        </div>
      )}
      <div style={s.inputRow}>
        <textarea
          style={s.textarea}
          rows={3}
          placeholder="Ask Claude..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={sending}
        />
        <button style={s.sendBtn} onClick={send} disabled={sending || !input.trim()}>
          {sending ? '...' : '→'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update LeftPanel/index.tsx**

```tsx
import React from 'react';
import DesignReference from './DesignReference';
import FileAttach from './FileAttach';
import ChatThread from './ChatThread';

export default function LeftPanel(): React.ReactElement {
  return (
    <div style={{ padding: 12, overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <DesignReference />
      <hr style={{ border: 'none', borderTop: '1px solid var(--vscode-panel-border)', flexShrink: 0 }} />
      <FileAttach />
      <hr style={{ border: 'none', borderTop: '1px solid var(--vscode-panel-border)', flexShrink: 0 }} />
      <ChatThread />
    </div>
  );
}
```

- [ ] **Step 3: Build**

```bash
npm run build:webview
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/webview/components/LeftPanel/
git commit -m "feat: left panel chat thread with streaming + pinned element context"
```

---

### Task 7: Center Panel — Toolbar + Live Preview + Annotation

**Files:**
- Modify: `src/webview/components/CenterPanel/index.tsx`
- Create: `src/webview/components/CenterPanel/PreviewToolbar.tsx`
- Create: `src/webview/components/CenterPanel/LivePreview.tsx`
- Create: `src/webview/components/CenterPanel/BranchBanner.tsx`

**Interfaces:**
- Consumes: `useStore` (devServerUrl, viewport, annotationMode, activeTab, activeVariant)
- The iframe annotation script communicates via `window.postMessage` from inside the iframe

- [ ] **Step 1: Create PreviewToolbar.tsx**

```tsx
import React, { useState } from 'react';
import { useStore } from '../../store';

const s: Record<string, React.CSSProperties> = {
  bar: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--vscode-editorGroupHeader-tabsBackground)', borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0 },
  input: { flex: 1, padding: '3px 6px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 3, fontSize: 12 },
  btn: (active?: boolean): React.CSSProperties => ({
    padding: '3px 8px', background: active ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
    color: active ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
    border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap',
  }),
  select: { padding: '3px 4px', background: 'var(--vscode-dropdown-background)', color: 'var(--vscode-dropdown-foreground)', border: '1px solid var(--vscode-dropdown-border)', borderRadius: 3, fontSize: 11 },
};

export default function PreviewToolbar(): React.ReactElement {
  const { devServerUrl, setDevServerUrl, viewport, setViewport, annotationMode, setAnnotationMode, activeTab, setActiveTab, activeVariant } = useStore();
  const [urlInput, setUrlInput] = useState(devServerUrl);

  return (
    <div style={s.bar}>
      <input style={s.input} value={urlInput} onChange={e => setUrlInput(e.target.value)}
        onBlur={() => setDevServerUrl(urlInput)}
        onKeyDown={e => { if (e.key === 'Enter') setDevServerUrl(urlInput); }} />
      <button style={s.btn()} onClick={() => setDevServerUrl(urlInput + '?' + Date.now())}>↺</button>
      <select style={s.select} value={viewport} onChange={e => setViewport(e.target.value as 'desktop' | 'tablet' | 'mobile')}>
        <option value="desktop">1440</option>
        <option value="tablet">768</option>
        <option value="mobile">375</option>
      </select>
      <button style={s.btn(annotationMode)} onClick={() => setAnnotationMode(!annotationMode)}>
        {annotationMode ? '✏️ On' : '✏️ Off'}
      </button>
      <button style={s.btn(activeTab === 'preview')} onClick={() => setActiveTab('preview')}>Preview</button>
      {activeVariant && (
        <button style={s.btn(activeTab === 'output')} onClick={() => setActiveTab('output')}>Claude Output</button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create LivePreview.tsx**

The annotation injection script runs inside the iframe via `postMessage`. Define it as a string to inject:

```tsx
import React, { useRef, useEffect } from 'react';
import { useStore } from '../../store';
import type { ElementContext } from '../../../host/types';

const VIEWPORT_WIDTHS = { desktop: 1440, tablet: 768, mobile: 375 };

const ANNOTATION_SCRIPT = `
(function() {
  if (window.__claudeAnnotation) return;
  window.__claudeAnnotation = true;
  let overlay = null;
  function getStyles(el) {
    const cs = window.getComputedStyle(el);
    const props = ['color','background-color','font-size','font-weight','padding','margin','border','border-radius','display','flex-direction','align-items','justify-content','width','height'];
    const result = {};
    props.forEach(p => { result[p] = cs.getPropertyValue(p); });
    return result;
  }
  function getSelector(el) {
    if (el.id) return '#' + el.id;
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body) {
      let part = cur.tagName.toLowerCase();
      if (cur.className) part += '.' + Array.from(cur.classList).join('.');
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }
  function getComponentName(el) {
    let fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    if (fiberKey) {
      let fiber = el[fiberKey];
      while (fiber) {
        if (fiber.type && typeof fiber.type === 'function' && fiber.type.name) return fiber.type.name;
        fiber = fiber.return;
      }
    }
    return el.tagName.toLowerCase();
  }
  document.addEventListener('mouseover', function(e) {
    if (!window.__claudeAnnotationActive) return;
    e.stopPropagation();
    const target = e.target;
    if (overlay) overlay.remove();
    const rect = target.getBoundingClientRect();
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:999999;outline:2px solid #007acc;background:rgba(0,122,204,0.08);';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    document.body.appendChild(overlay);
  }, true);
  document.addEventListener('click', function(e) {
    if (!window.__claudeAnnotationActive) return;
    e.preventDefault(); e.stopPropagation();
    const target = e.target;
    const rect = target.getBoundingClientRect();
    window.parent.postMessage({
      type: 'ELEMENT_SELECTED',
      data: {
        selector: getSelector(target),
        componentName: getComponentName(target),
        filePath: '',
        computedStyles: getStyles(target),
        boundingBox: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      }
    }, '*');
  }, true);
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'SET_ANNOTATION_MODE') {
      window.__claudeAnnotationActive = e.data.active;
      if (!e.data.active && overlay) { overlay.remove(); overlay = null; }
    }
  });
})();
`;

export default function LivePreview(): React.ReactElement {
  const { devServerUrl, viewport, annotationMode, setSelectedElement, setPinnedElement } = useStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const width = VIEWPORT_WIDTHS[viewport];

  // Inject annotation script and toggle mode
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    function onLoad() {
      try {
        iframe!.contentWindow?.eval(ANNOTATION_SCRIPT);
      } catch { /* cross-origin — postMessage only */ }
      iframe!.contentWindow?.postMessage({ type: 'SET_ANNOTATION_MODE', active: annotationMode }, '*');
    }
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [devServerUrl]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'SET_ANNOTATION_MODE', active: annotationMode }, '*');
  }, [annotationMode]);

  // Listen for element selection from iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'ELEMENT_SELECTED') {
        const el = e.data.data as ElementContext;
        setSelectedElement(el);
        setPinnedElement(el);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setSelectedElement, setPinnedElement]);

  return (
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'auto', background: '#1e1e1e', padding: 16 }}>
      <iframe
        ref={iframeRef}
        src={devServerUrl}
        style={{ width, height: 900, border: '1px solid var(--vscode-panel-border)', background: '#fff', flexShrink: 0 }}
        title="Live Preview"
      />
    </div>
  );
}
```

- [ ] **Step 3: Create BranchBanner.tsx**

```tsx
import React, { useState } from 'react';
import { useStore } from '../../store';
import * as bridge from '../../bridge';

const s: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: 'var(--vscode-statusBar-background)', color: 'var(--vscode-statusBar-foreground)', fontSize: 11, flexShrink: 0 };
const btn = (danger?: boolean): React.CSSProperties => ({ padding: '2px 8px', background: danger ? 'var(--vscode-button-secondaryBackground)' : 'var(--vscode-button-background)', color: danger ? 'var(--vscode-button-secondaryForeground)' : 'var(--vscode-button-foreground)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11 });

export default function BranchBanner(): React.ReactElement | null {
  const { activeVariant, setActiveVariant, setActiveTab, updateVariantStatus } = useStore();
  const [loading, setLoading] = useState(false);

  if (!activeVariant) return null;

  async function apply() {
    if (!activeVariant) return;
    setLoading(true);
    try {
      await bridge.request({ type: 'APPLY_BRANCH', id: bridge.uid(), payload: { branch: activeVariant.branch, filePath: activeVariant.filePath } });
      updateVariantStatus(activeVariant.branch, 'applied');
      setActiveVariant(null);
      setActiveTab('preview');
    } finally { setLoading(false); }
  }

  async function discard() {
    if (!activeVariant) return;
    setLoading(true);
    try {
      await bridge.request({ type: 'DISCARD_BRANCH', id: bridge.uid(), payload: { branch: activeVariant.branch } });
      updateVariantStatus(activeVariant.branch, 'discarded');
      setActiveVariant(null);
      setActiveTab('preview');
    } finally { setLoading(false); }
  }

  return (
    <div style={s}>
      <span>🌿 {activeVariant.branch}</span>
      <button style={btn()} onClick={() => setActiveTab('output')} disabled={loading}>Compare</button>
      <button style={btn()} onClick={apply} disabled={loading}>{loading ? '...' : 'Apply'}</button>
      <button style={btn(true)} onClick={discard} disabled={loading}>Discard</button>
    </div>
  );
}
```

- [ ] **Step 4: Update CenterPanel/index.tsx**

```tsx
import React from 'react';
import PreviewToolbar from './PreviewToolbar';
import LivePreview from './LivePreview';
import BranchBanner from './BranchBanner';
import ClaudeOutputTab from './ClaudeOutputTab';
import { useStore } from '../../store';

export default function CenterPanel(): React.ReactElement {
  const { activeTab } = useStore();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PreviewToolbar />
      <BranchBanner />
      <div style={{ flex: 1, minHeight: 0, display: activeTab === 'preview' ? 'flex' : 'none', flexDirection: 'column' }}>
        <LivePreview />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: activeTab === 'output' ? 'flex' : 'none', flexDirection: 'column' }}>
        <ClaudeOutputTab />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create ClaudeOutputTab.tsx stub (will be filled in Task 8)**

```tsx
import React from 'react';
import { useStore } from '../../store';

export default function ClaudeOutputTab(): React.ReactElement {
  const { activeVariant } = useStore();
  if (!activeVariant) return <div style={{ padding: 16, fontSize: 12 }}>No variant generated yet.</div>;
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: 'var(--vscode-editor-foreground)', fontFamily: 'monospace' }}>
        {activeVariant.generatedContent}
      </pre>
    </div>
  );
}
```

- [ ] **Step 6: Build**

```bash
npm run build:webview
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/webview/components/CenterPanel/
git commit -m "feat: center panel toolbar, live preview iframe, annotation injection, branch banner"
```

---

### Task 8: Right Panel — Element Inspector + Variant Controls

**Files:**
- Modify: `src/webview/components/RightPanel/index.tsx`
- Create: `src/webview/components/RightPanel/ElementHeader.tsx`
- Create: `src/webview/components/RightPanel/PropertiesInspector.tsx`
- Create: `src/webview/components/RightPanel/InstructionBox.tsx`
- Create: `src/webview/components/RightPanel/VariantHistory.tsx`

**Interfaces:**
- Consumes: `useStore`, `bridge.request`, `bridge.uid`
- Calls: `PREVIEW_VARIANT`, `OPEN_FILE`

- [ ] **Step 1: Create ElementHeader.tsx**

```tsx
import React from 'react';
import { useStore } from '../../store';
import * as bridge from '../../bridge';

const s: Record<string, React.CSSProperties> = {
  root: { padding: '8px 12px', borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0 },
  name: { fontWeight: 600, fontSize: 13, color: 'var(--vscode-editor-foreground)' },
  path: { fontSize: 11, color: 'var(--vscode-textLink-foreground)', cursor: 'pointer', textDecoration: 'underline', marginTop: 2, wordBreak: 'break-all' as const },
  selector: { fontSize: 10, color: 'var(--vscode-descriptionForeground)', fontFamily: 'monospace', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  empty: { padding: '12px', fontSize: 12, color: 'var(--vscode-descriptionForeground)' },
};

export default function ElementHeader(): React.ReactElement {
  const { selectedElement } = useStore();
  if (!selectedElement) return <div style={s.empty}>Select an element in the preview to inspect it.</div>;

  async function openFile() {
    if (!selectedElement?.filePath) return;
    await bridge.request({ type: 'OPEN_FILE', id: bridge.uid(), payload: { path: selectedElement.filePath } });
  }

  return (
    <div style={s.root}>
      <div style={s.name}>{selectedElement.componentName}</div>
      {selectedElement.filePath && (
        <div style={s.path} onClick={openFile}>{selectedElement.filePath}</div>
      )}
      <div style={s.selector}>{selectedElement.selector}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create PropertiesInspector.tsx**

```tsx
import React from 'react';
import { useStore } from '../../store';

const s: Record<string, React.CSSProperties> = {
  root: { padding: '8px 12px', borderBottom: '1px solid var(--vscode-panel-border)' },
  label: { fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px' },
  key: { fontSize: 11, color: 'var(--vscode-descriptionForeground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  val: { fontSize: 11, color: 'var(--vscode-editor-foreground)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
};

const SHOWN_PROPS = ['color', 'background-color', 'font-size', 'font-weight', 'padding', 'margin', 'border-radius', 'display', 'width', 'height'];

export default function PropertiesInspector(): React.ReactElement {
  const { selectedElement } = useStore();
  if (!selectedElement) return <></>;

  const entries = SHOWN_PROPS.map(k => [k, selectedElement.computedStyles[k] ?? '—'] as [string, string])
    .filter(([, v]) => v && v !== '—');

  return (
    <div style={s.root}>
      <div style={s.label}>Computed Styles</div>
      <div style={s.grid}>
        {entries.map(([k, v]) => (
          <React.Fragment key={k}>
            <div style={s.key}>{k}</div>
            <div style={s.val}>{v}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create InstructionBox.tsx**

```tsx
import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import * as bridge from '../../bridge';
import type { VariantHistoryEntry } from '../../store';

const s: Record<string, React.CSSProperties> = {
  root: { padding: '8px 12px', borderBottom: '1px solid var(--vscode-panel-border)', display: 'flex', flexDirection: 'column' as const, gap: 6 },
  label: { fontSize: 11, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' as const, letterSpacing: 1 },
  textarea: { resize: 'vertical' as const, background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 3, padding: '6px', fontSize: 12, fontFamily: 'inherit', minHeight: 80 },
  btn: (primary?: boolean): React.CSSProperties => ({ padding: '5px 0', background: primary ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)', color: primary ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12, flex: 1 }),
  btnRow: { display: 'flex', gap: 6 },
  error: { fontSize: 11, color: 'var(--vscode-errorForeground)' },
};

export default function InstructionBox(): React.ReactElement {
  const { selectedElement, attachedFiles, addVariantHistory, setActiveVariant, setActiveTab } = useStore();
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedElement) setInstruction('');
  }, [selectedElement?.selector]);

  async function previewVariant() {
    if (!selectedElement || !instruction.trim()) return;
    setError(''); setLoading(true);
    try {
      const result = await bridge.request<{ branch: string; filePath: string; generatedContent: string }>({
        type: 'PREVIEW_VARIANT',
        id: bridge.uid(),
        payload: { element: selectedElement, instruction, files: attachedFiles },
      });
      const entry: VariantHistoryEntry = {
        id: result.branch,
        timestamp: Date.now(),
        element: selectedElement,
        instruction,
        variant: result,
        status: 'pending',
      };
      addVariantHistory(entry);
      setActiveVariant(result);
      setActiveTab('output');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!selectedElement) return <></>;

  return (
    <div style={s.root}>
      <div style={s.label}>Instruction</div>
      <textarea
        style={s.textarea}
        placeholder={`Describe changes to ${selectedElement.componentName}...`}
        value={instruction}
        onChange={e => setInstruction(e.target.value)}
      />
      {error && <div style={s.error}>{error}</div>}
      <div style={s.btnRow}>
        <button style={s.btn(true)} disabled={!instruction.trim() || loading} onClick={previewVariant}>
          {loading ? 'Generating...' : 'Preview Variant'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create VariantHistory.tsx**

```tsx
import React, { useState } from 'react';
import { useStore } from '../../store';

const s: Record<string, React.CSSProperties> = {
  root: { padding: '8px 12px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const },
  label: { fontSize: 11, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6, cursor: 'pointer', userSelect: 'none' as const },
  list: { overflowY: 'auto' as const, flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 4 },
  item: (status: string): React.CSSProperties => ({
    padding: '6px 8px', borderRadius: 3, fontSize: 11, cursor: 'pointer',
    background: status === 'applied' ? 'rgba(0,200,100,0.08)' : status === 'discarded' ? 'rgba(200,0,0,0.08)' : 'var(--vscode-badge-background)',
    border: '1px solid var(--vscode-panel-border)',
  }),
  meta: { color: 'var(--vscode-descriptionForeground)', fontSize: 10, marginTop: 2 },
};

export default function VariantHistory(): React.ReactElement {
  const { variantHistory, setActiveVariant, setActiveTab } = useStore();
  const [open, setOpen] = useState(true);

  return (
    <div style={s.root}>
      <div style={s.label} onClick={() => setOpen(o => !o)}>{open ? '▾' : '▸'} History ({variantHistory.length})</div>
      {open && (
        <div style={s.list}>
          {variantHistory.length === 0 && <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>No variants yet.</div>}
          {variantHistory.map(e => (
            <div key={e.id} style={s.item(e.status)} onClick={() => { setActiveVariant(e.variant); setActiveTab('output'); }}>
              <div>{e.element.componentName}</div>
              <div style={{ color: 'var(--vscode-editor-foreground)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{e.instruction}</div>
              <div style={s.meta}>{new Date(e.timestamp).toLocaleTimeString()} · {e.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Update RightPanel/index.tsx**

```tsx
import React from 'react';
import ElementHeader from './ElementHeader';
import PropertiesInspector from './PropertiesInspector';
import InstructionBox from './InstructionBox';
import VariantHistory from './VariantHistory';

export default function RightPanel(): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ElementHeader />
      <div style={{ overflowY: 'auto', flex: 'none' }}>
        <PropertiesInspector />
        <InstructionBox />
      </div>
      <VariantHistory />
    </div>
  );
}
```

- [ ] **Step 6: Build both**

```bash
npm run build
```

Expected: No errors. `out/` and `dist/webview/` both populated.

- [ ] **Step 7: Commit**

```bash
git add src/webview/components/RightPanel/
git commit -m "feat: right panel element header, properties, instruction box, variant history"
```

---

### Task 9: Final Build + Package

**Files:**
- No new files — verify full build and package

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: No TypeScript errors. `out/extension.js` and `dist/webview/index.html` exist.

- [ ] **Step 2: Install vsce if needed**

```bash
npx vsce --version || npm install -g @vscode/vsce
```

- [ ] **Step 3: Package**

```bash
npx vsce package --no-dependencies
```

Expected: `claude-visual-dev-0.1.0.vsix` created.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete claude-visual-dev extension v0.1.0"
```
