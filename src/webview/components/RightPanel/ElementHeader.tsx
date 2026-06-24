import React from 'react';
import { useStore } from '../../store';
import * as bridge from '../../bridge';

const s: Record<string, React.CSSProperties> = {
  root: { padding: '10px 12px', borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0 },
  name: { fontWeight: 600, fontSize: 13, color: 'var(--vscode-editor-foreground)' },
  path: { fontSize: 11, color: 'var(--vscode-textLink-foreground)', cursor: 'pointer', textDecoration: 'underline', marginTop: 3, wordBreak: 'break-all' as const, display: 'block' },
  selector: { fontSize: 10, color: 'var(--vscode-descriptionForeground)', fontFamily: 'monospace', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  empty: { padding: '16px 12px', fontSize: 12, color: 'var(--vscode-descriptionForeground)', lineHeight: 1.5 },
};

export default function ElementHeader(): React.ReactElement {
  const { selectedElement } = useStore();

  if (!selectedElement) {
    return (
      <div style={s.empty}>
        Toggle ✏️ annotation mode and click an element in the preview to inspect it.
      </div>
    );
  }

  async function openFile() {
    if (!selectedElement?.filePath) return;
    await bridge.request({ type: 'OPEN_FILE', id: bridge.uid(), payload: { path: selectedElement.filePath } });
  }

  return (
    <div style={s.root}>
      <div style={s.name}>{selectedElement.componentName}</div>
      {selectedElement.filePath && (
        <span style={s.path} onClick={openFile}>{selectedElement.filePath}</span>
      )}
      <div style={s.selector} title={selectedElement.selector}>{selectedElement.selector}</div>
    </div>
  );
}
