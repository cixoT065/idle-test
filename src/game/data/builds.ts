/**
 * Build archetypes — a player-chosen "focus" that re-weights how good an item is
 * for them. It drives auto-equip (equip toward your build, not raw stat-sum) and
 * biases the forge's reforge toward the affixes your build wants. Purely an
 * overlay on top of class; weights are tuned in data, not the engine.
 *
 * Weights multiply a stat's *normalised* value (crit stats and affixes, which are
 * small decimals, are scaled up so they're comparable to flat stats). Anything
 * not listed uses DEFAULT_WEIGHT, so off-focus stats still count a little.
 */
export interface BuildArchetype {
  key: string;
  name: string;
  icon: string;
  desc: string;
  weights: Record<string, number>;
}

export const DEFAULT_BUILD_WEIGHT = 0.5;

export const BUILDS: Record<string, BuildArchetype> = {
  balanced: {
    key: 'balanced', icon: '⚖️', name: 'Balanced',
    desc: 'Values every combat stat evenly — the classic "highest total" pick.',
    weights: {}, // special-cased to a flat 1 everywhere
  },
  crit: {
    key: 'crit', icon: '🎯', name: 'Critical',
    desc: 'Glass-cannon burst: crit chance/damage, DEX, and armor-piercing crits.',
    weights: { critChance: 10, critDmg: 6, dex: 2.5, agl: 1.2, critIgnoresDef: 8 },
  },
  bruiser: {
    key: 'bruiser', icon: '🛡️', name: 'Bruiser',
    desc: 'Survivable sustain: HP, DEF, STR, lifesteal and damage reflect.',
    weights: { con: 2.5, def: 2, str: 1.8, hpPercent: 9, lifesteal: 9, reflectDamage: 6 },
  },
  caster: {
    key: 'caster', icon: '🔮', name: 'Caster',
    desc: 'Spell power: INT, crit to trigger procs, and skill lifesteal.',
    weights: { int: 2.6, critChance: 6, critDmg: 3, skillLifesteal: 9 },
  },
};

export const BUILD_KEYS = Object.keys(BUILDS);

/** Crit stats and affixes are tiny decimals; scale them so they're comparable to flat stats. */
export function normaliseStatValue(key: string, value: number): number {
  if (key === 'critChance' || key === 'critDmg') return value * 100;
  // Affix keys (lifesteal/hpPercent/reflectDamage/critIgnoresDef/skillLifesteal) are also fractional.
  if (key === 'lifesteal' || key === 'skillLifesteal' || key === 'hpPercent' || key === 'reflectDamage' || key === 'critIgnoresDef') {
    return value * 100;
  }
  return value;
}

export function buildWeight(focusKey: string, statKey: string): number {
  const build = BUILDS[focusKey] ?? BUILDS.balanced;
  if (build.key === 'balanced') return 1;
  return build.weights[statKey] ?? DEFAULT_BUILD_WEIGHT;
}

/** Affix-only weight map for biasing reforge rolls toward the focus (1 = neutral). */
export function buildAffixWeights(focusKey: string): Record<string, number> {
  const build = BUILDS[focusKey];
  if (!build || build.key === 'balanced') return {};
  const out: Record<string, number> = {};
  for (const k of ['lifesteal', 'skillLifesteal', 'hpPercent', 'reflectDamage', 'critIgnoresDef']) {
    // Map the (normalised) build weight to a sane reforge-pick weight, min 1.
    if (build.weights[k]) out[k] = Math.max(1, build.weights[k] / 2);
  }
  return out;
}
