import type { BaseClassName, ItemType } from '../game/types';

export const CLASS_ICON: Record<BaseClassName, string> = {
  Warrior: '⚔️',
  Rogue: '🗡️',
  Wizard: '🧙',
};

export const SLOT_ICON: Record<ItemType, string> = {
  weapon: '🗡️',
  helm: '🪖',
  body: '🛡️',
  legs: '🦵',
  accessory: '💍',
};

export const STAT_ICON: Record<string, string> = {
  str: '💪', con: '❤️', def: '🛡️', dex: '🎯', agl: '💨', int: '🔮',
  critChance: '🎲', critDmg: '💥',
};

export const TAB_ICON: Record<string, string> = {
  shop: '🛒', inventory: '🎒', skills: '✨', blacksmith: '🔨', rebirth: '♻️', goals: '🎯',
};

export const MODIFIER_ICON: Record<string, string> = {
  Vampiric: '🩸', Armored: '🛡️', Swift: '💨', Frenzied: '😡', Volatile: '💥',
  Giant: '🗿', Berserk: '🪓',
};

/** Best-effort monster emoji from its (possibly modifier-prefixed) name. */
export function monsterIcon(name: string): string {
  const n = name.toLowerCase();
  const map: [string, string][] = [
    ['chronos', '⏳'], ['tyrant', '👹'],
    ['slime', '🟢'], ['rat', '🐀'], ['goblin king', '👑'], ['goblin', '👺'],
    ['kobold', '👺'], ['bat', '🦇'], ['spider', '🕷️'], ['fungus', '🍄'],
    ['undead', '💀'], ['skeleton', '💀'], ['wolf', '🐺'], ['orc', '👹'],
    ['troll', '👹'], ['ogre', '👹'], ['shaman', '🧟'], ['golem', '🗿'],
    ['hydra', '🐉'], ['dragon', '🐉'], ['mother', '🟢'],
  ];
  for (const [key, icon] of map) if (n.includes(key)) return icon;
  return '👾';
}
