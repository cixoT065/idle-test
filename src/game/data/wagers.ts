/**
 * Boss wagers — opt-in stakes the player toggles before challenging a boss.
 * Each makes the fight harder (applied to the boss at spawn) in exchange for a
 * scaling reward on victory. They stack: reward multipliers multiply and bonus
 * drops sum, so piling on stakes is a high-risk / high-payout gamble.
 */
export interface WagerDef {
  key: string;
  name: string;
  icon: string;
  desc: string;
  // --- difficulty (applied to the boss at spawn) ---
  bossAtkMult?: number;
  bossHpMult?: number;
  bossEvasionAdd?: number;
  // --- reward (applied on victory) ---
  goldMult?: number;
  xpMult?: number;
  /** Extra boss-tier loot rolls granted on a win. */
  bonusDrops?: number;
}

export const WAGERS: Record<string, WagerDef> = {
  enraged: {
    key: 'enraged', icon: '🔥', name: 'Enraged',
    desc: 'Boss attacks 50% harder.',
    bossAtkMult: 1.5, goldMult: 1.7,
  },
  colossal: {
    key: 'colossal', icon: '🛡️', name: 'Colossal',
    desc: 'Boss has 120% more HP — a war of attrition.',
    bossHpMult: 2.2, xpMult: 2.0,
  },
  frenzied: {
    key: 'frenzied', icon: '⚡', name: 'Frenzied',
    desc: 'Boss is faster: +12% evasion and +30% ATK.',
    bossEvasionAdd: 0.12, bossAtkMult: 1.3, bonusDrops: 1,
  },
};

export const WAGER_KEYS = Object.keys(WAGERS);
