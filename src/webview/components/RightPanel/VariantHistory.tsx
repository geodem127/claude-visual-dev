import React, { useState } from 'react';
import { useStore } from '../../store';

function statusColor(status: string): string {
  if (status === 'applied') return 'rgba(0,200,100,0.12)';
  if (status === 'discarded') return 'rgba(200,50,50,0.10)';
  return 'var(--vscode-badge-background)';
}

export default function VariantHistory(): React.ReactElement {
  const { variantHistory, setActiveVariant, setActiveTab } = useStore();
  const [open, setOpen] = useState(true);

  return (
    <div style={{ padding: '8px 12px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6, cursor: 'pointer', userSelect: 'none' as const, flexShrink: 0 }}
        onClick={() => setOpen(o => !o)}
      >
        {open ? '▾' : '▸'} History ({variantHistory.length})
      </div>
      {open && (
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {variantHistory.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)' }}>No variants generated yet.</div>
          )}
          {variantHistory.map(e => (
            <div
              key={e.id}
              style={{
                padding: '6px 8px', borderRadius: 3, fontSize: 11, cursor: 'pointer',
                background: statusColor(e.status),
                border: '1px solid var(--vscode-panel-border)',
              }}
              onClick={() => { setActiveVariant(e.variant); setActiveTab('output'); }}
            >
              <div style={{ fontWeight: 600, color: 'var(--vscode-editor-foreground)' }}>{e.element.componentName}</div>
              <div style={{ color: 'var(--vscode-editor-foreground)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {e.instruction}
              </div>
              <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: 10, marginTop: 2 }}>
                {new Date(e.timestamp).toLocaleTimeString()} · {e.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
