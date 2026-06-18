import type { BaseClassName } from '../game/types';
import warrior from '../assets/generated/warrior.png';
import rogue from '../assets/generated/rogue.png';
import wizard from '../assets/generated/wizard.png';
import slime from '../assets/generated/slime.png';
import giantRat from '../assets/generated/giant_rat.png';
import goblinScout from '../assets/generated/goblin_scout.png';
import caveBat from '../assets/generated/cave_bat.png';
import kobold from '../assets/generated/kobold_miner.png';
import forestSpider from '../assets/generated/forest_spider.png';
import undeadSoldier from '../assets/generated/undead_soldier.png';
import mutatedSlime from '../assets/generated/mutated_slime.png';
import rabidWolf from '../assets/generated/rabid_wolf.png';
import shriekingFungus from '../assets/generated/shrieking_fungus.png';
import orcGrunt from '../assets/generated/orc_grunt.png';
import troll from '../assets/generated/troll.png';
import ogreMage from '../assets/generated/ogre_mage.png';
import goblinShaman from '../assets/generated/goblin_shaman.png';
import stoneGolem from '../assets/generated/stone_golem.png';
import goblinKing from '../assets/generated/goblin_king.png';
import slimeMother from '../assets/generated/slime_mother.png';
import hydra from '../assets/generated/hydra.png';
import dragonWhelp from '../assets/generated/dragon_whelp.png';
import chronos from '../assets/generated/chronos_tyrant.png';

export const CLASS_SPRITE: Record<BaseClassName, string> = { Warrior: warrior, Rogue: rogue, Wizard: wizard };

/**
 * Monster name → generated sprite. Names may carry modifier prefixes
 * ("Armored Orc Grunt", "⭐ Champion Slime"), so the base template name is always
 * a substring. Most-specific keys are listed first so e.g. "Mutated Slime" and
 * "The Slime Mother" win over the generic "slime".
 */
const MONSTER_SPRITES: [string, string][] = [
  ['chronos', chronos],
  ['slime mother', slimeMother],
  ['mutated slime', mutatedSlime],
  ['grimgnaw', goblinKing],
  ['goblin king', goblinKing],
  ['goblin scout', goblinScout],
  ['goblin shaman', goblinShaman],
  ['giant rat', giantRat],
  ['cave bat', caveBat],
  ['kobold', kobold],
  ['forest spider', forestSpider],
  ['undead soldier', undeadSoldier],
  ['rabid wolf', rabidWolf],
  ['shrieking fungus', shriekingFungus],
  ['orc grunt', orcGrunt],
  ['ogre mage', ogreMage],
  ['goblin', goblinScout],
  ['stone golem', stoneGolem],
  ['dragon whelp', dragonWhelp],
  ['dragon', dragonWhelp],
  ['hydra', hydra],
  ['troll', troll],
  ['slime', slime],
];

export function monsterSprite(name: string): string | null {
  const n = name.toLowerCase();
  for (const [kw, asset] of MONSTER_SPRITES) if (n.includes(kw)) return asset;
  return null;
}
