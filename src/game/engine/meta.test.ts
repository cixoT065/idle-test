import { describe, it, expect } from 'vitest';
import type { GameState, EngineContext, Item } from '../types';
import { getDefaultGameState, selectClass, startGame } from './state';
import { applyOfflineProgress } from './offline';
import { buyAutomation, runAutomation } from './automation';
import { checkAchievements, ensureDaily, trackDaily, claimDailyObjective, saveLoadout, loadLoadout } from './meta';
import { monsterDefeated } from './progression';

function ctxOf(): EngineContext {
  let s = 42;
  return { rng: () => ((s = (s * 1103515245 + 12345) >>> 0), s / 4294967296), log: () => {}, onGameWon: () => {} };
}

function freshGame(): { state: GameState; ctx: EngineContext } {
  const ctx = ctxOf();
  const state = getDefaultGameState();
  selectClass(state, ctx, 'Warrior');
  startGame(state, ctx);
  return { state, ctx };
}

function makeItem(id: number, partial: Partial<Item> = {}): Item {
  return {
    id, type: 'helm', rarity: 'N', classReq: 'Warrior', name: 'Test Helm',
    setName: null, bonusStats: {}, enhancementLevel: 0,
    enhancementBonusStats: { str: 0, con: 0, def: 0, dex: 0, agl: 0, int: 0, critChance: 0, critDmg: 0 },
    con: 5, ...partial,
  } as Item;
}

describe('offline progression', () => {
  it('awards gold, xp and kills for time away', () => {
    const { state, ctx } = freshGame();
    const goldBefore = state.gold;
    const report = applyOfflineProgress(state, ctx, 3600 * 1000); // 1 hour
    expect(report).not.toBeNull();
    expect(report!.kills).toBeGreaterThan(0);
    expect(state.gold).toBeGreaterThan(goldBefore);
    // Gold grows by at least the reported kills' gold (offline can also trip
    // achievement payouts, so allow ≥).
    expect(state.gold - goldBefore).toBeGreaterThanOrEqual(report!.gold);
  });

  it('ignores brief absences', () => {
    const { state, ctx } = freshGame();
    expect(applyOfflineProgress(state, ctx, 5000)).toBeNull();
  });
});

describe('automation', () => {
  it('unlocks with rebirth points and auto-sells junk', () => {
    const { state, ctx } = freshGame();
    state.rebirth.points = 5;
    buyAutomation(state, ctx, 'autoSell');
    expect(state.automation.unlocked.autoSell).toBe(true);
    expect(state.rebirth.points).toBe(3);
    state.automation.autoSellRarity = 'N';
    state.inventory.push(makeItem(111));
    const goldBefore = state.gold;
    runAutomation(state, ctx);
    expect(state.inventory.find((i) => i.id === 111)).toBeUndefined();
    expect(state.gold).toBeGreaterThan(goldBefore);
  });

  it('does not unlock without enough points', () => {
    const { state, ctx } = freshGame();
    state.rebirth.points = 1;
    buyAutomation(state, ctx, 'autoBoss');
    expect(state.automation.unlocked.autoBoss).toBe(false);
  });
});

describe('achievements', () => {
  it('unlocks first blood and pays out', () => {
    const { state, ctx } = freshGame();
    state.stats.totalKills = 1;
    const goldBefore = state.gold;
    checkAchievements(state, ctx);
    expect(state.achievements).toContain('first_blood');
    expect(state.gold).toBe(goldBefore + 100);
    // idempotent — no double reward
    checkAchievements(state, ctx);
    expect(state.achievements.filter((a) => a === 'first_blood')).toHaveLength(1);
  });
});

describe('dailies', () => {
  it('rolls 3 objectives and supports claiming', () => {
    const { state, ctx } = freshGame();
    ensureDaily(state, ctx, Date.parse('2026-06-18T10:00:00Z'));
    expect(state.daily!.objectives).toHaveLength(3);
    const obj = state.daily!.objectives[0];
    trackDaily(state, obj.metric, obj.target);
    expect(state.daily!.objectives[0].progress).toBe(obj.target);
    const goldBefore = state.gold;
    const rpBefore = state.rebirth.points;
    claimDailyObjective(state, ctx, obj.id);
    expect(state.daily!.objectives[0].claimed).toBe(true);
    expect(state.gold + state.rebirth.points).toBeGreaterThan(goldBefore + rpBefore);
  });

  it('rerolls on a new day', () => {
    const { state, ctx } = freshGame();
    ensureDaily(state, ctx, Date.parse('2026-06-18T10:00:00Z'));
    const created = ensureDaily(state, ctx, Date.parse('2026-06-18T23:00:00Z'));
    expect(created).toBe(false); // same day
    const rerolled = ensureDaily(state, ctx, Date.parse('2026-06-19T01:00:00Z'));
    expect(rerolled).toBe(true);
  });
});

describe('loadouts', () => {
  it('saves and restores equipment', () => {
    const { state, ctx } = freshGame();
    const item = makeItem(222);
    state.inventory.push(item);
    state.equipment.helm = 222;
    saveLoadout(state, 0, 'Tank');
    state.equipment.helm = null;
    loadLoadout(state, ctx, 0);
    expect(state.equipment.helm).toBe(222);
  });
});

describe('endless waves', () => {
  it('advances past the old cap of 35', () => {
    const { state, ctx } = freshGame();
    state.wave = 35;
    state.currentMonster = { ...state.currentMonster!, monsterType: 'boss', hp: 0, name: 'Test Boss' };
    monsterDefeated(state, ctx);
    expect(state.wave).toBe(36);
  });
});
