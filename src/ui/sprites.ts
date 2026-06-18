import type { BaseClassName } from '../game/types';

// Eagerly import every generated sprite as a URL, keyed by file path.
const URLS = import.meta.glob('../assets/generated/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function url(slug: string): string | undefined {
  const hit = Object.keys(URLS).find((p) => p.endsWith(`/${slug}.png`));
  return hit ? URLS[hit] : undefined;
}

export interface Frames { idle: [string, string]; atk: string[] }

/** Build the {idle pair, attack sequence} frame set for a slug. The attack may be
 *  1 frame (most foes/Wizard cast) or 2 (Warrior slash, Rogue stab: windup→strike). */
function frames(slug: string): Frames | null {
  const base = url(slug);
  if (!base) return null;
  const atk = [url(`${slug}_atk`), url(`${slug}_atk2`)].filter(Boolean) as string[];
  return { idle: [base, url(`${slug}_b`) ?? base], atk: atk.length ? atk : [base] };
}

const CLASS_SLUG: Record<BaseClassName, string> = { Warrior: 'warrior', Rogue: 'rogue', Wizard: 'wizard' };

export function classFrames(c: BaseClassName): Frames {
  return frames(CLASS_SLUG[c]) ?? { idle: [url('warrior')!, url('warrior')!], atk: [url('warrior')!] };
}

/**
 * Monster name → sprite slug. Names may carry modifier prefixes ("Armored Orc
 * Grunt", "⭐ Champion Slime"), so the base template name is always a substring.
 * Most-specific keys first so "Mutated Slime"/"Slime Mother" beat generic "slime".
 */
const MONSTER_SLUGS: [string, string][] = [
  ['chronos', 'chronos_tyrant'],
  ['slime mother', 'slime_mother'],
  ['mutated slime', 'mutated_slime'],
  ['grimgnaw', 'goblin_king'],
  ['goblin king', 'goblin_king'],
  ['goblin scout', 'goblin_scout'],
  ['goblin shaman', 'goblin_shaman'],
  ['giant rat', 'giant_rat'],
  ['cave bat', 'cave_bat'],
  ['kobold', 'kobold_miner'],
  ['forest spider', 'forest_spider'],
  ['undead soldier', 'undead_soldier'],
  ['rabid wolf', 'rabid_wolf'],
  ['shrieking fungus', 'shrieking_fungus'],
  ['orc grunt', 'orc_grunt'],
  ['ogre mage', 'ogre_mage'],
  ['goblin', 'goblin_scout'],
  ['stone golem', 'stone_golem'],
  ['dragon whelp', 'dragon_whelp'],
  ['dragon', 'dragon_whelp'],
  ['hydra', 'hydra'],
  ['troll', 'troll'],
  ['slime', 'slime'],
];

export function monsterFrames(name: string): Frames | null {
  const n = name.toLowerCase();
  for (const [kw, slug] of MONSTER_SLUGS) if (n.includes(kw)) return frames(slug);
  return null;
}
