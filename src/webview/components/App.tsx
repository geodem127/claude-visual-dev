import React from 'react';
import LeftPanel from './LeftPanel';
import CenterPanel from './CenterPanel';
import RightPanel from './RightPanel';

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr 300px',
    height: '100vh',
    overflow: 'hidden',
    gap: '1px',
    background: 'var(--vscode-panel-border)',
  },
  panel: {
    background: 'var(--vscode-editor-background)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
};

export default function App(): React.ReactElement {
  return (
    <div style={styles.root}>
      <div style={styles.panel}><LeftPanel /></div>
      <div style={styles.panel}><CenterPanel /></div>
      <div style={styles.panel}><RightPanel /></div>
    </div>
  );
}
