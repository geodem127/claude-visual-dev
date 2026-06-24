import React from 'react';
import DesignReference from './DesignReference';
import FileAttach from './FileAttach';
import ChatThread from './ChatThread';

const divider: React.CSSProperties = { border: 'none', borderTop: '1px solid var(--vscode-panel-border)', flexShrink: 0, margin: '4px 0' };

export default function LeftPanel(): React.ReactElement {
  return (
    <div style={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 0 }}>
      <div style={{ overflowY: 'auto', flexShrink: 0 }}>
        <DesignReference />
        <hr style={divider} />
        <FileAttach />
        <hr style={divider} />
      </div>
      <ChatThread />
    </div>
  );
}
