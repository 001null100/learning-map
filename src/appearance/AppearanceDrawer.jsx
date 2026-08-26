import { useEffect } from 'react';

const THEMES = [
  { id: 'midnight', name: 'Midnight', note: 'Deep navy, violet and cool cyan.', swatches: ['#0a0d12', '#171d28', '#9b8cff', '#72d4ff'] },
  { id: 'aurora', name: 'Aurora', note: 'Blue-black with mint and electric teal.', swatches: ['#071110', '#10201f', '#68dfc2', '#77b7ff'] },
  { id: 'ember', name: 'Ember', note: 'Charcoal plum with warm coral highlights.', swatches: ['#120b0f', '#24141a', '#ff8b7a', '#e0a2ff'] },
  { id: 'graphite', name: 'Graphite', note: 'Neutral charcoal with crisp icy accents.', swatches: ['#0c0d0f', '#1a1c20', '#d1d7e0', '#8db7ff'] },
];

const ACCENTS = [
  ['theme', 'Theme'], ['violet', 'Violet'], ['cyan', 'Cyan'], ['mint', 'Mint'], ['rose', 'Rose'], ['amber', 'Amber'],
];

function Segment({ value, options, onChange, label }) {
  return (
    <div className="settings-control">
      <span className="settings-label">{label}</span>
      <div className="segmented-control">
        {options.map(([id, text]) => (
          <button key={id} type="button" className={value === id ? 'active' : ''} onClick={() => onChange(id)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, title, note }) {
  return (
    <button type="button" className="toggle-row" onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span><strong>{title}</strong>{note && <small>{note}</small>}</span>
      <span className={`toggle-switch ${checked ? 'on' : ''}`} aria-hidden="true"><i /></span>
    </button>
  );
}

export default function AppearanceDrawer({ open, appearance, updateAppearance, resetAppearance, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-label="Appearance settings">
        <header className="settings-head">
          <div>
            <p className="panel-eyebrow">Local configuration</p>
            <h2>Appearance</h2>
            <p>These settings live only in this browser. Project data is untouched.</p>
          </div>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings">×</button>
        </header>

        <div className="settings-scroll">
          <section className="settings-section">
            <div className="settings-section-title"><h3>Theme</h3><small>Base atmosphere</small></div>
            <div className="theme-grid">
              {THEMES.map((theme) => (
                <button key={theme.id} type="button" className={`theme-card ${appearance.theme === theme.id ? 'active' : ''}`} onClick={() => updateAppearance('theme', theme.id)}>
                  <span className="theme-swatches">{theme.swatches.map((color) => <i key={color} style={{ background: color }} />)}</span>
                  <strong>{theme.name}</strong>
                  <small>{theme.note}</small>
                </button>
              ))}
            </div>
            <div className="accent-picker">
              <span className="settings-label">Accent</span>
              <div className="accent-options">
                {ACCENTS.map(([id, label]) => (
                  <button key={id} type="button" className={`accent-${id} ${appearance.accent === id ? 'active' : ''}`} onClick={() => updateAppearance('accent', id)} title={label}>
                    <span aria-hidden="true" /><em>{label}</em>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-title"><h3>Interface</h3><small>Spacing and readability</small></div>
            <Segment
              label="Interface scale"
              value={appearance.interfaceScale || '100'}
              options={[["90", "90%"], ["100", "100%"], ["115", "115%"], ["130", "130%"]]}
              onChange={(value) => updateAppearance('interfaceScale', value)}
            />
            <Segment label="Density" value={appearance.density} options={[["comfortable", "Comfortable"], ["compact", "Compact"]]} onChange={(value) => updateAppearance('density', value)} />
            <Toggle checked={appearance.glass} onChange={(value) => updateAppearance('glass', value)} title="Glass surfaces" note="Adds gentle translucency and backdrop blur to chrome." />
          </section>

          <section className="settings-section">
            <div className="settings-section-title"><h3>Graph</h3><small>Canvas presentation</small></div>
            <Segment label="Background" value={appearance.graphPattern} options={[["dots", "Dots"], ["grid", "Grid"], ["cross", "Cross"], ["none", "None"]]} onChange={(value) => updateAppearance('graphPattern', value)} />
            <Toggle checked={appearance.showMinimap} onChange={(value) => updateAppearance('showMinimap', value)} title="Minimap" note="Show the overview map in the lower corner." />
            <Toggle checked={appearance.edgeMotion} onChange={(value) => updateAppearance('edgeMotion', value)} title="Flow animation" note="Animate process, execution and data-flow edges." />
          </section>

          <section className="settings-section">
            <div className="settings-section-title"><h3>Effects</h3><small>Atmosphere without fireworks</small></div>
            <Segment label="Motion" value={appearance.motion} options={[["system", "System"], ["full", "Full"], ["reduced", "Reduced"]]} onChange={(value) => updateAppearance('motion', value)} />
            <Toggle checked={appearance.ambientGlow} onChange={(value) => updateAppearance('ambientGlow', value)} title="Ambient glow" note="Adds low-contrast color bloom behind the workspace." />
            <Toggle checked={appearance.pointerGlow} onChange={(value) => updateAppearance('pointerGlow', value)} title="Pointer light" note="A very soft local highlight follows the pointer." />
          </section>

          <section className="settings-section settings-shortcuts">
            <div className="settings-section-title"><h3>Shortcuts</h3><small>Quick escape hatches</small></div>
            <div><span>Focus mode</span><kbd>F</kbd></div>
            <div><span>Appearance</span><kbd>Ctrl</kbd><span>+</span><kbd>,</kbd></div>
            <div><span>Leave focus / close panel</span><kbd>Esc</kbd></div>
          </section>
        </div>

        <footer className="settings-footer">
          <button type="button" onClick={resetAppearance}>Reset appearance</button>
          <span>Learning Map v2.5</span>
        </footer>
      </aside>
    </div>
  );
}
