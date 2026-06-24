import React, { useState } from 'react';
import { useStore } from '../../store';
import * as bridge from '../../bridge';

export default function BranchBanner(): React.ReactElement | null {
  const { activeVariant, setActiveVariant, setActiveTab, updateVariantStatus } = useStore();
  const [loading, setLoading] = useState(false);

  if (!activeVariant) return null;

  async function apply() {
    if (!activeVariant) return;
    setLoading(true);
    try {
      await bridge.request({ type: 'APPLY_BRANCH', id: bridge.uid(), payload: { branch: activeVariant.branch, filePath: activeVariant.filePath } });
      updateVariantStatus(activeVariant.branch, 'applied');
      setActiveVariant(null);
      setActiveTab('preview');
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function discard() {
    if (!activeVariant) return;
    setLoading(true);
    try {
      await bridge.request({ type: 'DISCARD_BRANCH', id: bridge.uid(), payload: { branch: activeVariant.branch } });
      updateVariantStatus(activeVariant.branch, 'discarded');
      setActiveVariant(null);
      setActiveTab('preview');
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const bannerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '4px 12px',
    background: 'var(--vscode-statusBar-background)',
    color: 'var(--vscode-statusBar-foreground)',
    fontSize: 11, flexShrink: 0,
  };

  function bBtn(danger?: boolean): React.CSSProperties {
    return {
      padding: '2px 8px',
      background: danger ? 'var(--vscode-button-secondaryBackground)' : 'var(--vscode-button-background)',
      color: danger ? 'var(--vscode-button-secondaryForeground)' : 'var(--vscode-button-foreground)',
      border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11,
    };
  }

  return (
    <div style={bannerStyle}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
        🌿 {activeVariant.branch}
      </span>
      <button style={bBtn()} onClick={() => setActiveTab('output')} disabled={loading}>Compare</button>
      <button style={bBtn()} onClick={apply} disabled={loading}>{loading ? '…' : 'Apply'}</button>
      <button style={bBtn(true)} onClick={discard} disabled={loading}>Discard</button>
    </div>
  );
}
