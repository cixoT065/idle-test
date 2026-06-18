export interface PromotionSkill {
  name: string;
  description: string;
}

export const promotionSkills: Record<string, PromotionSkill> = {
  // Knight Path
  Knight: { name: 'Aegis Block', description: '15% chance to block all incoming damage and gain Shield Charge.' },
  Paladin: { name: 'Holy Shield', description: 'Aegis Block now heals for 10% of Max HP and Shield Charges grant 15% damage reduction.' },
  'Holy Knight': { name: 'Divine Retribution', description: 'Shield Charges burst for 200% DEF as holy damage when consumed.' },
  Guardian: { name: 'Stand Firm', description: 'Aegis Block grants +50% DEF for 3 seconds and generates 2 Shield Charges.' },
  Aegis: { name: 'Thornmail', description: 'Reflects 30% damage when blocking. Shield Charges also grant 10% damage reflection.' },

  // Berserker Path
  Berserker: { name: 'Frenzy', description: 'Gain +2% ATK and +1% true damage for every 5% missing health.' },
  Slayer: { name: 'Execute', description: 'Deal 100% more damage to non-boss enemies below 30% HP. Instantly kills non-boss enemies below 15% HP.' },
  Executioner: { name: 'Cull the Weak', description: 'Execute threshold increased to 40% HP, instant kill at 20% HP.' },
  Warlord: { name: 'Battle Rush', description: '25% chance on attack to gain +30% ATK and +10% true damage for 3 seconds.' },
  Conqueror: { name: 'Unyielding Assault', description: 'Battle Rush also grants 10% lifesteal and can stack twice.' },

  // Assassin Path
  Assassin: { name: 'Bleed', description: 'Critical hits apply bleed for 30% ATK + 1% enemy max HP per second for 3 seconds.' },
  Shadow: { name: 'Shadow Step', description: '15% chance on attack to guarantee critical and gain 50% evasion for next attack.' },
  Phantom: { name: 'Invisibility', description: 'Shadow Step grants 100% crit rate and evasion for 2 attacks. First attack deals +100% damage.' },
  Reaper: { name: 'Hemorrhage', description: 'Bleed stacks up to 5 times and heals you for 5% of bleed damage.' },
  'Soul Carver': { name: 'Exsanguinate', description: 'Bleed ticks can critically strike and spread to a new target on kill.' },

  // Ranger Path
  Ranger: { name: 'Double Shot', description: '20% chance to attack twice, second hit deals 80% damage with +50% accuracy.' },
  Sharpshooter: { name: 'Focus', description: 'Every 3rd attack is a guaranteed critical with +30% critical damage.' },
  Deadeye: { name: 'Lethal Precision', description: 'Focused crits deal +55% critical damage and apply Blind (25% miss) for 3 seconds.' },
  Pathfinder: { name: 'Sunder', description: '30% chance to reduce enemy DEF by 10% for 5 seconds, stacks 3 times.' },
  Trailblazer: { name: 'Armor Shatter', description: 'Sunder stacks to 5, reduces ATK by 10%, and spreads on enemy death.' },

  // Mage Path
  Mage: { name: 'Arcane Power', description: '10% chance to cast a spell for 200% ATK as true damage.' },
  Archmage: { name: 'High Voltage', description: 'Arcane Power chance increased to 18%, damage to 300% ATK.' },
  'Grand Magus': { name: 'Chain Lightning', description: 'Arcane Power chains to deal 100% ATK bonus damage with 30% true damage conversion.' },
  Elementalist: { name: 'Combustion', description: 'Arcane Power applies burn for 85% ATK per second for 3 seconds as true damage.' },
  Avatar: { name: 'Apocalypse', description: 'Combustion damage increased to 120% ATK and reduces enemy stats by 15%.' },

  // Sorcerer Path
  Sorcerer: { name: 'Reality Break', description: 'Attacks have 10% chance to deal damage equal to 5% of enemy current HP (max 500% ATK) as true damage.' },
  Warlock: { name: 'Devour Soul', description: 'Reality Break chance to 15%, also heals for 50% damage dealt.' },
  Demonologist: { name: 'Annihilate', description: 'Reality Break deals 8% current HP (max 800% ATK), applies Doom (85% ATK true damage/sec for 3s).' },
  Chronomancer: { name: 'Time Warp', description: 'Reality Break freezes time for 1 turn (enemy skips attack).' },
  'Time Lord': { name: 'Paradox', description: 'All abilities have 20% chance to trigger twice. Time freeze lasts 2 turns.' },

  // --- New tier-3 (L70) capstones: passive "powerhouse" alternatives. ---
  Templar: { name: 'Conviction', description: '+12% Lifesteal and +15% Max HP.' },
  Sentinel: { name: 'Retribution Aura', description: 'Reflect +20% of damage taken and +20% Max HP.' },
  Ravager: { name: 'Savagery', description: '+25% ATK and +10% Crit Chance.' },
  Warbringer: { name: 'Bloodlust', description: '+20% ATK and +40% Crit Damage.' },
  Nightblade: { name: 'Killer Instinct', description: '+15% Crit Chance and +50% Crit Damage.' },
  Deathstalker: { name: 'Predation', description: '+15% Lifesteal and +10% ATK.' },
  Tempest: { name: 'Onslaught', description: '+20% ATK and +10% Crit Chance.' },
  Windrunner: { name: 'Evasive Maneuvers', description: '+10% Evasion and +15% ATK.' },
  Arcanist: { name: 'Arcane Mastery', description: '+30% ATK.' },
  Stormcaller: { name: 'Tempest Fury', description: '+20% ATK and +10% Crit Chance.' },
  Necromancer: { name: 'Soul Siphon', description: '+10% Lifesteal, +15% Skill Lifesteal, +10% ATK.' },
  Aeon: { name: 'Eternity', description: '+20% Max HP and +15% ATK.' },
};

/**
 * Passive stat packages for the new L70 capstone skills. Applied once in
 * getPlayerTotalStats (keyed by the granted skill name), so they need no
 * per-attack combat logic. `atkPercent`/`hpPercent` are multiplicative; the
 * rest are additive onto the derived stat of the same name.
 */
export const capstonePassives: Record<string, Record<string, number>> = {
  Conviction: { lifesteal: 0.12, hpPercent: 0.15 },
  'Retribution Aura': { reflectDamage: 0.2, hpPercent: 0.2 },
  Savagery: { atkPercent: 0.25, critChance: 0.1 },
  Bloodlust: { atkPercent: 0.2, critDmg: 0.4 },
  'Killer Instinct': { critChance: 0.15, critDmg: 0.5 },
  Predation: { lifesteal: 0.15, atkPercent: 0.1 },
  Onslaught: { atkPercent: 0.2, critChance: 0.1 },
  'Evasive Maneuvers': { evasion: 0.1, atkPercent: 0.15 },
  'Arcane Mastery': { atkPercent: 0.3 },
  'Tempest Fury': { atkPercent: 0.2, critChance: 0.1 },
  'Soul Siphon': { lifesteal: 0.1, skillLifesteal: 0.15, atkPercent: 0.1 },
  Eternity: { hpPercent: 0.2, atkPercent: 0.15 },
};
