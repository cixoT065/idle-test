import type { GameState, EngineContext } from '../types';
import { getClassSkillCatalog, isCapstoneSkill, type CatalogSkill } from '../data/skills';

/** Active skill slots available — scales with level (3 at L1, +1 every 20 levels). */
export function getSkillSlots(state: GameState): number {
  return 3 + Math.floor((state.player?.level ?? 1) / 20);
}

/** The player's base-class catalog filtered to skills unlocked at their level. */
export function getUnlockedCatalog(state: GameState): CatalogSkill[] {
  const p = state.player;
  if (!p) return [];
  return getClassSkillCatalog(p.baseClassName).filter((s) => p.level >= s.unlockLevel);
}

/** Equipped proc skills that are still valid (unlocked + in catalog). Drives combat. */
export function getEquippedSkills(state: GameState): string[] {
  const p = state.player;
  if (!p?.equippedSkills?.length) return [];
  const unlocked = new Set(getUnlockedCatalog(state).map((s) => s.name));
  return p.equippedSkills.filter((s) => unlocked.has(s));
}

/** Slot a catalog skill into an open active slot. */
export function equipSkill(state: GameState, ctx: EngineContext, name: string): void {
  const p = state.player;
  if (!p) return;
  if (isCapstoneSkill(name)) return; // capstones are innate/free, never slotted
  if (!getUnlockedCatalog(state).some((s) => s.name === name)) {
    ctx.log('That skill is not unlocked yet.', 'log-error', 'event');
    return;
  }
  if (!p.equippedSkills) p.equippedSkills = [];
  if (p.equippedSkills.includes(name)) return;
  if (p.equippedSkills.length >= getSkillSlots(state)) {
    ctx.log('No free skill slots — unequip one first.', 'log-error', 'event');
    return;
  }
  p.equippedSkills.push(name);
  ctx.log(`Equipped skill: <span class="log-skill">${name}</span>.`, 'log-system', 'event');
}

export function unequipSkill(state: GameState, name: string): void {
  const p = state.player;
  if (!p?.equippedSkills) return;
  p.equippedSkills = p.equippedSkills.filter((s) => s !== name);
}

/**
 * Fill empty slots with unlocked catalog skills (foundational tiers first).
 * Never evicts a chosen skill, so it's safe to call on level-up / promotion to
 * keep idle players running a full skill bar without overriding their picks.
 */
export function autoFillSkillSlots(state: GameState): void {
  const p = state.player;
  if (!p) return;
  if (!p.equippedSkills) p.equippedSkills = [];
  const slots = getSkillSlots(state);
  for (const skill of getUnlockedCatalog(state)) {
    if (p.equippedSkills.length >= slots) break;
    if (!p.equippedSkills.includes(skill.name)) p.equippedSkills.push(skill.name);
  }
}
