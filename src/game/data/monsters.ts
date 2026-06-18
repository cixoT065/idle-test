export interface MonsterTemplate {
  name: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseEvasion: number;
  gold: number;
  xp: number;
  dropChance: number;
  monsterType: 'regular' | 'mutant' | 'elite' | 'boss';
}

/**
 * Affixes that can roll on mutant/elite monsters. Each grants the monster a
 * combat edge and multiplies its rewards (gold/xp/drop chance). Applied in
 * engine/bosses.ts; the name is prefixed to the monster.
 */
export interface MonsterModifierInfo {
  description: string;
  rewardMult: number;
  defMult?: number;
  atkMult?: number;
  hpMult?: number;
  evasionAdd?: number;
  /** Heal the monster for this fraction of the damage it deals to the player. */
  lifesteal?: number;
  /** On death, detonate for this fraction of the player's max HP. */
  deathBurstPct?: number;
}

export const monsterModifiers: Record<string, MonsterModifierInfo> = {
  Armored: { description: '+50% DEF', rewardMult: 1.3, defMult: 1.5 },
  Swift: { description: '+12% evasion', rewardMult: 1.3, evasionAdd: 0.12 },
  Frenzied: { description: '+45% ATK', rewardMult: 1.45, atkMult: 1.45 },
  Vampiric: { description: 'Heals for 30% of damage dealt', rewardMult: 1.5, lifesteal: 0.3 },
  Volatile: { description: 'Explodes for 15% of your max HP on death', rewardMult: 1.4, deathBurstPct: 0.15 },
  Giant: { description: '+150% HP', rewardMult: 1.6, hpMult: 2.5 },
  Berserk: { description: '+70% ATK, -30% DEF', rewardMult: 1.5, atkMult: 1.7, defMult: 0.7 },
};

export const monsters: Record<'regular' | 'mutant' | 'elite' | 'bosses', MonsterTemplate[]> = {
  regular: [
    { name: 'Slime', baseHp: 30, baseAtk: 5, baseDef: 5, baseEvasion: 0.01, gold: 5, xp: 5, dropChance: 0.15, monsterType: 'regular' },
    { name: 'Giant Rat', baseHp: 25, baseAtk: 6, baseDef: 8, baseEvasion: 0.03, gold: 4, xp: 4, dropChance: 0.1, monsterType: 'regular' },
    { name: 'Goblin Scout', baseHp: 40, baseAtk: 7, baseDef: 12, baseEvasion: 0.05, gold: 7, xp: 6, dropChance: 0.2, monsterType: 'regular' },
    { name: 'Cave Bat', baseHp: 20, baseAtk: 8, baseDef: 8, baseEvasion: 0.08, gold: 3, xp: 3, dropChance: 0.08, monsterType: 'regular' },
    { name: 'Kobold Miner', baseHp: 35, baseAtk: 9, baseDef: 10, baseEvasion: 0.02, gold: 8, xp: 7, dropChance: 0.18, monsterType: 'regular' },
    { name: 'Forest Spider', baseHp: 30, baseAtk: 7, baseDef: 15, baseEvasion: 0.1, gold: 6, xp: 5, dropChance: 0.12, monsterType: 'regular' },
    { name: 'Undead Soldier', baseHp: 50, baseAtk: 6, baseDef: 25, baseEvasion: 0.01, gold: 9, xp: 8, dropChance: 0.22, monsterType: 'regular' },
  ],
  mutant: [
    { name: 'Mutated Slime', baseHp: 80, baseAtk: 10, baseDef: 45, baseEvasion: 0.01, gold: 20, xp: 15, dropChance: 0.5, monsterType: 'mutant' },
    { name: 'Rabid Wolf', baseHp: 50, baseAtk: 18, baseDef: 5, baseEvasion: 0.12, gold: 25, xp: 18, dropChance: 0.4, monsterType: 'mutant' },
    { name: 'Shrieking Fungus', baseHp: 100, baseAtk: 8, baseDef: 60, baseEvasion: 0.0, gold: 30, xp: 20, dropChance: 0.6, monsterType: 'mutant' },
  ],
  elite: [
    { name: 'Orc Grunt', baseHp: 120, baseAtk: 20, baseDef: 30, baseEvasion: 0.05, gold: 50, xp: 30, dropChance: 0.8, monsterType: 'elite' },
    { name: 'Troll', baseHp: 150, baseAtk: 18, baseDef: 35, baseEvasion: 0.02, gold: 65, xp: 40, dropChance: 0.9, monsterType: 'elite' },
    { name: 'Ogre Mage', baseHp: 100, baseAtk: 28, baseDef: 10, baseEvasion: 0.04, gold: 80, xp: 50, dropChance: 0.85, monsterType: 'elite' },
    { name: 'Goblin Shaman', baseHp: 90, baseAtk: 32, baseDef: 25, baseEvasion: 0.08, gold: 90, xp: 55, dropChance: 0.88, monsterType: 'elite' },
    { name: 'Stone Golem', baseHp: 200, baseAtk: 15, baseDef: 60, baseEvasion: 0.0, gold: 100, xp: 60, dropChance: 1.0, monsterType: 'elite' },
  ],
  bosses: [
    { name: 'Grimgnaw the Goblin King', baseHp: 400, baseAtk: 35, baseDef: 80, baseEvasion: 0.06, gold: 400, xp: 200, dropChance: 1.0, monsterType: 'boss' },
    { name: 'The Slime Mother', baseHp: 600, baseAtk: 30, baseDef: 120, baseEvasion: 0.03, gold: 600, xp: 350, dropChance: 1.0, monsterType: 'boss' },
    { name: 'Hydra', baseHp: 500, baseAtk: 45, baseDef: 30, baseEvasion: 0.1, gold: 800, xp: 500, dropChance: 1.0, monsterType: 'boss' },
    { name: 'Dragon Whelp', baseHp: 700, baseAtk: 40, baseDef: 135, baseEvasion: 0.08, gold: 1000, xp: 600, dropChance: 1.0, monsterType: 'boss' },
  ],
};
