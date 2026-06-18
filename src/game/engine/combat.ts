import type { GameState, EngineContext, Monster, TotalStats } from '../types';
import { getPlayerTotalStats, hasSkill } from './stats';
import { monsterDefeated, playerDefeated } from './progression';
import { applyModifierOnPlayerHit, advanceBossPhase } from './bosses';

export interface DamageResult {
  damage: number;
  isCrit: boolean;
  preMitigationDamage: number;
  instantKill?: boolean;
}

type Combatant = TotalStats | Monster;
const n = (v: unknown): number => (typeof v === 'number' ? v : 0);

/** Faithful port of the legacy calculateDamage. */
export function calculateDamage(
  state: GameState,
  ctx: EngineContext,
  attacker: Combatant,
  defender: Combatant,
  isPlayerAttacker: boolean,
): DamageResult {
  const p = state.player!;
  const monster = state.currentMonster!;
  const rng = ctx.rng;

  const MIN_HIT_CHANCE = 0.25;
  const MAX_HIT_CHANCE = 0.95;
  const defenderEvasion = n((defender as Monster).evasion);
  const attackerAccuracy = n((attacker as Monster).accuracy);
  let hitChance = 0.9 + attackerAccuracy - defenderEvasion;
  hitChance = Math.max(MIN_HIT_CHANCE, Math.min(MAX_HIT_CHANCE, hitChance));

  if (!isPlayerAttacker && monster.debuffs && monster.debuffs['Blind']) hitChance *= 0.75;

  if (rng() > hitChance) {
    if (isPlayerAttacker) ctx.log('Your attack was evaded!', 'log-system', 'battle');
    else ctx.log(`${(attacker as Monster).name}'s attack was evaded!`, 'log-system', 'battle');
    return { damage: 0, isCrit: false, preMitigationDamage: 0 };
  }

  let isCrit = false;
  if (isPlayerAttacker) {
    state.playerTemp.attacksSinceLastFocus++;
    if ((attacker as TotalStats).firstAttackCrit && !state.playerTemp.firstAttackCritUsed) {
      isCrit = true;
      state.playerTemp.firstAttackCritUsed = true;
      ctx.log("Phantom's Mirage guarantees a critical hit!", 'log-skill', 'battle');
    } else if (hasSkill(state, 'Focus') && state.playerTemp.attacksSinceLastFocus >= 3) {
      isCrit = true;
      state.playerTemp.attacksSinceLastFocus = 0;
      ctx.log('Focus guarantees a critical hit!', 'log-skill', 'battle');
    } else if (state.playerTemp.guaranteedCrit) {
      isCrit = true;
      state.playerTemp.guaranteedCrit = false;
      ctx.log('Shadow Step guarantees a critical hit!', 'log-skill', 'battle');
    }
    if (state.playerTemp.invisibilityStacks > 0) state.playerTemp.invisibilityStacks--;
  }

  if (!isCrit) isCrit = rng() < n((attacker as Monster).critChance);
  if (!isPlayerAttacker && (defender as TotalStats).immuneToCrits) isCrit = false;

  let critMultiplier = isCrit ? n((attacker as Monster).critDmg) || 1.5 : 1;
  if (isCrit && isPlayerAttacker) {
    if (hasSkill(state, 'Lethal Precision') && state.playerTemp.attacksSinceLastFocus === 0) critMultiplier += 0.55;
  }

  let calculatedAtk = n((attacker as Monster).atk) * critMultiplier;

  if (isPlayerAttacker && state.playerTemp.invisibilityFirstAttack) {
    calculatedAtk *= 2.0;
    state.playerTemp.invisibilityFirstAttack = false;
    ctx.log('Invisible strike deals double damage!', 'log-skill', 'battle');
  }

  let damageMultiplier = 1.0;
  const defMonsterType = (defender as Monster).monsterType;
  if (isPlayerAttacker && !defMonsterType?.includes('boss')) {
    let executeThreshold = 0.3;
    const executeBonus = 1.0;
    let instantKillThreshold = 0.15;
    if (hasSkill(state, 'Cull the Weak')) {
      executeThreshold = 0.4;
      instantKillThreshold = 0.2;
    }
    const hpPercent = monster.hp / monster.maxHp;
    if (hasSkill(state, 'Execute') && hpPercent <= instantKillThreshold) {
      ctx.log('Execute instantly slays the weakened enemy!', 'log-skill', 'battle');
      return { damage: monster.hp, isCrit: true, preMitigationDamage: monster.hp, instantKill: true };
    } else if (hasSkill(state, 'Execute') && hpPercent <= executeThreshold) {
      damageMultiplier += executeBonus;
    }
  }

  calculatedAtk *= damageMultiplier;

  let trueDamage = 0;
  let normalAtk = calculatedAtk;
  const trueDmgBonus = n((attacker as TotalStats).trueDmgBonus);
  if (isPlayerAttacker && trueDmgBonus > 0) {
    trueDamage = Math.round(calculatedAtk * trueDmgBonus);
    if (hasSkill(state, 'Frenzy')) {
      const missingHpPercent = 1 - p.currentHp / n((attacker as TotalStats).hp);
      const frenzyTrueDmg = Math.floor(missingHpPercent / 0.05) * 0.01;
      trueDamage += Math.round(calculatedAtk * frenzyTrueDmg);
    }
    if (state.playerTemp.battleRushTurns > 0) trueDamage += Math.round(calculatedAtk * 0.1);
    normalAtk = calculatedAtk - trueDamage;
  }

  let defenderDef = n((defender as Monster).def);
  if (isPlayerAttacker && monster && monster.debuffs) {
    if (monster.debuffs['Sunder']) defenderDef *= 1 - (monster.debuffs['Sunder'].stacks ?? 0) * 0.1;
    if (monster.debuffs['Apocalypse']) defenderDef *= 0.85;
  }
  if (isPlayerAttacker && isCrit && (attacker as TotalStats).critIgnoresDef) {
    defenderDef *= 1 - n((attacker as TotalStats).critIgnoresDef);
  }

  const damageReduction = 1 - defenderDef / (defenderDef + 100 + normalAtk / 10);
  const mitigatedNormalDamage = Math.round(normalAtk * damageReduction);
  let finalDamage = mitigatedNormalDamage + trueDamage;

  if (trueDamage > 0) {
    ctx.log(`Attack splits into ${mitigatedNormalDamage} normal + <span style="color: #8888FF;">${trueDamage}</span> true damage!`, 'log-skill', 'battle');
  }

  if (isPlayerAttacker && (attacker as TotalStats).bonusCurrentHpDamage) {
    const bonusDmg = Math.round(n((defender as Monster).hp) * n((attacker as TotalStats).bonusCurrentHpDamage));
    finalDamage += bonusDmg;
    ctx.log(`Dragon-Slayer set burns for ${bonusDmg} bonus damage!`, 'log-skill', 'battle');
  }

  return { damage: Math.max(1, finalDamage), isCrit, preMitigationDamage: calculatedAtk };
}

/** Faithful port of handlePostPlayerAttackSkills (recursive for spell procs). */
export function handlePostPlayerAttackSkills(
  state: GameState,
  ctx: EngineContext,
  playerStats: TotalStats,
  playerDamage: DamageResult,
  skillDamage: number,
): void {
  const p = state.player!;
  const monster = state.currentMonster!;
  const rng = ctx.rng;
  const totalDamage = playerDamage.damage + skillDamage;

  let totalLifesteal = n(playerStats.lifesteal);
  if (skillDamage > 0) totalLifesteal += n(playerStats.skillLifesteal);
  if (hasSkill(state, 'Unyielding Assault') && state.playerTemp.battleRushStacks > 0) totalLifesteal += 0.1;

  if (totalLifesteal > 0 && totalDamage > 0) {
    const healAmount = Math.round(totalDamage * totalLifesteal);
    p.currentHp = Math.min(playerStats.hp, p.currentHp + healAmount);
    ctx.log(`Lifesteal heals you for ${healAmount} HP.`, 'log-skill', 'battle');
  }

  if (skillDamage > 0) return;

  if (hasSkill(state, 'Aegis Block') && rng() < 0.15) {
    const charges = hasSkill(state, 'Stand Firm') ? 2 : 1;
    state.playerTemp.shieldCharges = (state.playerTemp.shieldCharges || 0) + charges;
    ctx.log(`You gain ${charges} Shield Charge${charges > 1 ? 's' : ''}!`, 'log-skill', 'battle');
  }

  if (hasSkill(state, 'Double Shot') && rng() < 0.2) {
    const secondShotDmg = Math.round(playerDamage.damage * 0.8);
    monster.hp -= secondShotDmg;
    ctx.log(`Double Shot hits for an extra ${secondShotDmg} damage!`, 'log-skill', 'battle');
  }

  if (hasSkill(state, 'Shadow Step') && rng() < 0.15) {
    state.playerTemp.guaranteedCrit = true;
    if (hasSkill(state, 'Invisibility')) {
      state.playerTemp.invisibilityStacks = 2;
      state.playerTemp.invisibilityFirstAttack = true;
      state.playerTemp.guaranteedEvasion = true;
    }
  }

  if (hasSkill(state, 'Battle Rush') && rng() < 0.25) {
    const maxStacks = hasSkill(state, 'Unyielding Assault') ? 2 : 1;
    if (!state.playerTemp.battleRushStacks) state.playerTemp.battleRushStacks = 0;
    if (state.playerTemp.battleRushStacks < maxStacks) {
      state.playerTemp.battleRushStacks++;
      state.playerTemp.battleRushTurns = 3;
      ctx.log(`Battle Rush grants you a surge of power! (Stack ${state.playerTemp.battleRushStacks})`, 'log-skill', 'battle');
    }
  }

  if (playerDamage.isCrit && hasSkill(state, 'Lethal Precision') && state.playerTemp.attacksSinceLastFocus === 0) {
    monster.debuffs['Blind'] = { duration: 3 };
    ctx.log('Your precise shot blinds the enemy!', 'log-skill', 'battle');
  }

  if (playerDamage.isCrit && hasSkill(state, 'Bleed')) {
    const maxStacks = hasSkill(state, 'Hemorrhage') ? 5 : 1;
    const bleedDamage = Math.round(playerStats.atk * 0.3 + monster.maxHp * 0.01);
    if (!monster.debuffs['Bleed']) {
      monster.debuffs['Bleed'] = { damage: bleedDamage, duration: 3, stacks: 1, canCrit: hasSkill(state, 'Exsanguinate') };
      ctx.log('Your critical hit causes deep bleeding!', 'log-skill', 'battle');
    } else {
      monster.debuffs['Bleed'].duration = 3;
      if ((monster.debuffs['Bleed'].stacks ?? 0) < maxStacks) {
        monster.debuffs['Bleed'].stacks = (monster.debuffs['Bleed'].stacks ?? 0) + 1;
        ctx.log(`Bleed intensifies! (${monster.debuffs['Bleed'].stacks} stacks)`, 'log-skill', 'battle');
      }
    }
  }

  if (hasSkill(state, 'Sunder') && rng() < 0.3) {
    const maxStacks = hasSkill(state, 'Armor Shatter') ? 5 : 3;
    if (!monster.debuffs['Sunder']) monster.debuffs['Sunder'] = { duration: 5, stacks: 1 };
    else if ((monster.debuffs['Sunder'].stacks ?? 0) < maxStacks) monster.debuffs['Sunder'].stacks = (monster.debuffs['Sunder'].stacks ?? 0) + 1;
    monster.debuffs['Sunder'].duration = 5;
    if (hasSkill(state, 'Armor Shatter')) monster.debuffs['WeakenATK'] = { percent: 0.1, duration: 5 };
    ctx.log(`Armor sundered! (${monster.debuffs['Sunder'].stacks} stacks)`, 'log-skill', 'battle');
  }

  // Arcane Power / spell casting
  let arcanePowerProc = false;
  const arcanePowerChance = hasSkill(state, 'High Voltage') ? 0.18 : hasSkill(state, 'Arcane Power') ? 0.1 : 0;
  if (arcanePowerChance > 0 && rng() < arcanePowerChance) {
    arcanePowerProc = true;
    const arcaneDmg = playerStats.atk * (hasSkill(state, 'High Voltage') ? 3.0 : 2.0);
    const trueDmgPortion = Math.round(arcaneDmg * playerStats.trueDmgBonus);
    let normalDmgPortion = arcaneDmg - trueDmgPortion;
    const dr = 1 - monster.def / (monster.def + 100 + normalDmgPortion / 10);
    normalDmgPortion = Math.round(normalDmgPortion * dr);
    const totalSpellDmg = normalDmgPortion + trueDmgPortion;
    monster.hp -= totalSpellDmg;
    ctx.log(`Arcane Power erupts for ${normalDmgPortion} + <span style="color: #8888FF;">${trueDmgPortion}</span> true damage!`, 'log-skill', 'battle');
    handlePostPlayerAttackSkills(state, ctx, playerStats, playerDamage, totalSpellDmg);

    if (hasSkill(state, 'Chain Lightning')) {
      const chainDmg = playerStats.atk;
      const chainTrueDmg = Math.round(chainDmg * 0.3);
      let chainNormalDmg = chainDmg - chainTrueDmg;
      const chainReduction = 1 - monster.def / (monster.def + 100 + chainNormalDmg / 10);
      chainNormalDmg = Math.round(chainNormalDmg * chainReduction);
      const totalChainDmg = chainNormalDmg + chainTrueDmg;
      monster.hp -= totalChainDmg;
      ctx.log(`Chain Lightning arcs for ${chainNormalDmg} + <span style="color: #8888FF;">${chainTrueDmg}</span> true damage!`, 'log-skill', 'battle');
    }

    if (hasSkill(state, 'Paradox') && rng() < 0.25) {
      monster.hp -= totalSpellDmg;
      ctx.log(`Paradox causes the spell to echo for another ${totalSpellDmg} damage!`, 'log-skill', 'battle');
      handlePostPlayerAttackSkills(state, ctx, playerStats, playerDamage, totalSpellDmg);
    }
  }

  if (arcanePowerProc && hasSkill(state, 'Combustion')) {
    const burnDmg = playerStats.atk * (hasSkill(state, 'Avatar') ? 1.2 : 0.85);
    monster.debuffs['Combustion'] = { damage: Math.round(burnDmg), duration: 3, isTrueDamage: true };
    if (hasSkill(state, 'Avatar')) {
      monster.debuffs['Apocalypse'] = { duration: 3 };
      ctx.log('Apocalyptic flames reduce enemy power!', 'log-skill', 'battle');
    }
    ctx.log('The enemy is engulfed in magical flames!', 'log-skill', 'battle');
  }

  // Reality Break
  const realityBreakChance = hasSkill(state, 'Devour Soul') ? 0.15 : hasSkill(state, 'Reality Break') ? 0.1 : 0;
  if (realityBreakChance > 0 && rng() < realityBreakChance) {
    const percentDmg = hasSkill(state, 'Annihilate') ? 0.08 : 0.05;
    const maxDmg = playerStats.atk * (hasSkill(state, 'Annihilate') ? 8.0 : 5.0);
    const realityDmg = Math.min(Math.round(monster.hp * percentDmg), maxDmg);
    monster.hp -= realityDmg;
    ctx.log(`Reality Break tears through for ${realityDmg} true damage!`, 'log-skill', 'battle');

    if (hasSkill(state, 'Devour Soul')) {
      const healAmount = Math.round(realityDmg * 0.5);
      p.currentHp = Math.min(playerStats.hp, p.currentHp + healAmount);
      ctx.log(`You devour their essence, healing for ${healAmount} HP.`, 'log-skill', 'battle');
    }
    if (hasSkill(state, 'Annihilate')) {
      monster.debuffs['Doom'] = { damage: Math.round(playerStats.atk * 0.85), duration: 3, isTrueDamage: true };
      ctx.log("Doom seals the enemy's fate!", 'log-skill', 'battle');
    }
    if (hasSkill(state, 'Time Warp')) {
      const freezeDuration = hasSkill(state, 'Paradox') ? 2 : 1;
      state.playerTemp.timeFreezeCounter = freezeDuration;
      ctx.log(`Time freezes for ${freezeDuration} turn${freezeDuration > 1 ? 's' : ''}!`, 'log-skill', 'battle');
    }
    if (hasSkill(state, 'Paradox') && rng() < 0.2) {
      monster.hp -= realityDmg;
      ctx.log(`Paradox causes Reality Break to echo for another ${realityDmg} damage!`, 'log-skill', 'battle');
      handlePostPlayerAttackSkills(state, ctx, playerStats, playerDamage, realityDmg);
    }
  }
}

export function handleBuffsAndDebuffs(state: GameState, ctx: EngineContext): void {
  const pt = state.playerTemp;
  if (pt.standFirmTurns > 0) pt.standFirmTurns--;
  if (pt.battleRushTurns > 0) pt.battleRushTurns--;
  if (pt.evasionAtkBuffDuration > 0) pt.evasionAtkBuffDuration--;
  else pt.evasionAtkBuffStacks = 0;

  const monster = state.currentMonster!;
  if (pt.timeFreezeCounter > 0) {
    pt.timeFreezeCounter--;
    monster.missNextAttack = true;
  }

  const playerStats = getPlayerTotalStats(state);
  for (const key in monster.debuffs) {
    const debuff = monster.debuffs[key];
    if (debuff.duration > 0) {
      if (key === 'Bleed') {
        let bleedDmg = (debuff.damage ?? 0) * (debuff.stacks ?? 1);
        if (hasSkill(state, 'Hemorrhage')) {
          const healAmount = Math.round(bleedDmg * 0.5);
          state.player!.currentHp = Math.min(playerStats.hp, state.player!.currentHp + healAmount);
        }
        if (debuff.canCrit && ctx.rng() < playerStats.critChance) {
          bleedDmg = Math.round(bleedDmg * playerStats.critDmg);
          ctx.log(`Bleed critically strikes for ${bleedDmg} damage!`, 'log-skill', 'battle');
        } else {
          ctx.log(`Bleed deals ${bleedDmg} damage (${debuff.stacks} stacks).`, 'log-monster', 'battle');
        }
        monster.hp -= bleedDmg;
        if (monster.hp <= 0 && hasSkill(state, 'Exsanguinate')) pt.bleedSpreadOnKill = true;
      }
      if (key === 'Combustion') {
        const dmgText = debuff.isTrueDamage ? `<span style="color: #8888FF;">${debuff.damage}</span> true` : `${debuff.damage}`;
        ctx.log(`Combustion burns for ${dmgText} damage.`, 'log-monster', 'battle');
        monster.hp -= debuff.damage ?? 0;
      }
      if (key === 'Doom') {
        ctx.log(`Doom tears at reality for <span style="color: #8888FF;">${debuff.damage}</span> true damage.`, 'log-monster', 'battle');
        monster.hp -= debuff.damage ?? 0;
      }
      if (key === 'Poison') {
        monster.hp -= debuff.damage ?? 0;
        ctx.log(`Poison deals ${debuff.damage} damage.`, 'log-monster', 'battle');
      }
      debuff.duration--;
    }
    if (debuff.duration <= 0) delete monster.debuffs[key];
  }
}

/** One simulation step — the legacy gameLoop. */
export function runTick(state: GameState, ctx: EngineContext): void {
  if (!state.isRunning || !state.player || !state.currentMonster) return;

  handleBuffsAndDebuffs(state, ctx);
  if (state.currentMonster.hp <= 0) return monsterDefeated(state, ctx);

  const playerStats = getPlayerTotalStats(state);
  const p = state.player;

  const playerDamage = calculateDamage(state, ctx, playerStats, state.currentMonster, true);
  state.currentMonster.hp -= playerDamage.damage;
  ctx.log(`You hit ${state.currentMonster.name} for ${playerDamage.damage} damage.${playerDamage.isCrit ? ' (CRIT!)' : ''}`, 'log-player', 'battle');
  handlePostPlayerAttackSkills(state, ctx, playerStats, playerDamage, 0);
  if (state.currentMonster.hp <= 0) return monsterDefeated(state, ctx);

  // Wave-boss / final-boss phase transitions react to the damage just dealt.
  advanceBossPhase(state, ctx);

  if (state.currentMonster.missNextAttack) {
    ctx.log(`${state.currentMonster.name}'s attack was nullified!`, 'log-skill', 'battle');
    state.currentMonster.missNextAttack = false;
  } else if (state.playerTemp.guaranteedEvasion) {
    ctx.log('You phase through the attack, taking no damage!', 'log-skill', 'battle');
    state.playerTemp.guaranteedEvasion = false;
  } else {
    const monsterDamage = calculateDamage(state, ctx, state.currentMonster, playerStats, false);
    let wasBlocked = false;
    if (hasSkill(state, 'Aegis Block') && ctx.rng() < 0.15) {
      wasBlocked = true;
      if (wasBlocked && state.playerTemp.shieldCharges > 0 && hasSkill(state, 'Holy Knight')) {
        const shieldBurst = Math.round(playerStats.def * 2.0);
        state.currentMonster.hp -= shieldBurst;
        state.playerTemp.shieldCharges--;
        ctx.log(`Divine Retribution bursts for ${shieldBurst} holy damage! (${state.playerTemp.shieldCharges} charges remaining)`, 'log-skill', 'battle');
      }
      if (!wasBlocked && state.playerTemp.shieldCharges > 0 && hasSkill(state, 'Holy Shield')) {
        const reduction = 0.15 * state.playerTemp.shieldCharges;
        monsterDamage.damage = Math.round(monsterDamage.damage * (1 - reduction));
        ctx.log(`Shield Charges reduce damage by ${Math.round(reduction * 100)}%!`, 'log-skill', 'battle');
      }
      if (!wasBlocked && state.playerTemp.shieldCharges > 0 && hasSkill(state, 'Thornmail')) {
        const reflectPercent = 0.1 * state.playerTemp.shieldCharges;
        const reflectDmg = Math.round(monsterDamage.preMitigationDamage * reflectPercent);
        state.currentMonster.hp -= reflectDmg;
        ctx.log(`Shield Charges reflect ${reflectDmg} damage!`, 'log-skill', 'battle');
      }
      if (hasSkill(state, 'Holy Shield')) {
        const healAmount = Math.round(playerStats.hp * 0.05);
        p.currentHp = Math.min(playerStats.hp, p.currentHp + healAmount);
        ctx.log(`You blocked the attack with your Holy Shield, healing for ${healAmount} HP!`, 'log-skill', 'battle');
      } else {
        ctx.log('You blocked the attack with Aegis Block!', 'log-skill', 'battle');
      }
      if (hasSkill(state, 'Stand Firm')) {
        state.playerTemp.standFirmTurns = 3;
        ctx.log('You Stand Firm, bolstering your defense!', 'log-skill', 'battle');
      }
      if (hasSkill(state, 'Divine Retribution')) {
        const retaliateDmg = Math.round(playerStats.def);
        state.currentMonster.hp -= retaliateDmg;
        ctx.log(`Your shield erupts with holy light, dealing ${retaliateDmg} damage!`, 'log-skill', 'battle');
      }
      monsterDamage.damage = 0;
    }

    if (hasSkill(state, 'Thornmail') && state.playerTemp.standFirmTurns > 0 && !wasBlocked) {
      const reflectDmg = Math.round(monsterDamage.preMitigationDamage * 0.2);
      state.currentMonster.hp -= reflectDmg;
      ctx.log(`Your Thornmail reflects ${reflectDmg} damage!`, 'log-skill', 'battle');
    }
    if (n(playerStats.reflectDamage) > 0 && !wasBlocked) {
      const reflectDmg = Math.round(monsterDamage.preMitigationDamage * n(playerStats.reflectDamage));
      state.currentMonster.hp -= reflectDmg;
      ctx.log(`Your set reflects ${reflectDmg} damage!`, 'log-skill', 'battle');
    }

    state.player.currentHp -= monsterDamage.damage;
    ctx.log(`${state.currentMonster.name} hits you for ${monsterDamage.damage} damage.`, 'log-monster', 'battle');
    applyModifierOnPlayerHit(state, ctx, monsterDamage.damage);
  }

  if (state.player.currentHp <= 0) playerDefeated(state, ctx);
}
