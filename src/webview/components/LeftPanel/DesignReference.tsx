import React, { useState } from 'react';
import { useStore } from '../../store';
import * as bridge from '../../bridge';

const s: Record<string, React.CSSProperties> = {
  root: { padding: '8px 0' },
  label: { fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 1 },
  tabs: { display: 'flex', gap: 4, marginBottom: 8 },
  tab: { flex: 1, padding: '4px 0', fontSize: 11, background: 'none', border: '1px solid var(--vscode-panel-border)', color: 'var(--vscode-editor-foreground)', cursor: 'pointer', borderRadius: 3 },
  tabActive: { background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: '1px solid transparent' },
  input: { width: '100%', padding: '4px 6px', background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', borderRadius: 3, fontSize: 12 },
  btn: { width: '100%', marginTop: 6, padding: '4px 0', background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
  btnSecondary: { width: '100%', marginTop: 4, padding: '4px 0', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12, display: 'block', textAlign: 'center' as const },
  preview: { marginTop: 8, width: '100%', borderRadius: 4, border: '1px solid var(--vscode-panel-border)' },
  error: { marginTop: 4, fontSize: 11, color: 'var(--vscode-errorForeground)' },
};

type Tab = 'figma' | 'url';

export default function DesignReference(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('figma');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { designReferenceBase64, setDesignReference, clearDesignReference } = useStore();

  async function handleFetch() {
    setError(''); setLoading(true);
    try {
      if (tab === 'figma') {
        const base64 = await bridge.request<string>({ type: 'FETCH_FIGMA', id: bridge.uid(), payload: { url: value } });
        setDesignReference(base64, 'figma');
      } else {
        const base64 = await bridge.request<string>({ type: 'SCREENSHOT_URL', id: bridge.uid(), payload: { url: value } });
        setDesignReference(base64, 'url');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      setDesignReference(base64, 'upload');
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={s.root}>
      <div style={s.label}>Design Reference</div>
      <div style={s.tabs}>
        {(['figma', 'url'] as Tab[]).map(t => (
          <button key={t} style={tab === t ? { ...s.tab, ...s.tabActive } : s.tab} onClick={() => setTab(t)}>
            {t === 'figma' ? 'Figma' : 'URL'}
          </button>
        ))}
      </div>
      <input
        style={s.input}
        placeholder={tab === 'figma' ? 'https://www.figma.com/file/...' : 'https://...'}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleFetch(); }}
      />
      <button style={s.btn} disabled={!value || loading} onClick={handleFetch}>
        {loading ? 'Loading...' : 'Fetch'}
      </button>
      <div style={{ marginTop: 4 }}>
        <input type="file" accept="image/*,.pdf" id="design-upload" style={{ display: 'none' }} onChange={handleUpload} />
        <label htmlFor="design-upload" style={s.btnSecondary}>Upload Image / PDF</label>
      </div>
      {error && <div style={s.error}>{error}</div>}
      {designReferenceBase64 && (
        <>
          <img src={`data:image/png;base64,${designReferenceBase64}`} alt="Design reference" style={s.preview} />
          <button style={s.btnSecondary} onClick={clearDesignReference}>Clear</button>
        </>
      )}
    </div>
  );
}
