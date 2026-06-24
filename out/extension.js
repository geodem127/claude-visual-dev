"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const messageHandler_1 = require("./host/messageHandler");
function activate(context) {
    const disposable = vscode.commands.registerCommand('claudeDev.open', () => {
        const panel = vscode.window.createWebviewPanel('claudeVisualDev', 'Claude Visual Dev', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview'))],
        });
        panel.webview.html = getWebviewHtml(panel.webview, context);
        const handler = (0, messageHandler_1.registerMessageHandler)(panel);
        panel.onDidDispose(() => handler.dispose(), null, context.subscriptions);
    });
    context.subscriptions.push(disposable);
}
function getWebviewHtml(webview, context) {
    const distPath = path.join(context.extensionPath, 'dist', 'webview');
    const indexPath = path.join(distPath, 'index.html');
    let html = fs.readFileSync(indexPath, 'utf-8');
    html = html.replace(/(src|href)="([^"]+)"/g, (match, attr, val) => {
        if (val.startsWith('http') || val.startsWith('//') || val.startsWith('data:'))
            return match;
        const assetUri = webview.asWebviewUri(vscode.Uri.file(path.join(distPath, val)));
        return `${attr}="${assetUri}"`;
    });
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: https:; script-src 'unsafe-inline' ${webview.cspSource}; style-src 'unsafe-inline' ${webview.cspSource}; frame-src *;">`;
    html = html.replace('<head>', `<head>${csp}`);
    return html;
}
function deactivate() { }
