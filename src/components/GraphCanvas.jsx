import { useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import ConceptNode from './ConceptNode.jsx';
import { useAppearance } from '../appearance/AppearanceProvider.jsx';

const nodeTypes = { concept: ConceptNode };
const NODE_WIDTH = 230;
const NODE_HEIGHT = 112;

const FAMILY_STYLE = {
  flow: { stroke: 'var(--edge-flow)', marker: 'var(--edge-flow)' },
  structure: { stroke: 'var(--edge-structure)', marker: 'var(--edge-structure)' },
  dependency: { stroke: 'var(--edge-dependency)', marker: 'var(--edge-dependency)', dash: '7 5' },
  execution: { stroke: 'var(--edge-execution)', marker: 'var(--edge-execution)' },
  data: { stroke: 'var(--edge-data)', marker: 'var(--edge-data)' },
  comparison: { stroke: 'var(--edge-comparison)', marker: 'var(--edge-comparison)', dash: '4 4' },
  evidence: { stroke: 'var(--edge-evidence)', marker: 'var(--edge-evidence)', dash: '2 5' },
};

const BACKGROUND_VARIANTS = {
  dots: BackgroundVariant.Dots,
  grid: BackgroundVariant.Lines,
  cross: BackgroundVariant.Cross,
};

function intersects(layers, visibleLayers) {
  if (!layers?.length) return true;
  if (!visibleLayers?.size) return true;
  return layers.some((layer) => visibleLayers.has(layer));
}

function chooseHandles(sourceNode, targetNode) {
  if (!sourceNode || !targetNode) {
    return { sourceHandle: 'source-right', targetHandle: 'target-left' };
  }

  const sourceX = sourceNode.position.x + NODE_WIDTH / 2;
  const sourceY = sourceNode.position.y + NODE_HEIGHT / 2;
  const targetX = targetNode.position.x + NODE_WIDTH / 2;
  const targetY = targetNode.position.y + NODE_HEIGHT / 2;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'source-right', targetHandle: 'target-left' }
      : { sourceHandle: 'source-left', targetHandle: 'target-right' };
  }

  return dy >= 0
    ? { sourceHandle: 'source-bottom', targetHandle: 'target-top' }
    : { sourceHandle: 'source-top', targetHandle: 'target-bottom' };
}

export default function GraphCanvas({
  graph,
  concepts,
  learningState,
  visibleLayers,
  onSelectConcept,
  onDive,
  onMoveNode,
  onOpenSource,
}) {
  const { appearance } = useAppearance();
  const visibleGraphNodes = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.filter((node) => intersects(node.layers, visibleLayers));
  }, [graph, visibleLayers]);

  const makeNodes = useMemo(() => () => {
    return visibleGraphNodes.map((node) => {
      const concept = concepts[node.concept] || {};
      const learning = learningState?.learning?.[node.concept] || {
        exposure: 'unseen',
        confidence: 'low',
        verification: 'untested',
      };
      const openAnnotations = (learningState?.annotations || []).filter(
        (item) => item.targetType === 'concept'
          && item.targetId === node.concept
          && !['resolved', 'accepted', 'rejected'].includes(item.status),
      );
      const questions = openAnnotations.filter((item) => item.type === 'question').length;
      const unfamiliar = openAnnotations.filter((item) => item.type === 'unfamiliar-term').length;

      return {
        id: node.id,
        type: 'concept',
        position: node.position,
        data: {
          conceptId: node.concept,
          label: node.labelOverride || concept.title || node.concept,
          summary: concept.summary || '',
          detailGraph: concept.detailGraph || null,
          hasDetail: Boolean(concept.detailGraph),
          kind: concept.kind || node.kind || 'knowledge',
          nodeKind: node.kind || 'concept',
          learning,
          questionCount: questions,
          unfamiliarCount: unfamiliar,
          threadCount: openAnnotations.length,
          provenance: concept.provenance || null,
          evidenceCount: concept.evidence?.length || 0,
        },
      };
    });
  }, [visibleGraphNodes, concepts, learningState]);

  const makeEdges = useMemo(() => () => {
    if (!graph) return [];
    const nodeLookup = new Map(graph.nodes.map((node) => [node.id, node]));
    const visibleNodeIds = new Set(visibleGraphNodes.map((node) => node.id));

    return graph.edges
      .filter((edge) => intersects(edge.layers, visibleLayers))
      .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
      .map((edge) => {
        const handles = chooseHandles(nodeLookup.get(edge.source), nodeLookup.get(edge.target));
        const family = edge.family || 'flow';
        const familyStyle = FAMILY_STYLE[family] || FAMILY_STYLE.flow;
        const animated = appearance.edgeMotion && ['flow', 'execution', 'data'].includes(family);
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
          type: 'smoothstep',
          pathOptions: { offset: 30, borderRadius: 16 },
          animated,
          label: edge.label || undefined,
          labelShowBg: Boolean(edge.label),
          labelBgPadding: [8, 5],
          labelBgBorderRadius: 7,
          labelStyle: { fill: 'var(--text)', fontSize: 10, fontWeight: 620 },
          labelBgStyle: {
            fill: 'var(--panel)',
            fillOpacity: 0.96,
            stroke: familyStyle.stroke,
            strokeWidth: 0.7,
          },
          className: `edge-family-${family} edge-type-${edge.type}`,
          style: {
            stroke: familyStyle.stroke,
            strokeWidth: family === 'execution' || family === 'data' ? 1.8 : 1.5,
            strokeDasharray: animated ? undefined : familyStyle.dash,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: familyStyle.marker,
            width: 15,
            height: 15,
          },
          data: {
            family,
            relation: edge.type,
            evidence: edge.evidence || [],
          },
        };
      });
  }, [graph, visibleGraphNodes, visibleLayers, appearance.edgeMotion]);

  const [nodes, setNodes, onNodesChange] = useNodesState(makeNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(makeEdges());

  useEffect(() => setNodes(makeNodes()), [makeNodes, setNodes]);
  useEffect(() => setEdges(makeEdges()), [makeEdges, setEdges]);

  const backgroundVariant = BACKGROUND_VARIANTS[appearance.graphPattern] || BackgroundVariant.Dots;

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => onSelectConcept(node.data.conceptId)}
      onNodeDoubleClick={(_, node) => {
        if (node.data.detailGraph) onDive(node.data.detailGraph, node.data.label);
      }}
      onEdgeClick={(_, edge) => {
        const source = edge.data?.evidence?.[0];
        if (source && onOpenSource) onOpenSource(source);
      }}
      onNodeDragStop={(_, node) => onMoveNode(node.id, node.position)}
      fitView
      fitViewOptions={{ padding: 0.22, maxZoom: 1.08 }}
      minZoom={0.2}
      maxZoom={2.4}
      deleteKeyCode={null}
      onlyRenderVisibleElements
      proOptions={{ hideAttribution: false }}
    >
      {appearance.graphPattern !== 'none' && (
        <Background variant={backgroundVariant} gap={24} size={appearance.graphPattern === 'cross' ? 1.4 : 1} color="var(--graph-grid)" />
      )}
      {appearance.showMinimap && <MiniMap pannable zoomable />}
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
