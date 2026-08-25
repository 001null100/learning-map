import { useMemo, useState } from 'react';
import './ProjectSearch.css';

export default function ProjectSearch({ index, onSelect, disabled = false }) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !index?.concepts) return [];
    return index.concepts
      .filter((entry) => `${entry.title} ${entry.id}`.toLowerCase().includes(needle))
      .slice(0, 8);
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
          if (event.key === 'Enter' && results.length === 1) choose(results[0]);
        }}
        placeholder="Search concepts…"
        aria-label="Search concepts in this project"
      />
      {query.trim() && (
        <div className="project-search-results" role="listbox">
          {results.length ? results.map((entry) => (
            <button key={entry.id} type="button" onClick={() => choose(entry)}>
              <strong>{entry.title}</strong>
              <small>{entry.id} · {entry.primaryGraph}</small>
            </button>
          )) : (
            <div className="project-search-empty">No matching concepts</div>
          )}
        </div>
      )}
    </div>
  );
}
