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
  html = html.replace(/(src|href)="([^"]+)"/g, (match, attr, val) => {
    if (val.startsWith('http') || val.startsWith('//') || val.startsWith('data:')) return match;
    const assetUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, val)));
    return `${attr}="${assetUri}"`;
  });
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: https:; script-src 'unsafe-inline' ${webview.cspSource}; style-src 'unsafe-inline' ${webview.cspSource}; frame-src *;">`;
  html = html.replace('<head>', `<head>${csp}`);
  return html;
}

export function deactivate(): void {}
