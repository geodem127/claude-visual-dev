import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { registerMessageHandler } from './host/messageHandler';

let mainPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'claudeDev.sidebarView',
      {
        resolveWebviewView(webviewView: vscode.WebviewView) {
          webviewView.webview.options = { enableScripts: true };
          webviewView.webview.html = getSidebarHtml();
          webviewView.webview.onDidReceiveMessage(msg => {
            if (msg.type === 'OPEN_PANEL') {
              vscode.commands.executeCommand('claudeDev.open');
            }
          });
          vscode.commands.executeCommand('claudeDev.open');
        },
      },
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeDev.open', () => {
      if (mainPanel) {
        mainPanel.reveal(vscode.ViewColumn.One);
        return;
      }
      mainPanel = vscode.window.createWebviewPanel(
        'claudeVisualDev',
        'Claude Visual Dev',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview')),
          ],
        }
      );
      mainPanel.webview.html = getWebviewHtml(mainPanel.webview, context);
      const handler = registerMessageHandler(mainPanel);
      mainPanel.onDidDispose(() => {
        mainPanel = undefined;
        handler.dispose();
      }, null, context.subscriptions);
    })
  );
}

function getSidebarHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { padding: 16px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
    button {
      width: 100%; padding: 8px; margin-top: 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none; border-radius: 4px; cursor: pointer; font-size: 13px;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    p { font-size: 12px; color: var(--vscode-descriptionForeground); line-height: 1.5; }
  </style>
</head>
<body>
  <p>Visual development with Claude — live preview, element selection, and AI-generated variants.</p>
  <button onclick="openPanel()">Open Panel</button>
  <script>
    const vscode = acquireVsCodeApi();
    function openPanel() { vscode.postMessage({ type: 'OPEN_PANEL' }); }
  </script>
</body>
</html>`;
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

export function deactivate(): void {
  mainPanel?.dispose();
}
