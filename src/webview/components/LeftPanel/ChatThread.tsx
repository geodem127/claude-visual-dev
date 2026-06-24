import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store';
import * as bridge from '../../bridge';
import type { ClaudeMessage } from '../../../host/types';

const s: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column' as const, flex: 1, minHeight: 0 },
  label: { fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 1, flexShrink: 0 },
  thread: { flex: 1, overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 8, paddingBottom: 8, minHeight: 80 },
  pinChip: { display: 'flex', alignItems: 'center', gap: 4, background: 'var(--vscode-badge-background)', borderRadius: 3, padding: '2px 6px', fontSize: 11, flexShrink: 0, marginBottom: 4 },
  dismissBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vscode-descriptionForeground)', fontSize: 13, padding: 0 },
  inputRow: { display: 'flex', gap: 4, marginTop: 4, flexShrink: 0 },
  textarea: { flex: 1, resize: 'none' as const, background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 3, padding: '4px 6px', fontSize: 12, fontFamily: 'inherit' },
  sendBtn: { padding: '4px 10px', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 14, alignSelf: 'flex-end' },
};

function msgStyle(role: string): React.CSSProperties {
  return {
    padding: '6px 8px', borderRadius: 4, fontSize: 12, lineHeight: 1.5,
    background: role === 'user' ? 'var(--vscode-button-background)' : 'var(--vscode-badge-background)',
    color: role === 'user' ? 'var(--vscode-button-foreground)' : 'var(--vscode-editor-foreground)',
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    maxWidth: '90%', whiteSpace: 'pre-wrap' as const,
  };
}

export default function ChatThread(): React.ReactElement {
  const {
    chatMessages, pinnedElement, setPinnedElement,
    addChatMessage, appendStreamChunk, finishStream,
    attachedFiles, designReferenceBase64,
  } = useStore();
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
    const userContent: ClaudeMessage['content'] = designReferenceBase64
      ? [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: designReferenceBase64 } },
          { type: 'text', text: userText },
        ]
      : userText;

    const messages: ClaudeMessage[] = [...history, { role: 'user', content: userContent }];
    const id = bridge.uid();
    bridge.onStream(id, appendStreamChunk, () => { finishStream(); setSending(false); });
    bridge.send({ type: 'CLAUDE_CHAT', id, payload: { messages, context: pinnedElement ?? undefined } });
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div style={s.root}>
      <div style={s.label}>Claude Chat</div>
      <div ref={threadRef} style={s.thread}>
        {chatMessages.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', textAlign: 'center', marginTop: 16 }}>
            Select an element or ask Claude anything
          </div>
        )}
        {chatMessages.map((m, i) => (
          <div key={i} style={msgStyle(m.role)}>
            {m.content}
            {m.streaming && <span style={{ opacity: 0.5 }}>▌</span>}
          </div>
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
          placeholder={pinnedElement ? `Ask about ${pinnedElement.componentName}...` : 'Ask Claude...'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={sending}
        />
        <button style={s.sendBtn} onClick={send} disabled={sending || !input.trim()}>
          {sending ? '…' : '→'}
        </button>
      </div>
    </div>
  );
}
