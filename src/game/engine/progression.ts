import type { GameState, EngineContext, Player, Monster } from '../types';
import { classes, promotionGrowthAdjustments, promotionInfo } from '../data/classes';
import { promotionSkills, isCapstoneSkill } from '../data/skills';
import { getPlayerTotalStats } from './stats';
import { autoFillSkillSlots } from './skillLoadout';
import { generateItemDrop, spawnMonster, weakenFinalBoss } from './loot';
import { getModifierRewardMult, applyModifierOnDeath } from './bosses';
import { getWagerRewards } from './wagers';
import { checkAchievements, trackDaily } from './meta';

export interface AvailablePromotion {
  level: number;
  choices: string[];
}

export function getAvailablePromotion(player: Player): AvailablePromotion | null {
  const baseClassInfo = classes[player.baseClassName];
  if (!baseClassInfo || !baseClassInfo.promotions) return null;
  const promotionTiers = Object.keys(baseClassInfo.promotions).sort((a, b) => Number(a) - Number(b));
  for (const tierLevel of promotionTiers) {
    if (player.level >= Number(tierLevel)) {
      const tier = baseClassInfo.promotions[Number(tierLevel)];
      if (Array.isArray(tier) && player.className === player.baseClassName) return { level: Number(tierLevel), choices: tier };
      if (!Array.isArray(tier) && tier[player.className]) return { level: Number(tierLevel), choices: tier[player.className] };
    }
  }
  return null;
}

function checkForPendingPromotion(state: GameState, ctx: EngineContext): void {
  const p = state.player;
  if (!p) return;
  if (p.promotionPending && p.pendingPromotionChoices) return;
  const available = getAvailablePromotion(p);
  if (available) {
    p.promotionPending = true;
    p.pendingPromotionChoices = available.choices;
    state.isRunning = false;
    ctx.log('A promotion is available! Choose your new class.', 'log-system', 'event');
  }
}

export function levelUp(state: GameState, ctx: EngineContext): void {
  const p = state.player!;
  p.xp -= p.xpToNextLevel;
  p.level++;
  p.xpToNextLevel = Math.round(38 * Math.pow(p.level, 1.45));
  // Scale points with level so investment keeps pace with monster scaling
  // (5 at L1 → +1 every 10 levels, i.e. 12/level by L70).
  const pointsGained = 5 + Math.floor(p.level / 10);
  p.statPoints += pointsGained;

  const growth: Record<string, number> = { ...classes[p.baseClassName].growth };
  const promoAdjust = promotionGrowthAdjustments[p.className];
  if (promoAdjust) for (const stat in promoAdjust) growth[stat] = (growth[stat] || 0) + promoAdjust[stat];
  for (const stat in growth) p.baseStats[stat] = (p.baseStats[stat] || 0) + growth[stat];

  p.currentHp = getPlayerTotalStats(state).hp;
  ctx.log(`LEVEL UP! You are now level ${p.level}. Gained ${pointsGained} stat points.`, 'log-system', 'event');

  // New level may grant a slot or unlock a catalog tier — fill any free slots.
  autoFillSkillSlots(state);
  checkForPendingPromotion(state, ctx);
}

/** Apply a chosen promotion (called from the UI once the player selects). */
export function applyPromotion(state: GameState, ctx: EngineContext, selection: string): void {
  const p = state.player;
  if (!p || !p.pendingPromotionChoices?.includes(selection)) return;
  p.className = selection;
  p.promotionPending = false;
  p.pendingPromotionChoices = null;
  const skill = promotionSkills[selection];
  if (skill) {
    if (isCapstoneSkill(skill.name)) {
      // Passive capstones stay innate/always-on (they don't use a loadout slot).
      if (!p.activeSkills.includes(skill.name)) {
        p.activeSkills.push(skill.name);
        ctx.log(`You have mastered the passive: <span class="log-skill">${skill.name}</span>!`, 'log-system', 'event');
      }
    } else {
      ctx.log(`<span class="log-skill">${skill.name}</span> is now available in your skill catalog.`, 'log-system', 'event');
    }
  }
  // A new tier may have just unlocked — keep the skill bar full where there's room.
  autoFillSkillSlots(state);
  ctx.log(`You have been promoted to ${p.className}! ${promotionInfo[selection]?.description ?? ''}`, 'log-system', 'event');
  p.currentHp = getPlayerTotalStats(state).hp;
  state.isRunning = true;
}

export function monsterDefeated(state: GameState, ctx: EngineContext): void {
  const monster = state.currentMonster as Monster & { isFinalBoss?: boolean };
  ctx.log(`You have defeated the ${monster.name}!`, 'log-system', 'event');

  const wager = getWagerRewards(monster);

  // Final boss victory.
  if (monster.isFinalBoss) {
    state.finalBossDefeated = true;
    state.gold += Math.round(monster.gold * wager.goldMult);
    ctx.log(`You have vanquished ${monster.name}! The realm is safe!`, 'log-system', 'event');
    checkAchievements(state, ctx);
    state.isRunning = false;
    ctx.onGameWon?.();
    return;
  }

  // Volatile monsters detonate as they die (may bring you low, but not below 1 HP).
  applyModifierOnDeath(state, ctx);
  if (state.player!.currentHp <= 0) state.player!.currentHp = 1;

  const playerStats = getPlayerTotalStats(state);
  if (playerStats.killRestoresHp && monster.hp <= 0) {
    const healAmount = Math.round(playerStats.hp * (playerStats.killRestoresHp as number));
    state.player!.currentHp = Math.min(playerStats.hp, state.player!.currentHp + healAmount);
    ctx.log(`Void-Drinker set restores ${healAmount} HP on kill.`, 'log-skill', 'event');
  }

  // Affixed monsters (Vampiric, Frenzied, ...) grant richer rewards; boss wagers
  // multiply on top of that for opted-in risk.
  const rewardMult = getModifierRewardMult(monster);
  const goldBonus = (1 + state.rebirth.bonuses.gold) * rewardMult * wager.goldMult;
  const xpRebirthBonus = (1 + state.rebirth.bonuses.xp) * rewardMult * wager.xpMult;
  const goldGained = Math.round(monster.gold * goldBonus);
  state.stats.totalGoldEarned += goldGained;
  trackDaily(state, 'gold', goldGained);

  let xpShopBoostMultiplier = 1;
  if (state.activeBoosts.xp && state.activeBoosts.xp.fightsRemaining > 0) {
    xpShopBoostMultiplier = state.activeBoosts.xp.multiplier;
    state.activeBoosts.xp.fightsRemaining--;
    if (state.activeBoosts.xp.fightsRemaining <= 0) state.activeBoosts.xp = null;
  }
  const xpGained = Math.round(monster.xp * xpRebirthBonus * xpShopBoostMultiplier);
  state.gold += goldGained;
  state.player!.xp += xpGained;
  ctx.log(`You gained ${goldGained} gold and ${xpGained} XP.`, 'log-drop', 'event');

  const dropChance = (monster.dropChance ?? 0) * rewardMult * (1 + state.rebirth.bonuses.dropRate);
  if (ctx.rng() < dropChance) generateItemDrop(state, ctx, monster);

  // Wager bonus loot: extra guaranteed boss-tier rolls for accepting the stakes.
  for (let i = 0; i < wager.bonusDrops; i++) generateItemDrop(state, ctx, monster);

  state.kills++;
  state.stats.totalKills++;
  state.killStreak++;
  if (state.killStreak > state.bestKillStreak) state.bestKillStreak = state.killStreak;
  trackDaily(state, 'kills', 1);
  if (monster.monsterType === 'boss') {
    // Endless waves: no cap, scaling continues so there is always a next milestone.
    state.wave++;
    if (state.wave > state.maxWaveReached) state.maxWaveReached = state.wave;
    state.kills = 0;
    state.totalBossesDefeatedInRun++;
    state.stats.totalBosses++;
    trackDaily(state, 'bosses', 1);
    // Every wave boss cleared chips the final boss down further (resets on rebirth,
    // since totalBossesDefeatedInRun starts fresh). The final boss is opt-in via the
    // "Challenge Final Boss" button — it is never auto-triggered.
    weakenFinalBoss(state);
    if (!state.finalBossDefeated) {
      const pct = Math.round(Math.max(0.1, 1 - state.totalBossesDefeatedInRun * 0.025) * 100);
      ctx.log(`The Chronos Tyrant weakens — now at ${pct}% power.`, 'log-system', 'event');
    }
  }

  checkAchievements(state, ctx);
  while (state.player!.xp >= state.player!.xpToNextLevel) levelUp(state, ctx);
  spawnMonster(state, ctx);
}

export function playerDefeated(state: GameState, ctx: EngineContext): void {
  const p = state.player!;
  p.currentHp = 0;
  state.killStreak = 0;
  ctx.log('You have been defeated!', 'log-monster', 'battle');
  const xpPenalty = Math.round(p.xpToNextLevel * 0.1);
  p.xp = Math.max(0, p.xp - xpPenalty);
  ctx.log(`As a penalty, you lose ${xpPenalty} XP.`, 'log-error', 'event');
  p.currentHp = getPlayerTotalStats(state).hp * 0.5;
  ctx.log('You revive with 50% health.', 'log-system', 'event');
  if (state.currentMonster?.monsterType === 'boss') spawnMonster(state, ctx);
}

/** Can the player manually challenge a wave boss right now? */
export function canChallengeBoss(state: GameState): boolean {
  return state.kills >= 10 && state.currentMonster?.monsterType !== 'boss';
}
