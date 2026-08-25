import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import SettingsPanel from './SettingsPanel.jsx';

const STORAGE_KEY = 'learning-map-appearance-v1';

export const DEFAULT_APPEARANCE = {
  theme: 'midnight',
  accent: 'theme',
  density: 'comfortable',
  motion: 'system',
  ambientGlow: true,
  pointerGlow: true,
  glass: true,
  graphPattern: 'dots',
  showMinimap: true,
  edgeMotion: false,
};

const AppearanceContext = createContext({
  appearance: DEFAULT_APPEARANCE,
  setAppearance: () => {},
  updateAppearance: () => {},
  resetAppearance: () => {},
  settingsOpen: false,
  setSettingsOpen: () => {},
  focusMode: false,
  setFocusMode: () => {},
});

function readStoredAppearance() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return { ...DEFAULT_APPEARANCE, ...(parsed || {}) };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function applyRootAttributes(appearance, focusMode) {
  const root = document.documentElement;
  root.dataset.lmTheme = appearance.theme;
  root.dataset.lmAccent = appearance.accent;
  root.dataset.lmDensity = appearance.density;
  root.dataset.lmMotion = appearance.motion;
  root.dataset.lmGlass = appearance.glass ? 'on' : 'off';
  root.dataset.lmAmbient = appearance.ambientGlow ? 'on' : 'off';
  root.dataset.lmPointer = appearance.pointerGlow ? 'on' : 'off';
  root.classList.toggle('lm-focus-mode', focusMode);
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches('input, textarea, select, [contenteditable="true"]');
}

export function AppearanceProvider({ children }) {
  const [appearance, setAppearance] = useState(readStoredAppearance);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const updateAppearance = (key, value) => setAppearance((current) => ({ ...current, [key]: value }));
  const resetAppearance = () => setAppearance(DEFAULT_APPEARANCE);

  useEffect(() => {
    applyRootAttributes(appearance, focusMode);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance)); } catch { /* local preference persistence is optional */ }
  }, [appearance, focusMode]);

  useEffect(() => {
    if (!appearance.pointerGlow || appearance.motion === 'reduced') return undefined;
    let raf = 0;
    const move = (event) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const root = document.documentElement;
        root.style.setProperty('--pointer-x', `${event.clientX}px`);
        root.style.setProperty('--pointer-y', `${event.clientY}px`);
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [appearance.pointerGlow, appearance.motion]);

  useEffect(() => {
    const keydown = (event) => {
      if (isTypingTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault();
        setSettingsOpen((value) => !value);
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setFocusMode((value) => !value);
      }
      if (event.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false);
        else if (focusMode) setFocusMode(false);
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [settingsOpen, focusMode]);

  const value = useMemo(() => ({
    appearance,
    setAppearance,
    updateAppearance,
    resetAppearance,
    settingsOpen,
    setSettingsOpen,
    focusMode,
    setFocusMode,
  }), [appearance, settingsOpen, focusMode]);

  return (
    <AppearanceContext.Provider value={value}>
      {children}
      <div className="appearance-dock" aria-label="View controls">
        <button
          type="button"
          className={focusMode ? 'active' : ''}
          onClick={() => setFocusMode((current) => !current)}
          title="Focus mode (F)"
        >
          <span aria-hidden="true">⌗</span><em>Focus</em>
        </button>
        <button
          type="button"
          className={settingsOpen ? 'active' : ''}
          onClick={() => setSettingsOpen(true)}
          title="Appearance settings (Ctrl+,)"
        >
          <span aria-hidden="true">⚙</span><em>Style</em>
        </button>
      </div>
      <SettingsPanel
        open={settingsOpen}
        appearance={appearance}
        updateAppearance={updateAppearance}
        resetAppearance={resetAppearance}
        onClose={() => setSettingsOpen(false)}
      />
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
