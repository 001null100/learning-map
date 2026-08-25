import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function ConceptNode({ data, selected }) {
  const markers = [];
  if (data.questionCount) markers.push(`${data.questionCount} ?`);
  if (data.unfamiliarCount) markers.push(`${data.unfamiliarCount} flag`);

  return (
    <div className={`concept-node status-${data.status || 'unexplored'} ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="concept-node-topline">
        <span className="status-dot" aria-hidden="true" />
        <span className="concept-node-title">{data.label}</span>
      </div>
      {data.summary && <div className="concept-node-summary">{data.summary}</div>}
      <div className="concept-node-footer">
        <span>{markers.join(' · ') || data.kind || 'concept'}</span>
        {data.hasDetail && <span className="deeper-badge">Dive deeper ↘</span>}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(ConceptNode);
