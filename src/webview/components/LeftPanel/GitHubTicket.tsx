import React, { useState } from 'react';
import { useStore } from '../../store';
import * as bridge from '../../bridge';
import type { GitHubTicket as Ticket } from '../../../host/types';

const s: Record<string, React.CSSProperties> = {
  root: { padding: '8px 0' },
  label: { fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 1 },
  row: { display: 'flex', gap: 4 },
  input: { flex: 1, padding: '4px 6px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 3, fontSize: 12 },
  btn: { padding: '4px 10px', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
  card: { marginTop: 8, padding: '8px 10px', background: 'var(--vscode-badge-background)', borderRadius: 4, border: '1px solid var(--vscode-panel-border)' },
  ticketNum: { fontSize: 10, color: 'var(--vscode-descriptionForeground)', marginBottom: 2 },
  ticketTitle: { fontSize: 12, fontWeight: 600, color: 'var(--vscode-editor-foreground)', marginBottom: 4 },
  ticketBody: { fontSize: 11, color: 'var(--vscode-editor-foreground)', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' as const, whiteSpace: 'pre-wrap' as const },
  labels: { display: 'flex', gap: 3, flexWrap: 'wrap' as const, marginTop: 6 },
  labelChip: { fontSize: 10, padding: '1px 6px', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', borderRadius: 10 },
  link: { fontSize: 10, color: 'var(--vscode-textLink-foreground)', cursor: 'pointer', marginTop: 4, display: 'block' },
  error: { marginTop: 4, fontSize: 11, color: 'var(--vscode-errorForeground)' },
  clearBtn: { marginTop: 4, width: '100%', padding: '3px 0', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11 },
};

export default function GitHubTicket(): React.ReactElement {
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { githubTicket, setGithubTicket } = useStore();

  async function fetch() {
    if (!ref.trim()) return;
    setError(''); setLoading(true);
    try {
      const ticket = await bridge.request<Ticket>({
        type: 'FETCH_GITHUB_TICKET',
        id: bridge.uid(),
        payload: { ref: ref.trim() },
      });
      setGithubTicket(ticket);
      setRef('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.root}>
      <div style={s.label}>GitHub Ticket</div>
      <div style={s.row}>
        <input
          style={s.input}
          placeholder="#123, owner/repo#123, or issue URL"
          value={ref}
          onChange={e => setRef(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') fetch(); }}
        />
        <button style={s.btn} disabled={!ref.trim() || loading} onClick={fetch}>
          {loading ? '…' : 'Load'}
        </button>
      </div>
      {error && <div style={s.error}>{error}</div>}
      {githubTicket && (
        <div style={s.card}>
          <div style={s.ticketNum}>#{githubTicket.number} · {githubTicket.state}</div>
          <div style={s.ticketTitle}>{githubTicket.title}</div>
          {githubTicket.body && (
            <div style={s.ticketBody}>{githubTicket.body}</div>
          )}
          {githubTicket.labels.length > 0 && (
            <div style={s.labels}>
              {githubTicket.labels.map(l => <span key={l} style={s.labelChip}>{l}</span>)}
            </div>
          )}
          <a style={s.link} onClick={() => window.open(githubTicket.url, '_blank')}>
            Open on GitHub ↗
          </a>
          <button style={s.clearBtn} onClick={() => setGithubTicket(null)}>Clear</button>
        </div>
      )}
    </div>
  );
}
