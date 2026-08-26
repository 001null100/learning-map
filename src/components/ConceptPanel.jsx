import { useEffect, useMemo, useState } from 'react';
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

function SourceButtons({ sources, onOpenSource }) {
  if (!sources.length) return null;
  return (
    <div className="source-list">
      {sources.map((source) => (
        <button key={source.id} type="button" onClick={() => onOpenSource(source)}>
          <span>{source.type === 'code' ? '⌘' : '↗'}</span>
          <span>
            <strong>{source.symbol || source.title || source.path || source.type}</strong>
            <small>{source.claim}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

function CheckCard({ check, attempts, onSubmitPrediction, emphasized = false }) {
  const latest = attempts.at(-1);
  const firstPlaceholder = check.type === 'predict'
    ? 'Commit to a prediction before reading further…'
    : check.type === 'apply'
      ? 'Work through the application…'
      : 'Explain it in your own words, citing the implementation where useful…';

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const response = new FormData(form).get('response')?.toString().trim();
    if (!response) return;
    onSubmitPrediction(check, response);
    form.reset();
  }

  return (
    <div className={`learning-check ${emphasized ? 'is-gate' : ''}`}>
      <div className="check-head">
        <span>{check.type}</span>
        {latest && <em className={`outcome outcome-${latest.outcome}`}>{latest.outcome}</em>}
      </div>
      <p>{check.prompt}</p>
      {latest && <blockquote>{latest.response}</blockquote>}
      {latest?.reflection && <div className="check-reflection">{latest.reflection}</div>}
      {latest && check.reviewNotes && <div className="check-review-notes"><strong>Review:</strong> {check.reviewNotes}</div>}
      <form className="quick-form" onSubmit={submit}>
        <textarea name="response" rows="3" placeholder={latest ? 'Try again with a better mental model…' : firstPlaceholder} />
        <button type="submit">{latest ? 'Record another attempt' : 'Record answer'}</button>
      </form>
    </div>
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
  onSetAnnotationResolution,
  onSubmitPrediction,
  onPinConcept,
  onOpenSource,
}) {
  const [revealExplanation, setRevealExplanation] = useState(false);

  useEffect(() => setRevealExplanation(false), [concept?.id]);

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
  const implementationSources = (concept.evidence || []).filter((source) => source.type === 'code');
  const supportingSources = (concept.evidence || []).filter((source) => source.type !== 'code');
  const indexMap = useMemo(() => new Map((conceptIndex?.concepts || []).map((entry) => [entry.id, entry])), [conceptIndex]);
  const attemptsByCheck = useMemo(() => {
    const map = new Map();
    for (const prediction of predictions) {
      if (!map.has(prediction.checkId)) map.set(prediction.checkId, []);
      map.get(prediction.checkId).push(prediction);
    }
    return map;
  }, [predictions]);
  const unansweredPrediction = (concept.checks || []).find(
    (check) => check.type === 'predict' && !(attemptsByCheck.get(check.id)?.length),
  );
  const explanationLocked = Boolean(unansweredPrediction && !revealExplanation);
  const pinned = Boolean(activeWorkspace?.conceptIds?.includes(concept.id));
  const canDive = Boolean(concept.detailGraph && concept.detailGraph !== graphId);

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

  return (
    <aside className="concept-panel">
      <div className="concept-panel-scroll">
        <div className="concept-header-line">
          <div>
            <div className="panel-eyebrow">{concept.kind || 'concept'}</div>
            <h2>{concept.title}</h2>
          </div>
          <button className={`pin-button ${pinned ? 'is-pinned' : ''}`} type="button" onClick={() => onPinConcept(concept.id)} title="Pin to active investigation workspace">
            {pinned ? '✓ Pinned' : '＋ Pin'}
          </button>
        </div>
        <p className="concept-summary">{concept.summary}</p>

        {((concept.tags || []).length > 0 || (concept.aliases || []).length > 0) && (
          <div className="concept-meta-chips">
            {(concept.tags || []).slice(0, 6).map((tag) => <span key={`tag-${tag}`}>#{tag}</span>)}
            {(concept.aliases || []).slice(0, 3).map((alias) => <span className="alias-chip" key={`alias-${alias}`}>{alias}</span>)}
          </div>
        )}

        <div className="learning-grid">
          <SelectAxis label="Exposure" value={learning.exposure} options={EXPOSURE} onChange={(value) => onSetLearning(concept.id, 'exposure', value)} />
          <SelectAxis label="Confidence" value={learning.confidence} options={CONFIDENCE} onChange={(value) => onSetLearning(concept.id, 'confidence', value)} />
          <SelectAxis label="Verification" value={learning.verification} options={VERIFICATION} onChange={(value) => onSetLearning(concept.id, 'verification', value)} />
        </div>
        {activeWorkspace && <div className="workspace-hint">Pinning to: <strong>{activeWorkspace.title}</strong></div>}

        {canDive && (
          <button className="primary-button dive-button" type="button" onClick={() => onDive(concept.detailGraph, concept.title)}>Dive deeper ↘</button>
        )}

        {implementationSources.length > 0 && (
          <section className="panel-section implementation-section">
            <div className="section-title-row">
              <h3>Implementation</h3>
              <small>{implementationSources.length} source{implementationSources.length === 1 ? '' : 's'}</small>
            </div>
            <p className="implementation-hint">Read the cited implementation directly. Uploaded snapshots are embedded; repository-backed sources can load live.</p>
            <SourceButtons sources={implementationSources} onOpenSource={onOpenSource} />
          </section>
        )}

        {explanationLocked && (
          <section className="prediction-gate">
            <div className="prediction-gate-head">
              <div>
                <p className="panel-eyebrow">Predict first</p>
                <h3>Commit before revealing the explanation</h3>
              </div>
              <button className="ghost-button" type="button" onClick={() => setRevealExplanation(true)}>Reveal anyway</button>
            </div>
            <CheckCard
              check={unansweredPrediction}
              attempts={attemptsByCheck.get(unansweredPrediction.id) || []}
              onSubmitPrediction={onSubmitPrediction}
              emphasized
            />
          </section>
        )}

        {!explanationLocked && <div className="markdown-body"><ReactMarkdown>{concept.body}</ReactMarkdown></div>}

        {!explanationLocked && (
          <section className="panel-section provenance-section">
            <div className="section-title-row"><h3>Grounding</h3><span className={`confidence-pill confidence-${concept.provenance?.confidence || 'medium'}`}>{concept.provenance?.confidence || 'medium'}</span></div>
            <p><strong>{concept.provenance?.basis || 'unknown'}</strong>{concept.provenance?.note ? ` · ${concept.provenance.note}` : ''}</p>
            {supportingSources.length > 0
              ? <SourceButtons sources={supportingSources} onOpenSource={onOpenSource} />
              : implementationSources.length > 0
                ? <small className="muted-note">Implementation grounding is shown above.</small>
                : <small className="muted-note">No structured source anchors on this concept.</small>}
          </section>
        )}

        {!explanationLocked && (concept.checks || []).length > 0 && (
          <section className="panel-section checks-section">
            <h3>Learning checks</h3>
            {concept.checks.map((check) => (
              <CheckCard
                key={check.id}
                check={check}
                attempts={attemptsByCheck.get(check.id) || []}
                onSubmitPrediction={onSubmitPrediction}
              />
            ))}
          </section>
        )}

        {!explanationLocked && (concept.related || []).length > 0 && (
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
                  {item.resolution && <div className="annotation-resolution">Resolution: {item.resolution}</div>}
                  <div className="annotation-controls">
                    <select value={item.status} onChange={(event) => onSetAnnotationStatus(item.id, event.target.value)}>
                      <option value="open">Open</option>
                      <option value="answered">Answered</option>
                      <option value="needs-testing">Needs testing</option>
                      <option value="resolved">Resolved</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <form onSubmit={(event) => {
                      event.preventDefault();
                      const value = new FormData(event.currentTarget).get('resolution')?.toString().trim() || '';
                      onSetAnnotationResolution(item.id, value);
                    }}>
                      <input name="resolution" defaultValue={item.resolution || ''} placeholder="Resolution / corrected model" />
                      <button type="submit">Set</button>
                    </form>
                  </div>
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
