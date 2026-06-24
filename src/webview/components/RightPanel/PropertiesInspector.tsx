import React from 'react';
import { useStore } from '../../store';

const SHOWN_PROPS = [
  'color', 'background-color', 'font-size', 'font-weight',
  'padding', 'margin', 'border-radius', 'display',
  'width', 'height', 'align-items', 'justify-content',
];

export default function PropertiesInspector(): React.ReactElement {
  const { selectedElement } = useStore();
  if (!selectedElement) return <></>;

  const entries = SHOWN_PROPS
    .map(k => [k, selectedElement.computedStyles[k] ?? ''] as [string, string])
    .filter(([, v]) => v && v !== 'none' && v !== 'normal' && v !== 'auto');

  if (entries.length === 0) return <></>;

  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--vscode-panel-border)' }}>
      <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1 }}>
        Computed Styles
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px' }}>
        {entries.map(([k, v]) => (
          <React.Fragment key={k}>
            <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{k}</div>
            <div style={{ fontSize: 11, color: 'var(--vscode-editor-foreground)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{v}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
