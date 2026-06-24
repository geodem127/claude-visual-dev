import React, { useRef } from 'react';
import { useStore } from '../../store';
import * as bridge from '../../bridge';

const s: Record<string, React.CSSProperties> = {
  root: { padding: '8px 0' },
  label: { fontSize: 11, color: 'var(--vscode-descriptionForeground)', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 1 },
  dropZone: { border: '1px dashed var(--vscode-panel-border)', borderRadius: 4, padding: '8px', textAlign: 'center' as const, fontSize: 11, cursor: 'pointer', color: 'var(--vscode-descriptionForeground)' },
  fileList: { marginTop: 6, display: 'flex', flexDirection: 'column' as const, gap: 3 },
  fileItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--vscode-badge-background)', borderRadius: 3, padding: '2px 6px', fontSize: 11 },
  removeBtn: { background: 'none', border: 'none', color: 'var(--vscode-errorForeground)', cursor: 'pointer', fontSize: 13, lineHeight: 1, flexShrink: 0 },
};

export default function FileAttach(): React.ReactElement {
  const { attachedFiles, addAttachedFile, removeAttachedFile } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    for (const f of Array.from(files)) {
      const filePath = (f as unknown as { path?: string }).path ?? f.name;
      try {
        const content = await bridge.request<string>({
          type: 'READ_FILE',
          id: bridge.uid(),
          payload: { path: filePath },
        });
        addAttachedFile({ path: filePath, content });
      } catch {
        // Fallback: read via FileReader for browser-side files
        const reader = new FileReader();
        reader.onload = () => addAttachedFile({ path: f.name, content: reader.result as string });
        reader.readAsText(f);
      }
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  return (
    <div style={s.root}>
      <div style={s.label}>Attached Files</div>
      <div
        style={s.dropZone}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        Click or drop files to attach
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={handleChange} />
      </div>
      {attachedFiles.length > 0 && (
        <div style={s.fileList}>
          {attachedFiles.map(f => (
            <div key={f.path} style={s.fileItem}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {f.path.split('/').pop()}
              </span>
              <button style={s.removeBtn} onClick={() => removeAttachedFile(f.path)}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
