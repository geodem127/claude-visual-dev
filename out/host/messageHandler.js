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
exports.registerMessageHandler = registerMessageHandler;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("./fileSystem"));
const git = __importStar(require("./gitClient"));
const figma = __importStar(require("./figmaClient"));
const screenshotter_1 = require("./screenshotter");
const claudeClient_1 = require("./claudeClient");
function send(panel, msg) {
    panel.webview.postMessage(msg);
}
function cfg(key) {
    return vscode.workspace.getConfiguration('claudeDev').get(key) ?? '';
}
function workspaceRoot() {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!folder)
        throw new Error('No workspace folder open');
    return folder;
}
function registerMessageHandler(panel) {
    return panel.webview.onDidReceiveMessage(async (msg) => {
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
                    if (!apiKey)
                        throw new Error('Figma API key not configured. Set claudeDev.figmaApiKey in settings.');
                    const fileKey = figma.extractFigmaFileKey(msg.payload.url);
                    const base64 = await figma.fetchFigmaScreenshot(fileKey, apiKey);
                    send(panel, { type: 'RESPONSE', id: msg.id, result: base64 });
                    break;
                }
                case 'SCREENSHOT_URL': {
                    const base64 = await (0, screenshotter_1.screenshotUrl)(msg.payload.url);
                    send(panel, { type: 'RESPONSE', id: msg.id, result: base64 });
                    break;
                }
                case 'CLAUDE_CHAT': {
                    const apiKey = cfg('claudeApiKey');
                    const model = cfg('claudeModel') || 'claude-sonnet-4-6';
                    if (!apiKey)
                        throw new Error('Claude API key not configured. Set claudeDev.claudeApiKey in settings.');
                    await (0, claudeClient_1.streamChat)(msg.payload.messages, apiKey, model, chunk => {
                        send(panel, { type: 'STREAM_CHUNK', id: msg.id, chunk });
                    });
                    send(panel, { type: 'STREAM_END', id: msg.id });
                    send(panel, { type: 'RESPONSE', id: msg.id, result: true });
                    break;
                }
                case 'PREVIEW_VARIANT': {
                    const apiKey = cfg('claudeApiKey');
                    const model = cfg('claudeModel') || 'claude-sonnet-4-6';
                    if (!apiKey)
                        throw new Error('Claude API key not configured. Set claudeDev.claudeApiKey in settings.');
                    const root = workspaceRoot();
                    const branch = `claude/variant-${Date.now()}`;
                    const generatedContent = await (0, claudeClient_1.generateVariant)(msg.payload.element, msg.payload.instruction, msg.payload.files, apiKey, model);
                    await git.createBranch(root, branch);
                    const absPath = path.join(root, msg.payload.element.filePath);
                    await fs.writeFile(absPath, generatedContent);
                    await git.commitFile(root, msg.payload.element.filePath, `feat: claude variant for ${msg.payload.element.componentName}`);
                    const result = { branch, filePath: msg.payload.element.filePath, generatedContent };
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
        }
        catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            send(panel, { type: 'ERROR', id: msg.id, error });
        }
    });
}
