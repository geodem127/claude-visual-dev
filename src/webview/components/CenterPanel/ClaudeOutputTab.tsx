import React, { useState } from 'react';
import { useStore } from '../../store';

type View = 'code' | 'diff';

export default function ClaudeOutputTab(): React.ReactElement {
  const { activeVariant } = useStore();
  const [view, setView] = useState<View>('code');

  if (!activeVariant) {
    return (
      <div style={{ padding: 24, fontSize: 12, color: 'var(--vscode-descriptionForeground)', textAlign: 'center' }}>
        No variant generated yet.
      </div>
    );
  }

  function tabBtn(v: View): React.CSSProperties {
    return {
      padding: '4px 12px', fontSize: 11, border: 'none', cursor: 'pointer', borderRadius: 3,
      background: view === v ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
      color: view === v ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
    };
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 4, padding: '6px 8px', borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0 }}>
        <button style={tabBtn('code')} onClick={() => setView('code')}>Generated Code</button>
        <button style={tabBtn('diff')} onClick={() => setView('diff')}>Diff View</button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground)', alignSelf: 'center' }}>
          {activeVariant.filePath}
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <pre style={{
          fontSize: 12, lineHeight: 1.6,
          whiteSpace: 'pre-wrap' as const,
          color: 'var(--vscode-editor-foreground)',
          fontFamily: 'var(--vscode-editor-font-family, monospace)',
          margin: 0,
        }}>
          {activeVariant.generatedContent}
        </pre>
      </div>
    </div>
  );
}
