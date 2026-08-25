import { useEffect, useMemo, useState } from 'react';
import GraphCanvas from './components/GraphCanvas.jsx';
import ConceptPanel from './components/ConceptPanel.jsx';
import ProjectSearch from './components/ProjectSearch.jsx';
import { clearConnection, getConnection, saveConnection } from './lib/storage.js';
import { readJson, testConnection, writeJson } from './lib/github.js';

const EMPTY_STATE = {
  version: 1,
  status: {},
  questions: [],
  comments: [],
  unfamiliarTerms: [],
};

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
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
          The app itself is public, but your projects live in a private GitHub repository. The token is stored only in this browser's IndexedDB.
        </p>
        <form onSubmit={submit} className="setup-form">
          <label>
            <span>Repository owner</span>
            <input value={owner} onChange={(event) => setOwner(event.target.value)} autoComplete="off" />
          </label>
          <label>
            <span>Repository</span>
            <input value={repo} onChange={(event) => setRepo(event.target.value)} autoComplete="off" />
          </label>
          <label>
            <span>Fine-grained PAT</span>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="github_pat_…"
              autoComplete="off"
            />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-button large" disabled={busy} type="submit">
            {busy ? 'Testing connection…' : 'Connect'}
          </button>
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
          <p className="eyebrow">Learning Map</p>
          <h1>Projects</h1>
          <p>Pick a domain, then descend through its abstraction levels.</p>
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
  const [dirtyState, setDirtyState] = useState(false);
  const [dirtyGraph, setDirtyGraph] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const learningState = stateDoc?.data || EMPTY_STATE;
  const selectedConcept = selectedConceptId ? concepts[selectedConceptId] || null : null;

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

  async function loadConcepts(projectData, ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    const docs = await Promise.all(
      unique.map((id) => readJson(connection, `projects/${projectData.id}/concepts/${id}.json`)),
    );
    const loaded = {};
    docs.forEach((doc) => {
      loaded[doc.data.id] = doc.data;
    });
    setConcepts((previous) => ({ ...previous, ...loaded }));
    return loaded;
  }

  async function fetchGraph(projectData, graphId) {
    const path = `projects/${projectData.id}/graphs/${graphId}.json`;
    const doc = await readJson(connection, path);
    const conceptIds = [...doc.data.nodes.map((node) => node.concept), doc.data.rootConcept];
    await loadConcepts(projectData, conceptIds);
    return { ...doc, path };
  }

  function blockDirtyGraphNavigation() {
    if (!dirtyGraph) return false;
    setError('Save or refresh the current layout before leaving this graph.');
    return true;
  }

  async function openProject(reference) {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const projectFile = await readJson(connection, reference.path);
      const projectData = projectFile.data;
      const [stateFile, indexFile, firstGraph] = await Promise.all([
        readJson(connection, projectData.statePath),
        readJson(connection, projectData.indexPath),
        fetchGraph(projectData, projectData.entryGraph),
      ]);
      setProjectRef(reference);
      setProject(projectData);
      setProjectIndex(indexFile.data);
      setStateDoc(stateFile);
      setGraphDoc(firstGraph);
      setTrail([{ id: firstGraph.data.id, title: firstGraph.data.title }]);
      setSelectedConceptId(firstGraph.data.rootConcept || firstGraph.data.nodes[0]?.concept || null);
      setDirtyGraph(false);
      setDirtyState(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function diveInto(graphId) {
    if (!project || graphDoc?.data.id === graphId || blockDirtyGraphNavigation()) return;
    setLoading(true);
    setError('');
    try {
      const next = await fetchGraph(project, graphId);
      setGraphDoc(next);
      setTrail((previous) => [...previous, { id: next.data.id, title: next.data.title }]);
      setSelectedConceptId(next.data.rootConcept || next.data.nodes[0]?.concept || null);
      setDirtyGraph(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openTrailIndex(index) {
    const target = trail[index];
    if (!target || !project || blockDirtyGraphNavigation()) return;
    setLoading(true);
    setError('');
    try {
      const next = await fetchGraph(project, target.id);
      setGraphDoc(next);
      setTrail((previous) => previous.slice(0, index + 1));
      setSelectedConceptId(next.data.rootConcept || next.data.nodes[0]?.concept || null);
      setDirtyGraph(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openSearchResult(entry) {
    if (!project || !entry || blockDirtyGraphNavigation()) return;
    setLoading(true);
    setError('');
    try {
      const next = await fetchGraph(project, entry.primaryGraph);
      setGraphDoc(next);
      setTrail([{ id: next.data.id, title: next.data.title }]);
      setSelectedConceptId(entry.id);
      setDirtyGraph(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectConcept(conceptId) {
    if (!project) return;
    if (!concepts[conceptId]) {
      try {
        await loadConcepts(project, [conceptId]);
      } catch (err) {
        setError(err.message);
        return;
      }
    }
    setSelectedConceptId(conceptId);
  }

  function mutateState(mutator) {
    setStateDoc((previous) => ({ ...previous, data: mutator(previous?.data || EMPTY_STATE) }));
    setDirtyState(true);
  }

  function setConceptStatus(conceptId, status) {
    mutateState((state) => ({ ...state, status: { ...state.status, [conceptId]: status } }));
  }

  function addQuestion(text) {
    if (!selectedConceptId) return;
    const now = new Date().toISOString();
    mutateState((state) => ({
      ...state,
      questions: [...state.questions, {
        id: makeId('question'),
        targetType: 'concept',
        targetId: selectedConceptId,
        text,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      }],
    }));
  }

  function setQuestionStatus(id, status) {
    const now = new Date().toISOString();
    mutateState((state) => ({
      ...state,
      questions: state.questions.map((item) => item.id === id ? { ...item, status, updatedAt: now } : item),
    }));
  }

  function addComment(text) {
    if (!selectedConceptId) return;
    const now = new Date().toISOString();
    mutateState((state) => ({
      ...state,
      comments: [...state.comments, {
        id: makeId('comment'),
        targetType: 'concept',
        targetId: selectedConceptId,
        text,
        createdAt: now,
        updatedAt: now,
      }],
    }));
  }

  function addUnfamiliar(term) {
    if (!selectedConceptId) return;
    const now = new Date().toISOString();
    mutateState((state) => ({
      ...state,
      unfamiliarTerms: [...state.unfamiliarTerms, {
        id: makeId('term'),
        term,
        contextConcept: selectedConceptId,
        context: concepts[selectedConceptId]?.title || selectedConceptId,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      }],
    }));
  }

  function moveNode(nodeId, position) {
    setGraphDoc((previous) => ({
      ...previous,
      data: {
        ...previous.data,
        nodes: previous.data.nodes.map((node) => node.id === nodeId ? { ...node, position } : node),
      },
    }));
    setDirtyGraph(true);
  }

  async function saveChanges() {
    if (!project || !connection || (!dirtyGraph && !dirtyState)) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (dirtyGraph) {
        const result = await writeJson(
          connection,
          graphDoc.path,
          graphDoc.data,
          graphDoc.sha,
          `Rearrange ${graphDoc.data.title}`,
        );
        setGraphDoc((previous) => ({ ...previous, sha: result.content.sha }));
        setDirtyGraph(false);
      }
      if (dirtyState) {
        const result = await writeJson(
          connection,
          project.statePath,
          stateDoc.data,
          stateDoc.sha,
          `Update ${project.title} learning state`,
        );
        setStateDoc((previous) => ({ ...previous, sha: result.content.sha }));
        setDirtyState(false);
      }
      setNotice('Saved to GitHub');
      window.setTimeout(() => setNotice(''), 2200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function refreshCurrent() {
    if (!project || !graphDoc) return;
    setLoading(true);
    setError('');
    try {
      const [freshState, freshIndex, freshGraph] = await Promise.all([
        readJson(connection, project.statePath),
        readJson(connection, project.indexPath),
        fetchGraph(project, graphDoc.data.id),
      ]);
      setStateDoc(freshState);
      setProjectIndex(freshIndex.data);
      setGraphDoc(freshGraph);
      setSelectedConceptId(freshGraph.data.rootConcept || freshGraph.data.nodes[0]?.concept || null);
      setDirtyGraph(false);
      setDirtyState(false);
      setNotice('Reloaded from GitHub');
      window.setTimeout(() => setNotice(''), 2200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function closeProject() {
    if (dirtyGraph || dirtyState) {
      setError('Save or refresh your changes before returning to the project list.');
      return;
    }
    setProject(null);
    setProjectRef(null);
    setProjectIndex(null);
    setGraphDoc(null);
    setStateDoc(null);
    setConcepts({});
    setSelectedConceptId(null);
    setTrail([]);
    setError('');
  }

  async function disconnect() {
    if (dirtyGraph || dirtyState) {
      setError('Save or refresh your changes before disconnecting this browser.');
      return;
    }
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
  }

  const unsaved = dirtyGraph || dirtyState;
  const graphQuestion = graphDoc?.data.question || '';
  const projectTitle = project?.title || projectRef?.title;
  const statusText = useMemo(() => {
    if (saving) return 'Saving…';
    if (notice) return notice;
    if (unsaved) return 'Unsaved changes';
    return 'Synced';
  }, [saving, notice, unsaved]);

  if (!connectionLoaded) return <div className="center-message">Loading local settings…</div>;
  if (!connection) return <ConnectionSetup onConnected={setConnection} />;

  if (!project) {
    return (
      <>
        {error && <div className="global-error">{error}</div>}
        {manifest ? (
          <ProjectPicker projects={manifest.projects} onOpen={openProject} onDisconnect={disconnect} loading={loading} />
        ) : (
          <div className="center-message">{loading ? 'Loading projects…' : 'No project manifest loaded.'}</div>
        )}
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
              <button type="button" className={index === trail.length - 1 ? 'current' : ''} onClick={() => openTrailIndex(index)}>
                {item.title}
              </button>
            </span>
          ))}
        </div>
        <ProjectSearch index={projectIndex} onSelect={openSearchResult} disabled={loading || saving} />
        <div className="topbar-actions">
          <span className={`sync-state ${unsaved ? 'dirty' : ''}`}>{statusText}</span>
          <button className="ghost-button" type="button" onClick={refreshCurrent} disabled={loading || saving}>Refresh</button>
          <button className="primary-button" type="button" onClick={saveChanges} disabled={!unsaved || saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="icon-button" type="button" onClick={disconnect} title="Disconnect this browser">⋯</button>
        </div>
      </header>

      {error && <div className="global-error in-app">{error}</div>}

      <div className="workspace">
        <section className="graph-area">
          <div className="graph-context">
            <div>
              <p className="eyebrow">This map answers</p>
              <h1>{graphQuestion}</h1>
            </div>
            <p>{graphDoc?.data.description}</p>
          </div>
          <div className="graph-canvas-wrap">
            {loading && <div className="loading-overlay">Loading map…</div>}
            <GraphCanvas
              graph={graphDoc?.data}
              concepts={concepts}
              learningState={learningState}
              onSelectConcept={selectConcept}
              onDive={diveInto}
              onMoveNode={moveNode}
            />
          </div>
        </section>

        <ConceptPanel
          concept={selectedConcept}
          learningState={learningState}
          onDive={diveInto}
          onSelectRelated={selectConcept}
          onSetStatus={setConceptStatus}
          onAddQuestion={addQuestion}
          onSetQuestionStatus={setQuestionStatus}
          onAddComment={addComment}
          onAddUnfamiliar={addUnfamiliar}
        />
      </div>
    </div>
  );
}
