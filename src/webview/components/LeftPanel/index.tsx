import React from 'react';
import DesignReference from './DesignReference';
import FileAttach from './FileAttach';

const divider: React.CSSProperties = { border: 'none', borderTop: '1px solid var(--vscode-panel-border)', flexShrink: 0, margin: 0 };

export default function LeftPanel(): React.ReactElement {
  return (
    <div style={{ padding: 12, overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
      <DesignReference />
      <hr style={divider} />
      <FileAttach />
    </div>
  );
}
