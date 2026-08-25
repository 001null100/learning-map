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
    return graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      label: edge.label || undefined,
      className: `edge-${edge.type}`,
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
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
