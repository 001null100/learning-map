import { useMemo, useState } from 'react';

const TERMINAL = new Set(['resolved', 'accepted', 'rejected']);

function humanize(value = '') {
  return value.split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

function compactLearning(state, id) {
  return state.learning?.[id] || { exposure: 'unseen', confidence: 'low', verification: 'untested' };
}

export default function Navigator({
  project,
  index,
  state,
  currentGraphId,
  activeWorkspaceId,
  onSetActiveWorkspace,
  onOpenGraph,
  onOpenConcept,
  onOpenAnnotation,
  onCreateWorkspace,
  onRemoveWorkspace,
  onRemoveWorkspaceConcept,
}) {
  const [tab, setTab] = useState('maps');
  const entries = index?.concepts || [];
  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);

  const threads = useMemo(
    () => (state.annotations || []).filter((item) => !TERMINAL.has(item.status)),
    [state.annotations],
  );

  const frontier = useMemo(() => entries.filter((entry) => {
    const own = compactLearning(state, entry.id);
    if (own.exposure === 'studied') return false;
    const prereqs = entry.prerequisites || [];
    if (!prereqs.length) return own.exposure === 'seen';
    return prereqs.every((id) => compactLearning(state, id).exposure !== 'unseen');
  }).slice(0, 12), [entries, state]);

  const activeWorkspace = state.workspaces?.find((item) => item.id === activeWorkspaceId) || null;

  function submitWorkspace(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = data.get('title')?.toString().trim();
    const question = data.get('question')?.toString().trim() || '';
    if (!title) return;
    onCreateWorkspace(title, question);
    form.reset();
  }

  return (
    <aside className="navigator">
      <div className="navigator-head">
        <p className="panel-eyebrow">{project.projectType || 'learning'} project</p>
        <h2>{project.title}</h2>
      </div>

      <div className="navigator-tabs" role="tablist">
        {[
          ['maps', 'Maps'],
          ['threads', `Threads${threads.length ? ` ${threads.length}` : ''}`],
          ['frontier', 'Frontier'],
          ['workspaces', 'Workspaces'],
        ].map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <div className="navigator-scroll">
        {tab === 'maps' && (
          <div className="nav-list">
            {(project.graphs || []).map((graphId) => (
              <button key={graphId} type="button" className={graphId === currentGraphId ? 'active' : ''} onClick={() => onOpenGraph(graphId)}>
                <span className="nav-icon">◇</span>
                <span><strong>{humanize(graphId)}</strong><small>{graphId === project.entryGraph ? 'entry map' : 'map'}</small></span>
              </button>
            ))}
          </div>
        )}

        {tab === 'threads' && (
          <div className="nav-list threads-list">
            {threads.length ? threads.map((item) => {
              const entry = item.targetType === 'concept' ? entryMap.get(item.targetId) : null;
              return (
                <button key={item.id} type="button" onClick={() => onOpenAnnotation(item)}>
                  <span className={`thread-type type-${item.type}`}>{item.type === 'question' ? '?' : item.type === 'code-todo' ? '⌘' : '•'}</span>
                  <span><strong>{item.text}</strong><small>{item.type} · {entry?.title || item.targetId}</small></span>
                </button>
              );
            }) : <p className="nav-empty">No unresolved threads. Suspiciously tidy.</p>}
          </div>
        )}

        {tab === 'frontier' && (
          <div>
            <p className="navigator-help">Concepts whose prerequisites are already within reach, but which are not yet studied.</p>
            <div className="nav-list">
              {frontier.length ? frontier.map((entry) => (
                <button key={entry.id} type="button" onClick={() => onOpenConcept(entry)}>
                  <span className="nav-icon">→</span>
                  <span><strong>{entry.title}</strong><small>{entry.prerequisites?.length ? `after ${entry.prerequisites.map((id) => entryMap.get(id)?.title || id).join(', ')}` : 'ready to explore'}</small></span>
                </button>
              )) : <p className="nav-empty">No frontier suggestions yet. Study or mark a few concepts as seen to reveal the boundary.</p>}
            </div>
          </div>
        )}

        {tab === 'workspaces' && (
          <div className="workspace-nav">
            <form className="workspace-form" onSubmit={submitWorkspace}>
              <input name="title" placeholder="New investigation" />
              <input name="question" placeholder="Question (optional)" />
              <button type="submit">Create workspace</button>
            </form>

            <div className="workspace-list">
              {(state.workspaces || []).map((workspace) => (
                <section key={workspace.id} className={`workspace-card ${workspace.id === activeWorkspaceId ? 'active' : ''}`}>
                  <button className="workspace-select" type="button" onClick={() => onSetActiveWorkspace(workspace.id)}>
                    <strong>{workspace.title}</strong>
                    <small>{workspace.question || (workspace.temporary ? 'temporary investigation' : 'saved workspace')}</small>
                  </button>
                  <button className="workspace-delete" type="button" onClick={() => onRemoveWorkspace(workspace.id)} title="Delete workspace">×</button>
                </section>
              ))}
            </div>

            {activeWorkspace && (
              <section className="active-workspace-detail">
                <h3>{activeWorkspace.title}</h3>
                {activeWorkspace.question && <p>{activeWorkspace.question}</p>}
                <div className="workspace-concepts">
                  {activeWorkspace.conceptIds.length ? activeWorkspace.conceptIds.map((conceptId) => {
                    const entry = entryMap.get(conceptId);
                    return (
                      <div key={conceptId}>
                        <button type="button" onClick={() => entry && onOpenConcept(entry)}>{entry?.title || conceptId}</button>
                        <button type="button" onClick={() => onRemoveWorkspaceConcept(activeWorkspace.id, conceptId)}>×</button>
                      </div>
                    );
                  }) : <p className="nav-empty">Pin concepts from the inspector to gather them here.</p>}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
