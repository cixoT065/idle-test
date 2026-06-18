import { useGameStore } from '../store/gameStore';
import { useGame, useTotalStats } from './useGame';
import { tooltipHandlers } from './tooltip';
import { STAT_KEYS, STAT_NAMES, DEF_INVEST_FACTOR } from '../game/data/constants';
import { itemData } from '../game/data/items';
import { getActiveSkills } from '../game/engine';
import { STAT_ICON, SLOT_ICON } from './icons';
import type { StatName } from '../game/types';

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Gear presets for fast farm/boss swapping. */
function LoadoutsPanel() {
  const state = useGame();
  const save = useGameStore((s) => s.saveLoadout);
  const load = useGameStore((s) => s.loadLoadout);
  const del = useGameStore((s) => s.deleteLoadout);
  return (
    <div className="panel">
      <div className="panel-header">Loadouts</div>
      <div className="panel-body" style={{ display: 'grid', gap: 6 }}>
        {state.loadouts.map((l, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <span style={{ flexGrow: 1, color: l ? 'var(--text-color)' : 'var(--disabled-text-color)' }}>{l ? l.name : `Slot ${i + 1} (empty)`}</span>
            {l && <button className="button-secondary" style={{ width: 'auto', margin: 0, padding: '4px 8px' }} onClick={() => load(i)}>Load</button>}
            <button className="button-secondary" style={{ width: 'auto', margin: 0, padding: '4px 8px' }} onClick={() => save(i)}>Save</button>
            {l && <button className="button-danger" style={{ width: 'auto', margin: 0, padding: '4px 8px' }} onClick={() => del(i)}>✕</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sidebar() {
  const state = useGame();
  const stats = useTotalStats();
  const invest = useGameStore((s) => s.invest);
  const unequip = useGameStore((s) => s.unequip);
  const p = state.player;
  if (!p || !stats) return null;

  return (
    <>
      <div className="panel">
        <div className="panel-header">Player Profile</div>
        <div className="panel-body">
          <div id="player-info">
            <div>Name: <span>{p.name}</span></div>
            <div>Class: <span>{p.className}</span></div>
            <div>Level: <span>{p.level}</span></div>
            <div>Stat Points: <span style={{ color: 'var(--gold-color)', fontWeight: 'bold' }}>{p.statPoints}</span></div>
          </div>
          <hr style={{ borderColor: 'var(--border-color)' }} />
          <div>❤️ HP: <span>{Math.ceil(p.currentHp)} / {Math.round(stats.hp)}</span></div>
          <div className="stat-bar"><div className="stat-bar-fill hp" style={{ width: pct(Math.min(1, p.currentHp / stats.hp)) }} /></div>
          <div>✨ XP: <span>{p.xp} / {p.xpToNextLevel}</span></div>
          <div className="stat-bar"><div className="stat-bar-fill xp" style={{ width: pct(Math.min(1, p.xp / p.xpToNextLevel)) }} /></div>
          {state.activeBoosts.xp && (
            <div style={{ color: 'var(--boost-color, #f0a)' }}>
              {state.activeBoosts.xp.multiplier}x XP ({state.activeBoosts.xp.fightsRemaining} fights left)
            </div>
          )}
          <div className="gold-display">🪙 Gold: <span>{state.gold.toLocaleString()}</span>G</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Combat Stats</div>
        <div className="panel-body stats-grid">
          <div>⚔️ ATK: <span>{Math.round(stats.atk)}</span></div>
          <div>🛡️ DEF: <span>{Math.round(stats.def)}</span></div>
          <div>🎯 Accuracy: <span>{pct(stats.accuracy)}</span></div>
          <div>💨 Evasion: <span>{pct(stats.evasion)}</span></div>
          <div>🎲 Crit Chance: <span>{pct(stats.critChance)}</span></div>
          <div>💥 Crit DMG: <span>{pct(stats.critDmg)}</span></div>
          <div>🔮 True DMG: <span>{stats.trueDmgBonusPercent}</span></div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Invest Points</div>
        <div className="panel-body" id="point-investment-display">
          {STAT_KEYS.map((stat: StatName) => {
            const isPct = stat === 'critChance' || stat === 'critDmg';
            const base = p.baseStats[stat] || 0;
            const inv = isPct
              ? p.investedStats[stat] * (stat === 'critChance' ? 0.002 : 0.005)
              : p.investedStats[stat] * (stat === 'def' ? DEF_INVEST_FACTOR : 1);
            const val = base + inv;
            return (
              <div className="point-investment-stat" key={stat}>
                <span className="stat-label">{STAT_ICON[stat]} {STAT_NAMES[stat]}: <span className="stat-value">{isPct ? pct(val) : Math.round(val)}</span></span>
                <div className="investment-controls">
                  <button disabled={p.statPoints <= 0} onClick={() => invest(stat, 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Equipment</div>
        <div className="panel-body" id="equipment-display">
          {itemData.types.map((type) => {
            const item = state.inventory.find((i) => i.id === state.equipment[type]);
            return (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ textTransform: 'capitalize' }}>{SLOT_ICON[type]} {type}:</span>
                {item ? (
                  <span style={{ color: itemData.rarities[item.rarity].color, cursor: 'pointer' }} onClick={() => unequip(type)} title="Click to unequip" {...tooltipHandlers(item, true)}>
                    {item.name}{item.enhancementLevel ? ` +${item.enhancementLevel}` : ''}
                  </span>
                ) : (
                  <span style={{ color: 'var(--disabled-text-color)' }}>(empty)</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <LoadoutsPanel />

      {(() => {
        const skills = getActiveSkills(state);
        if (skills.length === 0) return null;
        const learned = new Set(p.activeSkills);
        return (
          <div className="panel">
            <div className="panel-header">Active Skills</div>
            <div className="panel-body" id="skill-display">
              {skills.map((s) => (
                <div key={s} className="log-skill">
                  {s}{learned.has(s) ? '' : ' (set)'}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </>
  );
}
