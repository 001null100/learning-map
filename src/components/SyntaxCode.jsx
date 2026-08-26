import { useEffect, useMemo, useState } from 'react';
import { createHighlighter } from 'shiki';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { useAppearance } from '../appearance/AppearanceProvider.jsx';

export const CODE_THEMES = {
  cyberpunk: { shiki: 'synthwave-84', label: 'Cyberpunk' },
  tokyo: { shiki: 'tokyo-night', label: 'Tokyo Neon' },
  monokai: { shiki: 'monokai', label: 'Monokai' },
  oneDark: { shiki: 'one-dark-pro', label: 'One Dark' },
};

const CPP_EXTENSIONS = new Set(['c', 'cc', 'cpp', 'cxx', 'h', 'hh', 'hpp', 'hxx', 'inl']);
let highlighterPromise = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      langs: ['cpp'],
      themes: Object.values(CODE_THEMES).map((theme) => theme.shiki),
      // Browser-first engine. Avoids Shiki's default Oniguruma WASM startup path,
      // which can fail at runtime even when Vite builds successfully.
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

function normalizeLanguage(language, path) {
  const explicit = (language || '').toLowerCase();
  if (['cpp', 'c++', 'cplusplus'].includes(explicit)) return 'cpp';
  const file = (path || '').toLowerCase();
  const extension = file.includes('.') ? file.split('.').pop() : '';
  return CPP_EXTENSIONS.has(extension) ? 'cpp' : null;
}

function tokenStyle(token) {
  const fontStyle = token.fontStyle || 0;
  return {
    color: token.color || undefined,
    fontStyle: fontStyle & 1 ? 'italic' : undefined,
    fontWeight: fontStyle & 2 ? 700 : undefined,
    textDecoration: fontStyle & 4 ? 'underline' : undefined,
  };
}

function SourceRow({ line, tokens = null }) {
  return (
    <span className="source-line" key={line.number}>
      <b>{line.number}</b>
      <span className="syntax-line">
        {tokens
          ? tokens.map((token, tokenIndex) => (
              <span key={`${line.number}-${tokenIndex}`} style={tokenStyle(token)}>{token.content}</span>
            ))
          : (line.text || ' ')}
        {tokens && !tokens.length && ' '}
      </span>
    </span>
  );
}

function PlainLines({ lines }) {
  return lines.map((line) => <SourceRow line={line} key={line.number} />);
}

export default function SyntaxCode({ lines, language, path }) {
  const { appearance } = useAppearance();
  const codeTheme = appearance.codeTheme || 'cyberpunk';
  const theme = CODE_THEMES[codeTheme] || CODE_THEMES.cyberpunk;
  const shikiLanguage = normalizeLanguage(language, path);
  const sourceText = useMemo(() => (lines || []).map((line) => line.text).join('\n'), [lines]);
  const [tokenLines, setTokenLines] = useState(null);
  const [highlightError, setHighlightError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setTokenLines(null);
    setHighlightError('');

    if (!shikiLanguage || !sourceText) return undefined;

    getHighlighter()
      .then((highlighter) => highlighter.codeToTokens(sourceText, {
        lang: shikiLanguage,
        theme: theme.shiki,
      }))
      .then((result) => {
        if (!cancelled) setTokenLines(result.tokens || null);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setHighlightError(message || 'Unknown syntax-highlighting error');
        console.error('C++ syntax highlighting failed:', error);
      });

    return () => { cancelled = true; };
  }, [sourceText, shikiLanguage, theme.shiki]);

  const highlighting = Boolean(shikiLanguage && !tokenLines && !highlightError);

  return (
    <div className="syntax-code-wrap">
      <pre
        className={`source-excerpt live-source syntax-code syntax-theme-${codeTheme}`}
        aria-busy={highlighting}
        data-language={shikiLanguage || 'plain'}
        data-theme={codeTheme}
        data-highlight-state={highlightError ? 'failed' : tokenLines ? 'ready' : shikiLanguage ? 'loading' : 'plain'}
      >
        <code>
          {tokenLines
            ? lines.map((line, lineIndex) => (
                <SourceRow line={line} tokens={tokenLines[lineIndex] || []} key={line.number} />
              ))
            : <PlainLines lines={lines} />}
        </code>
      </pre>
      {highlightError && shikiLanguage && (
        <div className="syntax-highlight-warning" title={highlightError}>
          Syntax colors unavailable. Showing plain C++ source.
        </div>
      )}
    </div>
  );
}
