import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('claudeDev.open', () => {
    vscode.window.showInformationMessage('Claude Visual Dev — coming soon');
  });
  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
