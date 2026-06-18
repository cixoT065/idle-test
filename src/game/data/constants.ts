import type { StatName } from '../types';

/** Bump this when the persisted save shape changes (see save/migrate.ts). */
export const SAVE_KEY = 'idleRpgSaveData_v15_revamp';
export const SAVE_VERSION = 15;

// Slightly super-linear so heavy primary-stat investment compounds and stays
// relevant against exponential monster scaling (was 1.08 ≈ linear).
export const PRIMARY_STAT_POWER_CURVE = 1.12;

// --- v2 revamp tuning knobs ---
/** HP per point of CON (on top of the class base HP). */
export const CON_HP_FACTOR = 8;
/**
 * Effective DEF granted per *invested* stat point (gear/STR DEF stay 1:1). Flat
 * DEF's mitigation decays against exponential monster ATK, so at 1:1 a CON point
 * always out-values a DEF point and pure-CON dominates. At ~2.5 a balanced CON+DEF
 * split becomes the best tank investment in early/mid game, while CON still leads
 * deep into the run — so both stats are worth taking. (See engine/stats.ts.)
 */
export const DEF_INVEST_FACTOR = 2.5;
/** HP regenerated each tick as a fraction of max HP, per point of CON (tiny). */
export const CON_REGEN_FACTOR = 0.0004;

export const STAT_NAMES: Record<StatName, string> = {
  str: 'STR', con: 'CON', def: 'DEF', dex: 'DEX',
  agl: 'AGL', int: 'INT', critChance: 'Crit Chance', critDmg: 'Crit DMG',
};

export const STAT_KEYS = Object.keys(STAT_NAMES) as StatName[];

export const DISPLAY_STATS: Record<string, string> = {
  atk: 'ATK', def: 'DEF', hp: 'HP', accuracy: 'Accuracy',
  evasion: 'Evasion', critChance: 'Crit Chance', critDmg: 'Crit DMG',
};

export const FINAL_BOSS_BASE_STATS = {
  name: 'The Chronos Tyrant',
  hp: 450000,
  atk: 75000,
  def: 150000,
  gold: 50000,
  xp: 0,
} as const;

/** DEX contributes to crit chance (finesse identity); AGL → evasion + attack speed. */
export const DEX_CRIT_FACTOR = 0.0012;

// Per-class contribution coefficients used by getPlayerTotalStats.
export const STAT_CONTRIBUTIONS = {
  atk: {
    strContribution: { Warrior: 0.95, Rogue: 0.4, Wizard: 0.12 },
    intContribution: { Warrior: 0.08, Rogue: 0.12, Wizard: 0.9 },
    dexContribution: { Warrior: 0.12, Rogue: 0.8, Wizard: 0.15 },
    aglContribution: { Warrior: 0.15, Rogue: 0.55, Wizard: 0.2 },
  },
  defPerStr: { Warrior: 0.6, Rogue: 0.3, Wizard: 0.2 },
  trueDmg: {
    base: { Wizard: 0.05, Warrior: 0.0, Rogue: 0.0 },
    perInt: { Wizard: 0.0024, Warrior: 0.0008, Rogue: 0.001 },
    // Physical classes pierce armor by mastering their primary attack stat
    // (Warrior STR, Rogue DEX), so heavily-armored bosses no longer hard-counter
    // them. The Wizard's anti-armor identity comes from INT (perInt) instead, and
    // is capped lower than before so it leads on damage without dwarfing the rest.
    perPrimary: { Warrior: 0.0003, Rogue: 0.00032, Wizard: 0 },
    softCap: 0.35,
    hardCap: 0.6,
  },
} as const;
