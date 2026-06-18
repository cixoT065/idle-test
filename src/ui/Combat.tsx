import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { useGame } from './useGame';
import { canChallengeWaveBoss } from '../game/engine';
import { CombatArena } from './CombatArena';
import { MODIFIER_ICON } from './icons';
import type { LogEntry } from '../game/types';

function LogList({ title, entries }: { title: string; entries: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries]);
  return (
    <div className="panel" style={{ flexGrow: 1 }}>
      <div className="panel-header">{title}</div>
      <div className="panel-body activity-log-container" ref={ref}>
        {entries.map((e, i) => (
          <div key={i} className={e.className} dangerouslySetInnerHTML={{ __html: e.message }} />
        ))}
      </div>
    </div>
  );
}

export function CombatPanel() {
  const state = useGame();
  const challengeBoss = useGameStore((s) => s.challengeBoss);
  const challengeFinal = useGameStore((s) => s.challengeFinal);
  const m = state.currentMonster;
  const finalBossActive = !!(m as { isFinalBoss?: boolean })?.isFinalBoss;
  // The final boss is opt-in: challengeable any time you're not already in a boss
  // fight. Clearing wave bosses first weakens it (resets each run / on rebirth).
  const inBossFight = m?.monsterType === 'boss' || finalBossActive;
  const finalBossAvailable = !!state.player && !state.finalBossDefeated && !inBossFight;
  const finalBossPower = Math.round(Math.max(0.1, 1 - state.totalBossesDefeatedInRun * 0.025) * 100);
  const phase = m?.phase ?? 0;
  const phaseLabel = phase >= 2 ? 'FRENZIED' : phase >= 1 ? 'ENRAGED' : null;

  return (
    <div className="panel monster-area">
      <div className="panel-body">
        <CombatArena />
        {/* Fixed-height rows so spawning/affixes/phases never reflow the panels below. */}
        <div className="combat-modifiers">
          {m?.modifiers?.map((mod) => (
            <span key={mod} className="combat-modifier log-monster">{MODIFIER_ICON[mod] ?? ''} {mod}</span>
          ))}
        </div>
        <div className="combat-phase">
          {phaseLabel && <span className="log-error" style={{ fontWeight: 'bold' }}>⚠ {phaseLabel}</span>}
        </div>
        <div className="combat-readout">
          HP: <span>{m ? `${Math.max(0, Math.ceil(m.hp))} / ${m.maxHp}` : '—'}</span> DEF: <span>{m ? Math.round(m.def) : '—'}</span> ATK: <span>{m ? Math.round(m.atk) : '—'}</span>
        </div>
        <div className="stat-bar">
          <div className="stat-bar-fill enemy" style={{ width: m ? `${Math.max(0, Math.min(100, (m.hp / m.maxHp) * 100))}%` : '0%' }} />
        </div>
        {(m as { isChampion?: boolean })?.isChampion && (
          <div className="combat-phase"><span className="champion-banner">⭐ CHAMPION — rich loot guaranteed</span></div>
        )}
        <div className="combat-readout">Wave: <span>{state.wave}</span> | Kills: <span>{state.kills}</span>{state.killStreak > 4 ? <> | Streak: <span style={{ color: '#ff8a4a' }}>🔥{state.killStreak}</span></> : null}</div>
        <button disabled={!canChallengeWaveBoss(state)} onClick={challengeBoss}>Challenge Boss</button>
        {!state.finalBossDefeated && (
          <button className="button-final-boss" disabled={!finalBossAvailable} onClick={challengeFinal}>
            Challenge Final Boss — {finalBossPower}% power
          </button>
        )}
      </div>
    </div>
  );
}

export function LogPanels() {
  const eventLog = useGameStore((s) => s.eventLog);
  const battleLog = useGameStore((s) => s.battleLog);
  return (
    <div className="log-area-container">
      <LogList title="Event Log" entries={eventLog} />
      <LogList title="Battle Log" entries={battleLog} />
    </div>
  );
}
