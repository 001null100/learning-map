import ReactMarkdown from 'react-markdown';

const EXPOSURE = [['unseen', 'Unseen'], ['seen', 'Seen'], ['studied', 'Studied']];
const CONFIDENCE = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
const VERIFICATION = [['untested', 'Untested'], ['predicted', 'Predicted'], ['explained', 'Explained'], ['applied', 'Applied']];
const ANNOTATION_TYPES = [
  ['question', 'Question'],
  ['note', 'Note'],
  ['unfamiliar-term', 'Unfamiliar term'],
  ['hypothesis', 'Hypothesis'],
  ['misconception', 'Misconception'],
  ['insight', 'Insight'],
  ['code-todo', 'Code TODO'],
];

function SelectAxis({ label, value, options, onChange }) {
  return (
    <label className="learning-axis">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
      </select>
    </label>
  );
}

export default function ConceptPanel({
  concept,
  conceptIndex,
  graphId,
  learningState,
  activeWorkspace,
  onDive,
  onSelectRelated,
  onSetLearning,
  onAddAnnotation,
  onSetAnnotationStatus,
  onSubmitPrediction,
  onPinConcept,
  onOpenSource,
}) {
  if (!concept) {
    return (
      <aside className="concept-panel empty-panel">
        <div><h2>Select a concept</h2><p>Click a node to inspect it. Double-click a node with a deeper map to descend one abstraction level.</p></div>
      </aside>
    );
  }

  const learning = learningState.learning?.[concept.id] || { exposure: 'unseen', confidence: 'low', verification: 'untested' };
  const annotations = (learningState.annotations || []).filter((item) => item.targetType === 'concept' && item.targetId === concept.id);
  const predictions = (learningState.predictions || []).filter((item) => item.conceptId === concept.id);
  const indexMap = new Map((conceptIndex?.concepts || []).map((entry) => [entry.id, entry]));

  function submitAnnotation(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = data.get('text')?.toString().trim();
    const type = data.get('type')?.toString() || 'question';
    if (!text) return;
    onAddAnnotation(type, text);
    form.reset();
  }

  function submitCheck(event, check) {
    event.preventDefault();
    const form = event.currentTarget;
    const response = new FormData(form).get('response')?.toString().trim();
    if (!response) return;
    onSubmitPrediction(check, response);
    form.reset();
  }

  return (
    <aside className="concept-panel">
      <div className="concept-panel-scroll">
        <div className="concept-header-line">
          <div>
            <div className="panel-eyebrow">{concept.kind || 'concept'}</div>
            <h2>{concept.title}</h2>
          </div>
          <button className="pin-button" type="button" onClick={() => onPinConcept(concept.id)} title="Pin to active investigation workspace">＋ Pin</button>
        </div>
        <p className="concept-summary">{concept.summary}</p>

        <div className="learning-grid">
          <SelectAxis label="Exposure" value={learning.exposure} options={EXPOSURE} onChange={(value) => onSetLearning(concept.id, 'exposure', value)} />
          <SelectAxis label="Confidence" value={learning.confidence} options={CONFIDENCE} onChange={(value) => onSetLearning(concept.id, 'confidence', value)} />
          <SelectAxis label="Verification" value={learning.verification} options={VERIFICATION} onChange={(value) => onSetLearning(concept.id, 'verification', value)} />
        </div>
        {activeWorkspace && <div className="workspace-hint">Pinning to: <strong>{activeWorkspace.title}</strong></div>}

        {concept.detailGraph && (
          <button className="primary-button dive-button" type="button" onClick={() => onDive(concept.detailGraph, concept.title)}>Dive deeper ↘</button>
        )}

        <div className="markdown-body"><ReactMarkdown>{concept.body}</ReactMarkdown></div>

        <section className="panel-section provenance-section">
          <div className="section-title-row"><h3>Grounding</h3><span className={`confidence-pill confidence-${concept.provenance?.confidence || 'medium'}`}>{concept.provenance?.confidence || 'medium'}</span></div>
          <p><strong>{concept.provenance?.basis || 'unknown'}</strong>{concept.provenance?.note ? ` · ${concept.provenance.note}` : ''}</p>
          {(concept.evidence || []).length > 0 ? (
            <div className="source-list">
              {concept.evidence.map((source) => (
                <button key={source.id} type="button" onClick={() => onOpenSource(source)}>
                  <span>{source.type === 'code' ? '⌘' : '↗'}</span>
                  <span><strong>{source.symbol || source.title || source.path || source.type}</strong><small>{source.claim}</small></span>
                </button>
              ))}
            </div>
          ) : <small className="muted-note">No structured source anchors on this concept.</small>}
        </section>

        {(concept.checks || []).length > 0 && (
          <section className="panel-section checks-section">
            <h3>Learning checks</h3>
            {concept.checks.map((check) => {
              const attempts = predictions.filter((item) => item.checkId === check.id);
              const latest = attempts.at(-1);
              return (
                <div className="learning-check" key={check.id}>
                  <div className="check-head"><span>{check.type}</span>{latest && <em className={`outcome outcome-${latest.outcome}`}>{latest.outcome}</em>}</div>
                  <p>{check.prompt}</p>
                  {latest && <blockquote>{latest.response}</blockquote>}
                  {latest?.reflection && <div className="check-reflection">{latest.reflection}</div>}
                  <form className="quick-form" onSubmit={(event) => submitCheck(event, check)}>
                    <textarea name="response" rows="3" placeholder="Commit to an answer before opening more explanation…" />
                    <button type="submit">Record answer</button>
                  </form>
                </div>
              );
            })}
          </section>
        )}

        {(concept.related || []).length > 0 && (
          <section className="panel-section">
            <h3>Related concepts</h3>
            <div className="related-list">
              {concept.related.map((item) => (
                <button key={`${item.concept}-${item.relation}`} type="button" onClick={() => onSelectRelated(item.concept)}>
                  <span>{indexMap.get(item.concept)?.title || item.concept}</span><small>{item.relation}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="panel-section">
          <div className="section-title-row"><h3>Threads & notes</h3><small>{graphId}</small></div>
          {annotations.length > 0 && (
            <div className="annotation-list">
              {annotations.map((item) => (
                <div className={`annotation annotation-${item.type}`} key={item.id}>
                  <div className="annotation-head"><span>{item.type}</span><small>{item.status}</small></div>
                  <p>{item.text}</p>
                  {item.resolution && <div className="annotation-resolution">Resolved: {item.resolution}</div>}
                  <select value={item.status} onChange={(event) => onSetAnnotationStatus(item.id, event.target.value)}>
                    <option value="open">Open</option>
                    <option value="answered">Answered</option>
                    <option value="needs-testing">Needs testing</option>
                    <option value="resolved">Resolved</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              ))}
            </div>
          )}
          <form className="annotation-form" onSubmit={submitAnnotation}>
            <select name="type" defaultValue="question">{ANNOTATION_TYPES.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>
            <textarea name="text" rows="2" placeholder="Question, hypothesis, misconception, insight…" />
            <button type="submit">Add thread</button>
          </form>
        </section>
      </div>
    </aside>
  );
}
