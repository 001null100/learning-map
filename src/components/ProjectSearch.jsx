import { useMemo, useState } from 'react';
import './ProjectSearch.css';

function searchableText(entry) {
  return [
    entry.title,
    entry.id,
    entry.kind,
    ...(entry.aliases || []),
    ...(entry.tags || []),
  ].filter(Boolean).join(' ').toLowerCase();
}

function score(entry, needle) {
  const title = entry.title.toLowerCase();
  const id = entry.id.toLowerCase();
  if (title === needle || id === needle) return 0;
  if (title.startsWith(needle) || id.startsWith(needle)) return 1;
  if ((entry.aliases || []).some((alias) => alias.toLowerCase().startsWith(needle))) return 2;
  return 3;
}

export default function ProjectSearch({ index, onSelect, disabled = false }) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !index?.concepts) return [];
    return index.concepts
      .filter((entry) => searchableText(entry).includes(needle))
      .sort((a, b) => score(a, needle) - score(b, needle) || a.title.localeCompare(b.title))
      .slice(0, 10);
  }, [index, query]);

  function choose(entry) {
    setQuery('');
    onSelect(entry);
  }

  return (
    <div className="project-search">
      <input
        type="search"
        value={query}
        disabled={disabled || !index}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setQuery('');
          if (event.key === 'Enter' && results.length) choose(results[0]);
        }}
        placeholder="Search concepts, symbols, tags…"
        aria-label="Search concepts in this project"
      />
      {query.trim() && (
        <div className="project-search-results" role="listbox">
          {results.length ? results.map((entry) => (
            <button key={entry.id} type="button" onClick={() => choose(entry)}>
              <span className="search-result-topline">
                <strong>{entry.title}</strong>
                <em>{entry.kind || 'knowledge'}</em>
              </span>
              <small>{entry.id} · {entry.primaryGraph}</small>
              {(entry.tags || []).length > 0 && <small className="search-tags">{entry.tags.slice(0, 4).join(' · ')}</small>}
            </button>
          )) : (
            <div className="project-search-empty">No matching concepts</div>
          )}
        </div>
      )}
    </div>
  );
}
