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

const nodeTypes = { concept: ConceptNode };
const NODE_WIDTH = 230;
const NODE_HEIGHT = 112;

const FAMILY_STYLE = {
  flow: { stroke: '#63758d', marker: '#8393aa' },
  structure: { stroke: '#8f82bd', marker: '#a99bd4' },
  dependency: { stroke: '#b99b62', marker: '#ceb276', dash: '7 5' },
  execution: { stroke: '#67a7da', marker: '#82bce8' },
  data: { stroke: '#63ad9e', marker: '#7dc5b6' },
  comparison: { stroke: '#bd7d92', marker: '#d394a9', dash: '4 4' },
  evidence: { stroke: '#8792a1', marker: '#a2acb9', dash: '2 5' },
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
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
          type: 'smoothstep',
          pathOptions: { offset: 30, borderRadius: 16 },
          label: edge.label || undefined,
          labelShowBg: Boolean(edge.label),
          labelBgPadding: [8, 5],
          labelBgBorderRadius: 6,
          labelStyle: { fill: '#c0cad8', fontSize: 10, fontWeight: 600 },
          labelBgStyle: {
            fill: '#0d131b',
            fillOpacity: 0.98,
            stroke: familyStyle.stroke,
            strokeWidth: 0.7,
          },
          className: `edge-family-${family} edge-type-${edge.type}`,
          style: {
            stroke: familyStyle.stroke,
            strokeWidth: family === 'execution' || family === 'data' ? 1.8 : 1.5,
            strokeDasharray: familyStyle.dash,
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
  }, [graph, visibleGraphNodes, visibleLayers]);

  const [nodes, setNodes, onNodesChange] = useNodesState(makeNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(makeEdges());

  useEffect(() => setNodes(makeNodes()), [makeNodes, setNodes]);
  useEffect(() => setEdges(makeEdges()), [makeEdges, setEdges]);

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
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
      <MiniMap pannable zoomable />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
