import type { GameState, EngineContext, Monster, Item, Rarity, BaseClassName, StatName, ItemType, Affix } from '../types';
import { monsters } from '../data/monsters';
import { itemData, itemSets, affixPool, AFFIX_COUNT } from '../data/items';
import { STAT_KEYS, FINAL_BOSS_BASE_STATS } from '../data/constants';
import { applyMonsterModifiers } from './bosses';
import { trackDaily } from './meta';

/** Core (guaranteed) stat per equipment slot — gives each slot an identity. */
const SLOT_CORE_STAT: Record<ItemType, StatName> = {
  weapon: 'str', // overridden to 'int' for Wizard
  helm: 'con',
  body: 'def',
  legs: 'agl',
  accessory: 'critChance',
};

function shuffleArray<T>(array: T[], rng: () => number): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function getRarityProbabilities(state: GameState, monsterType: string): Record<Rarity, number> {
  let baseProbs: Record<Rarity, number>;
  switch (monsterType) {
    case 'regular': baseProbs = { N: 0.8, R: 0.17, SR: 0.025, SSR: 0.005, UR: 0, LR: 0 }; break;
    case 'mutant': baseProbs = { N: 0.647, R: 0.3, SR: 0.04, SSR: 0.01, UR: 0.003, LR: 0 }; break;
    case 'elite': baseProbs = { N: 0.459, R: 0.4, SR: 0.1, SSR: 0.03, UR: 0.01, LR: 0.001 }; break;
    case 'boss': baseProbs = { N: 0.1, R: 0.6, SR: 0.2, SSR: 0.075, UR: 0.02, LR: 0.005 }; break;
    default: return { N: 1.0, R: 0, SR: 0, SSR: 0, UR: 0, LR: 0 };
  }

  const wave = state.wave || 1;
  if (wave <= 1) return baseProbs;

  const newProbs = { ...baseProbs };
  const shiftAmount = Math.min(newProbs.N * 0.8, Math.log10(wave) * 0.1);
  newProbs.N -= shiftAmount;

  const higherRarities: Rarity[] = ['R', 'SR', 'SSR', 'UR', 'LR'];
  const totalHigherProb = higherRarities.reduce((sum, r) => sum + (baseProbs[r] || 0), 0);
  if (totalHigherProb > 0) {
    for (const rarity of higherRarities) {
      if (baseProbs[rarity] > 0) newProbs[rarity] += shiftAmount * (baseProbs[rarity] / totalHigherProb);
    }
  } else {
    newProbs.R += shiftAmount;
  }
  return newProbs;
}

export function generateItemDrop(state: GameState, ctx: EngineContext, monster: Monster): void {
  if (state.inventory.length >= state.maxInventorySize) {
    ctx.log('Inventory is full!', 'log-system', 'event');
    return;
  }
  const rng = ctx.rng;
  // Class-biased drops: ~75% match the player's class so loot is usable; the rest
  // are off-class (still worth selling). Falls back to a random class if no player.
  const allClasses = ['Warrior', 'Rogue', 'Wizard'] as BaseClassName[];
  const playerClass = state.player?.baseClassName;
  let classForDrop: BaseClassName;
  if (playerClass && rng() < 0.75) {
    classForDrop = playerClass;
  } else {
    const others = playerClass ? allClasses.filter((c) => c !== playerClass) : allClasses;
    classForDrop = others[Math.floor(rng() * others.length)];
  }
  const itemType = itemData.types[Math.floor(rng() * itemData.types.length)];
  // Champions roll on the boss-tier rarity table — guaranteed rich loot.
  const probs = getRarityProbabilities(state, monster.isChampion ? 'boss' : monster.monsterType);
  const rand = rng();
  let cumulativeProb = 0;
  let rarityKey: Rarity = 'N';
  for (const rarity in probs) {
    cumulativeProb += probs[rarity as Rarity];
    if (rand < cumulativeProb) {
      rarityKey = rarity as Rarity;
      break;
    }
  }

  const rarityInfo = itemData.rarities[rarityKey];
  // Stronger than the legacy log10 curve so drops keep pace with monster scaling.
  const waveScale = 1 + Math.log10(state.wave || 1) * 1.5 + (state.wave - 1) * 0.04;
  const SET_ITEM_CHANCE = 0.15;

  const newItem: Item = {
    id: Date.now() + rng(),
    type: itemType,
    rarity: rarityKey,
    classReq: classForDrop,
    name: '',
    bonusStats: {},
    setName: null,
    enhancementLevel: 0,
    enhancementBonusStats: {} as Record<StatName, number>,
  };
  for (const statName of STAT_KEYS) newItem.enhancementBonusStats[statName] = 0;

  let itemName = '';
  const possibleSets = Object.keys(itemSets).filter((name) => itemSets[name].class === classForDrop && itemSets[name].rarity === rarityKey);
  if (possibleSets.length > 0 && rng() < SET_ITEM_CHANCE) {
    const selectedSetName = possibleSets[Math.floor(rng() * possibleSets.length)];
    newItem.setName = selectedSetName;
    // Name the piece by its slot so set items read sensibly (items are slot-ordered).
    const setItemNames = itemSets[selectedSetName].items;
    const slotIdx = itemData.types.indexOf(itemType);
    itemName = setItemNames[slotIdx] ?? setItemNames[slotIdx % setItemNames.length];
  }
  if (!newItem.setName) {
    const pool = itemData.names[itemType][classForDrop];
    const baseName = pool[Math.floor(rng() * pool.length)];
    const prefix = itemData.names.prefixes.Balanced[Math.floor(rng() * itemData.names.prefixes.Balanced.length)];
    itemName = `${prefix} ${baseName}`;
  }
  newItem.name = itemName;

  const calculateStatValue = (stat: string): number => {
    if (stat === 'critChance' || stat === 'critDmg') return (rng() * 0.03 + 0.005) * rarityInfo.statMod * waveScale;
    return Math.round((rng() * 3 + 1) * rarityInfo.statMod * waveScale);
  };

  const coreStat: string =
    newItem.type === 'weapon' ? (newItem.classReq === 'Wizard' ? 'int' : 'str') : SLOT_CORE_STAT[newItem.type];
  const baseStatPool = shuffleArray([...itemData.bonusStatPool], rng).filter((s) => s !== coreStat);
  if (coreStat) newItem[coreStat] = calculateStatValue(coreStat);

  const baseStatsToGenerate = rarityInfo.baseStatCount - (coreStat ? 1 : 0);
  for (let i = 0; i < baseStatsToGenerate; i++) {
    if (baseStatPool.length === 0) break;
    const statToGenerate = baseStatPool.pop()!;
    newItem[statToGenerate] = calculateStatValue(statToGenerate);
  }

  const bonusStatPool = shuffleArray([...itemData.bonusStatPool], rng).filter((s) => !newItem[s]);
  for (let i = 0; i < rarityInfo.bonusStats; i++) {
    if (bonusStatPool.length === 0) break;
    const stat = bonusStatPool.pop()!;
    newItem.bonusStats[stat] = calculateStatValue(stat);
  }

  // Affixes: extra special modifiers (lifesteal, %HP, reflect, ...) on higher rarities.
  const affixCount = AFFIX_COUNT[rarityKey];
  if (affixCount > 0) {
    const pool = shuffleArray([...affixPool], rng);
    const affixes: Affix[] = [];
    for (let i = 0; i < affixCount && pool.length > 0; i++) {
      const def = pool.pop()!;
      affixes.push({ key: def.key, value: Math.round((rng() * (def.max - def.min) + def.min) * 1000) / 1000 });
    }
    if (affixes.length) newItem.affixes = affixes;
  }

  if (rarityKey === 'LR') state.stats.lrDrops += 1;
  trackDaily(state, 'drops', 1);
  state.inventory.push(newItem);
  ctx.log(`You found a [<span style="color:${rarityInfo.color}; font-weight: bold;">${rarityKey}</span>] <span style="color:${rarityInfo.color}">${newItem.name}</span>!`, 'log-drop', 'event');
}

export function weakenFinalBoss(state: GameState): void {
  const base = FINAL_BOSS_BASE_STATS;
  const reductionPerBoss = 0.025;
  const totalReduction = 1 - state.totalBossesDefeatedInRun * reductionPerBoss;
  const effectiveReduction = Math.max(0.1, totalReduction);

  state.finalBoss = {
    ...base,
    hp: Math.round(base.hp * effectiveReduction),
    maxHp: Math.round(base.hp * effectiveReduction),
    atk: Math.round(base.atk * effectiveReduction),
    def: Math.round(base.def * effectiveReduction),
    evasion: 0.15,
    accuracy: 0.1,
    critChance: 0.15,
    critDmg: 2.0,
    monsterType: 'boss',
    debuffs: {},
    missNextAttack: false,
    isFinalBoss: true,
  } as Monster & { isFinalBoss: boolean };
}

export function spawnMonster(state: GameState, ctx: EngineContext, isBoss = false): void {
  state.isRunning = true;
  state.playerTemp.firstAttackCritUsed = false;
  state.playerTemp.evasionAtkBuffStacks = 0;
  state.playerTemp.evasionAtkBuffDuration = 0;

  const rng = ctx.rng;
  let monsterTemplate;
  if (isBoss) {
    monsterTemplate = monsters.bosses[(state.wave - 1) % monsters.bosses.length];
  } else {
    const rand = rng();
    if (state.wave > 3 && rand < 0.15) monsterTemplate = monsters.elite[Math.floor(rng() * monsters.elite.length)];
    else if (state.wave > 1 && rand < 0.3) monsterTemplate = monsters.mutant[Math.floor(rng() * monsters.mutant.length)];
    else monsterTemplate = monsters.regular[Math.floor(rng() * monsters.regular.length)];
  }

  const hpScale = Math.pow(1.2, state.wave - 1);
  const statScale = Math.pow(1.12, state.wave - 1);
  const goldScale = Math.pow(1.15, state.wave - 1);
  const xpScale = Math.pow(1.09, state.wave - 1);

  state.currentMonster = {
    ...monsterTemplate,
    hp: Math.round(monsterTemplate.baseHp * hpScale),
    maxHp: Math.round(monsterTemplate.baseHp * hpScale),
    atk: Math.round(monsterTemplate.baseAtk * statScale),
    def: Math.round(monsterTemplate.baseDef * statScale),
    evasion: monsterTemplate.baseEvasion + state.wave * 0.001,
    accuracy: 0,
    gold: Math.round(monsterTemplate.gold * goldScale),
    xp: Math.round(monsterTemplate.xp * xpScale),
    isBoss,
    debuffs: {},
    missNextAttack: false,
  } as Monster;

  if (!isBoss) applyMonsterModifiers(ctx, state.currentMonster);

  // Rare "champion" elite: chunky, dangerous, and drops boss-tier loot.
  if (!isBoss && state.wave > 2 && rng() < 0.03) {
    const m = state.currentMonster;
    m.isChampion = true;
    m.hp = Math.round(m.hp * 4);
    m.maxHp = m.hp;
    m.atk = Math.round(m.atk * 1.6);
    m.def = Math.round(m.def * 1.4);
    m.gold = Math.round(m.gold * 6);
    m.xp = Math.round(m.xp * 5);
    m.dropChance = 1;
    m.name = `⭐ Champion ${m.name}`;
  }

  state.playerTemp.firstAttackCritUsed = false;
  state.playerTemp.attacksSinceLastFocus = 0;
  if (state.playerTemp.invisibilityStacks > 0) state.playerTemp.invisibilityFirstAttack = true;

  ctx.log(`A wild ${state.currentMonster.name} appears!`, 'log-system', 'event');
}

/** Begin the final boss encounter; the normal tick loop fights it. */
export function challengeFinalBoss(state: GameState, ctx: EngineContext): void {
  if (state.finalBossDefeated) {
    ctx.log('You have already defeated the final boss.', 'log-system', 'event');
    return;
  }
  // Always recompute so the encounter reflects the current run's weakening.
  weakenFinalBoss(state);
  state.currentMonster = { ...(state.finalBoss as Monster), debuffs: {}, missNextAttack: false };
  ctx.log(`You challenge the mighty ${state.currentMonster.name}!`, 'log-system', 'event');
}
