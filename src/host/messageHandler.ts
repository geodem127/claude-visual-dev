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
          if (!apiKey) throw new Error('Figma API key not configured. Set claudeDev.figmaApiKey in settings.');
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
          if (!apiKey) throw new Error('Claude API key not configured. Set claudeDev.claudeApiKey in settings.');
          await streamChat(msg.payload.messages, apiKey, model, chunk => {
            send(panel, { type: 'STREAM_CHUNK', id: msg.id, chunk });
          });
          send(panel, { type: 'STREAM_END', id: msg.id });
          send(panel, { type: 'RESPONSE', id: msg.id, result: true });
          break;
        }
        case 'PREVIEW_VARIANT': {
          const apiKey = cfg('claudeApiKey');
          const model = cfg('claudeModel') || 'claude-sonnet-4-6';
          if (!apiKey) throw new Error('Claude API key not configured. Set claudeDev.claudeApiKey in settings.');
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
