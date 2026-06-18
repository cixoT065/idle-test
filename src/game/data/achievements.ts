import type { GameState, RebirthState } from '../types';

type BonusStat = keyof RebirthState['bonuses'];

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  check: (s: GameState) => boolean;
  reward: { gold?: number; rebirthPoints?: number; bonus?: { stat: BonusStat; amount: number } };
  rewardText: string;
}

/**
 * Milestones that grant a one-time permanent reward. Stat rewards are folded into
 * the existing rebirth-bonus multipliers, so they persist through rebirths (they
 * reset only on a full New Game). Ordered roughly by difficulty.
 */
export const achievements: AchievementDef[] = [
  { id: 'first_blood', name: 'First Blood', desc: 'Defeat your first monster', icon: '🗡️',
    check: (s) => s.stats.totalKills >= 1, reward: { gold: 100 }, rewardText: '+100 gold' },
  { id: 'kills_1k', name: 'Cull the Horde', desc: 'Defeat 1,000 monsters', icon: '💀',
    check: (s) => s.stats.totalKills >= 1000, reward: { bonus: { stat: 'dropRate', amount: 0.05 } }, rewardText: '+5% drop rate' },
  { id: 'kills_10k', name: 'Genocidal', desc: 'Defeat 10,000 monsters', icon: '☠️',
    check: (s) => s.stats.totalKills >= 10000, reward: { bonus: { stat: 'gold', amount: 0.1 } }, rewardText: '+10% gold' },
  { id: 'boss_10', name: 'Boss Slayer', desc: 'Defeat 10 wave bosses', icon: '👑',
    check: (s) => s.stats.totalBosses >= 10, reward: { bonus: { stat: 'atk', amount: 0.05 } }, rewardText: '+5% ATK' },
  { id: 'boss_100', name: 'Boss Master', desc: 'Defeat 100 wave bosses', icon: '🐲',
    check: (s) => s.stats.totalBosses >= 100, reward: { bonus: { stat: 'atk', amount: 0.1 } }, rewardText: '+10% ATK' },
  { id: 'wave_10', name: 'Getting Started', desc: 'Reach wave 10', icon: '🌊',
    check: (s) => s.maxWaveReached >= 10, reward: { gold: 1000 }, rewardText: '+1,000 gold' },
  { id: 'wave_25', name: 'Veteran', desc: 'Reach wave 25', icon: '⛰️',
    check: (s) => s.maxWaveReached >= 25, reward: { bonus: { stat: 'hp', amount: 0.1 } }, rewardText: '+10% Max HP' },
  { id: 'wave_50', name: 'Beyond the Cap', desc: 'Reach wave 50', icon: '🌋',
    check: (s) => s.maxWaveReached >= 50, reward: { bonus: { stat: 'atk', amount: 0.15 } }, rewardText: '+15% ATK' },
  { id: 'first_lr', name: 'Legendary Find', desc: 'Find your first LR item', icon: '🌟',
    check: (s) => s.stats.lrDrops >= 1, reward: { rebirthPoints: 1 }, rewardText: '+1 Rebirth Point' },
  { id: 'lr_10', name: 'Hoarder of Legends', desc: 'Find 10 LR items', icon: '✨',
    check: (s) => s.stats.lrDrops >= 10, reward: { bonus: { stat: 'dropRate', amount: 0.1 } }, rewardText: '+10% drop rate' },
  { id: 'enhance_50', name: 'Master Smith', desc: 'Enhance equipment 50 times', icon: '🔨',
    check: (s) => s.stats.enhancements >= 50, reward: { bonus: { stat: 'gold', amount: 0.05 } }, rewardText: '+5% gold' },
  { id: 'streak_50', name: 'Unstoppable', desc: 'Reach a 50 kill streak', icon: '🔥',
    check: (s) => s.bestKillStreak >= 50, reward: { bonus: { stat: 'critDmg', amount: 0.1 } }, rewardText: '+10% Crit DMG' },
  { id: 'millionaire', name: 'Millionaire', desc: 'Earn 1,000,000 total gold', icon: '🪙',
    check: (s) => s.stats.totalGoldEarned >= 1_000_000, reward: { bonus: { stat: 'gold', amount: 0.15 } }, rewardText: '+15% gold' },
  { id: 'reborn', name: 'Reborn', desc: 'Rebirth for the first time', icon: '♻️',
    check: (s) => s.stats.rebirths >= 1, reward: { bonus: { stat: 'xp', amount: 0.1 } }, rewardText: '+10% XP' },
  { id: 'ascendant', name: 'Ascendant', desc: 'Rebirth 5 times', icon: '🔆',
    check: (s) => s.stats.rebirths >= 5, reward: { bonus: { stat: 'atk', amount: 0.2 } }, rewardText: '+20% ATK' },
  { id: 'conqueror', name: 'Conqueror', desc: 'Defeat the Chronos Tyrant', icon: '🏆',
    check: (s) => s.finalBossDefeated, reward: { rebirthPoints: 5 }, rewardText: '+5 Rebirth Points' },
];
