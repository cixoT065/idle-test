import { describe, it, expect } from 'vitest';
import type { EngineContext, GameState, Item, ItemType, Rarity } from '../types';
import {
  getDefaultGameState,
  selectClass,
  runTick,
  getPlayerTotalStats,
  investStat,
  sellItems,
  sellByRarity,
  getActiveSkills,
  generateItemDrop,
  getModifierRewardMult,
  applyModifierOnPlayerHit,
  applyPromotion,
  canChallengeWaveBoss,
  challengeWaveBoss,
  advanceBossPhase,
} from './index';
import { itemData } from '../data/items';

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCtx(seed = 1): EngineContext {
  return { rng: mulberry32(seed), log: () => {} };
}

function newWarrior(seed = 1): GameState {
  const state = getDefaultGameState();
  selectClass(state, makeCtx(seed), 'Warrior');
  return state;
}

describe('character creation', () => {
  it('creates a level-1 warrior with a monster to fight', () => {
    const state = newWarrior();
    expect(state.player?.baseClassName).toBe('Warrior');
    expect(state.player?.level).toBe(1);
    expect(state.currentMonster).not.toBeNull();
    expect(state.isRunning).toBe(true);
  });
});

describe('derived stats', () => {
  it('computes positive atk/hp/def', () => {
    const state = newWarrior();
    const stats = getPlayerTotalStats(state);
    expect(stats.atk).toBeGreaterThan(0);
    expect(stats.hp).toBeGreaterThan(0);
    expect(stats.def).toBeGreaterThan(0);
  });

  it('investing STR raises ATK', () => {
    const state = newWarrior();
    const before = getPlayerTotalStats(state).atk;
    investStat(state, 'str', 5);
    const after = getPlayerTotalStats(state).atk;
    expect(after).toBeGreaterThan(before);
  });
});

describe('combat tick', () => {
  it('damages the monster over a few ticks', () => {
    const state = newWarrior(42);
    const ctx = makeCtx(42);
    const startHp = state.currentMonster!.hp;
    const startMonster = state.currentMonster!.name;
    for (let i = 0; i < 3; i++) runTick(state, ctx);
    // Either the same monster lost HP, or it died and a new one spawned.
    const progressed = state.currentMonster!.name !== startMonster || state.currentMonster!.hp < startHp;
    expect(progressed).toBe(true);
  });

  it('never lets the player drop below 0 HP without reviving', () => {
    const state = newWarrior(7);
    const ctx = makeCtx(7);
    for (let i = 0; i < 50; i++) runTick(state, ctx);
    expect(state.player!.currentHp).toBeGreaterThanOrEqual(0);
  });
});

function makeItem(id: number, rarity: Rarity, opts: Partial<Item> = {}): Item {
  return {
    id,
    type: 'weapon',
    rarity,
    classReq: 'Warrior',
    name: `Item ${id}`,
    setName: null,
    bonusStats: {},
    enhancementLevel: 0,
    enhancementBonusStats: {} as Item['enhancementBonusStats'],
    ...opts,
  };
}

/** Put an item in the inventory and equip it in its slot. */
function equip(state: GameState, item: Item): void {
  state.inventory.push(item);
  state.equipment[item.type] = item.id;
}

describe('stack-selling', () => {
  it('sells the given ids and credits their combined value', () => {
    const state = newWarrior();
    state.inventory = [makeItem(1, 'N'), makeItem(2, 'SR'), makeItem(3, 'SSR')];
    state.gold = 0;
    sellItems(state, makeCtx(), [1, 2]);
    expect(state.inventory.map((i) => i.id)).toEqual([3]);
    expect(state.gold).toBe(itemData.rarities.N.value + itemData.rarities.SR.value);
  });

  it('never sells equipped items', () => {
    const state = newWarrior();
    state.inventory = [makeItem(1, 'R'), makeItem(2, 'R')];
    state.equipment.weapon = 1;
    state.gold = 0;
    sellItems(state, makeCtx(), [1, 2]);
    expect(state.inventory.map((i) => i.id)).toEqual([1]);
    expect(state.gold).toBe(itemData.rarities.R.value);
  });

  it('sellByRarity only sells the matching rarity', () => {
    const state = newWarrior();
    state.inventory = [makeItem(1, 'N'), makeItem(2, 'R'), makeItem(3, 'N')];
    state.gold = 0;
    sellByRarity(state, makeCtx(), 'N');
    expect(state.inventory.map((i) => i.id)).toEqual([2]);
    expect(state.gold).toBe(itemData.rarities.N.value * 2);
  });
});

function newWizard(seed = 1): GameState {
  const state = getDefaultGameState();
  selectClass(state, makeCtx(seed), 'Wizard');
  return state;
}

describe('stats revamp', () => {
  it('HP uses class base HP + CON and rebirth HP is multiplicative', () => {
    const state = newWarrior();
    const baseHp = state.player!.baseStats.hp; // 120 for Warrior
    const con = state.player!.baseStats.con; // 8
    expect(getPlayerTotalStats(state).hp).toBe(baseHp + con * 8);

    state.rebirth.bonuses.hp = 1; // +100%
    expect(getPlayerTotalStats(state).hp).toBe((baseHp + con * 8) * 2);
  });

  it('item affixes feed derived stats (hpPercent, lifesteal)', () => {
    const state = newWarrior();
    const before = getPlayerTotalStats(state);
    equip(state, makeItem(900, 'LR', { type: 'accessory', affixes: [{ key: 'hpPercent', value: 0.5 }, { key: 'lifesteal', value: 0.1 }] }));
    const after = getPlayerTotalStats(state);
    expect(after.hp).toBeCloseTo(before.hp * 1.5, 5);
    expect(after.lifesteal).toBeCloseTo(0.1, 5);
  });
});

describe('capstones & set skills', () => {
  it('a passive capstone (Arcane Mastery) multiplies ATK', () => {
    const state = newWizard();
    const before = getPlayerTotalStats(state).atk;
    state.player!.activeSkills.push('Arcane Mastery'); // +30% ATK
    const after = getPlayerTotalStats(state).atk;
    expect(after).toBeCloseTo(before * 1.3, 4);
  });

  it('equipping enough set pieces grants the set skill', () => {
    const state = newWarrior();
    const setName = "Colossus's Earth-Shattering Plate"; // 4pc grants Aegis Block
    const slots: ItemType[] = ['weapon', 'helm', 'body', 'legs'];
    slots.forEach((slot, i) => equip(state, makeItem(800 + i, 'LR', { type: slot, setName })));
    expect(getActiveSkills(state)).toContain('Aegis Block');
  });
});

describe('drops & monster modifiers', () => {
  it('drops are biased toward the player class', () => {
    const state = newWarrior(11);
    const ctx = makeCtx(11);
    let own = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      state.inventory = [];
      generateItemDrop(state, ctx, state.currentMonster!);
      if (state.inventory[0]?.classReq === 'Warrior') own++;
    }
    expect(own / N).toBeGreaterThan(0.6);
  });

  it('Vampiric monsters heal when they damage the player; modifiers boost rewards', () => {
    const state = newWarrior();
    state.currentMonster = { ...state.currentMonster!, hp: 50, maxHp: 100, modifiers: ['Vampiric'] };
    applyModifierOnPlayerHit(state, makeCtx(), 20);
    expect(state.currentMonster.hp).toBe(56); // 50 + round(20 * 0.3)
    expect(getModifierRewardMult(state.currentMonster)).toBeCloseTo(1.5, 5);
  });
});

describe('full automated run (smoke)', () => {
  it('auto-plays without errors: gears up, promotes, levels and advances waves', () => {
    const state = newWarrior(123);
    const ctx = makeCtx(123);

    // Equip any usable drop that raises ATK or HP — a crude "auto-gear" player.
    const autoGear = () => {
      for (const item of state.inventory) {
        if (item.classReq !== state.player!.baseClassName || state.equipment[item.type] === item.id) continue;
        const cur = getPlayerTotalStats(state);
        const next = getPlayerTotalStats(state, item);
        if (next.atk + next.hp > cur.atk + cur.hp) state.equipment[item.type] = item.id;
      }
    };

    let geared = false;
    for (let i = 0; i < 40000 && !state.finalBossDefeated; i++) {
      const p = state.player!;
      if (p.promotionPending && p.pendingPromotionChoices) applyPromotion(state, ctx, p.pendingPromotionChoices[0]);
      if (p.statPoints > 0) investStat(state, 'str', p.statPoints);
      // Re-gear only when new loot arrives (keeps the hot loop cheap).
      if (state.inventory.length && !geared) { autoGear(); geared = true; }
      else if (state.kills === 9) { autoGear(); }
      if (canChallengeWaveBoss(state)) challengeWaveBoss(state, ctx);
      runTick(state, ctx);
    }

    expect(state.player!.level).toBeGreaterThan(15);
    expect(state.maxWaveReached).toBeGreaterThan(1);
    expect(state.player!.currentHp).toBeGreaterThanOrEqual(0);
  });
});

describe('boss phases', () => {
  it('a boss enrages below 50% and frenzies below 25%', () => {
    const state = newWarrior();
    const ctx = makeCtx();
    state.kills = 10; // unlock the boss challenge
    challengeWaveBoss(state, ctx);
    const boss = state.currentMonster!;
    expect(boss.monsterType).toBe('boss');
    advanceBossPhase(state, ctx); // sets baseAtk at full HP, no phase yet
    const baseAtk = boss.atk;

    boss.hp = boss.maxHp * 0.4;
    advanceBossPhase(state, ctx);
    expect(boss.phase).toBe(1);
    expect(boss.atk).toBe(Math.round(baseAtk * 1.6));

    boss.hp = boss.maxHp * 0.2;
    advanceBossPhase(state, ctx);
    expect(boss.phase).toBe(2);
    expect(boss.atk).toBe(Math.round(baseAtk * 2.2));
  });
});
