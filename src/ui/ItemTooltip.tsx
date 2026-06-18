import { useLayoutEffect, useRef, useState } from 'react';
import { useTooltip } from './tooltip';
import { useGame } from './useGame';
import { getPlayerTotalStats } from '../game/engine';
import { itemData, itemSets, affixPool } from '../game/data/items';
import { STAT_NAMES, STAT_KEYS, DISPLAY_STATS } from '../game/data/constants';
import type { Item, StatName } from '../game/types';

const isPctStat = (s: string) => s === 'critChance' || s === 'critDmg';

function statLine(item: Item, stat: StatName, baseValue: number): string {
  const enhancementBonus = item.enhancementBonusStats?.[stat] || 0;
  if (baseValue === 0 && enhancementBonus === 0) return '';
  const total = baseValue + enhancementBonus;
  const pct = isPctStat(stat);
  let display = pct ? `+${(total * 100).toFixed(1)}%` : `+${Math.round(total)}`;
  if (enhancementBonus > 0) {
    display += ` (<span class="enhancement-bonus">+${pct ? (enhancementBonus * 100).toFixed(1) + '%' : Math.round(enhancementBonus)}</span>)`;
  }
  return `${STAT_NAMES[stat]}: ${display}<br>`;
}

/** Build the legacy tooltip HTML string for an item, including equip comparison. */
function buildContent(item: Item, isEquipped: boolean, state: ReturnType<typeof useGame>): string {
  const rarity = itemData.rarities[item.rarity];
  const classColor = item.classReq === state.player?.baseClassName ? 'var(--text-color)' : '#e06c75';
  const enh = item.enhancementLevel ? ` +${item.enhancementLevel}` : '';

  let content = `<strong style="color:${rarity.color};font-weight:bold;">${item.name}${enh} (${item.type})</strong><br>`;
  content += `Rarity: <span style="color:${rarity.color};font-weight:bold;">${item.rarity}</span> | Class: <span style="color:${classColor};">${item.classReq}</span><br>----<br>`;

  let baseStats = '';
  let bonusStats = '';
  for (const stat of STAT_KEYS) {
    if (typeof item[stat] === 'number') baseStats += statLine(item, stat, item[stat] as number);
    else if (item.bonusStats?.[stat]) bonusStats += statLine(item, stat, item.bonusStats[stat] as number);
  }
  content += baseStats;
  if (bonusStats) content += `---- (Bonus) ----<br>${bonusStats}`;

  if (item.affixes?.length) {
    content += `---- (Affixes) ----<br>`;
    for (const af of item.affixes) {
      const def = affixPool.find((a) => a.key === af.key);
      content += `<span style="color:var(--set-bonus-active,#6cc);">${def?.label ?? af.key}: +${(af.value * 100).toFixed(1)}%</span><br>`;
    }
  }

  if (item.setName) {
    const setInfo = itemSets[item.setName];
    const equippedCount = getPlayerTotalStats(state).activeSets[item.setName] || 0;
    content += `----<br><strong>${item.setName} (${setInfo.rarity})</strong><br>`;
    for (const count in setInfo.bonuses) {
      const active = equippedCount >= Number(count);
      content += `<span style="color:${active ? 'var(--set-bonus-active)' : 'var(--disabled-text-color)'};">${setInfo.bonuses[count].description}</span><br>`;
    }
  }

  if (!isEquipped && state.equipment[item.type]) {
    const current = getPlayerTotalStats(state);
    const future = getPlayerTotalStats(state, item);
    let cmp = '----<br><strong>Comparison:</strong><br>';
    let has = false;
    for (const stat in DISPLAY_STATS) {
      const diff = (future[stat] as number) - (current[stat] as number);
      if (Math.abs(diff) < 0.0001) continue;
      has = true;
      const pct = ['accuracy', 'evasion', 'critChance', 'critDmg'].includes(stat);
      let d = pct ? `${(diff * 100).toFixed(1)}%` : `${Math.round(diff)}`;
      if (diff > 0) d = `+${d}`;
      cmp += `${DISPLAY_STATS[stat]}: <span class="${diff > 0 ? 'stat-increase' : 'stat-decrease'}">${diff > 0 ? '▲' : '▼'}${d}</span><br>`;
    }
    if (has) content += cmp;
  }

  content += `----<br>Sell Value: ${rarity.value}G`;
  return content;
}

/** Single floating tooltip layer, rendered once at the app root. */
export function ItemTooltipLayer() {
  const { item, isEquipped, rect } = useTooltip();
  const state = useGame();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!item || !rect || !ref.current) {
      setPos(null);
      return;
    }
    const tip = ref.current.getBoundingClientRect();
    let top = rect.bottom + 5;
    let left = rect.left + rect.width / 2 - tip.width / 2;
    if (top + tip.height > window.innerHeight) top = rect.top - tip.height - 5;
    if (left < 0) left = 5;
    if (left + tip.width > window.innerWidth) left = window.innerWidth - tip.width - 5;
    setPos({ top, left });
  }, [item, rect]);

  if (!item) return null;
  return (
    <div
      id="global-tooltip"
      ref={ref}
      style={{ display: 'block', top: pos?.top ?? -9999, left: pos?.left ?? -9999, position: 'fixed' }}
      dangerouslySetInnerHTML={{ __html: buildContent(item, isEquipped, state) }}
    />
  );
}
