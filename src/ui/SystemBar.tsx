import { useState } from 'react';
import { useGameStore, persistGame, disablePersistence } from '../store/gameStore';
import { useGame } from './useGame';
import { saveManager } from '../game/save';
import { AuthBar } from './AuthBar';
import { InfoModal } from './InfoModal';

export function SystemBar() {
  const state = useGame();
  const exportSaveCode = useGameStore((s) => s.exportSaveCode);
  const importSaveCode = useGameStore((s) => s.importSaveCode);
  const rebirthRun = useGameStore((s) => s.rebirthRun);
  const [exportCode, setExportCode] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const canRebirth = (state.player?.level ?? 0) >= 70;

  return (
    <div className="panel">
      <div className="panel-header">System</div>
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AuthBar />
        <button onClick={() => setShowInfo(true)}>Game Info</button>
        <button onClick={() => { void persistGame(); setExportCode(exportSaveCode()); }}>Export Save</button>
        <button onClick={() => { const code = prompt('Paste your save code:'); if (code) importSaveCode(code); }}>Import Save</button>
        <button onClick={() => void persistGame()}>Save Now</button>
        <hr style={{ borderColor: 'var(--border-color)' }} />
        <button
          className="button-danger"
          onClick={async () => { if (confirm('Erase ALL progress and start over?')) { disablePersistence(); await saveManager.clear(); location.reload(); } }}
        >
          New Game
        </button>
        <button
          className="button-danger"
          disabled={!canRebirth}
          title={canRebirth ? 'Reborn to gain Rebirth Points' : 'Requires level 70'}
          onClick={() => { if (confirm('Rebirth now? You restart at level 1 but keep Rebirth bonuses.')) rebirthRun(); }}
        >
          Rebirth
        </button>

        {exportCode && (
          <div className="modal" style={{ display: 'flex' }} onClick={() => setExportCode(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Game Saved!</h2>
              <p>Copy this code and keep it safe. Use Import Save to restore.</p>
              <textarea readOnly value={exportCode} onFocus={(e) => e.target.select()} style={{ width: '100%', height: 120 }} />
              <button onClick={() => setExportCode(null)}>Close</button>
            </div>
          </div>
        )}
        {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      </div>
    </div>
  );
}
