import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const HANDLE_SIDES = [
  ['left', Position.Left],
  ['right', Position.Right],
  ['top', Position.Top],
  ['bottom', Position.Bottom],
];

function ConceptNode({ data, selected }) {
  const markers = [];
  if (data.questionCount) markers.push(`${data.questionCount} ?`);
  if (data.unfamiliarCount) markers.push(`${data.unfamiliarCount} flag`);

  return (
    <div className={`concept-node status-${data.status || 'unexplored'} ${selected ? 'is-selected' : ''}`}>
      {HANDLE_SIDES.map(([side, position]) => (
        <Handle key={`target-${side}`} id={`target-${side}`} type="target" position={position} />
      ))}
      {HANDLE_SIDES.map(([side, position]) => (
        <Handle key={`source-${side}`} id={`source-${side}`} type="source" position={position} />
      ))}

      <div className="concept-node-topline">
        <span className="status-dot" aria-hidden="true" />
        <span className="concept-node-title">{data.label}</span>
      </div>
      {data.summary && <div className="concept-node-summary">{data.summary}</div>}
      <div className="concept-node-footer">
        <span>{markers.join(' · ') || data.kind || 'concept'}</span>
        {data.hasDetail && <span className="deeper-badge">Dive deeper ↘</span>}
      </div>
    </div>
  );
}

export default memo(ConceptNode);
