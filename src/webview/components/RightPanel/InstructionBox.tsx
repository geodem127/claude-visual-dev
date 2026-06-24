import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import * as bridge from '../../bridge';
import type { VariantHistoryEntry } from '../../store';

export default function InstructionBox(): React.ReactElement {
  const { selectedElement, attachedFiles, addVariantHistory, setActiveVariant, setActiveTab } = useStore();
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setInstruction('');
    setError('');
  }, [selectedElement?.selector]);

  if (!selectedElement) return <></>;

  async function previewVariant() {
    if (!selectedElement || !instruction.trim()) return;
    setError(''); setLoading(true);
    try {
      const result = await bridge.request<{ branch: string; filePath: string; generatedContent: string }>({
        type: 'PREVIEW_VARIANT',
        id: bridge.uid(),
        payload: { element: selectedElement, instruction, files: attachedFiles },
      });
      const entry: VariantHistoryEntry = {
        id: result.branch,
        timestamp: Date.now(),
        element: selectedElement,
        instruction,
        variant: result,
        status: 'pending',
      };
      addVariantHistory(entry);
      setActiveVariant(result);
      setActiveTab('output');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--vscode-panel-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' as const, letterSpacing: 1 }}>
        Instruction
      </div>
      <textarea
        style={{
          resize: 'vertical' as const,
          background: 'var(--vscode-input-background)',
          color: 'var(--vscode-input-foreground)',
          border: '1px solid var(--vscode-input-border)',
          borderRadius: 3, padding: '6px', fontSize: 12,
          fontFamily: 'inherit', minHeight: 72,
        }}
        placeholder={`Describe changes to ${selectedElement.componentName}...`}
        value={instruction}
        onChange={e => setInstruction(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) previewVariant(); }}
      />
      {error && (
        <div style={{ fontSize: 11, color: 'var(--vscode-errorForeground)', wordBreak: 'break-word' as const }}>{error}</div>
      )}
      <button
        style={{
          padding: '6px 0',
          background: loading || !instruction.trim() ? 'var(--vscode-button-secondaryBackground)' : 'var(--vscode-button-background)',
          color: loading || !instruction.trim() ? 'var(--vscode-button-secondaryForeground)' : 'var(--vscode-button-foreground)',
          border: 'none', borderRadius: 3, cursor: loading || !instruction.trim() ? 'not-allowed' : 'pointer', fontSize: 12,
        }}
        disabled={!instruction.trim() || loading}
        onClick={previewVariant}
      >
        {loading ? 'Generating variant…' : 'Preview Variant ⌘↵'}
      </button>
    </div>
  );
}
