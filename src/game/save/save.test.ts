import { describe, it, expect } from 'vitest';
import { migrateSave, isValidSave } from './migrate';
import { getDefaultGameState } from '../engine/state';

describe('save migration', () => {
  it('rejects blobs without a player', () => {
    expect(isValidSave({})).toBe(false);
    expect(isValidSave({ player: {} })).toBe(false);
    expect(isValidSave({ player: { baseStats: {} } })).toBe(true);
  });

  it('fills in missing fields from defaults', () => {
    const ancient = {
      player: { baseStats: { hp: 120 }, baseClassName: 'Warrior', className: 'Warrior', level: 5 },
      inventory: [{ id: 1, type: 'weapon', rarity: 'N', str: 3 }],
      wave: 4,
    };
    const migrated = migrateSave(ancient as any);
    expect(migrated.maxWaveReached).toBe(4);
    expect(migrated.finalBossDefeated).toBe(false);
    expect(migrated.totalBossesDefeatedInRun).toBe(0);
    // Item gains the new structural fields.
    const item = migrated.inventory[0] as any;
    expect(item.enhancementLevel).toBe(0);
    expect(item.enhancementBonusStats.str).toBe(0);
    // playerTemp is always rebuilt fresh.
    expect(migrated.playerTemp.battleRushStacks).toBe(0);
    // Defaults present.
    expect(migrated.potionCosts).toEqual(getDefaultGameState().potionCosts);
  });

  it('marks promotion pending only when choices were stored', () => {
    const withChoices = {
      player: { baseStats: { hp: 1 }, pendingPromotionChoices: ['Knight', 'Berserker'] },
    };
    expect(migrateSave(withChoices as any).player!.promotionPending).toBe(true);
  });
});
