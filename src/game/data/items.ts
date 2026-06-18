import type { Rarity, BaseClassName } from '../types';
import { STAT_KEYS } from './constants';

export interface RarityInfo {
  color: string;
  statMod: number;
  value: number;
  baseStatCount: number;
  bonusStats: number;
  enhanceCostMod: number;
}

export const itemData = {
  types: ['weapon', 'helm', 'body', 'legs', 'accessory'] as const,
  rarities: {
    N: { color: '#DEDEDE', statMod: 1.0, value: 2, baseStatCount: 1, bonusStats: 0, enhanceCostMod: 1.0 },
    R: { color: '#63C270', statMod: 1.2, value: 8, baseStatCount: 2, bonusStats: 1, enhanceCostMod: 2.0 },
    SR: { color: '#6386C2', statMod: 1.5, value: 25, baseStatCount: 3, bonusStats: 2, enhanceCostMod: 3.5 },
    SSR: { color: '#9663C2', statMod: 2.0, value: 150, baseStatCount: 4, bonusStats: 3, enhanceCostMod: 6.5 },
    UR: { color: '#C29463', statMod: 2.8, value: 500, baseStatCount: 4, bonusStats: 4, enhanceCostMod: 12.0 },
    LR: { color: '#FFD700', statMod: 3.5, value: 1000, baseStatCount: 5, bonusStats: 4, enhanceCostMod: 30.0 },
  } as Record<Rarity, RarityInfo>,
  bonusStatPool: [...STAT_KEYS],
  names: {
    weapon: {
      Warrior: ['Sword', 'Axe', 'Gauntlet'],
      Rogue: ['Dagger', 'Bow', 'Claw'],
      Wizard: ['Staff', 'Wand', 'Rod'],
    },
    helm: {
      Warrior: ['Helm', 'Greathelm', 'Casque'],
      Rogue: ['Hood', 'Mask', 'Cowl'],
      Wizard: ['Hat', 'Circlet', 'Veil'],
    },
    body: {
      Warrior: ['Armor', 'Vest'],
      Rogue: ['Leather', 'Jacket'],
      Wizard: ['Robe', 'Cape'],
    },
    legs: {
      Warrior: ['Greaves', 'Sabatons'],
      Rogue: ['Boots', 'Slippers'],
      Wizard: ['Shoes', 'Wraps'],
    },
    accessory: {
      Warrior: ['Pendant', 'Sigil', 'Band'],
      Rogue: ['Charm', 'Talisman', 'Ring'],
      Wizard: ['Orb', 'Amulet', 'Tome'],
    },
    prefixes: {
      Warrior: ['Mighty', 'Stalwart', 'Brutal', 'Savage', "Guardian's"],
      Rogue: ['Swift', 'Silent', 'Vicious', 'Shadow', "Assassin's"],
      Wizard: ['Arcane', 'Mystic', 'Elemental', "Warlock's", "Sage's"],
      Balanced: ['Fine', 'Superior', 'Masterwork', 'Exquisite', 'Perfect'],
    },
  },
};

/**
 * Affixes roll on higher-rarity items as extra non-base modifiers. Keys are read
 * by getPlayerTotalStats (lifesteal/hpPercent/...) and consumed in combat.ts.
 */
export interface AffixDef {
  key: string;
  min: number;
  max: number;
  label: string;
}

export const affixPool: AffixDef[] = [
  { key: 'lifesteal', min: 0.02, max: 0.06, label: 'Lifesteal' },
  { key: 'skillLifesteal', min: 0.03, max: 0.08, label: 'Skill Lifesteal' },
  { key: 'hpPercent', min: 0.03, max: 0.08, label: 'Max HP' },
  { key: 'reflectDamage', min: 0.03, max: 0.08, label: 'Damage Reflect' },
  { key: 'critIgnoresDef', min: 0.05, max: 0.15, label: 'Crit DEF Pierce' },
];

/** Affixes rolled per rarity. */
export const AFFIX_COUNT: Record<Rarity, number> = { N: 0, R: 0, SR: 1, SSR: 2, UR: 2, LR: 3 };

export interface ItemSet {
  class: BaseClassName;
  rarity: Rarity;
  items: string[];
  bonuses: Record<number, Record<string, unknown> & { grantsSkill?: string }>;
}

export const itemSets: Record<string, ItemSet> = {
  "Stalwart Guard's Battlegear": {
    class: 'Warrior', rarity: 'SSR', items: ["Stalwart Guard's Helm", "Stalwart Guard's Plate", "Stalwart Guard's Greaves"],
    bonuses: { 2: { def: 75, description: '2pc: +75 DEF' }, 3: { hpPercent: 0.1, description: '3pc: +10% Max HP' } },
  },
  "Executioner's Judgment": {
    class: 'Warrior', rarity: 'SSR', items: ["Executioner's Headcase", "Executioner's Garb", "Executioner's Stompers"],
    bonuses: { 2: { str: 50, description: '2pc: +50 STR' }, 3: { critDmg: 0.15, description: '3pc: +15% Crit Damage' } },
  },
  "Shadow-Walker's Guise": {
    class: 'Rogue', rarity: 'SSR', items: ["Shadow-Walker's Cowl", "Shadow-Walker's Leathers", "Shadow-Walker's Boots"],
    bonuses: { 2: { agl: 60, description: '2pc: +60 AGL' }, 3: { critDmg: 0.15, description: '3pc: +15% Crit Damage' } },
  },
  "Viper's Embrace": {
    class: 'Rogue', rarity: 'SSR', items: ["Viper's Fangs", "Viper's Scales", "Viper's Trail"],
    bonuses: { 2: { dex: 60, description: '2pc: +60 DEX' }, 3: { dotOnCrit: { damagePercent: 0.25, duration: 3 }, description: '3pc: Crits apply a poison for 25% of ATK over 3s.' } },
  },
  "Sage's Regalia": {
    class: 'Wizard', rarity: 'SSR', items: ["Sage's Circlet", "Sage's Robe", "Sage's Slippers"],
    bonuses: { 2: { int: 75, description: '2pc: +75 INT' }, 3: { critChance: 0.05, description: '3pc: +5% Crit Chance' } },
  },
  "Mana-Weaver's Attire": {
    class: 'Wizard', rarity: 'SSR', items: ["Mana-Weaver's Hood", "Mana-Weaver's Vestments", "Mana-Weaver's Treads"],
    bonuses: { 2: { int: 50, description: '2pc: +50 INT' }, 3: { lifesteal: 0.05, description: '3pc: Gain 5% Lifesteal.' } },
  },
  'Aegis of the Unbreakable': {
    class: 'Warrior', rarity: 'UR', items: ['Unbreakable Helm', 'Unbreakable Chestplate', 'Unbreakable Sabatons'],
    bonuses: { 2: { hpPercent: 0.15, description: '2pc: +15% Max HP' }, 3: { reflectDamage: 0.1, description: '3pc: Reflect 10% of damage taken.' } },
  },
  "Warlord's Onslaught": {
    class: 'Warrior', rarity: 'UR', items: ["Warlord's Greathelm", "Warlord's Battleplate", "Warlord's Warboots"],
    bonuses: { 2: { str: 100, description: '2pc: +100 STR' }, 3: { lowerEnemyDefOnHit: { chance: 0.15, percent: 0.2, duration: 5 }, description: '3pc: 15% chance on hit to lower enemy DEF by 20% for 5s.' } },
  },
  "Phantom's Mirage": {
    class: 'Rogue', rarity: 'UR', items: ["Phantom's Mask", "Phantom's Wraps", "Phantom's Steps"],
    bonuses: { 2: { agl: 120, description: '2pc: +120 AGL' }, 3: { firstAttackCrit: true, description: '3pc: Your first attack in combat is a guaranteed critical hit.' } },
  },
  "Reaper's Embrace": {
    class: 'Rogue', rarity: 'UR', items: ["Reaper's Hood", "Reaper's Shroud", "Reaper's Treads"],
    bonuses: { 2: { lifesteal: 0.1, description: '2pc: +10% Lifesteal' }, 3: { executeDmg: { hpThreshold: 0.3, dmgBonus: 0.25 }, description: '3pc: Deal 25% more damage to enemies below 30% HP.' } },
  },
  "Archmage's Imperium": {
    class: 'Wizard', rarity: 'UR', items: ["Archmage's Crown", "Archmage's Robes", "Archmage's Boots"],
    bonuses: { 2: { int: 150, description: '2pc: +150 INT' }, 3: { critDmg: 0.3, description: '3pc: +30% Crit Damage' } },
  },
  "Chronomancer's Paradox": {
    class: 'Wizard', rarity: 'UR', items: ['Paradox Hood', 'Paradox Vestments', 'Paradox Treads'],
    bonuses: { 2: { int: 100, description: '2pc: +100 INT' }, 3: { stunOnHit: { chance: 0.1 }, description: '3pc: Attacks have a 10% chance to stun the enemy for 1 turn.' } },
  },
  // --- LR 5-piece sets (slot order: weapon, helm, body, legs, accessory) ---
  // Threshold bonuses at 2/5, 4/5, 5/5; some grant combat skills via `grantsSkill`.
  "Colossus's Earth-Shattering Plate": {
    class: 'Warrior', rarity: 'LR',
    items: ['Maul of the Colossus', 'Helm of the Colossus', 'Aegis of the Colossus', 'Greaves of the Colossus', 'Heart of the Colossus'],
    bonuses: {
      2: { def: 250, hpPercent: 0.15, description: '2pc: +250 DEF & +15% Max HP' },
      4: { hpPercent: 0.2, grantsSkill: 'Aegis Block', description: '4pc: +20% Max HP & learn Aegis Block' },
      5: { immuneToCrits: true, reflectDamage: 0.15, description: '5pc: Immune to enemy crits & reflect 15% of damage taken' },
    },
  },
  "Dragon-Slayer's Aspect": {
    class: 'Warrior', rarity: 'LR',
    items: ["Dragon-Slayer's Fang", "Dragon-Slayer's Visage", "Dragon-Slayer's Carapace", "Dragon-Slayer's Striders", "Dragon-Slayer's Trophy"],
    bonuses: {
      2: { str: 250, description: '2pc: +250 STR' },
      4: { critDmg: 0.5, grantsSkill: 'Frenzy', description: '4pc: +50% Crit DMG & learn Frenzy' },
      5: { bonusCurrentHpDamage: 0.06, description: "5pc: Attacks deal bonus damage equal to 6% of the enemy's current HP" },
    },
  },
  "Storm-Chaser's Regalia": {
    class: 'Rogue', rarity: 'LR',
    items: ["Storm-Chaser's Edge", "Storm-Chaser's Cowl", "Storm-Chaser's Doublet", "Storm-Chaser's Boots", "Storm-Chaser's Eye"],
    bonuses: {
      2: { agl: 300, evasion: 0.05, description: '2pc: +300 AGL & +5% Evasion' },
      4: { critChance: 0.1, grantsSkill: 'Double Shot', description: '4pc: +10% Crit Chance & learn Double Shot' },
      5: { lifesteal: 0.12, description: '5pc: +12% Lifesteal' },
    },
  },
  "King-Slayer's Guile": {
    class: 'Rogue', rarity: 'LR',
    items: ["King-Slayer's Kris", "King-Slayer's Hood", "King-Slayer's Jerkin", "King-Slayer's Treads", "King-Slayer's Seal"],
    bonuses: {
      2: { critDmg: 0.6, description: '2pc: +60% Crit Damage' },
      4: { critIgnoresDef: 0.5, grantsSkill: 'Bleed', description: '4pc: Crits ignore 50% DEF & learn Bleed' },
      5: { grantsSkill: 'Execute', description: '5pc: learn Execute (slay weakened foes)' },
    },
  },
  'Celestial Fabric of the Cosmos': {
    class: 'Wizard', rarity: 'LR',
    items: ['Celestial Scepter', 'Celestial Diadem', 'Celestial Robe', 'Celestial Sandals', 'Celestial Star'],
    bonuses: {
      2: { int: 400, description: '2pc: +400 INT' },
      4: { critChance: 0.05, grantsSkill: 'Arcane Power', description: '4pc: +5% Crit Chance & learn Arcane Power' },
      5: { grantsSkill: 'Reality Break', description: '5pc: learn Reality Break (tear current HP)' },
    },
  },
  "Void-Drinker's Vestments": {
    class: 'Wizard', rarity: 'LR',
    items: ["Void-Drinker's Wand", "Void-Drinker's Cowl", "Void-Drinker's Mantle", "Void-Drinker's Wraps", "Void-Drinker's Idol"],
    bonuses: {
      2: { int: 200, skillLifesteal: 0.15, description: '2pc: +200 INT & 15% Skill Lifesteal' },
      4: { grantsSkill: 'Reality Break', description: '4pc: learn Reality Break' },
      5: { killRestoresHp: 0.2, description: '5pc: Killing an enemy with a skill restores 20% of your Max HP' },
    },
  },
};
