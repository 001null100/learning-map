import { memo } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';

const HANDLE_SIDES = [
  ['left', Position.Left],
  ['right', Position.Right],
  ['top', Position.Top],
  ['bottom', Position.Bottom],
];

const CODE_KINDS = new Set([
  'package', 'module', 'class', 'struct', 'function', 'method', 'interface',
  'data-type', 'configuration', 'resource', 'external-dependency',
]);

function kindGlyph(kind) {
  if (CODE_KINDS.has(kind)) return '⌘';
  if (kind === 'system' || kind === 'subsystem' || kind === 'conceptual-component') return '▦';
  return '●';
}

function ConceptNode({ data, selected }) {
  const zoom = useStore((state) => state.transform[2]);
  const compact = zoom < 0.58;
  const expanded = zoom >= 0.82;
  const detailed = zoom >= 1.15;
  const learning = data.learning || { exposure: 'unseen', confidence: 'low', verification: 'untested' };

  const markers = [];
  if (data.questionCount) markers.push(`${data.questionCount} ?`);
  if (data.unfamiliarCount) markers.push(`${data.unfamiliarCount} term`);
  if (!data.questionCount && !data.unfamiliarCount && data.threadCount) markers.push(`${data.threadCount} thread${data.threadCount === 1 ? '' : 's'}`);

  return (
    <div
      className={[
        'concept-node',
        `exposure-${learning.exposure}`,
        `confidence-${learning.confidence}`,
        `verification-${learning.verification}`,
        `kind-${data.kind || 'knowledge'}`,
        data.provenance?.basis ? `provenance-${data.provenance.basis}` : '',
        selected ? 'is-selected' : '',
        compact ? 'is-compact' : '',
      ].filter(Boolean).join(' ')}
    >
      {HANDLE_SIDES.map(([side, position]) => (
        <Handle key={`target-${side}`} id={`target-${side}`} type="target" position={position} />
      ))}
      {HANDLE_SIDES.map(([side, position]) => (
        <Handle key={`source-${side}`} id={`source-${side}`} type="source" position={position} />
      ))}

      <div className="concept-node-topline">
        <span className="status-dot" aria-hidden="true" />
        <span className="node-kind-glyph" aria-hidden="true">{kindGlyph(data.kind)}</span>
        <span className="concept-node-title">{data.label}</span>
      </div>

      {!compact && data.summary && <div className="concept-node-summary">{data.summary}</div>}

      {expanded && (
        <div className="concept-node-footer">
          <span>{markers.join(' · ') || data.kind || 'concept'}</span>
          <span className={`verification-chip verification-${learning.verification}`}>{learning.verification}</span>
          {data.hasDetail && <span className="deeper-badge">Dive ↘</span>}
        </div>
      )}

      {detailed && data.provenance && (
        <div className="node-provenance">
          {data.provenance.basis} · {data.provenance.confidence}
          {data.evidenceCount ? ` · ${data.evidenceCount} source${data.evidenceCount === 1 ? '' : 's'}` : ''}
        </div>
      )}
    </div>
  );
}

export default memo(ConceptNode);
