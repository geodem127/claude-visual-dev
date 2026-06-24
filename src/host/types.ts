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
  | { type: 'LIST_FILES'; id: string; payload: { dir: string } }
  | { type: 'FETCH_GITHUB_TICKET'; id: string; payload: { ref: string } };

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

export interface GitHubTicket {
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
  labels: string[];
}
