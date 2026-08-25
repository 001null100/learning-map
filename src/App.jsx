import { useEffect, useMemo, useState } from 'react';
import GraphCanvas from './components/GraphCanvas.jsx';
import ConceptPanel from './components/ConceptPanel.jsx';
import ProjectSearch from './components/ProjectSearch.jsx';
import Navigator from './components/Navigator.jsx';
import GraphToolbar from './components/GraphToolbar.jsx';
import SourceDrawer from './components/SourceDrawer.jsx';
import { clearConnection, getConnection, saveConnection } from './lib/storage.js';
import { readJson, testConnection, writeJson } from './lib/github.js';

const EMPTY_STATE = {
  version: 2,
  learning: {},
  annotations: [],
  predictions: [],
  workspaces: [],
};

const VERIFICATION_RANK = {
  untested: 0,
  predicted: 1,
  explained: 2,
  applied: 3,
};

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function maxVerification(current = 'untested', candidate = 'untested') {
  return (VERIFICATION_RANK[candidate] || 0) > (VERIFICATION_RANK[current] || 0) ? candidate : current;
}

function normalizeState(data) {
  if (data?.version === 2) {
    return {
      ...EMPTY_STATE,
      ...data,
      learning: data.learning || {},
      annotations: data.annotations || [],
      predictions: data.predictions || [],
      workspaces: data.workspaces || [],
    };
  }

  const learning = {};
  for (const [conceptId, status] of Object.entries(data?.status || {})) {
    const mapped = status === 'understood'
      ? { exposure: 'studied', confidence: 'high', verification: 'explained' }
      : status === 'revisit'
        ? { exposure: 'studied', confidence: 'medium', verification: 'untested' }
        : status === 'developing'
          ? { exposure: 'seen', confidence: 'low', verification: 'untested' }
          : { exposure: 'unseen', confidence: 'low', verification: 'untested' };
    learning[conceptId] = mapped;
  }

  const annotations = [];
  for (const item of data?.questions || []) {
    annotations.push({
      ...item,
      type: 'question',
      updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
      createdAt: item.createdAt || new Date().toISOString(),
    });
  }
  for (const item of data?.comments || []) {
    annotations.push({
      ...item,
      type: 'note',
      status: 'open',
      updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
      createdAt: item.createdAt || new Date().toISOString(),
    });
  }
  for (const item of data?.unfamiliarTerms || []) {
    annotations.push({
      id: item.id,
      type: 'unfamiliar-term',
      targetType: 'concept',
      targetId: item.contextConcept,
      text: item.term,
      status: item.status || 'open',
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
    });
  }

  return { ...EMPTY_STATE, learning, annotations };
}

function normalizeConcept(concept) {
  if (!concept) return concept;
  if (concept.version === 2) return concept;
  return {
    ...concept,
    version: 2,
    kind: concept.kind || 'knowledge',
    evidence: concept.evidence || [],
    provenance: concept.provenance || { basis: 'documented', confidence: 'medium' },
    checks: concept.checks || [],
  };
}

function normalizeGraph(graph) {
  if (!graph) return graph;
  if (graph.version === 2) return graph;
  return {
    ...graph,
    version: 2,
    intent: graph.intent || 'flow',
    layers: graph.layers || [{ id: 'core', label: 'Core' }],
    defaultLayers: graph.defaultLayers || ['core'],
    nodes: (graph.nodes || []).map((node) => ({ ...node, layers: node.layers || ['core'] })),
    edges: (graph.edges || []).map((edge) => ({
      ...edge,
      family: edge.family || 'flow',
      layers: edge.layers || ['core'],
      evidence: edge.evidence || [],
    })),
  };
}

function normalizeIndex(index) {
  if (!index) return null;
  if (index.version === 2) return index;
  return {
    version: 2,
    concepts: (index.concepts || []).map((entry) => ({
      ...entry,
      kind: entry.kind || 'knowledge',
      tags: entry.tags || [],
      aliases: entry.aliases || [],
      prerequisites: entry.prerequisites || [],
    })),
  };
}

function ConnectionSetup({ onConnected }) {
  const [owner, setOwner] = useState('001null100');
  const [repo, setRepo] = useState('learning-map-data');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    setError('');
    const connection = { owner: owner.trim(), repo: repo.trim(), token: token.trim() };
    try {
      await testConnection(connection);
      await saveConnection(connection);
      onConnected(connection);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="setup-page">
      <section className="setup-card">
        <div className="brand-mark">LM</div>
        <p className="eyebrow">Private data connection</p>
        <h1>Connect your learning map</h1>
        <p className="setup-copy">
          The public app reads and writes your private learning repository directly. The fine-grained token stays in this browser's IndexedDB.
        </p>
        <form onSubmit={submit} className="setup-form">
          <label><span>Repository owner</span><input value={owner} onChange={(event) => setOwner(event.target.value)} autoComplete="off" /></label>
          <label><span>Repository</span><input value={repo} onChange={(event) => setRepo(event.target.value)} autoComplete="off" /></label>
          <label>
            <span>Fine-grained PAT</span>
            <input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="github_pat_…" autoComplete="off" />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-button large" disabled={busy} type="submit">{busy ? 'Testing connection…' : 'Connect'}</button>
        </form>
      </section>
    </main>
  );
}

function ProjectPicker({ projects, onOpen, onDisconnect, loading }) {
  return (
    <main className="project-page">
      <header className="project-header">
        <div>
          <p className="eyebrow">Learning Map v2</p>
          <h1>Projects</h1>
          <p>Explore a subject or codebase as recursive maps of relationships, evidence, and understanding.</p>
        </div>
        <button className="ghost-button" type="button" onClick={onDisconnect}>Disconnect device</button>
      </header>
      <div className="project-grid">
        {projects.map((project) => (
          <button className="project-card" key={project.id} type="button" onClick={() => onOpen(project)} disabled={loading}>
            <span className="project-glyph">{project.title.slice(0, 2).toUpperCase()}</span>
            <span>
              <strong>{project.title}</strong>
              <small>{project.description}</small>
              <em>{project.projectType || 'learning'} project</em>
            </span>
            <span className="project-arrow">→</span>
          </button>
        ))}
      </div>
    </main>
  );
}

export default function App() {
  const [connectionLoaded, setConnectionLoaded] = useState(false);
  const [connection, setConnection] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [projectRef, setProjectRef] = useState(null);
  const [project, setProject] = useState(null);
  const [projectIndex, setProjectIndex] = useState(null);
  const [stateDoc, setStateDoc] = useState(null);
  const [graphDoc, setGraphDoc] = useState(null);
  const [concepts, setConcepts] = useState({});
  const [selectedConceptId, setSelectedConceptId] = useState(null);
  const [trail, setTrail] = useState([]);
  const [visibleLayers, setVisibleLayers] = useState(new Set());
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [sourceDrawer, setSourceDrawer] = useState(null);
  const [dirtyState, setDirtyState] = useState(false);
  const [dirtyGraph, setDirtyGraph] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const learningState = stateDoc?.data || EMPTY_STATE;
  const selectedConcept = selectedConceptId ? concepts[selectedConceptId] || null : null;
  const activeWorkspace = learningState.workspaces.find((item) => item.id === activeWorkspaceId) || null;

  useEffect(() => {
    getConnection()
      .then((saved) => setConnection(saved || null))
      .catch((err) => setError(`Could not read browser settings: ${err.message}`))
      .finally(() => setConnectionLoaded(true));
  }, []);

  useEffect(() => {
    if (!connection) return;
    setLoading(true);
    setError('');
    readJson(connection, 'manifest.json')
      .then((doc) => setManifest(doc.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [connection]);

  useEffect(() => {
    if (!dirtyGraph && !dirtyState) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyGraph, dirtyState]);

  function applyGraph(next, trailValue, selectedId) {
    setGraphDoc(next);
    setTrail(trailValue);
    setSelectedConceptId(selectedId || next.data.rootConcept || next.data.nodes[0]?.concept || null);
    setVisibleLayers(new Set(next.data.defaultLayers || next.data.layers?.map((layer) => layer.id) || []));
    setDirtyGraph(false);
    setSourceDrawer(null);
  }

  async function loadConcepts(projectData, ids, { replace = false } = {}) {
    const all = [...new Set(ids.filter(Boolean))];
    const unique = replace ? all : all.filter((id) => !concepts[id]);
    if (!unique.length) return {};
    const docs = await Promise.all(unique.map((id) => readJson(connection, `projects/${projectData.id}/concepts/${id}.json`)));
    const loaded = {};
    docs.forEach((doc) => { loaded[doc.data.id] = normalizeConcept(doc.data); });
    setConcepts((previous) => replace ? loaded : { ...previous, ...loaded });
    return loaded;
  }

  async function fetchGraph(projectData, graphId, { replaceConcepts = false } = {}) {
    const path = `projects/${projectData.id}/graphs/${graphId}.json`;
    const doc = await readJson(connection, path);
    const graph = normalizeGraph(doc.data);
    const conceptIds = [...graph.nodes.map((node) => node.concept), graph.rootConcept];
    await loadConcepts(projectData, conceptIds, { replace: replaceConcepts });
    return { ...doc, data: graph, path };
  }

  async function persistChanges({ notify = false } = {}) {
    if (!project || !connection || (!dirtyGraph && !dirtyState)) return true;
    if (saving) return false;
    const graphToSave = dirtyGraph ? graphDoc : null;
    const stateToSave = dirtyState ? stateDoc : null;
    setSaving(true);
    setError('');
    if (notify) setNotice('');

    try {
      if (graphToSave) {
        const result = await writeJson(connection, graphToSave.path, graphToSave.data, graphToSave.sha, `Rearrange ${graphToSave.data.title}`);
        setGraphDoc((previous) => previous?.path === graphToSave.path ? { ...previous, sha: result.content.sha } : previous);
        setDirtyGraph(false);
      }
      if (stateToSave) {
        const result = await writeJson(connection, project.statePath, stateToSave.data, stateToSave.sha, `Update ${project.title} understanding state`);
        setStateDoc((previous) => ({ ...previous, sha: result.content.sha }));
        setDirtyState(false);
      }
      if (notify) {
        setNotice('Saved to GitHub');
        window.setTimeout(() => setNotice(''), 2200);
      }
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveBeforeNavigation() {
    if (!dirtyGraph && !dirtyState) return true;
    return persistChanges({ notify: false });
  }

  async function openProject(reference) {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const projectFile = await readJson(connection, reference.path);
      const projectData = { projectType: 'learning', sourceRepositories: [], ...projectFile.data };
      const [stateFile, indexFile, firstGraph] = await Promise.all([
        readJson(connection, projectData.statePath),
        readJson(connection, projectData.indexPath),
        fetchGraph(projectData, projectData.entryGraph, { replaceConcepts: true }),
      ]);
      setProjectRef(reference);
      setProject(projectData);
      setProjectIndex(normalizeIndex(indexFile.data));
      setStateDoc({ ...stateFile, data: normalizeState(stateFile.data) });
      applyGraph(firstGraph, [{ id: firstGraph.data.id, title: firstGraph.data.title }]);
      setDirtyState(stateFile.data.version !== 2);
      setActiveWorkspaceId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openGraph(graphId, { trailMode = 'replace', selectedId = null } = {}) {
    if (!project || loading || saving) return;
    if (graphDoc?.data.id === graphId) {
      if (selectedId) await selectConcept(selectedId);
      return;
    }
    if (!(await saveBeforeNavigation())) return;
    setLoading(true);
    setError('');
    try {
      const next = await fetchGraph(project, graphId);
      const nextTrail = trailMode === 'append'
        ? [...trail, { id: next.data.id, title: next.data.title }]
        : [{ id: next.data.id, title: next.data.title }];
      applyGraph(next, nextTrail, selectedId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function diveInto(graphId) {
    return openGraph(graphId, { trailMode: 'append' });
  }

  async function openTrailIndex(index) {
    const target = trail[index];
    if (!target || !project || loading || saving) return;
    if (target.id === graphDoc?.data.id) return;
    if (!(await saveBeforeNavigation())) return;
    setLoading(true);
    setError('');
    try {
      const next = await fetchGraph(project, target.id);
      applyGraph(next, trail.slice(0, index + 1));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openSearchResult(entry) {
    if (!entry) return;
    return openGraph(entry.primaryGraph, { trailMode: 'replace', selectedId: entry.id });
  }

  async function selectConcept(conceptId) {
    if (!project) return;
    if (!concepts[conceptId]) {
      try {
        const loaded = await loadConcepts(project, [conceptId]);
        if (!loaded[conceptId] && !concepts[conceptId]) return;
      } catch (err) {
        setError(err.message);
        return;
      }
    }
    setSelectedConceptId(conceptId);
    setSourceDrawer(null);
  }

  function mutateState(mutator) {
    setStateDoc((previous) => ({ ...previous, data: mutator(previous?.data || EMPTY_STATE) }));
    setDirtyState(true);
  }

  function setLearning(conceptId, field, value) {
    const now = new Date().toISOString();
    mutateState((state) => {
      const current = state.learning[conceptId] || { exposure: 'unseen', confidence: 'low', verification: 'untested' };
      return { ...state, learning: { ...state.learning, [conceptId]: { ...current, [field]: value, updatedAt: now } } };
    });
  }

  function addAnnotation(type, text) {
    if (!selectedConceptId) return;
    const now = new Date().toISOString();
    mutateState((state) => ({
      ...state,
      annotations: [...state.annotations, {
        id: makeId('annotation'),
        type,
        targetType: 'concept',
        targetId: selectedConceptId,
        contextGraph: graphDoc?.data.id,
        text,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      }],
    }));
  }

  function setAnnotationStatus(id, status) {
    const now = new Date().toISOString();
    mutateState((state) => ({
      ...state,
      annotations: state.annotations.map((item) => item.id === id ? { ...item, status, updatedAt: now } : item),
    }));
  }

  function setAnnotationResolution(id, resolution) {
    const now = new Date().toISOString();
    mutateState((state) => ({
      ...state,
      annotations: state.annotations.map((item) => item.id === id
        ? { ...item, ...(resolution ? { resolution } : { resolution: undefined }), updatedAt: now }
        : item),
    }));
  }

  function submitPrediction(check, response) {
    if (!selectedConceptId) return;
    const now = new Date().toISOString();
    const candidateVerification = check.type === 'apply' ? 'applied' : check.type === 'explain' ? 'explained' : 'predicted';
    mutateState((state) => {
      const current = state.learning[selectedConceptId] || { exposure: 'unseen', confidence: 'low', verification: 'untested' };
      return {
        ...state,
        learning: {
          ...state.learning,
          [selectedConceptId]: {
            ...current,
            exposure: 'studied',
            verification: maxVerification(current.verification, candidateVerification),
            updatedAt: now,
          },
        },
        predictions: [...state.predictions, {
          id: makeId('prediction'),
          checkId: check.id,
          conceptId: selectedConceptId,
          graphId: graphDoc?.data.id,
          prompt: check.prompt,
          response,
          outcome: 'unreviewed',
          createdAt: now,
          updatedAt: now,
        }],
      };
    });
  }

  function createWorkspace(title, question = '') {
    const now = new Date().toISOString();
    const id = makeId('workspace');
    mutateState((state) => ({
      ...state,
      workspaces: [...state.workspaces, { id, title, question, conceptIds: [], graphIds: [], temporary: true, createdAt: now, updatedAt: now }],
    }));
    setActiveWorkspaceId(id);
  }

  function pinConcept(conceptId) {
    const now = new Date().toISOString();
    const existing = learningState.workspaces.find((item) => item.id === activeWorkspaceId);
    const targetId = existing ? activeWorkspaceId : makeId('workspace');
    if (!existing) setActiveWorkspaceId(targetId);

    mutateState((state) => {
      let workspaces = [...state.workspaces];
      if (!workspaces.some((item) => item.id === targetId)) {
        workspaces.push({
          id: targetId,
          title: 'Current investigation',
          question: '',
          conceptIds: [],
          graphIds: [],
          temporary: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      workspaces = workspaces.map((workspace) => workspace.id === targetId
        ? {
            ...workspace,
            conceptIds: [...new Set([...workspace.conceptIds, conceptId])],
            graphIds: [...new Set([...workspace.graphIds, graphDoc?.data.id].filter(Boolean))],
            updatedAt: now,
          }
        : workspace);
      return { ...state, workspaces };
    });
  }

  function removeWorkspace(id) {
    mutateState((state) => ({ ...state, workspaces: state.workspaces.filter((item) => item.id !== id) }));
    if (activeWorkspaceId === id) setActiveWorkspaceId(null);
  }

  function removeWorkspaceConcept(workspaceId, conceptId) {
    const now = new Date().toISOString();
    mutateState((state) => ({
      ...state,
      workspaces: state.workspaces.map((workspace) => workspace.id === workspaceId
        ? { ...workspace, conceptIds: workspace.conceptIds.filter((id) => id !== conceptId), updatedAt: now }
        : workspace),
    }));
  }

  async function navigateAnnotation(annotation) {
    if (annotation.targetType === 'graph') return openGraph(annotation.targetId);
    if (annotation.targetType === 'edge' && annotation.contextGraph) return openGraph(annotation.contextGraph);
    if (annotation.targetType === 'concept') {
      const entry = projectIndex?.concepts?.find((item) => item.id === annotation.targetId);
      if (entry) return openSearchResult(entry);
    }
  }

  function moveNode(nodeId, position) {
    setGraphDoc((previous) => ({
      ...previous,
      data: { ...previous.data, nodes: previous.data.nodes.map((node) => node.id === nodeId ? { ...node, position } : node) },
    }));
    setDirtyGraph(true);
  }

  function toggleLayer(layerId) {
    setVisibleLayers((previous) => {
      if (previous.size === 1 && previous.has(layerId)) return previous;
      const next = new Set(previous);
      if (next.has(layerId)) next.delete(layerId); else next.add(layerId);
      return next;
    });
  }

  async function refreshCurrent() {
    if (!project || !graphDoc || saving) return;
    setLoading(true);
    setError('');
    try {
      const [freshState, freshIndex, freshGraph] = await Promise.all([
        readJson(connection, project.statePath),
        readJson(connection, project.indexPath),
        fetchGraph(project, graphDoc.data.id),
      ]);
      setStateDoc({ ...freshState, data: normalizeState(freshState.data) });
      setProjectIndex(normalizeIndex(freshIndex.data));
      applyGraph(freshGraph, trail.length ? trail : [{ id: freshGraph.data.id, title: freshGraph.data.title }]);
      setDirtyState(freshState.data.version !== 2);
      setNotice('Reloaded from GitHub');
      window.setTimeout(() => setNotice(''), 2200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function closeProject() {
    if (loading || saving || !(await saveBeforeNavigation())) return;
    setProject(null);
    setProjectRef(null);
    setProjectIndex(null);
    setGraphDoc(null);
    setStateDoc(null);
    setConcepts({});
    setSelectedConceptId(null);
    setTrail([]);
    setSourceDrawer(null);
    setError('');
  }

  async function disconnect() {
    if (project && (loading || saving || !(await saveBeforeNavigation()))) return;
    await clearConnection();
    setConnection(null);
    setManifest(null);
    setProject(null);
    setProjectRef(null);
    setProjectIndex(null);
    setGraphDoc(null);
    setStateDoc(null);
    setConcepts({});
    setSelectedConceptId(null);
    setTrail([]);
    setSourceDrawer(null);
  }

  const unsaved = dirtyGraph || dirtyState;
  const projectTitle = project?.title || projectRef?.title;
  const statusText = useMemo(() => saving ? 'Saving…' : notice || (unsaved ? 'Unsaved changes' : 'Synced'), [saving, notice, unsaved]);

  if (!connectionLoaded) return <div className="center-message">Loading local settings…</div>;
  if (!connection) return <ConnectionSetup onConnected={setConnection} />;
  if (!project) {
    return (
      <>
        {error && <div className="global-error">{error}</div>}
        {manifest
          ? <ProjectPicker projects={manifest.projects} onOpen={openProject} onDisconnect={disconnect} loading={loading} />
          : <div className="center-message">{loading ? 'Loading projects…' : 'No project manifest loaded.'}</div>}
      </>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-button" type="button" onClick={closeProject} title="All projects">LM</button>
        <div className="breadcrumbs" aria-label="Graph path">
          <button type="button" onClick={closeProject}>{projectTitle}</button>
          {trail.map((item, index) => (
            <span key={`${item.id}-${index}`}>
              <span className="crumb-separator">›</span>
              <button type="button" className={index === trail.length - 1 ? 'current' : ''} onClick={() => openTrailIndex(index)}>{item.title}</button>
            </span>
          ))}
        </div>
        <ProjectSearch index={projectIndex} onSelect={openSearchResult} disabled={loading || saving} />
        <div className="topbar-actions">
          <span className={`sync-state ${unsaved ? 'dirty' : ''}`}>{statusText}</span>
          <button className="ghost-button" type="button" onClick={refreshCurrent} disabled={loading || saving}>Refresh</button>
          <button className="primary-button" type="button" onClick={() => persistChanges({ notify: true })} disabled={!unsaved || saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="icon-button" type="button" onClick={disconnect} title="Disconnect this browser">⋯</button>
        </div>
      </header>

      {error && <div className="global-error in-app">{error}</div>}

      <div className="workspace v2-workspace">
        <Navigator
          project={project}
          index={projectIndex}
          state={learningState}
          currentGraphId={graphDoc?.data.id}
          activeWorkspaceId={activeWorkspaceId}
          onSetActiveWorkspace={setActiveWorkspaceId}
          onOpenGraph={(id) => openGraph(id)}
          onOpenConcept={openSearchResult}
          onOpenAnnotation={navigateAnnotation}
          onCreateWorkspace={createWorkspace}
          onRemoveWorkspace={removeWorkspace}
          onRemoveWorkspaceConcept={removeWorkspaceConcept}
        />

        <section className="graph-area">
          <div className="graph-context v2-graph-context">
            <div>
              <div className="graph-title-row">
                <p className="eyebrow">This map answers</p>
                <GraphToolbar graph={graphDoc?.data} visibleLayers={visibleLayers} onToggleLayer={toggleLayer} />
              </div>
              <h1>{graphDoc?.data.question}</h1>
            </div>
            <p>{graphDoc?.data.description}</p>
          </div>
          <div className="graph-canvas-wrap">
            {loading && <div className="loading-overlay">Loading map…</div>}
            <GraphCanvas
              graph={graphDoc?.data}
              concepts={concepts}
              learningState={learningState}
              visibleLayers={visibleLayers}
              onSelectConcept={selectConcept}
              onDive={diveInto}
              onMoveNode={moveNode}
              onOpenSource={setSourceDrawer}
            />
          </div>
        </section>

        <ConceptPanel
          concept={selectedConcept}
          conceptIndex={projectIndex}
          graphId={graphDoc?.data.id}
          learningState={learningState}
          activeWorkspace={activeWorkspace}
          onDive={diveInto}
          onSelectRelated={selectConcept}
          onSetLearning={setLearning}
          onAddAnnotation={addAnnotation}
          onSetAnnotationStatus={setAnnotationStatus}
          onSetAnnotationResolution={setAnnotationResolution}
          onSubmitPrediction={submitPrediction}
          onPinConcept={pinConcept}
          onOpenSource={setSourceDrawer}
        />
      </div>

      {sourceDrawer && (
        <SourceDrawer source={sourceDrawer} project={project} connection={connection} onClose={() => setSourceDrawer(null)} />
      )}
    </div>
  );
}
