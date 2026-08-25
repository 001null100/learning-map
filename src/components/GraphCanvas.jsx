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
const NODE_WIDTH = 220;
const NODE_HEIGHT = 96;

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
  onSelectConcept,
  onDive,
  onMoveNode,
}) {
  const makeNodes = useMemo(() => () => {
    if (!graph) return [];
    return graph.nodes.map((node) => {
      const concept = concepts[node.concept] || {};
      const questions = learningState?.questions?.filter(
        (item) => item.targetType === 'concept' && item.targetId === node.concept && item.status !== 'resolved',
      ).length || 0;
      const unfamiliar = learningState?.unfamiliarTerms?.filter(
        (item) => item.contextConcept === node.concept && item.status !== 'resolved',
      ).length || 0;

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
          kind: node.kind || 'concept',
          status: learningState?.status?.[node.concept] || 'unexplored',
          questionCount: questions,
          unfamiliarCount: unfamiliar,
        },
      };
    });
  }, [graph, concepts, learningState]);

  const makeEdges = useMemo(() => () => {
    if (!graph) return [];
    const nodeLookup = new Map(graph.nodes.map((node) => [node.id, node]));

    return graph.edges.map((edge) => {
      const handles = chooseHandles(nodeLookup.get(edge.source), nodeLookup.get(edge.target));
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        type: 'smoothstep',
        pathOptions: { offset: 28, borderRadius: 14 },
        label: edge.label || undefined,
        labelShowBg: Boolean(edge.label),
        labelBgPadding: [7, 4],
        labelBgBorderRadius: 5,
        labelStyle: { fill: '#b8c3d2', fontSize: 10, fontWeight: 550 },
        labelBgStyle: {
          fill: '#0d131b',
          fillOpacity: 0.98,
          stroke: '#344156',
          strokeWidth: 0.65,
        },
        className: `edge-${edge.type}`,
        style: { stroke: '#63758d', strokeWidth: 1.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#7f91aa',
          width: 15,
          height: 15,
        },
      };
    });
  }, [graph]);

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
      onNodeDragStop={(_, node) => onMoveNode(node.id, node.position)}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1.15 }}
      minZoom={0.2}
      maxZoom={2}
      deleteKeyCode={null}
      proOptions={{ hideAttribution: false }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
      <MiniMap pannable zoomable />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
