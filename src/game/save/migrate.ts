import type { GameState } from '../types';
import { STAT_KEYS } from '../data/constants';
import { isCapstoneSkill } from '../data/skills';
import { getDefaultGameState, createDefaultPlayerTemp } from '../engine/state';

/**
 * Bring an arbitrary (possibly ancient) save object up to the current shape.
 * This is the TypeScript port of the legacy migrateSaveData plus a deepMerge
 * against a fresh default state, so missing fields are always populated.
 */
function migrateFields(loaded: Record<string, any>): Record<string, any> {
  if (Array.isArray(loaded.inventory)) {
    for (const item of loaded.inventory) {
      if (!item) continue;
      if (item.enhancementLevel === undefined) item.enhancementLevel = 0;
      if (item.reforges === undefined) item.reforges = 0;
      if (item.bonusStats === undefined) item.bonusStats = {};
      if (item.enhancementBonusStats === undefined) item.enhancementBonusStats = {};
      if (item.enhancementProgress) delete item.enhancementProgress;
      for (const statName of STAT_KEYS) {
        if (item.enhancementBonusStats[statName] === undefined) item.enhancementBonusStats[statName] = 0;
      }
    }
  }
  if (loaded.player) {
    if (loaded.player.promotionPending === undefined) loaded.player.promotionPending = false;
    if (loaded.player.pendingPromotionChoices === undefined) loaded.player.pendingPromotionChoices = null;
    if (loaded.player.activeSkills === undefined) loaded.player.activeSkills = [];
    if (loaded.player.buildFocus === undefined) loaded.player.buildFocus = 'balanced';
    // Skill-loadout split: proc skills the character learned become its starting
    // equipped loadout; passive capstones stay innate in activeSkills.
    if (!Array.isArray(loaded.player.equippedSkills)) {
      const learned: string[] = Array.isArray(loaded.player.activeSkills) ? loaded.player.activeSkills : [];
      loaded.player.equippedSkills = learned.filter((s) => !isCapstoneSkill(s));
      loaded.player.activeSkills = learned.filter((s) => isCapstoneSkill(s));
    }
  }
  if (loaded.maxWaveReached === undefined) loaded.maxWaveReached = loaded.wave || 1;
  if (loaded.finalBoss === undefined) loaded.finalBoss = null;
  if (loaded.finalBossDefeated === undefined) loaded.finalBossDefeated = false;
  if (loaded.totalBossesDefeatedInRun === undefined) loaded.totalBossesDefeatedInRun = 0;
  if (!Array.isArray(loaded.wagers)) loaded.wagers = [];
  return loaded;
}

function deepMerge<T extends Record<string, any>>(target: T, source: Record<string, any>): T {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') (target as any)[key] = {};
      deepMerge((target as any)[key], source[key]);
    } else {
      (target as any)[key] = source[key];
    }
  }
  return target;
}

export function isValidSave(loaded: unknown): loaded is Record<string, any> {
  const s = loaded as any;
  return !!s && !!s.player && !!s.player.baseStats;
}

/** Produce a clean, current-shape GameState from any persisted blob. */
export function migrateSave(loaded: Record<string, any>): GameState {
  const migrated = migrateFields(loaded);
  const merged = deepMerge(getDefaultGameState() as unknown as Record<string, any>, migrated) as unknown as GameState;
  // playerTemp is transient and never trustworthy from disk — always rebuild it.
  merged.playerTemp = createDefaultPlayerTemp();
  if (merged.player) merged.player.promotionPending = !!merged.player.pendingPromotionChoices;
  return merged;
}
