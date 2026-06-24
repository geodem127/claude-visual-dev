import React, { useState } from 'react';
import { useStore } from '../../store';

const s: Record<string, React.CSSProperties> = {
  bar: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--vscode-editorGroupHeader-tabsBackground)', borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0 },
  input: { flex: 1, padding: '3px 6px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 3, fontSize: 12 },
  select: { padding: '3px 4px', background: 'var(--vscode-dropdown-background)', color: 'var(--vscode-dropdown-foreground)', border: '1px solid var(--vscode-dropdown-border)', borderRadius: 3, fontSize: 11 },
};

function btn(active?: boolean): React.CSSProperties {
  return {
    padding: '3px 8px',
    background: active ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)',
    color: active ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)',
    border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' as const,
  };
}

export default function PreviewToolbar(): React.ReactElement {
  const { devServerUrl, setDevServerUrl, viewport, setViewport, annotationMode, setAnnotationMode, activeTab, setActiveTab, activeVariant } = useStore();
  const [urlInput, setUrlInput] = useState(devServerUrl);

  function applyUrl() { setDevServerUrl(urlInput); }
  function refresh() { setDevServerUrl(urlInput + (urlInput.includes('?') ? '&' : '?') + '_r=' + Date.now()); }

  return (
    <div style={s.bar}>
      <input
        style={s.input}
        value={urlInput}
        onChange={e => setUrlInput(e.target.value)}
        onBlur={applyUrl}
        onKeyDown={e => { if (e.key === 'Enter') applyUrl(); }}
        placeholder="http://localhost:3000"
      />
      <button style={btn()} onClick={refresh} title="Refresh">↺</button>
      <select style={s.select} value={viewport} onChange={e => setViewport(e.target.value as 'desktop' | 'tablet' | 'mobile')}>
        <option value="desktop">1440</option>
        <option value="tablet">768</option>
        <option value="mobile">375</option>
      </select>
      <button style={btn(annotationMode)} onClick={() => setAnnotationMode(!annotationMode)} title="Annotation mode">
        ✏️
      </button>
      <button style={btn(activeTab === 'preview')} onClick={() => setActiveTab('preview')}>Preview</button>
      {activeVariant && (
        <button style={btn(activeTab === 'output')} onClick={() => setActiveTab('output')}>Output</button>
      )}
    </div>
  );
}
