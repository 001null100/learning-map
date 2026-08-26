import { useEffect, useMemo, useState } from 'react';
import { createHighlighter } from 'shiki';
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

function PlainLines({ lines }) {
  return lines.map((line) => (
    <span className="source-line" key={line.number}>
      <b>{line.number}</b><span className="syntax-line">{line.text || ' '}</span>{'\n'}
    </span>
  ));
}

export default function SyntaxCode({ lines, language, path }) {
  const { appearance } = useAppearance();
  const codeTheme = appearance.codeTheme || 'cyberpunk';
  const theme = CODE_THEMES[codeTheme] || CODE_THEMES.cyberpunk;
  const shikiLanguage = normalizeLanguage(language, path);
  const sourceText = useMemo(() => (lines || []).map((line) => line.text).join('\n'), [lines]);
  const [tokenLines, setTokenLines] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTokenLines(null);
    setFailed(false);

    if (!shikiLanguage || !sourceText) return undefined;

    getHighlighter()
      .then((highlighter) => highlighter.codeToTokens(sourceText, {
        lang: shikiLanguage,
        theme: theme.shiki,
      }))
      .then((result) => {
        if (!cancelled) setTokenLines(result.tokens || null);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => { cancelled = true; };
  }, [sourceText, shikiLanguage, theme.shiki]);

  return (
    <pre
      className={`source-excerpt live-source syntax-code syntax-theme-${codeTheme}`}
      aria-busy={Boolean(shikiLanguage && !tokenLines && !failed)}
      data-language={shikiLanguage || 'plain'}
    >
      <code>
        {tokenLines
          ? lines.map((line, lineIndex) => (
              <span className="source-line" key={line.number}>
                <b>{line.number}</b>
                <span className="syntax-line">
                  {(tokenLines[lineIndex] || []).map((token, tokenIndex) => (
                    <span key={`${line.number}-${tokenIndex}`} style={tokenStyle(token)}>{token.content}</span>
                  ))}
                  {!tokenLines[lineIndex]?.length && ' '}
                </span>
                {'\n'}
              </span>
            ))
          : <PlainLines lines={lines} />}
      </code>
    </pre>
  );
}
