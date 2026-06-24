import type { WebviewMessage, HostMessage } from '../host/types';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = typeof acquireVsCodeApi !== 'undefined'
  ? acquireVsCodeApi()
  : { postMessage: (_: unknown) => {} };

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
