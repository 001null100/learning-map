import { useEffect, useMemo, useState } from 'react';
import { readRepositoryFile } from '../lib/github.js';

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

function citationText(source, repository) {
  if (source.type !== 'code') return source.url || source.title || source.claim;
  const revision = source.commit || source.ref || repository?.defaultRef || 'main';
  const linePart = source.lines?.start
    ? `#L${source.lines.start}${source.lines.end && source.lines.end !== source.lines.start ? `-L${source.lines.end}` : ''}`
    : '';
  return `${repository?.repository || source.sourceId || 'repo'}@${revision}:${source.path || source.symbol || ''}${linePart}`;
}

function sliceLines(text, lines) {
  if (!lines?.start) return null;
  const all = text.split(/\r?\n/);
  const start = Math.max(1, lines.start);
  const end = Math.min(all.length, lines.end || lines.start);
  return all.slice(start - 1, end).map((line, index) => ({ number: start + index, text: line }));
}

export default function SourceDrawer({ source, project, connection, onClose }) {
  const [liveLines, setLiveLines] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [copied, setCopied] = useState(false);
  const url = sourceUrl(source, project);
  const repository = source.sourceId ? project.sourceRepositories?.find((item) => item.id === source.sourceId) : null;
  const citation = useMemo(() => citationText(source, repository), [source, repository]);

  useEffect(() => {
    let cancelled = false;
    setLiveLines(null);
    setLoadError('');

    if (source.type !== 'code' || !repository || !source.path || !source.lines?.start || !connection) return undefined;
    const ref = source.commit || source.ref || repository.defaultRef || 'main';
    setLoading(true);
    readRepositoryFile(connection, repository.repository, source.path, ref)
      .then((file) => {
        if (!cancelled) setLiveLines(sliceLines(file.text, source.lines));
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [source, repository, connection]);

  async function copyCitation() {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

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
        {source.lines && <span>Lines<strong>{source.lines.start}{source.lines.end !== source.lines.start ? `–${source.lines.end}` : ''}</strong></span>}
        {(source.commit || source.ref) && <span>Revision<strong>{source.commit ? source.commit.slice(0, 12) : source.ref}</strong></span>}
      </div>

      <div className="source-citation-row">
        <code>{citation}</code>
        <button type="button" onClick={copyCitation}>{copied ? 'Copied' : 'Copy citation'}</button>
      </div>

      {source.excerpt && !liveLines && <pre className="source-excerpt"><code>{source.excerpt}</code></pre>}

      {loading && <div className="source-loading">Loading cited lines from GitHub…</div>}
      {loadError && (
        <div className="source-preview-note">
          Live preview unavailable: {loadError}. The citation is still valid; give this browser token access to the source repository if you want inline code.
        </div>
      )}
      {liveLines && (
        <pre className="source-excerpt live-source">
          <code>{liveLines.map((line) => <span className="source-line" key={line.number}><b>{line.number}</b>{line.text || ' '}{'\n'}</span>)}</code>
        </pre>
      )}

      <div className="source-drawer-actions">
        {url && <a href={url} target="_blank" rel="noreferrer">Open source ↗</a>}
        {source.observedAt && <small>Inspected {new Date(source.observedAt).toLocaleString()}</small>}
      </div>
    </aside>
  );
}
