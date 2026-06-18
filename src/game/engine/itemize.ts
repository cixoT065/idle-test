import type { GameState, Item } from '../types';
import { STAT_KEYS } from '../data/constants';
import { BUILDS, buildWeight, normaliseStatValue } from '../data/builds';

/** Switch the player's build focus (drives auto-equip scoring + reforge bias). */
export function setBuildFocus(state: GameState, focus: string): void {
  if (state.player && BUILDS[focus]) state.player.buildFocus = focus;
}

/**
 * Score an item for a given build focus. Sums every contributing stat (base,
 * bonus, enhancement) plus affixes, each normalised and weighted by the focus.
 * 'balanced' weights everything 1, reproducing the old raw stat-sum behaviour.
 */
export function scoreItemForBuild(item: Item, focusKey: string): number {
  let score = 0;

  for (const key of STAT_KEYS) {
    let val = 0;
    if (typeof item[key] === 'number') val += item[key] as number;
    if (item.bonusStats?.[key]) val += item.bonusStats[key] as number;
    if (item.enhancementBonusStats?.[key]) val += item.enhancementBonusStats[key] as number;
    if (val !== 0) score += normaliseStatValue(key, val) * buildWeight(focusKey, key);
  }

  for (const affix of item.affixes ?? []) {
    score += normaliseStatValue(affix.key, affix.value) * buildWeight(focusKey, affix.key);
  }

  return score;
}
