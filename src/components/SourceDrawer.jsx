function sourceUrl(source, project) {
  if (source.url) return source.url;
  if (source.type !== 'code' || !source.sourceId || !source.path) return null;
  const repository = project.sourceRepositories?.find((item) => item.id === source.sourceId);
  if (!repository) return null;
  const ref = source.commit || source.ref || repository.defaultRef || 'main';
  const path = source.path.split('/').map(encodeURIComponent).join('/');
  let url = `https://github.com/${repository.repository}/blob/${encodeURIComponent(ref)}/${path}`;
  if (source.lines?.start) {
    url += `#L${source.lines.start}`;
    if (source.lines.end && source.lines.end !== source.lines.start) url += `-L${source.lines.end}`;
  }
  return url;
}

export default function SourceDrawer({ source, project, onClose }) {
  const url = sourceUrl(source, project);
  const repository = source.sourceId ? project.sourceRepositories?.find((item) => item.id === source.sourceId) : null;

  return (
    <aside className="source-drawer">
      <div className="source-drawer-head">
        <div>
          <p className="panel-eyebrow">Source evidence</p>
          <h3>{source.title || source.symbol || source.path || source.type}</h3>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close source drawer">×</button>
      </div>

      <p className="source-claim">{source.claim}</p>
      <div className="source-meta-grid">
        <span>Type<strong>{source.type}</strong></span>
        {repository && <span>Repository<strong>{repository.repository}</strong></span>}
        {source.path && <span>Path<strong>{source.path}</strong></span>}
        {source.symbol && <span>Symbol<strong>{source.symbol}</strong></span>}
        {source.lines && <span>Lines<strong>{source.lines.start}–{source.lines.end}</strong></span>}
        {(source.commit || source.ref) && <span>Revision<strong>{source.commit ? source.commit.slice(0, 12) : source.ref}</strong></span>}
      </div>

      {source.excerpt && <pre className="source-excerpt"><code>{source.excerpt}</code></pre>}
      <div className="source-drawer-actions">
        {url && <a href={url} target="_blank" rel="noreferrer">Open source ↗</a>}
        {source.observedAt && <small>Inspected {new Date(source.observedAt).toLocaleString()}</small>}
      </div>
    </aside>
  );
}
