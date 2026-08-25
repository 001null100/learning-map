export default function GraphToolbar({ graph, visibleLayers, onToggleLayer }) {
  if (!graph) return null;
  return (
    <div className="graph-toolbar">
      <span className={`intent-badge intent-${graph.intent || 'flow'}`}>{graph.intent || 'flow'}</span>
      {(graph.layers || []).length > 1 && (
        <div className="layer-toggles" aria-label="Graph layers">
          {graph.layers.map((layer) => (
            <button
              key={layer.id}
              type="button"
              className={visibleLayers.has(layer.id) ? 'active' : ''}
              title={layer.description || layer.label}
              onClick={() => onToggleLayer(layer.id)}
            >
              {layer.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
