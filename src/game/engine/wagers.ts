import type { GameState, EngineContext, Monster } from '../types';
import { WAGERS } from '../data/wagers';

/** Toggle a wager in the player's pre-boss selection (a persisted preference). */
export function toggleWager(state: GameState, key: string): void {
  if (!WAGERS[key]) return;
  const i = state.wagers.indexOf(key);
  if (i === -1) state.wagers.push(key);
  else state.wagers.splice(i, 1);
}

/**
 * Lock the currently-selected wagers onto a freshly-spawned boss and apply their
 * difficulty modifiers. Called from the boss-spawn paths only.
 */
export function applyWagersToBoss(state: GameState, ctx: EngineContext, monster: Monster): void {
  const keys = state.wagers.filter((k) => WAGERS[k]);
  if (keys.length === 0) return;
  monster.wagers = [...keys];

  for (const key of keys) {
    const w = WAGERS[key];
    if (w.bossAtkMult) monster.atk = Math.round(monster.atk * w.bossAtkMult);
    if (w.bossHpMult) { monster.hp = Math.round(monster.hp * w.bossHpMult); monster.maxHp = Math.round(monster.maxHp * w.bossHpMult); }
    if (w.bossEvasionAdd) monster.evasion += w.bossEvasionAdd;
  }
  const names = keys.map((k) => `${WAGERS[k].icon} ${WAGERS[k].name}`).join(', ');
  ctx.log(`Wagers accepted: ${names}. Greater risk, greater spoils!`, 'log-boost', 'event');
}

/** Combined gold/xp multipliers and bonus-drop count from a boss's locked wagers. */
export function getWagerRewards(monster: Monster | null): { goldMult: number; xpMult: number; bonusDrops: number } {
  let goldMult = 1, xpMult = 1, bonusDrops = 0;
  for (const key of monster?.wagers ?? []) {
    const w = WAGERS[key];
    if (!w) continue;
    if (w.goldMult) goldMult *= w.goldMult;
    if (w.xpMult) xpMult *= w.xpMult;
    if (w.bonusDrops) bonusDrops += w.bonusDrops;
  }
  return { goldMult, xpMult, bonusDrops };
}
