import React from 'react';
import PreviewToolbar from './PreviewToolbar';
import LivePreview from './LivePreview';
import BranchBanner from './BranchBanner';
import ClaudeOutputTab from './ClaudeOutputTab';
import { useStore } from '../../store';

export default function CenterPanel(): React.ReactElement {
  const { activeTab } = useStore();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PreviewToolbar />
      <BranchBanner />
      <div style={{ flex: 1, minHeight: 0, display: activeTab === 'preview' ? 'flex' : 'none', flexDirection: 'column' }}>
        <LivePreview />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: activeTab === 'output' ? 'flex' : 'none', flexDirection: 'column' }}>
        <ClaudeOutputTab />
      </div>
    </div>
  );
}
