import { useGame } from './useGame';

/** Persistent app header with branding and at-a-glance run stats. */
export function TopBar() {
  const state = useGame();
  const p = state.player;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">⚔</span>
        Idle&nbsp;RPG <span className="brand-accent">Evolved</span>
      </div>
      {p && (
        <div className="topbar-stats">
          <div className="tb-stat">
            <label>Class</label>
            <span>{p.className}</span>
          </div>
          <div className="tb-stat">
            <label>Level</label>
            <span>{p.level}</span>
          </div>
          <div className="tb-stat">
            <label>Wave</label>
            <span>{state.wave}</span>
          </div>
          {state.killStreak > 4 && (
            <div className="tb-stat">
              <label>Streak</label>
              <span style={{ color: '#ff8a4a' }}>🔥{state.killStreak}</span>
            </div>
          )}
          <div className="tb-stat gold">
            <label>Gold</label>
            <span>{state.gold.toLocaleString()}</span>
          </div>
        </div>
      )}
    </header>
  );
}
