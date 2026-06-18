import type { GameState, EngineContext, Item, Rarity } from '../types';
import { getPlayerTotalStats } from './stats';
import { equipItem, sellItems, buyPotion, canChallengeWaveBoss, challengeWaveBoss } from './economy';

export type AutomationKey = 'autoEquip' | 'autoSell' | 'autoBoss' | 'autoPotion';

/** One-time rebirth-point cost to permanently unlock each automation. */
export const AUTOMATION_COSTS: Record<AutomationKey, number> = {
  autoEquip: 2,
  autoSell: 2,
  autoBoss: 3,
  autoPotion: 3,
};

export const AUTOMATION_INFO: Record<AutomationKey, { name: string; desc: string }> = {
  autoEquip: { name: 'Auto-Equip', desc: 'Automatically equips stat upgrades for your class.' },
  autoSell: { name: 'Auto-Sell', desc: 'Automatically sells unequipped drops at or below a chosen rarity.' },
  autoBoss: { name: 'Auto-Boss', desc: 'Automatically challenges the wave boss as soon as it is available.' },
  autoPotion: { name: 'Auto-Potion', desc: 'Automatically quaffs a potion when your HP runs low.' },
};

const RARITY_RANK: Record<Rarity, number> = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4, LR: 5 };

export function buyAutomation(state: GameState, ctx: EngineContext, key: AutomationKey): void {
  if (state.automation.unlocked[key]) return;
  const cost = AUTOMATION_COSTS[key];
  if (state.rebirth.points < cost) {
    ctx.log(`Not enough Rebirth Points (need ${cost}).`, 'log-error', 'event');
    return;
  }
  state.rebirth.points -= cost;
  state.automation.unlocked[key] = true;
  // Enable with a sensible default the moment it is unlocked.
  if (key === 'autoEquip') state.automation.autoEquip = true;
  if (key === 'autoSell') state.automation.autoSellRarity = 'N';
  if (key === 'autoBoss') state.automation.autoBoss = true;
  if (key === 'autoPotion') state.automation.autoPotionPct = 30;
  ctx.log(`Unlocked ${AUTOMATION_INFO[key].name}!`, 'log-system', 'event');
}

function itemScore(it: Item): number {
  let s = 0;
  for (const k of ['str', 'con', 'def', 'dex', 'agl', 'int'] as const) {
    if (typeof it[k] === 'number') s += it[k] as number;
    s += it.enhancementBonusStats?.[k] || 0;
  }
  for (const v of Object.values(it.bonusStats || {})) s += v as number;
  return s;
}

/** Equip the best class-appropriate item in each slot (by raw stat sum). */
function runAutoEquip(state: GameState, ctx: EngineContext): void {
  const cls = state.player?.baseClassName;
  if (!cls) return;
  for (const item of state.inventory) {
    if (item.classReq !== cls) continue;
    const cur = state.inventory.find((i) => i.id === state.equipment[item.type]);
    if (!cur || itemScore(item) > itemScore(cur)) equipItem(state, ctx, item);
  }
}

function runAutoSell(state: GameState, ctx: EngineContext): void {
  const threshold = state.automation.autoSellRarity;
  if (threshold === 'off') return;
  const equipped = new Set(Object.values(state.equipment));
  const max = RARITY_RANK[threshold];
  const ids = state.inventory
    .filter((i) => !equipped.has(i.id) && RARITY_RANK[i.rarity] <= max)
    .map((i) => i.id);
  if (ids.length) sellItems(state, ctx, ids);
}

function runAutoPotion(state: GameState, ctx: EngineContext): void {
  const pct = state.automation.autoPotionPct;
  if (pct <= 0 || !state.player) return;
  const maxHp = getPlayerTotalStats(state).hp;
  if (state.player.currentHp > maxHp * (pct / 100)) return;
  // Buy the largest potion we can afford, biggest first.
  for (const p of [100, 75, 50, 25] as const) {
    if (state.gold >= state.potionCosts[`p${p}` as keyof typeof state.potionCosts]) { buyPotion(state, ctx, p); return; }
  }
}

/** Run all unlocked automations for this tick. Order: equip → sell → potion → boss. */
export function runAutomation(state: GameState, ctx: EngineContext): void {
  const a = state.automation;
  if (!state.player || !state.isRunning) return;
  if (a.unlocked.autoEquip && a.autoEquip) runAutoEquip(state, ctx);
  if (a.unlocked.autoSell) runAutoSell(state, ctx);
  if (a.unlocked.autoPotion) runAutoPotion(state, ctx);
  if (a.unlocked.autoBoss && a.autoBoss && canChallengeWaveBoss(state)) challengeWaveBoss(state, ctx);
}

/** Toggle/adjust an unlocked automation setting (called from the UI). */
export function setAutomation(state: GameState, key: AutomationKey, value: boolean | number | Rarity | 'off'): void {
  const a = state.automation;
  if (!a.unlocked[key]) return;
  if (key === 'autoEquip') a.autoEquip = !!value;
  else if (key === 'autoBoss') a.autoBoss = !!value;
  else if (key === 'autoSell') a.autoSellRarity = value as Rarity | 'off';
  else if (key === 'autoPotion') a.autoPotionPct = Number(value);
}
