import React from 'react';
import ElementHeader from './ElementHeader';
import PropertiesInspector from './PropertiesInspector';
import InstructionBox from './InstructionBox';
import VariantHistory from './VariantHistory';

export default function RightPanel(): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ElementHeader />
      <div style={{ overflowY: 'auto', flexShrink: 0 }}>
        <PropertiesInspector />
        <InstructionBox />
      </div>
      <VariantHistory />
    </div>
  );
}
