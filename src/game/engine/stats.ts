import type { GameState, Item, TotalStats, BaseClassName } from '../types';
import { itemSets } from '../data/items';
import { capstonePassives } from '../data/skills';
import {
  STAT_NAMES,
  STAT_CONTRIBUTIONS,
  PRIMARY_STAT_POWER_CURVE,
  CON_HP_FACTOR,
  DEX_CRIT_FACTOR,
  DEF_INVEST_FACTOR,
} from '../data/constants';

export function calculateTrueDamageBonus(className: BaseClassName, intValue: number, primaryValue = 0): number {
  const base = (STAT_CONTRIBUTIONS.trueDmg.base as Record<string, number>)[className] || 0;
  const perInt = (STAT_CONTRIBUTIONS.trueDmg.perInt as Record<string, number>)[className] || 0;
  const perPrimary = (STAT_CONTRIBUTIONS.trueDmg.perPrimary as Record<string, number>)[className] || 0;

  let trueDmgBonus = base + intValue * perInt + primaryValue * perPrimary;

  if (trueDmgBonus > STAT_CONTRIBUTIONS.trueDmg.softCap) {
    const excess = trueDmgBonus - STAT_CONTRIBUTIONS.trueDmg.softCap;
    trueDmgBonus = STAT_CONTRIBUTIONS.trueDmg.softCap + excess * 0.5;
  }
  return Math.min(trueDmgBonus, STAT_CONTRIBUTIONS.trueDmg.hardCap);
}

/** Resolve an equipment slot's id to the actual inventory item. */
function resolveEquipped(state: GameState): Item[] {
  const out: Item[] = [];
  for (const type in state.equipment) {
    const id = state.equipment[type as keyof typeof state.equipment];
    if (id == null) continue;
    const item = state.inventory.find((i) => i.id === id);
    if (item) out.push(item);
  }
  return out;
}

/** Count equipped pieces per set name. */
export function getEquippedSetCounts(state: GameState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of resolveEquipped(state)) {
    if (item.setName) counts[item.setName] = (counts[item.setName] || 0) + 1;
  }
  return counts;
}

/**
 * The player's effective skill list: skills learned via promotions PLUS skills
 * granted by equipped set thresholds (e.g. an LR 5-piece set's 2/5, 4/5 bonuses).
 */
export function getActiveSkills(state: GameState): string[] {
  const skills = state.player ? [...state.player.activeSkills] : [];
  const counts = getEquippedSetCounts(state);
  for (const setName in counts) {
    const set = itemSets[setName];
    if (!set) continue;
    for (let i = 2; i <= counts[setName]; i++) {
      const bonus = set.bonuses[i];
      const granted = bonus && (bonus as { grantsSkill?: string }).grantsSkill;
      if (granted && !skills.includes(granted)) skills.push(granted);
    }
  }
  return skills;
}

/** Does the player currently have a skill active (learned or set-granted)? */
export function hasSkill(state: GameState, name: string): boolean {
  if (state.player?.activeSkills.includes(name)) return true;
  return getActiveSkills(state).includes(name);
}

/**
 * Compute the player's full derived stat block. `hypotheticalItem` previews
 * equipping an item (used by tooltips).
 */
export function getPlayerTotalStats(state: GameState, hypotheticalItem: Item | null = null): TotalStats {
  if (!state.player) return {} as TotalStats;
  const p = state.player;
  const rawStats: Record<string, number> = { lifesteal: 0, skillLifesteal: 0 };

  for (const statName in STAT_NAMES) rawStats[statName] = 0;

  for (const statName in rawStats) {
    if (p.baseStats[statName] !== undefined) rawStats[statName] += p.baseStats[statName];
    const invested = p.investedStats[statName as keyof typeof p.investedStats];
    if (invested) {
      if (statName === 'critChance') rawStats[statName] += invested * 0.002;
      else if (statName === 'critDmg') rawStats[statName] += invested * 0.005;
      // Invested DEF is amplified so it can compete with CON for survivability.
      else if (statName === 'def') rawStats[statName] += invested * DEF_INVEST_FACTOR;
      else rawStats[statName] += invested;
    }
  }

  const equippedSets: Record<string, number> = {};
  // Non-base modifiers (set bonuses + item affixes) applied to finalStats later.
  const specialBonuses: Record<string, number> = {};
  let hpPercentBonus = 0;

  const effectiveEquipment: Record<string, number | null | Item> = { ...state.equipment };
  if (hypotheticalItem) effectiveEquipment[hypotheticalItem.type] = hypotheticalItem;

  for (const type in effectiveEquipment) {
    let item = effectiveEquipment[type];
    if (typeof item === 'number') item = state.inventory.find((i) => i.id === item) ?? null;
    if (item && typeof item === 'object') {
      if (item.setName) equippedSets[item.setName] = (equippedSets[item.setName] || 0) + 1;
      for (const stat in item) {
        if ((STAT_NAMES as Record<string, string>)[stat] && typeof item[stat] === 'number') {
          rawStats[stat] += item[stat] as number;
        }
      }
      for (const stat in item.bonusStats || {}) {
        if (rawStats[stat] !== undefined) rawStats[stat] += item.bonusStats[stat as keyof typeof item.bonusStats] as number;
      }
      for (const stat in item.enhancementBonusStats || {}) {
        if (rawStats[stat] !== undefined) rawStats[stat] += item.enhancementBonusStats[stat as keyof typeof item.enhancementBonusStats];
      }
      // Affixes: lifesteal/skillLifesteal feed rawStats; everything else is "special".
      for (const affix of item.affixes || []) {
        if (rawStats[affix.key] !== undefined) rawStats[affix.key] += affix.value;
        else if (affix.key === 'hpPercent') hpPercentBonus += affix.value;
        else specialBonuses[affix.key] = (specialBonuses[affix.key] || 0) + affix.value;
      }
    }
  }

  const finalStats: Record<string, unknown> = { ...rawStats, hp: 0, atk: 0, def: 0, accuracy: 0, evasion: 0, activeSets: {} };
  const sets = finalStats.activeSets as Record<string, number>;

  for (const setName in equippedSets) {
    const setInfo = itemSets[setName];
    const count = equippedSets[setName];
    sets[setName] = count;
    for (let i = 2; i <= count; i++) {
      const bonus = setInfo.bonuses[i];
      if (bonus) {
        for (const bonusStat in bonus) {
          if (bonusStat === 'description' || bonusStat === 'grantsSkill') continue;
          if (bonusStat === 'hpPercent') hpPercentBonus += bonus[bonusStat] as number;
          else if (finalStats[bonusStat] !== undefined) (finalStats[bonusStat] as number) += bonus[bonusStat] as number;
          else finalStats[bonusStat] = bonus[bonusStat];
        }
      }
    }
  }

  // Fold item-affix special bonuses (reflectDamage, critIgnoresDef, ...) in.
  for (const key in specialBonuses) {
    if (finalStats[key] !== undefined && typeof finalStats[key] === 'number') (finalStats[key] as number) += specialBonuses[key];
    else finalStats[key] = specialBonuses[key];
  }

  // L70 capstone passive packages (learned or set-granted). atk/hp are multiplicative.
  let capstoneAtkMult = 1;
  for (const skill of getActiveSkills(state)) {
    const cap = capstonePassives[skill];
    if (!cap) continue;
    for (const k in cap) {
      if (k === 'atkPercent') capstoneAtkMult *= 1 + cap[k];
      else if (k === 'hpPercent') hpPercentBonus += cap[k];
      else if (typeof finalStats[k] === 'number') (finalStats[k] as number) += cap[k];
      else finalStats[k] = cap[k];
    }
  }

  const cls = p.baseClassName;
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);

  const strTodefContrib = (rawStats.str || 0) * STAT_CONTRIBUTIONS.defPerStr[cls];
  finalStats.def = ((rawStats.def || 0) + strTodefContrib) * (1 + state.rebirth.bonuses.def);

  // HP: real class base HP + CON, scaled by %HP bonuses and (multiplicative) rebirth HP.
  const baseHp = p.baseStats.hp || 0;
  finalStats.hp = (baseHp + (rawStats.con || 0) * CON_HP_FACTOR) * (1 + hpPercentBonus) * (1 + state.rebirth.bonuses.hp);

  finalStats.accuracy = num(finalStats.dex) * 0.002;
  finalStats.evasion = num(finalStats.evasion) + num(finalStats.agl) * 0.001;

  // DEX feeds crit chance; rebirth adds crit damage. Crit chance is capped at
  // 100% so points/DEX past the cap aren't silently wasted.
  finalStats.critChance = Math.min(1, num(finalStats.critChance) + num(rawStats.dex) * DEX_CRIT_FACTOR);
  finalStats.critDmg = num(finalStats.critDmg) + state.rebirth.bonuses.critDmg;

  const strContrib = (rawStats.str || 0) * STAT_CONTRIBUTIONS.atk.strContribution[cls];
  const intContrib = (rawStats.int || 0) * STAT_CONTRIBUTIONS.atk.intContribution[cls];
  const dexContrib = (rawStats.dex || 0) * STAT_CONTRIBUTIONS.atk.dexContribution[cls];
  const aglContrib = (rawStats.agl || 0) * STAT_CONTRIBUTIONS.atk.aglContribution[cls];
  const totalAttackPower = strContrib + intContrib + dexContrib + aglContrib;

  finalStats.atk = Math.pow(totalAttackPower || 1, PRIMARY_STAT_POWER_CURVE) * (1 + state.rebirth.bonuses.atk) * capstoneAtkMult;

  if (hasSkill(state, 'Frenzy') && !hypotheticalItem) {
    const missingHpPercent = 1 - p.currentHp / (finalStats.hp as number);
    const frenzyAtkBonus = Math.floor(missingHpPercent / 0.05) * 0.02;
    (finalStats.atk as number) *= 1 + frenzyAtkBonus;
  }

  if (state.playerTemp.battleRushStacks > 0 && !hypotheticalItem) {
    (finalStats.atk as number) *= 1 + 0.3 * state.playerTemp.battleRushStacks;
  }

  // Warriors pierce with STR, Rogues with DEX; Wizards pierce via INT (perInt).
  const physPrimary = cls === 'Warrior' ? rawStats.str || 0 : cls === 'Rogue' ? rawStats.dex || 0 : 0;
  finalStats.trueDmgBonus = calculateTrueDamageBonus(cls, rawStats.int || 0, physPrimary);

  if (hasSkill(state, 'Frenzy') && !hypotheticalItem) {
    const missingHpPercent = 1 - p.currentHp / (finalStats.hp as number);
    const frenzyTrueDmg = Math.floor(missingHpPercent / 0.05) * 0.01;
    finalStats.trueDmgBonus = Math.min((finalStats.trueDmgBonus as number) + frenzyTrueDmg, 0.8);
  }

  if (state.playerTemp.battleRushStacks > 0 && !hypotheticalItem) {
    finalStats.trueDmgBonus = Math.min((finalStats.trueDmgBonus as number) + 0.1 * state.playerTemp.battleRushStacks, 0.8);
  }

  finalStats.trueDmgBonusPercent = ((finalStats.trueDmgBonus as number) * 100).toFixed(1) + '%';

  return finalStats as TotalStats;
}
