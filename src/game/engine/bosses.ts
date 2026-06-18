import type { GameState, EngineContext, Monster } from '../types';
import { monsterModifiers } from '../data/monsters';
import { getPlayerTotalStats } from './stats';

const MODIFIER_KEYS = Object.keys(monsterModifiers);

/**
 * Roll 0–2 affixes onto a freshly-spawned mutant/elite monster, apply their
 * spawn-time stat changes, and prefix the name. Bosses are never modified.
 */
export function applyMonsterModifiers(ctx: EngineContext, monster: Monster): void {
  if (monster.monsterType !== 'mutant' && monster.monsterType !== 'elite') return;
  const rng = ctx.rng;
  // 50% none, 35% one, 15% two.
  const roll = rng();
  const count = roll < 0.5 ? 0 : roll < 0.85 ? 1 : 2;
  if (count === 0) return;

  const pool = [...MODIFIER_KEYS];
  const chosen: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }

  for (const key of chosen) {
    const mod = monsterModifiers[key];
    if (mod.defMult) monster.def = Math.round(monster.def * mod.defMult);
    if (mod.atkMult) monster.atk = Math.round(monster.atk * mod.atkMult);
    if (mod.hpMult) { monster.hp = Math.round(monster.hp * mod.hpMult); monster.maxHp = Math.round(monster.maxHp * mod.hpMult); }
    if (mod.evasionAdd) monster.evasion += mod.evasionAdd;
  }
  monster.modifiers = chosen;
  monster.name = `${chosen.join(' ')} ${monster.name}`;
}

/** Combined reward multiplier from a monster's affixes (1 if none). */
export function getModifierRewardMult(monster: Monster): number {
  if (!monster.modifiers?.length) return 1;
  return monster.modifiers.reduce((m, key) => m * (monsterModifiers[key]?.rewardMult ?? 1), 1);
}

/** Vampiric monsters heal when they damage the player. Called after a monster hit. */
export function applyModifierOnPlayerHit(state: GameState, ctx: EngineContext, damageDealt: number): void {
  const monster = state.currentMonster;
  if (!monster?.modifiers?.includes('Vampiric') || damageDealt <= 0) return;
  const heal = Math.round(damageDealt * (monsterModifiers.Vampiric.lifesteal ?? 0));
  if (heal <= 0) return;
  monster.hp = Math.min(monster.maxHp, monster.hp + heal);
  ctx.log(`${monster.name} drains ${heal} HP from you!`, 'log-monster', 'battle');
}

/** Volatile monsters detonate on death, hurting the player. Called from monsterDefeated. */
export function applyModifierOnDeath(state: GameState, ctx: EngineContext): void {
  const monster = state.currentMonster;
  const p = state.player;
  if (!monster?.modifiers?.includes('Volatile') || !p) return;
  const maxHp = getPlayerTotalStats(state).hp;
  const burst = Math.round(maxHp * (monsterModifiers.Volatile.deathBurstPct ?? 0));
  p.currentHp = Math.max(0, p.currentHp - burst);
  ctx.log(`${monster.name} explodes for ${burst} damage as it dies!`, 'log-monster', 'battle');
}

/**
 * Boss & final-boss phase transitions, triggered as the boss loses HP.
 * Phase 1 (<50% HP): enrage — ATK ramps. Phase 2 (<25% HP): frenzy — more ATK + evasion.
 */
export function advanceBossPhase(state: GameState, ctx: EngineContext): void {
  const monster = state.currentMonster as (Monster & { isFinalBoss?: boolean }) | null;
  if (!monster) return;
  const isBoss = monster.monsterType === 'boss' || monster.isFinalBoss;
  if (!isBoss || monster.hp <= 0) return;

  if (monster.baseAtk === undefined) monster.baseAtk = monster.atk;
  if (monster.phase === undefined) monster.phase = 0;
  const hpPercent = monster.hp / monster.maxHp;

  if (monster.phase < 1 && hpPercent <= 0.5) {
    monster.phase = 1;
    monster.atk = Math.round(monster.baseAtk * 1.6);
    monster.critChance = (monster.critChance ?? 0.1) + 0.1;
    ctx.log(`${monster.name} ENRAGES, striking harder!`, 'log-monster', 'event');
  }
  if (monster.phase < 2 && hpPercent <= 0.25) {
    monster.phase = 2;
    monster.atk = Math.round(monster.baseAtk * 2.2);
    monster.evasion += 0.1;
    ctx.log(`${monster.name} enters a desperate frenzy!`, 'log-monster', 'event');
  }
}
