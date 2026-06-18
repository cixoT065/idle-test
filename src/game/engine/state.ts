import type { GameState, EngineContext, PlayerTemp, BaseClassName, StatName, AutomationState, RunStats } from '../types';
import { classes } from '../data/classes';
import { getPlayerTotalStats } from './stats';
import { spawnMonster, weakenFinalBoss } from './loot';

export function createDefaultAutomation(): AutomationState {
  return {
    unlocked: { autoEquip: false, autoSell: false, autoBoss: false, autoPotion: false },
    autoEquip: false,
    autoSellRarity: 'off',
    autoBoss: false,
    autoPotionPct: 0,
  };
}

export function createDefaultStats(): RunStats {
  return { totalKills: 0, totalBosses: 0, totalGoldEarned: 0, lrDrops: 0, rebirths: 0, enhancements: 0 };
}

export function createDefaultPlayerTemp(): PlayerTemp {
  return {
    pointAllocation: { str: 0, con: 0, def: 0, dex: 0, agl: 0, int: 0, critChance: 0, critDmg: 0 },
    classSelection: null,
    promotionSelection: null,
    blacksmithSelection: null,
    lastEnhancementResult: null,
    standFirmTurns: 0,
    battleRushTurns: 0,
    battleRushStacks: 0,
    guaranteedCrit: false,
    guaranteedEvasion: false,
    attacksSinceLastFocus: 0,
    firstAttackCritUsed: false,
    evasionAtkBuffStacks: 0,
    evasionAtkBuffDuration: 0,
    shieldCharges: 0,
    invisibilityStacks: 0,
    invisibilityFirstAttack: false,
    timeFreezeCounter: 0,
    bleedSpreadOnKill: false,
  };
}

export function getDefaultGameState(): GameState {
  return {
    player: null,
    currentMonster: null,
    wave: 1,
    kills: 0,
    gold: 0,
    isRunning: false,
    potionCosts: { p25: 20, p50: 35, p75: 50, p100: 65 },
    inventory: [],
    equipment: { weapon: null, helm: null, body: null, legs: null, accessory: null },
    maxInventorySize: 80,
    rebirth: {
      points: 0,
      bonuses: { atk: 0, def: 0, hp: 0, gold: 0, xp: 0, critDmg: 0, dropRate: 0 },
    },
    activeBoosts: { xp: null },
    maxWaveReached: 1,
    finalBoss: null,
    finalBossDefeated: false,
    totalBossesDefeatedInRun: 0,
    playerTemp: createDefaultPlayerTemp(),
    lastSeen: Date.now(),
    automation: createDefaultAutomation(),
    stats: createDefaultStats(),
    achievements: [],
    daily: null,
    loadouts: [null, null, null],
    killStreak: 0,
    bestKillStreak: 0,
    wagers: [],
  };
}

/**
 * Reset per-run transient buffs and refill HP.
 * NOTE: the legacy version had a bug where the reset body was wrapped in a
 * nested function that was never invoked, so playerTemp was never actually
 * cleared. This restores the intended behaviour.
 */
export function resetTransientData(state: GameState): void {
  state.playerTemp = createDefaultPlayerTemp();
  if (state.player) {
    state.player.currentHp = getPlayerTotalStats(state).hp;
  }
}

export function selectClass(state: GameState, ctx: EngineContext, className: BaseClassName): void {
  const classInfo = classes[className];
  state.player = {
    name: 'Player-' + Math.floor(1000 + ctx.rng() * 9000),
    className,
    baseClassName: className,
    level: 1,
    xp: 0,
    xpToNextLevel: 40,
    statPoints: 5,
    baseStats: { ...classInfo.base },
    investedStats: { str: 0, con: 0, def: 0, dex: 0, agl: 0, int: 0, critChance: 0, critDmg: 0 } as Record<StatName, number>,
    currentHp: classInfo.base.hp,
    activeSkills: [],
    equippedSkills: [],
    promotionPending: false,
    pendingPromotionChoices: null,
    buildFocus: 'balanced',
  };
  resetTransientData(state);
  ctx.log(`You have chosen the path of the ${className}.`, 'log-system', 'event');
  startGame(state, ctx);
}

/** Begin/resume the idle loop: ensure a monster exists and mark running. */
export function startGame(state: GameState, ctx: EngineContext): void {
  state.isRunning = true;
  if (!state.currentMonster) spawnMonster(state, ctx);
  weakenFinalBoss(state);
}

/**
 * Reborn: keep rebirth progress, max wave and final-boss status; reset the run.
 * Returns the gained rebirth points, or null if not eligible.
 */
export function rebirth(state: GameState, ctx: EngineContext): number | null {
  if (!state.player || state.player.level < 70) {
    ctx.log('You must be at least level 70 to rebirth.', 'log-error', 'event');
    return null;
  }
  const pointsGained = Math.floor(Math.pow(state.player.level / 20, 2));
  const rebirthData = state.rebirth;
  rebirthData.points += pointsGained;
  const oldMaxWave = state.maxWaveReached;
  const oldFinalBossDefeated = state.finalBossDefeated;
  // Meta-progress survives rebirth; the final boss still resets to full strength
  // because the fresh state zeroes totalBossesDefeatedInRun.
  const keptAutomation = state.automation;
  const keptAchievements = state.achievements;
  const keptStats = state.stats;
  const keptDaily = state.daily;
  const keptBestStreak = state.bestKillStreak;

  const fresh = getDefaultGameState();
  Object.assign(state, fresh);
  state.rebirth = rebirthData;
  state.maxWaveReached = oldMaxWave;
  state.finalBossDefeated = oldFinalBossDefeated;
  state.automation = keptAutomation;
  state.achievements = keptAchievements;
  state.stats = keptStats;
  state.stats.rebirths++;
  state.daily = keptDaily;
  state.bestKillStreak = keptBestStreak;
  ctx.log(`You have been reborn! Gained ${pointsGained} Rebirth Points.`, 'log-system', 'event');
  return pointsGained;
}
