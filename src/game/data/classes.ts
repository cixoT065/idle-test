import type { BaseClassName } from '../types';

type PromotionTier = string[] | Record<string, string[]>;

export interface ClassInfo {
  primaryStat: 'str' | 'int';
  description: string;
  base: Record<string, number>;
  growth: Record<string, number>;
  promotions: Record<number, PromotionTier>;
}

export const classes: Record<BaseClassName, ClassInfo> = {
  Warrior: {
    primaryStat: 'str',
    description: 'A balanced fighter with high HP and DEF. Excels at sustained combat and survivability.',
    base: { hp: 120, str: 10, con: 8, def: 6, dex: 3, agl: 2, int: 1, critChance: 0.05, critDmg: 1.5 },
    growth: { str: 2, con: 2, def: 1, dex: 0.5, agl: 0.5, int: 0, critChance: 0.0005, critDmg: 0 },
    promotions: {
      20: ['Knight', 'Berserker'],
      40: { Knight: ['Paladin', 'Guardian'], Berserker: ['Slayer', 'Warlord'] },
      70: { Paladin: ['Holy Knight', 'Templar'], Guardian: ['Aegis', 'Sentinel'], Slayer: ['Executioner', 'Ravager'], Warlord: ['Conqueror', 'Warbringer'] },
    },
  },
  Rogue: {
    primaryStat: 'str',
    description: 'A swift attacker specializing in high damage and critical hits. Relies on evasion to survive.',
    base: { hp: 90, str: 8, con: 5, def: 3, dex: 12, agl: 6, int: 1, critChance: 0.1, critDmg: 1.75 },
    growth: { str: 2, con: 1, def: 0.5, dex: 2, agl: 1, int: 0, critChance: 0.001, critDmg: 0 },
    promotions: {
      20: ['Assassin', 'Ranger'],
      40: { Assassin: ['Shadow', 'Reaper'], Ranger: ['Sharpshooter', 'Pathfinder'] },
      70: { Shadow: ['Phantom', 'Nightblade'], Reaper: ['Soul Carver', 'Deathstalker'], Sharpshooter: ['Deadeye', 'Tempest'], Pathfinder: ['Trailblazer', 'Windrunner'] },
    },
  },
  Wizard: {
    primaryStat: 'int',
    description: 'A master of arcane arts, dealing massive damage with powerful spells. Fragile but deadly.',
    base: { hp: 80, str: 8, con: 4, def: 2, dex: 6, agl: 3, int: 12, critChance: 0.07, critDmg: 1.6 },
    growth: { str: 0, con: 1, def: 0.5, dex: 1, agl: 0.5, int: 3, critChance: 0.0007, critDmg: 0 },
    promotions: {
      20: ['Mage', 'Sorcerer'],
      40: { Mage: ['Archmage', 'Elementalist'], Sorcerer: ['Warlock', 'Chronomancer'] },
      70: { Archmage: ['Grand Magus', 'Arcanist'], Elementalist: ['Avatar', 'Stormcaller'], Warlock: ['Demonologist', 'Necromancer'], Chronomancer: ['Time Lord', 'Aeon'] },
    },
  },
};

export const promotionInfo: Record<string, { description: string }> = {
  Knight: { description: 'Focuses on defense, becoming a stalwart protector who can withstand heavy blows.' },
  Berserker: { description: 'An offensive powerhouse who deals more damage by embracing risk and critical strikes.' },
  Paladin: { description: 'A holy warrior who blends offense and defense with sacred power.' },
  Guardian: { description: 'The ultimate shield, possessing unmatched defensive capabilities.' },
  Slayer: { description: 'A ruthless killer focused on executing single targets with overwhelming force.' },
  Warlord: { description: 'A charismatic leader in battle, bolstering their own power while commanding the field.' },
  Assassin: { description: 'A master of burst damage and criticals, eliminating foes with deadly precision.' },
  Ranger: { description: 'A nimble archer who excels at consistent damage and avoiding attacks.' },
  Shadow: { description: 'Uses stealth and deception to strike from the darkness, ensuring a fatal blow.' },
  Reaper: { description: 'A fearsome combatant who seems to dance with death, growing stronger with every kill.' },
  Sharpshooter: { description: 'An unrivaled marksman whose precision leads to devastating critical hits.' },
  Pathfinder: { description: 'A resourceful survivor who adapts to any situation, moving with incredible speed.' },
  Mage: { description: 'A student of pure magic, wielding raw arcane power to demolish enemies.' },
  Sorcerer: { description: 'A natural talent who bends magic to their will, often with unpredictable and chaotic results.' },
  Archmage: { description: 'A supreme spellcaster who has achieved mastery over all forms of arcane magic.' },
  Elementalist: { description: 'Commands the primal forces of fire, ice, and lightning to annihilate foes.' },
  Warlock: { description: 'Draws upon forbidden, dark powers, sacrificing vitality for immense destructive force.' },
  Chronomancer: { description: 'Manipulates time itself, slowing enemies and hastening their own actions.' },

  // --- Tier-3 capstones (level 70). Each tier-2 class now offers two paths: ---
  // the original proc-based capstone, or a new passive "powerhouse" alternative.
  'Holy Knight': { description: 'Channels divine power, retaliating with holy bursts.' },
  Templar: { description: 'An unbreakable zealot — sustains through lifesteal and a deep HP pool.' },
  Aegis: { description: 'The living wall, punishing attackers who dare to strike.' },
  Sentinel: { description: 'Turns defense into offense, reflecting a huge share of damage taken.' },
  Executioner: { description: 'Perfects the art of the kill, culling the weak without mercy.' },
  Ravager: { description: 'Raw, overwhelming force — trades finesse for crushing attack power.' },
  Conqueror: { description: 'A relentless champion who snowballs power across the battle.' },
  Warbringer: { description: 'A warlord of pure aggression, amplifying attack and critical damage.' },
  Phantom: { description: 'Strikes from impossible angles, untouchable and lethal.' },
  Nightblade: { description: 'A master of the killing blow — sky-high crit chance and damage.' },
  'Soul Carver': { description: 'Drinks deep of every wound, spreading death between foes.' },
  Deathstalker: { description: 'Sustains endlessly on the hunt, healing from every strike.' },
  Deadeye: { description: 'The perfect marksman, every focused shot a guaranteed crit.' },
  Tempest: { description: 'A storm of blades — sustained, relentless attack power.' },
  Trailblazer: { description: 'Shatters armor and spreads weakness across the field.' },
  Windrunner: { description: 'Impossibly nimble, weaving between attacks while dealing more.' },
  'Grand Magus': { description: 'Chains arcane devastation across reality itself.' },
  Arcanist: { description: 'Pure, concentrated magical power with no equal.' },
  Avatar: { description: 'Becomes an elemental cataclysm, reducing all who oppose.' },
  Stormcaller: { description: 'Calls down ceaseless elemental fury with deadly precision.' },
  Demonologist: { description: 'Wields forbidden power to annihilate and doom enemies.' },
  Necromancer: { description: 'Feeds on the dead, draining life with every spell.' },
  'Time Lord': { description: 'Bends time to act twice and freeze foes in place.' },
  Aeon: { description: 'An eternal being — vast vitality fused with arcane might.' },
};

export const promotionGrowthAdjustments: Record<string, Record<string, number>> = {
  Knight: { con: 1, def: 1, str: -1 },
  Berserker: { str: 1, critChance: 0.001, con: -1 },
  Assassin: { str: 1, dex: 1, agl: 1, critChance: 0.0005, con: -1 },
  Ranger: { dex: 1, agl: 1, str: 0, con: -1 },
  Mage: { int: 1, str: 1, dex: -1 },
  Sorcerer: { int: 1, dex: 1, str: -1 },
};
