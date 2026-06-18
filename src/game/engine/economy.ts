import type { GameState, EngineContext, Item, ItemType, Rarity, StatName } from '../types';
import { itemData, affixPool, AFFIX_COUNT } from '../data/items';
import { buildAffixWeights } from '../data/builds';
import { getPlayerTotalStats } from './stats';
import { spawnMonster, rollAffixes } from './loot';
import { checkAchievements, trackDaily } from './meta';

const MAX_ENHANCEMENT = 10;

/** Base gold cost of a reforge before rarity/repeat multipliers. */
const REFORGE_BASE_COST = 250;

export function equipItem(state: GameState, ctx: EngineContext, item: Item): void {
  if (item.classReq !== state.player!.baseClassName) {
    ctx.log(`Cannot equip: Requires ${item.classReq} class.`, 'log-error', 'event');
    return;
  }
  state.equipment[item.type] = item.id;
  ctx.log(`Equipped <span style="color:${itemData.rarities[item.rarity].color};">${item.name}</span>.`, 'log-system', 'event');
}

export function unequipItem(state: GameState, ctx: EngineContext, itemType: ItemType): void {
  const item = state.inventory.find((i) => i.id === state.equipment[itemType]);
  state.equipment[itemType] = null;
  if (item) ctx.log(`Unequipped <span style="color:${itemData.rarities[item.rarity].color};">${item.name}</span>.`, 'log-system', 'event');
}

export function sellItem(state: GameState, ctx: EngineContext, itemId: number): void {
  const idx = state.inventory.findIndex((i) => i.id === itemId);
  if (idx === -1) return;
  const item = state.inventory[idx];
  if (Object.values(state.equipment).includes(item.id)) {
    ctx.log('Cannot sell an equipped item.', 'log-error', 'event');
    return;
  }
  const sellValue = itemData.rarities[item.rarity].value;
  state.gold += sellValue;
  ctx.log(`Sold ${item.name} for ${sellValue}G.`, 'log-system', 'event');
  state.inventory.splice(idx, 1);
}

export function sellByRarity(state: GameState, ctx: EngineContext, rarity: Rarity): void {
  const equippedIds = Object.values(state.equipment);
  const ids = state.inventory.filter((i) => i.rarity === rarity && !equippedIds.includes(i.id)).map((i) => i.id);
  if (ids.length === 0) {
    ctx.log(`No unequipped [${rarity}] items to sell.`, 'log-system', 'event');
    return;
  }
  sellItems(state, ctx, ids);
}

/** Sell a batch of items by id. Skips equipped items; logs a single summary. */
export function sellItems(state: GameState, ctx: EngineContext, itemIds: number[]): void {
  const equippedIds = Object.values(state.equipment);
  const idSet = new Set(itemIds);
  const itemsToSell = state.inventory.filter((i) => idSet.has(i.id) && !equippedIds.includes(i.id));
  if (itemsToSell.length === 0) {
    ctx.log('No unequipped items to sell.', 'log-system', 'event');
    return;
  }
  const sellIds = new Set(itemsToSell.map((i) => i.id));
  const totalValue = itemsToSell.reduce((sum, i) => sum + itemData.rarities[i.rarity].value, 0);
  state.gold += totalValue;
  state.inventory = state.inventory.filter((i) => !sellIds.has(i.id));
  ctx.log(`Sold ${itemsToSell.length} item${itemsToSell.length === 1 ? '' : 's'} for ${totalValue}G.`, 'log-system', 'event');
}

export function buyPotion(state: GameState, ctx: EngineContext, percent: 25 | 50 | 75 | 100): void {
  const cost = state.potionCosts[`p${percent}` as keyof typeof state.potionCosts];
  if (state.gold < cost) return;
  const totalStats = getPlayerTotalStats(state);
  const healAmount = Math.round(totalStats.hp * (percent / 100));
  state.player!.currentHp = Math.min(totalStats.hp, state.player!.currentHp + healAmount);
  state.gold -= cost;
  ctx.log(`Used a potion, healing for ${healAmount} HP.`, 'log-system', 'event');
}

export function buyXpBoost(state: GameState, ctx: EngineContext, multiplier: 2 | 3): void {
  const cost = multiplier === 2 ? 250 * state.wave : 600 * state.wave;
  if (state.gold >= cost && !state.activeBoosts.xp) {
    state.gold -= cost;
    state.activeBoosts.xp = { multiplier, fightsRemaining: 100 };
    ctx.log(`Purchased a ${multiplier}x XP Boost!`, 'log-boost', 'event');
  }
}

export function getEnhancementCost(item: Item | undefined): number {
  if (!item) return 0;
  const baseCost = 50;
  const rarityMod = itemData.rarities[item.rarity].enhanceCostMod;
  const levelMod = Math.pow(1.4, item.enhancementLevel || 0);
  return Math.round(baseCost * rarityMod * levelMod);
}

export function getEnhanceableStats(item: Item): StatName[] {
  const pool: StatName[] = [];
  for (const stat of Object.keys(item)) {
    if ((['str', 'con', 'def', 'dex', 'agl', 'int', 'critChance', 'critDmg'] as string[]).includes(stat) && typeof item[stat] === 'number') {
      pool.push(stat as StatName);
    }
  }
  return pool;
}

export function enhanceItem(state: GameState, ctx: EngineContext, itemId: number): void {
  const item = state.inventory.find((i) => i.id === itemId);
  if (!item) return;
  const currentLevel = item.enhancementLevel || 0;
  if (currentLevel >= MAX_ENHANCEMENT) {
    ctx.log('This item is already at max enhancement level.', 'log-error', 'event');
    return;
  }
  const cost = getEnhancementCost(item);
  if (state.gold < cost) {
    ctx.log('Not enough gold to enhance.', 'log-error', 'event');
    return;
  }
  const statPool = getEnhanceableStats(item);
  if (statPool.length === 0) {
    ctx.log('This item has no stats to enhance.', 'log-error', 'event');
    return;
  }

  state.gold -= cost;
  const statToEnhance = statPool[Math.floor(ctx.rng() * statPool.length)];
  let increase: number;
  let isPercent = false;
  if (statToEnhance === 'critChance') {
    increase = 0.003;
    isPercent = true;
  } else if (statToEnhance === 'critDmg') {
    increase = 0.01;
    isPercent = true;
  } else {
    const baseValue = (item[statToEnhance] as number) || 0;
    increase = 1 + Math.round(baseValue * 0.1);
  }
  item.enhancementBonusStats[statToEnhance] = (item.enhancementBonusStats[statToEnhance] || 0) + increase;
  item.enhancementLevel = currentLevel + 1;
  state.playerTemp.lastEnhancementResult = { stat: statToEnhance };
  state.stats.enhancements++;
  trackDaily(state, 'enhance', 1);
  checkAchievements(state, ctx);

  const displayIncrease = isPercent ? `${(increase * 100).toFixed(1)}%` : `+${increase}`;
  ctx.log(`Successfully enhanced <span style="color:${itemData.rarities[item.rarity].color};">${item.name}</span>! ${statToEnhance} increased by ${displayIncrease}.`, 'log-system', 'event');
}

/** Only SR+ gear carries affixes, so only those can be reforged. */
export function canReforgeItem(item: Item | undefined): boolean {
  return !!item && AFFIX_COUNT[item.rarity] > 0;
}

/**
 * Gold cost to reroll an item's affixes. Scales with rarity (rich items cost
 * more) and with how many times it has already been reforged (1.35x each), so
 * chasing a perfect roll is a deep, ever-rising gold sink rather than a flat fee.
 */
export function getReforgeCost(item: Item | undefined): number {
  if (!item) return 0;
  const rarityMod = itemData.rarities[item.rarity].enhanceCostMod;
  const repeatMod = Math.pow(1.35, item.reforges ?? 0);
  return Math.round(REFORGE_BASE_COST * rarityMod * repeatMod);
}

const affixLabel = (key: string): string => affixPool.find((a) => a.key === key)?.label ?? key;

/** Reroll an item's affixes for gold — the forge "gamble". Base/bonus stats and
 *  enhancement are untouched; only the special modifiers (lifesteal/%HP/…) change. */
export function reforgeItem(state: GameState, ctx: EngineContext, itemId: number): void {
  const item = state.inventory.find((i) => i.id === itemId);
  if (!item) return;
  if (!canReforgeItem(item)) {
    ctx.log('Only SR+ items (which carry affixes) can be reforged.', 'log-error', 'event');
    return;
  }
  const cost = getReforgeCost(item);
  if (state.gold < cost) {
    ctx.log('Not enough gold to reforge.', 'log-error', 'event');
    return;
  }

  state.gold -= cost;
  // Bias the reroll toward the player's build focus, so reforging is a tool to
  // shape gear toward your archetype rather than a pure coin-flip.
  const focusWeights = buildAffixWeights(state.player?.buildFocus ?? 'balanced');
  item.affixes = rollAffixes(item.rarity, ctx.rng, focusWeights);
  item.reforges = (item.reforges ?? 0) + 1;

  const rolled = item.affixes.map((a) => `${affixLabel(a.key)} +${(a.value * 100).toFixed(1)}%`).join(', ');
  ctx.log(
    `Reforged <span style="color:${itemData.rarities[item.rarity].color};">${item.name}</span> → ${rolled || 'no affixes'}.`,
    'log-system',
    'event',
  );
}

/** Directly invest a single stat point (simplified from the legacy stage/confirm flow). */
export function investStat(state: GameState, stat: StatName, amount: number): void {
  const p = state.player;
  if (!p) return;
  if (amount > 0 && p.statPoints >= amount) {
    p.investedStats[stat] += amount;
    p.statPoints -= amount;
  }
}

export function spendRebirthPoint(state: GameState, stat: keyof GameState['rebirth']['bonuses']): void {
  if (state.rebirth.points > 0) {
    state.rebirth.points--;
    state.rebirth.bonuses[stat] += 0.1;
  }
}

export function canChallengeWaveBoss(state: GameState): boolean {
  return state.kills >= 10 && state.currentMonster?.monsterType !== 'boss';
}

export function challengeWaveBoss(state: GameState, ctx: EngineContext): void {
  if (!canChallengeWaveBoss(state)) return;
  // Spend the kill counter so a failed attempt requires re-clearing the wave.
  state.kills = 0;
  spawnMonster(state, ctx, true);
}
