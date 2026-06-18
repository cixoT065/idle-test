import type { GameState, EngineContext } from '../types';
import { getPlayerTotalStats } from './stats';
import { generateItemDrop } from './loot';
import { levelUp } from './progression';
import { checkAchievements } from './meta';

export interface OfflineReport {
  seconds: number;
  kills: number;
  gold: number;
  xp: number;
  levels: number;
  drops: number;
}

/** Idle earnings are capped and discounted so active play stays worthwhile. */
const MAX_OFFLINE_SECONDS = 12 * 3600;
const OFFLINE_EFFICIENCY = 0.6;

/** Estimated damage the player lands per tick against the current monster. */
function estimatePlayerDamage(state: GameState): number {
  const s = getPlayerTotalStats(state);
  const m = state.currentMonster!;
  const hitChance = Math.max(0.25, Math.min(0.95, 0.9 + (s.accuracy as number) - m.evasion));
  const critFactor = 1 + s.critChance * (s.critDmg - 1);
  const trueDmg = s.atk * s.trueDmgBonus;
  const normalAtk = s.atk - trueDmg;
  const dr = 1 - m.def / (m.def + 100 + normalAtk / 10);
  return Math.max(1, hitChance * critFactor * (normalAtk * dr + trueDmg));
}

/**
 * Award estimated idle earnings for time spent away. Approximates kills from the
 * player's damage vs the current monster (no wave advancement), then grants gold,
 * XP (with level-ups), and a capped handful of drops. Returns null for brief gaps.
 */
export function applyOfflineProgress(state: GameState, ctx: EngineContext, elapsedMs: number): OfflineReport | null {
  if (!state.player || !state.currentMonster) return null;
  let seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 60) return null;
  seconds = Math.min(seconds, MAX_OFFLINE_SECONDS);
  const effSeconds = Math.floor(seconds * OFFLINE_EFFICIENCY);

  const m = state.currentMonster;
  const dmg = estimatePlayerDamage(state);
  const ticksPerKill = Math.max(1, Math.ceil(m.maxHp / dmg) + 1);
  const kills = Math.floor(effSeconds / ticksPerKill);
  if (kills <= 0) return null;

  const gold = Math.round(kills * m.gold * (1 + state.rebirth.bonuses.gold));
  const xp = Math.round(kills * m.xp * (1 + state.rebirth.bonuses.xp));

  state.gold += gold;
  state.stats.totalGoldEarned += gold;
  state.player.xp += xp;
  state.kills += kills;
  state.stats.totalKills += kills;

  const startLevel = state.player.level;
  while (state.player.xp >= state.player.xpToNextLevel) levelUp(state, ctx);
  const levels = state.player.level - startLevel;

  // Roll a modest, inventory-capped number of drops (quietly — the modal sums up).
  const quiet: EngineContext = { ...ctx, log: () => {} };
  const space = state.maxInventorySize - state.inventory.length;
  const toRoll = Math.min(Math.max(0, space), 15, Math.floor(kills * (m.dropChance ?? 0) * 0.5));
  let drops = 0;
  for (let i = 0; i < toRoll; i++) { generateItemDrop(state, quiet, m); drops++; }

  checkAchievements(state, ctx);
  state.player.currentHp = getPlayerTotalStats(state).hp;
  return { seconds, kills, gold, xp, levels, drops };
}
