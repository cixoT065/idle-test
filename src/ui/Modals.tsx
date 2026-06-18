import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useGame } from './useGame';
import { classes, promotionInfo } from '../game/data/classes';
import { promotionSkills } from '../game/data/skills';
import type { BaseClassName } from '../game/types';

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

/** Shown on load when the player earned idle progress while away. */
export function OfflineModal() {
  const report = useGameStore((s) => s.offlineReport);
  const dismiss = useGameStore((s) => s.dismissOffline);
  if (!report) return null;
  return (
    <div className="modal" style={{ display: 'flex' }}>
      <div className="modal-content">
        <h2>Welcome back!</h2>
        <p>While you were away for <strong>{fmtDuration(report.seconds)}</strong>, your hero kept fighting:</p>
        <div className="offline-grid">
          <div><span>⚔️ Kills</span><strong>{report.kills.toLocaleString()}</strong></div>
          <div><span>🪙 Gold</span><strong>{report.gold.toLocaleString()}</strong></div>
          <div><span>✨ XP</span><strong>{report.xp.toLocaleString()}</strong></div>
          <div><span>⬆️ Levels</span><strong>{report.levels}</strong></div>
          <div><span>🎁 Drops</span><strong>{report.drops}</strong></div>
        </div>
        <p style={{ color: 'var(--muted-color)', fontSize: 12 }}>Idle earnings run at 60% efficiency, capped at 12 hours.</p>
        <button className="button" onClick={dismiss}>Collect</button>
      </div>
    </div>
  );
}

/** Brief gold screen flash when a legendary (LR) item drops. */
export function LrFlash() {
  const lrFlash = useGameStore((s) => s.lrFlash);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (lrFlash === 0) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 900);
    return () => clearTimeout(t);
  }, [lrFlash]);
  if (!on) return null;
  return <div className="lr-flash" />;
}

export function ClassSelectionModal() {
  const hasPlayer = useGameStore((s) => s.hasPlayer);
  const choose = useGameStore((s) => s.chooseClass);
  const [selected, setSelected] = useState<BaseClassName | null>(null);
  if (hasPlayer) return null;

  return (
    <div className="modal" style={{ display: 'flex' }}>
      <div className="modal-content">
        <h2>Choose Your Class</h2>
        <div className="modal-choices">
          {(Object.keys(classes) as BaseClassName[]).map((c) => (
            <button key={c} className={selected === c ? 'selected' : ''} onClick={() => setSelected(c)}>{c}</button>
          ))}
        </div>
        <p className="modal-description">{selected ? classes[selected].description : 'Select a class to learn more.'}</p>
        <div className="modal-footer-confirm">
          <button disabled={!selected} onClick={() => selected && choose(selected)}>Confirm Selection</button>
        </div>
      </div>
    </div>
  );
}

export function PromotionModal() {
  const state = useGame();
  const choosePromotion = useGameStore((s) => s.choosePromotion);
  const [selected, setSelected] = useState<string | null>(null);
  const choices = state.player?.promotionPending ? state.player.pendingPromotionChoices : null;
  if (!choices) return null;

  const skill = selected ? promotionSkills[selected] : null;
  return (
    <div className="modal" style={{ display: 'flex' }}>
      <div className="modal-content">
        <h2>Class Promotion!</h2>
        <p>You have reached a new milestone. Choose your path:</p>
        <div className="modal-choices">
          {choices.map((c) => (
            <button key={c} className={selected === c ? 'selected' : ''} onClick={() => setSelected(c)}>{c}</button>
          ))}
        </div>
        <p className="modal-description">
          {selected ? promotionInfo[selected]?.description : 'Select a promotion to learn more.'}
          {skill && <><br /><br /><strong>New Skill: {skill.name}</strong> — <em>{skill.description}</em></>}
        </p>
        <div className="modal-footer-confirm">
          <button disabled={!selected} onClick={() => { if (selected) { choosePromotion(selected); setSelected(null); } }}>Confirm Promotion</button>
        </div>
      </div>
    </div>
  );
}

export function GameWonModal() {
  const gameWon = useGameStore((s) => s.gameWon);
  const state = useGame();
  if (!gameWon) return null;
  return (
    <div className="modal" style={{ display: 'flex' }}>
      <div className="modal-content win-screen">
        <h1>Congratulations!</h1>
        <p>You have defeated The Chronos Tyrant and conquered the game!</p>
        <p>Accomplished after {state.rebirth.points} rebirth points earned.</p>
        <button className="button" onClick={() => location.reload()}>Continue</button>
      </div>
    </div>
  );
}
