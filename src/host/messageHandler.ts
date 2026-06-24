import * as vscode from 'vscode';
import * as path from 'path';
import fetch from 'node-fetch';
import type { WebviewMessage, HostMessage, VariantResult, GitHubTicket } from './types';
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

async function fetchGitHubTicket(ref: string, token: string): Promise<GitHubTicket> {
  // Accept: full URL, owner/repo#number, or just a number (uses workspace remote)
  let owner = '', repo = '', number = '';
  const urlMatch = ref.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  const shortMatch = ref.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  const numMatch = ref.match(/^#?(\d+)$/);

  if (urlMatch) {
    [, owner, repo, number] = urlMatch;
  } else if (shortMatch) {
    [, owner, repo, number] = shortMatch;
  } else if (numMatch) {
    [, number] = numMatch;
    // Try to infer from workspace git remote
    try {
      const simpleGit = (await import('simple-git')).default;
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
      const remotes = await simpleGit(root).getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin')?.refs?.fetch ?? '';
      const m = origin.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      if (m) { owner = m[1]; repo = m[2]; }
    } catch { /* ignore */ }
    if (!owner) throw new Error('Could not determine repo from workspace. Use owner/repo#number format.');
  } else {
    throw new Error('Invalid ticket reference. Use a GitHub issue URL, owner/repo#number, or just #number.');
  }

  const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `token ${token}`;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${number}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  const data = await res.json() as {
    number: number; title: string; body: string | null;
    html_url: string; state: string; labels: { name: string }[];
  };
  return {
    number: data.number,
    title: data.title,
    body: data.body ?? '',
    url: data.html_url,
    state: data.state,
    labels: data.labels.map(l => l.name),
  };
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
          const model = cfg('claudeModel') || 'claude-sonnet-4-6';
          await streamChat(msg.payload.messages, model, chunk => {
            send(panel, { type: 'STREAM_CHUNK', id: msg.id, chunk });
          });
          send(panel, { type: 'STREAM_END', id: msg.id });
          send(panel, { type: 'RESPONSE', id: msg.id, result: true });
          break;
        }
        case 'PREVIEW_VARIANT': {
          const model = cfg('claudeModel') || 'claude-sonnet-4-6';
          const root = workspaceRoot();
          const branch = `claude/variant-${Date.now()}`;
          const generatedContent = await generateVariant(
            msg.payload.element,
            msg.payload.instruction,
            msg.payload.files,
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
        case 'FETCH_GITHUB_TICKET': {
          const token = cfg('githubToken');
          const ticket = await fetchGitHubTicket(msg.payload.ref, token);
          send(panel, { type: 'RESPONSE', id: msg.id, result: ticket });
          break;
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      send(panel, { type: 'ERROR', id: msg.id, error });
    }
  });
}
