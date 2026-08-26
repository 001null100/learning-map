import { useEffect, useMemo, useState } from 'react';
import { readRepositoryFile } from '../lib/github.js';
import {
  clearProjectSourceSnapshot,
  getProjectSourceSnapshot,
  saveProjectSourceSnapshot,
} from '../lib/storage.js';
import SyntaxCode from './SyntaxCode.jsx';

const TEXT_SOURCE_EXTENSIONS = new Set([
  'h', 'hpp', 'hh', 'c', 'cc', 'cpp', 'cxx', 'cs', 'ini', 'json', 'txt', 'md', 'uproject', 'uplugin',
]);

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

function lineSuffix(lines) {
  if (!lines?.start) return '';
  return `#L${lines.start}${lines.end && lines.end !== lines.start ? `-L${lines.end}` : ''}`;
}

function citationText(source, repository, effectiveCode) {
  if (!effectiveCode) {
    if (source.path) return `${source.title || 'source'}:${source.path}${lineSuffix(source.lines)}`;
    return source.url || source.title || source.claim;
  }
  const suffix = lineSuffix(source.lines);
  if (repository) {
    const revision = source.commit || source.ref || repository.defaultRef || 'main';
    return `${repository.repository}@${revision}:${source.path || source.symbol || ''}${suffix}`;
  }
  const snapshot = source.title || 'uploaded source';
  return `${snapshot}:${source.path || source.symbol || ''}${suffix}`;
}

function sliceLines(text, lines) {
  if (!text || !lines?.start) return null;
  const all = text.split(/\r?\n/);
  const start = Math.max(1, lines.start);
  const end = Math.min(all.length, lines.end || lines.start);
  return all.slice(start - 1, end).map((line, index) => ({ number: start + index, text: line }));
}

function excerptLines(source) {
  if (!source.excerpt) return null;
  const all = source.excerpt.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  const start = source.lines?.start || 1;
  return all.map((line, index) => ({ number: start + index, text: line }));
}

function normalizeSourcePath(path) {
  const normalized = (path || '').replace(/\\/g, '/').replace(/^\.\//, '');
  const sourceIndex = normalized.indexOf('Source/');
  return sourceIndex >= 0 ? normalized.slice(sourceIndex) : normalized;
}

function isTextSourceFile(file) {
  const name = (file.name || '').toLowerCase();
  const extension = name.includes('.') ? name.split('.').pop() : '';
  return TEXT_SOURCE_EXTENSIONS.has(extension);
}

function accessInfo({ source, repository, effectiveCode, hasLocalSource }) {
  if (effectiveCode && source.excerpt) return { id: 'embedded-code', label: 'Readable code', detail: 'Exact cited lines are embedded in this learning map.' };
  if (effectiveCode && hasLocalSource) return { id: 'local-code', label: 'Attached source', detail: 'The cited lines are resolved from the source folder attached in this browser.' };
  if (effectiveCode && repository) return { id: 'live-code', label: 'Live code', detail: 'The cited range can be loaded from the connected repository.' };
  if (source.url) return { id: 'external', label: 'External source', detail: 'This citation links to an external source.' };
  if (source.excerpt) return { id: 'embedded', label: 'Readable excerpt', detail: 'A source excerpt is embedded in this learning map.' };
  return { id: 'citation-only', label: 'Source not attached', detail: effectiveCode ? 'Attach the uploaded source folder once to resolve this path and line range.' : 'This anchor stores citation metadata but no readable source content.' };
}

export default function SourceDrawer({ source, project, connection, onClose }) {
  const [liveLines, setLiveLines] = useState(null);
  const [localSnapshot, setLocalSnapshot] = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [attaching, setAttaching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [copied, setCopied] = useState(false);
  const repository = source.sourceId ? project.sourceRepositories?.find((item) => item.id === source.sourceId) : null;
  const effectiveCode = source.type === 'code' || Boolean(source.path && source.language && (source.symbol || source.lines));
  const origin = source.origin || (repository ? 'repository' : 'uploaded');
  const url = sourceUrl(source, project);
  const normalizedPath = normalizeSourcePath(source.path);
  const localText = normalizedPath ? localSnapshot?.files?.[normalizedPath] : null;
  const hasLocalSource = Boolean(localText);
  const citation = useMemo(() => citationText(source, repository, effectiveCode), [source, repository, effectiveCode]);
  const embeddedLines = useMemo(() => excerptLines(source), [source]);
  const localLines = useMemo(() => sliceLines(localText, source.lines), [localText, source.lines]);
  const displayedLines = liveLines || embeddedLines || localLines;
  const access = useMemo(
    () => accessInfo({ source, repository, effectiveCode, hasLocalSource }),
    [source, repository, effectiveCode, hasLocalSource],
  );

  useEffect(() => {
    let cancelled = false;
    setSnapshotLoading(true);
    getProjectSourceSnapshot(project.id)
      .then((snapshot) => { if (!cancelled) setLocalSnapshot(snapshot || null); })
      .catch(() => { if (!cancelled) setLocalSnapshot(null); })
      .finally(() => { if (!cancelled) setSnapshotLoading(false); });
    return () => { cancelled = true; };
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    setLiveLines(null);
    setLoadError('');

    if (!effectiveCode || !repository || !source.path || !source.lines?.start || !connection) return undefined;
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
  }, [effectiveCode, source, repository, connection]);

  async function attachSourceFolder(event) {
    const selectedFiles = Array.from(event.target.files || []).filter(isTextSourceFile);
    event.target.value = '';
    if (!selectedFiles.length) return;
    setAttaching(true);
    setLoadError('');
    try {
      const entries = await Promise.all(selectedFiles.map(async (file) => {
        const relativePath = file.webkitRelativePath || file.name;
        return [normalizeSourcePath(relativePath), await file.text()];
      }));
      const files = Object.fromEntries(entries.filter(([path]) => path));
      const snapshot = {
        version: 1,
        title: selectedFiles[0]?.webkitRelativePath?.split('/')[0] || 'Attached source',
        attachedAt: new Date().toISOString(),
        files,
      };
      await saveProjectSourceSnapshot(project.id, snapshot);
      setLocalSnapshot(snapshot);
    } catch (error) {
      setLoadError(`Could not attach source folder: ${error.message}`);
    } finally {
      setAttaching(false);
    }
  }

  async function detachSourceFolder() {
    try {
      await clearProjectSourceSnapshot(project.id);
      setLocalSnapshot(null);
    } catch (error) {
      setLoadError(`Could not remove attached source: ${error.message}`);
    }
  }

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
    <div
      className="source-drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <aside className="source-drawer source-inspector" role="dialog" aria-modal="true" aria-label="Source inspector">
        <div className="source-drawer-head">
          <div>
            <p className="panel-eyebrow">{effectiveCode ? 'Implementation source' : 'Source evidence'}</p>
            <h3>{source.symbol || source.title || source.path || source.type}</h3>
            <div className={`source-access source-access-${access.id}`}><strong>{access.label}</strong><span>{access.detail}</span></div>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close source inspector">×</button>
        </div>

        <p className="source-claim">{source.claim}</p>
        <div className="source-meta-grid">
          <span>Type<strong>{effectiveCode && source.type !== 'code' ? 'code (legacy anchor)' : source.type}</strong></span>
          {effectiveCode && <span>Origin<strong>{origin === 'repository' ? 'GitHub repository' : 'Uploaded snapshot'}</strong></span>}
          {repository && <span>Repository<strong>{repository.repository}</strong></span>}
          {!repository && effectiveCode && source.title && <span>Snapshot<strong>{source.title}</strong></span>}
          {source.path && <span>Path<strong>{source.path}</strong></span>}
          {source.symbol && <span>Symbol<strong>{source.symbol}</strong></span>}
          {source.language && <span>Language<strong>{source.language}</strong></span>}
          {source.lines && <span>Lines<strong>{source.lines.start}{source.lines.end !== source.lines.start ? `–${source.lines.end}` : ''}</strong></span>}
          {(source.commit || source.ref) && <span>Revision<strong>{source.commit ? source.commit.slice(0, 12) : source.ref}</strong></span>}
        </div>

        <div className="source-citation-row">
          <code>{citation}</code>
          <button type="button" onClick={copyCitation}>{copied ? 'Copied' : 'Copy citation'}</button>
        </div>

        {snapshotLoading && effectiveCode && !source.excerpt && <div className="source-loading">Checking attached source snapshot…</div>}
        {loading && <div className="source-loading">Loading cited lines from GitHub…</div>}
        {loadError && <div className="source-preview-note source-preview-warning">{loadError}</div>}

        {access.id === 'citation-only' && !snapshotLoading && (
          <div className="source-attach-panel">
            <div>
              <strong>{effectiveCode ? 'Attach this project’s source folder' : 'Readable source is not stored for this citation'}</strong>
              <p>{effectiveCode
                ? 'Choose the extracted Unreal project or Source folder. The app stores text source locally in IndexedDB and resolves every matching path/line citation in this project. Nothing is uploaded anywhere.'
                : 'This citation has no URL or embedded excerpt.'}</p>
            </div>
            {effectiveCode && (
              <label className="source-attach-button">
                {attaching ? 'Attaching…' : 'Attach source folder'}
                <input type="file" multiple webkitdirectory="" directory="" onChange={attachSourceFolder} disabled={attaching} />
              </label>
            )}
          </div>
        )}

        {!effectiveCode && source.excerpt && <pre className="source-excerpt"><code>{source.excerpt}</code></pre>}
        {displayedLines && effectiveCode && (
          <SyntaxCode lines={displayedLines} language={source.language} path={source.path} />
        )}

        <div className="source-drawer-actions">
          <div className="source-action-group">
            {url && <a href={url} target="_blank" rel="noreferrer">Open original source ↗</a>}
            {!url && effectiveCode && displayedLines && <small>{source.excerpt ? 'Embedded in map data' : `Resolved from ${localSnapshot?.title || 'attached source'}`}</small>}
          </div>
          <div className="source-action-group source-action-group-right">
            {localSnapshot && <button type="button" className="source-detach-button" onClick={detachSourceFolder}>Remove attached source</button>}
            {source.observedAt && <small>Inspected {new Date(source.observedAt).toLocaleString()}</small>}
          </div>
        </div>
      </aside>
    </div>
  );
}
