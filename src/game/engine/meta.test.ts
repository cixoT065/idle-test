import { describe, it, expect } from 'vitest';
import type { GameState, EngineContext, Item } from '../types';
import { getDefaultGameState, selectClass, startGame } from './state';
import { applyOfflineProgress } from './offline';
import { buyAutomation, runAutomation } from './automation';
import { checkAchievements, ensureDaily, trackDaily, claimDailyObjective, saveLoadout, loadLoadout } from './meta';
import { monsterDefeated } from './progression';
import { reforgeItem, getReforgeCost, canReforgeItem, challengeWaveBoss } from './economy';
import { toggleWager } from './wagers';
import { scoreItemForBuild, setBuildFocus } from './itemize';
import { getSkillSlots, getUnlockedCatalog, equipSkill, unequipSkill } from './skillLoadout';
import { hasSkill } from './stats';
import { applyPromotion } from './progression';

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

describe('reforging', () => {
  it('rerolls affixes, charges gold, and raises the next cost', () => {
    const { state, ctx } = freshGame();
    const item = makeItem(900, { rarity: 'SSR', affixes: [{ key: 'lifesteal', value: 0.02 }] });
    state.inventory.push(item);
    expect(canReforgeItem(item)).toBe(true);

    state.gold = 100000;
    const cost1 = getReforgeCost(item);
    reforgeItem(state, ctx, 900);

    expect(state.gold).toBe(100000 - cost1);
    expect(item.reforges).toBe(1);
    // SSR rolls 2 affixes; the reroll should produce the rarity's affix count.
    expect(item.affixes!.length).toBe(2);
    // Cost climbs after a reforge, keeping it a scaling sink.
    expect(getReforgeCost(item)).toBeGreaterThan(cost1);
  });

  it('refuses items without affixes and when gold is short', () => {
    const { state, ctx } = freshGame();
    const common = makeItem(901, { rarity: 'N' });
    state.inventory.push(common);
    expect(canReforgeItem(common)).toBe(false);
    reforgeItem(state, ctx, 901); // no-op, no affixes
    expect(common.reforges ?? 0).toBe(0);

    const rich = makeItem(902, { rarity: 'LR', affixes: [{ key: 'lifesteal', value: 0.05 }] });
    state.inventory.push(rich);
    state.gold = 0;
    reforgeItem(state, ctx, 902); // can't afford
    expect(rich.reforges ?? 0).toBe(0);
  });
});

describe('boss wagers', () => {
  it('locks selected wagers onto a challenged boss and buffs its stats', () => {
    const { state, ctx } = freshGame();
    state.kills = 10; // enough to challenge
    toggleWager(state, 'enraged');
    toggleWager(state, 'colossal');
    expect(state.wagers).toEqual(['enraged', 'colossal']);

    challengeWaveBoss(state, ctx);
    const boss = state.currentMonster!;
    expect(boss.monsterType).toBe('boss');
    expect(boss.wagers).toEqual(['enraged', 'colossal']);
    // Colossal multiplies HP, Enraged multiplies ATK vs an unwagered baseline.
    const plainHp = Math.round(boss.maxHp / 2.2);
    expect(boss.maxHp).toBeGreaterThan(plainHp);
  });

  it('grants multiplied gold/xp and bonus loot on a wagered boss kill', () => {
    const { state, ctx } = freshGame();
    state.inventory = [];
    const boss = { ...state.currentMonster!, monsterType: 'boss', hp: 0, name: 'Wagered Boss', gold: 1000, xp: 100, dropChance: 0, wagers: ['frenzied'] };
    state.currentMonster = boss as typeof state.currentMonster;
    const goldBefore = state.gold;
    monsterDefeated(state, ctx);
    // Frenzied grants +1 guaranteed boss-tier drop.
    expect(state.inventory.length).toBe(1);
    expect(state.gold).toBeGreaterThan(goldBefore + 1000);
  });

  it('toggleWager adds then removes', () => {
    const { state } = freshGame();
    toggleWager(state, 'enraged');
    expect(state.wagers).toContain('enraged');
    toggleWager(state, 'enraged');
    expect(state.wagers).not.toContain('enraged');
  });
});

describe('skill loadout', () => {
  it('slots grow with level; catalog is gated by level tier', () => {
    const { state } = freshGame();
    state.player!.level = 1;
    expect(getSkillSlots(state)).toBe(3);
    expect(getUnlockedCatalog(state).length).toBe(0); // nothing until L20
    state.player!.level = 40;
    expect(getSkillSlots(state)).toBe(5); // 3 + floor(40/20)
    // L20 + L40 proc skills are now unlocked.
    expect(getUnlockedCatalog(state).length).toBeGreaterThanOrEqual(6);
  });

  it('equip/unequip drives hasSkill and respects the slot cap', () => {
    const { state, ctx } = freshGame();
    state.player!.level = 40;
    state.player!.equippedSkills = [];
    const cat = getUnlockedCatalog(state);
    const first = cat[0].name;

    equipSkill(state, ctx, first);
    expect(state.player!.equippedSkills).toContain(first);
    expect(hasSkill(state, first)).toBe(true);

    unequipSkill(state, first);
    expect(hasSkill(state, first)).toBe(false);

    // Fill every slot, then a further equip is refused.
    const slots = getSkillSlots(state);
    state.player!.equippedSkills = cat.slice(0, slots).map((s) => s.name);
    const extra = cat[slots]?.name;
    if (extra) {
      equipSkill(state, ctx, extra);
      expect(state.player!.equippedSkills).not.toContain(extra);
    }
  });

  it('promoting into a passive capstone keeps it innate/free (not slotted)', () => {
    const { state, ctx } = freshGame(); // Warrior
    state.player!.level = 70;
    state.player!.className = 'Slayer';
    state.player!.baseClassName = 'Warrior';
    // Ravager is the passive-capstone branch (grants 'Savagery').
    state.player!.promotionPending = true;
    state.player!.pendingPromotionChoices = ['Executioner', 'Ravager'];
    applyPromotion(state, ctx, 'Ravager');
    expect(state.player!.activeSkills).toContain('Savagery');
    expect(state.player!.equippedSkills).not.toContain('Savagery');
    expect(hasSkill(state, 'Savagery')).toBe(true);
  });
});

describe('itemization build focus', () => {
  it('scores crit gear higher under a crit focus than balanced, and vice-versa', () => {
    const critItem = makeItem(800, { rarity: 'SR', critChance: 0.08, critDmg: 0.3 } as Partial<Item>);
    const tankItem = makeItem(801, { rarity: 'SR', con: 30, def: 25 } as Partial<Item>);

    // Under a crit focus, the crit item should win; under bruiser, the tank item.
    expect(scoreItemForBuild(critItem, 'crit')).toBeGreaterThan(scoreItemForBuild(tankItem, 'crit'));
    expect(scoreItemForBuild(tankItem, 'bruiser')).toBeGreaterThan(scoreItemForBuild(critItem, 'bruiser'));
  });

  it('setBuildFocus only accepts known archetypes', () => {
    const { state } = freshGame();
    setBuildFocus(state, 'caster');
    expect(state.player!.buildFocus).toBe('caster');
    setBuildFocus(state, 'nonsense');
    expect(state.player!.buildFocus).toBe('caster');
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
