// Core domain types for Idle RPG Evolved.
// The legacy game treated items/stats as loosely-typed bags; we keep that
// flexibility via index signatures while still naming the known fields.

export type StatName =
  | 'str' | 'con' | 'def' | 'dex' | 'agl' | 'int' | 'critChance' | 'critDmg';

export type ItemType = 'weapon' | 'helm' | 'body' | 'legs' | 'accessory';

export type Rarity = 'N' | 'R' | 'SR' | 'SSR' | 'UR' | 'LR';

export type BaseClassName = 'Warrior' | 'Rogue' | 'Wizard';

/** A non-base modifier rolled on an item (lifesteal, hpPercent, reflectDamage, ...). */
export interface Affix {
  key: string;
  value: number;
}

export interface Item {
  id: number;
  type: ItemType;
  rarity: Rarity;
  classReq: BaseClassName;
  name: string;
  setName: string | null;
  bonusStats: Partial<Record<StatName, number>>;
  affixes?: Affix[];
  enhancementLevel: number;
  enhancementBonusStats: Record<StatName, number>;
  // Core/base rolled stats live directly on the item (str, def, int, ...).
  [key: string]: unknown;
}

export interface Player {
  name: string;
  className: string;
  baseClassName: BaseClassName;
  level: number;
  xp: number;
  xpToNextLevel: number;
  statPoints: number;
  baseStats: Record<string, number>;
  investedStats: Record<StatName, number>;
  currentHp: number;
  activeSkills: string[];
  promotionPending: boolean;
  pendingPromotionChoices: string[] | null;
}

export interface Debuff {
  duration: number;
  stacks?: number;
  damage?: number;
  canCrit?: boolean;
  isTrueDamage?: boolean;
  percent?: number;
}

export interface Monster {
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  evasion: number;
  accuracy: number;
  gold: number;
  xp: number;
  dropChance?: number;
  monsterType: string;
  isBoss?: boolean;
  debuffs: Record<string, Debuff>;
  missNextAttack: boolean;
  critChance?: number;
  critDmg?: number;
  immuneToCrits?: boolean;
  /** Elite/mutant affixes (Vampiric, Armored, ...) and the reward multiplier they grant. */
  modifiers?: string[];
  /** Rare elite "champion" — boosted stats, guaranteed rich loot. */
  isChampion?: boolean;
  /** Final-boss / wave-boss phase mechanics. */
  baseAtk?: number;
  enrageStacks?: number;
  phase?: number;
  shielded?: boolean;
}

export interface PlayerTemp {
  pointAllocation: Record<StatName, number>;
  classSelection: string | null;
  promotionSelection: string | null;
  blacksmithSelection: ItemType | null;
  lastEnhancementResult: { stat: StatName } | null;
  standFirmTurns: number;
  battleRushTurns: number;
  battleRushStacks: number;
  guaranteedCrit: boolean;
  guaranteedEvasion: boolean;
  attacksSinceLastFocus: number;
  firstAttackCritUsed: boolean;
  evasionAtkBuffStacks: number;
  evasionAtkBuffDuration: number;
  shieldCharges: number;
  invisibilityStacks: number;
  invisibilityFirstAttack: boolean;
  timeFreezeCounter: number;
  bleedSpreadOnKill: boolean;
}

export interface RebirthState {
  points: number;
  bonuses: {
    atk: number;
    def: number;
    hp: number;
    gold: number;
    xp: number;
    critDmg: number;
    dropRate: number;
  };
}

/** Auto-play behaviours, each unlocked once with rebirth points. */
export interface AutomationState {
  unlocked: { autoEquip: boolean; autoSell: boolean; autoBoss: boolean; autoPotion: boolean };
  autoEquip: boolean;
  /** Auto-sell unequipped drops at or below this rarity ('off' disables). */
  autoSellRarity: Rarity | 'off';
  autoBoss: boolean;
  /** Auto-quaff a potion when HP falls to/below this % (0 disables). */
  autoPotionPct: number;
}

/** Lifetime counters that drive achievements and daily objectives. */
export interface RunStats {
  totalKills: number;
  totalBosses: number;
  totalGoldEarned: number;
  lrDrops: number;
  rebirths: number;
  enhancements: number;
}

export type DailyMetric = 'kills' | 'bosses' | 'gold' | 'enhance' | 'drops';

export interface DailyObjective {
  id: string;
  desc: string;
  metric: DailyMetric;
  target: number;
  progress: number;
  reward: { gold?: number; rebirthPoints?: number };
  claimed: boolean;
}

export interface DailyState {
  date: string; // YYYY-MM-DD
  objectives: DailyObjective[];
  loginClaimed: boolean;
  streak: number;
}

/** A saved gear preset for fast farm/boss swapping. */
export interface Loadout {
  name: string;
  equipment: Record<ItemType, number | null>;
}

export interface GameState {
  player: Player | null;
  currentMonster: Monster | null;
  wave: number;
  kills: number;
  gold: number;
  isRunning: boolean;
  potionCosts: { p25: number; p50: number; p75: number; p100: number };
  inventory: Item[];
  equipment: Record<ItemType, number | null>;
  maxInventorySize: number;
  rebirth: RebirthState;
  activeBoosts: { xp: { multiplier: number; fightsRemaining: number } | null };
  maxWaveReached: number;
  finalBoss: Monster | null;
  finalBossDefeated: boolean;
  totalBossesDefeatedInRun: number;
  playerTemp: PlayerTemp;
  // --- meta / retention systems ---
  lastSeen: number;
  automation: AutomationState;
  stats: RunStats;
  achievements: string[];
  daily: DailyState | null;
  loadouts: (Loadout | null)[];
  killStreak: number;
  bestKillStreak: number;
}

/** Computed/derived combat stats produced by getPlayerTotalStats. */
export interface TotalStats {
  hp: number;
  atk: number;
  def: number;
  accuracy: number;
  evasion: number;
  critChance: number;
  critDmg: number;
  trueDmgBonus: number;
  trueDmgBonusPercent: string;
  lifesteal: number;
  skillLifesteal: number;
  activeSets: Record<string, number>;
  [key: string]: unknown;
}

export type LogType = 'event' | 'battle';

export interface LogEntry {
  message: string;
  className: string;
  logType: LogType;
}

/** Side-effect channel passed into engine functions instead of touching the DOM. */
export interface EngineContext {
  log: (message: string, className?: string, logType?: LogType) => void;
  /** Injectable RNG for deterministic tests; defaults to Math.random. */
  rng: () => number;
  /** Raised when the player wins the whole game (final boss defeated). */
  onGameWon?: () => void;
}
