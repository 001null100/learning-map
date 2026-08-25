import ReactMarkdown from 'react-markdown';

const STATUS_OPTIONS = [
  ['unexplored', 'Unexplored'],
  ['developing', 'Developing'],
  ['understood', 'Understood'],
  ['revisit', 'Revisit'],
];

export default function ConceptPanel({
  concept,
  learningState,
  onDive,
  onSelectRelated,
  onSetStatus,
  onAddQuestion,
  onSetQuestionStatus,
  onAddComment,
  onAddUnfamiliar,
}) {
  if (!concept) {
    return (
      <aside className="concept-panel empty-panel">
        <div>
          <h2>Select a concept</h2>
          <p>Click a node to inspect it. Double-click a node with a deeper map to dive into its mechanics.</p>
        </div>
      </aside>
    );
  }

  const questions = learningState.questions.filter(
    (item) => item.targetType === 'concept' && item.targetId === concept.id,
  );
  const comments = learningState.comments.filter(
    (item) => item.targetType === 'concept' && item.targetId === concept.id,
  );
  const unfamiliar = learningState.unfamiliarTerms.filter(
    (item) => item.contextConcept === concept.id,
  );

  function submitText(event, callback) {
    event.preventDefault();
    const form = event.currentTarget;
    const text = new FormData(form).get('text')?.toString().trim();
    if (!text) return;
    callback(text);
    form.reset();
  }

  return (
    <aside className="concept-panel">
      <div className="concept-panel-scroll">
        <div className="panel-eyebrow">Concept</div>
        <h2>{concept.title}</h2>
        <p className="concept-summary">{concept.summary}</p>

        <div className="concept-actions">
          <label className="status-control">
            <span>Understanding</span>
            <select
              value={learningState.status[concept.id] || 'unexplored'}
              onChange={(event) => onSetStatus(concept.id, event.target.value)}
            >
              {STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          {concept.detailGraph && (
            <button className="primary-button" type="button" onClick={() => onDive(concept.detailGraph, concept.title)}>
              Dive deeper ↘
            </button>
          )}
        </div>

        <div className="markdown-body">
          <ReactMarkdown>{concept.body}</ReactMarkdown>
        </div>

        {concept.related.length > 0 && (
          <section className="panel-section">
            <h3>Related concepts</h3>
            <div className="related-list">
              {concept.related.map((item) => (
                <button key={`${item.concept}-${item.relation}`} type="button" onClick={() => onSelectRelated(item.concept)}>
                  <span>{item.concept}</span>
                  <small>{item.relation}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="panel-section">
          <h3>Questions</h3>
          {questions.length > 0 && (
            <div className="annotation-list">
              {questions.map((item) => (
                <div className="annotation" key={item.id}>
                  <p>{item.text}</p>
                  <select value={item.status} onChange={(event) => onSetQuestionStatus(item.id, event.target.value)}>
                    <option value="open">Open</option>
                    <option value="answered">Answered</option>
                    <option value="needs-testing">Needs testing</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              ))}
            </div>
          )}
          <form className="quick-form" onSubmit={(event) => submitText(event, onAddQuestion)}>
            <textarea name="text" rows="2" placeholder="What doesn't make sense yet?" />
            <button type="submit">Add question</button>
          </form>
        </section>

        <section className="panel-section">
          <h3>My notes</h3>
          {comments.length > 0 && (
            <div className="annotation-list">
              {comments.map((item) => <div className="annotation" key={item.id}><p>{item.text}</p></div>)}
            </div>
          )}
          <form className="quick-form" onSubmit={(event) => submitText(event, onAddComment)}>
            <textarea name="text" rows="2" placeholder="Capture your current mental model…" />
            <button type="submit">Add note</button>
          </form>
        </section>

        <section className="panel-section">
          <h3>Unfamiliar terms</h3>
          {unfamiliar.length > 0 && (
            <div className="term-list">
              {unfamiliar.map((item) => <span key={item.id} className={item.status === 'resolved' ? 'resolved' : ''}>{item.term}</span>)}
            </div>
          )}
          <form className="inline-form" onSubmit={(event) => submitText(event, onAddUnfamiliar)}>
            <input name="text" placeholder="e.g. projection" />
            <button type="submit">Flag</button>
          </form>
        </section>
      </div>
    </aside>
  );
}
