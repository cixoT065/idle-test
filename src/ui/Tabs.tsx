import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useGame } from './useGame';
import { itemData } from '../game/data/items';
import { getEnhancementCost, getEnhanceableStats, getReforgeCost, canReforgeItem, getSkillSlots, getActiveSkills, AUTOMATION_COSTS, AUTOMATION_INFO, type AutomationKey } from '../game/engine';
import { achievements } from '../game/data/achievements';
import { affixPool } from '../game/data/items';
import { getClassSkillCatalog } from '../game/data/skills';
import { tooltipHandlers } from './tooltip';
import { TAB_ICON, SLOT_ICON } from './icons';
import type { ItemType, Rarity } from '../game/types';

type TabKey = 'shop' | 'inventory' | 'skills' | 'blacksmith' | 'rebirth' | 'goals';
const TABS: TabKey[] = ['shop', 'inventory', 'skills', 'blacksmith', 'rebirth', 'goals'];

// Worst → best; index doubles as sort rank.
const RARITY_ORDER: Rarity[] = ['N', 'R', 'SR', 'SSR', 'UR', 'LR'];
// Selling these in bulk by accident hurts, so confirm first.
const HIGH_RARITIES: Rarity[] = ['SSR', 'UR', 'LR'];
type SortKey = 'rarity' | 'value' | 'name';

export function Tabs() {
  const [active, setActive] = useState<TabKey>('shop');
  return (
    <div className="panel">
      <div className="tab-buttons">
        {TABS.map((t) => (
          <button key={t} className={`tab-button${active === t ? ' active' : ''}`} onClick={() => setActive(t)} style={{ textTransform: 'capitalize' }}>
            {TAB_ICON[t]} {t}
          </button>
        ))}
      </div>
      <div className="panel-body">
        {active === 'shop' && <ShopTab />}
        {active === 'inventory' && <InventoryTab />}
        {active === 'skills' && <SkillsTab />}
        {active === 'blacksmith' && <BlacksmithTab />}
        {active === 'rebirth' && <RebirthTab />}
        {active === 'goals' && <GoalsTab />}
      </div>
    </div>
  );
}

function ShopTab() {
  const potion = useGameStore((s) => s.potion);
  const xpBoost = useGameStore((s) => s.xpBoost);
  return (
    <div className="shop-grid">
      {([25, 50, 75, 100] as const).map((p) => (
        <div className="shop-item" key={p}>
          <div><strong>🧪 {p}% Potion</strong><p>Heals {p}% HP</p></div>
          <button onClick={() => potion(p)}>Buy</button>
        </div>
      ))}
      {([2, 3] as const).map((m) => (
        <div className="shop-item" key={m}>
          <div><strong>✨ {m}x XP Boost</strong><p>{m === 2 ? 'Doubles' : 'Triples'} XP for 100 fights.</p></div>
          <button onClick={() => xpBoost(m)}>Buy</button>
        </div>
      ))}
    </div>
  );
}

function InventoryTab() {
  const state = useGame();
  const equip = useGameStore((s) => s.equip);
  const sell = useGameStore((s) => s.sell);
  const sellMany = useGameStore((s) => s.sellMany);

  const [rarityFilter, setRarityFilter] = useState<Rarity | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ItemType | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('rarity');

  const equippedIds = Object.values(state.equipment);

  const shown = state.inventory
    .filter((i) => rarityFilter === 'all' || i.rarity === rarityFilter)
    .filter((i) => typeFilter === 'all' || i.type === typeFilter)
    .sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'value') return itemData.rarities[b.rarity].value - itemData.rarities[a.rarity].value;
      return RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
    });

  // Unequipped items in the current view — the targets of "Sell Shown".
  const sellable = shown.filter((i) => !equippedIds.includes(i.id));
  const sellableValue = sellable.reduce((sum, i) => sum + itemData.rarities[i.rarity].value, 0);
  const hasHighRarity = sellable.some((i) => HIGH_RARITIES.includes(i.rarity));

  const sellShown = () => {
    if (sellable.length === 0) return;
    if (hasHighRarity && !window.confirm(`Sell ${sellable.length} items (including high-rarity gear) for ${sellableValue}G?`)) return;
    sellMany(sellable.map((i) => i.id));
  };

  const selectStyle = { flex: 1, padding: 4 };
  return (
    <>
      <div className="inventory-filters" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <select aria-label="Filter by rarity" style={selectStyle} value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value as Rarity | 'all')}>
          <option value="all">All rarities</option>
          {RARITY_ORDER.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select aria-label="Filter by type" style={selectStyle} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ItemType | 'all')}>
          <option value="all">All types</option>
          {itemData.types.map((t) => <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t}</option>)}
        </select>
        <select aria-label="Sort by" style={selectStyle} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="rarity">Sort: Rarity</option>
          <option value="value">Sort: Value</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>
      <div id="inventory-list" style={{ display: 'grid', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
        {state.inventory.length === 0 && <em>Inventory is empty.</em>}
        {state.inventory.length > 0 && shown.length === 0 && <em>No items match the current filters.</em>}
        {shown.map((item) => {
          const equipped = equippedIds.includes(item.id);
          return (
            <div key={item.id} className="inventory-item" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <span style={{ color: itemData.rarities[item.rarity].color, cursor: 'help' }} {...tooltipHandlers(item, equipped)}>
                [{item.rarity}] {item.name}{item.enhancementLevel ? ` +${item.enhancementLevel}` : ''} <small>({item.classReq} {item.type})</small>
              </span>
              <span style={{ display: 'flex', gap: 4 }}>
                {!equipped && <button onClick={() => equip(item)}>Equip</button>}
                {equipped && <span className="log-system">equipped</span>}
                {!equipped && <button className="button-secondary" onClick={() => sell(item.id)}>Sell</button>}
              </span>
            </div>
          );
        })}
      </div>
      <div className="inventory-actions" style={{ marginTop: 10, display: 'flex', gap: 10 }}>
        <button className="button-secondary" style={{ flex: 1 }} disabled={sellable.length === 0} onClick={sellShown}>
          Sell Shown ({sellable.length}) — {sellableValue}G
        </button>
      </div>
    </>
  );
}

function SkillsTab() {
  const state = useGame();
  const slotSkill = useGameStore((s) => s.slotSkill);
  const unslotSkill = useGameStore((s) => s.unslotSkill);
  const p = state.player;
  if (!p) return <p>Choose a class first.</p>;

  const slots = getSkillSlots(state);
  const equipped = p.equippedSkills ?? [];
  const catalog = getClassSkillCatalog(p.baseClassName);
  // "Free" skills are everything active that isn't a slotted catalog pick:
  // innate L70 capstones and set-granted skills.
  const equippedSet = new Set(equipped);
  const freeSkills = getActiveSkills(state).filter((s) => !equippedSet.has(s));

  return (
    <>
      <h3 style={{ marginTop: 0 }}>✨ Active Skills <small style={{ color: equipped.length >= slots ? 'var(--gold-color)' : 'var(--muted-color)' }}>({equipped.length}/{slots} slots)</small></h3>
      <p style={{ color: 'var(--muted-color)', fontSize: 12, marginTop: 0 }}>
        Slot proc skills from your <strong>{p.baseClassName}</strong> catalog. Slots grow every 20 levels; new skills unlock as you promote (L20/40/70).
      </p>

      <div style={{ display: 'grid', gap: 6 }}>
        {catalog.map((sk) => {
          const unlocked = p.level >= sk.unlockLevel;
          const isOn = equippedSet.has(sk.name);
          const full = equipped.length >= slots;
          return (
            <div key={sk.name} className="inventory-item" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', opacity: unlocked ? 1 : 0.45 }}>
              <span title={sk.description} style={{ cursor: 'help' }}>
                <span className={isOn ? 'log-skill' : ''} style={{ fontWeight: isOn ? 'bold' : 'normal' }}>{sk.name}</span>
                {!unlocked && <small style={{ color: 'var(--muted-color)' }}> — unlocks L{sk.unlockLevel}</small>}
              </span>
              {unlocked && (
                isOn
                  ? <button className="button-secondary" style={{ width: 'auto', margin: 0, padding: '4px 8px' }} onClick={() => unslotSkill(sk.name)}>Unequip</button>
                  : <button style={{ width: 'auto', margin: 0, padding: '4px 8px' }} disabled={full} onClick={() => slotSkill(sk.name)}>{full ? 'Slots full' : 'Equip'}</button>
              )}
            </div>
          );
        })}
      </div>

      {freeSkills.length > 0 && (
        <>
          <h3 style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>Always-on <small style={{ color: 'var(--muted-color)' }}>(free — capstones &amp; set bonuses)</small></h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {freeSkills.map((s) => <span key={s} className="log-skill">{s}</span>)}
          </div>
        </>
      )}
    </>
  );
}

const affixLabelOf = (key: string) => affixPool.find((a) => a.key === key)?.label ?? key;

function BlacksmithTab() {
  const state = useGame();
  const enhance = useGameStore((s) => s.enhance);
  const reforge = useGameStore((s) => s.reforge);
  const [selected, setSelected] = useState<ItemType>('weapon');
  const item = state.inventory.find((i) => i.id === state.equipment[selected]);

  return (
    <>
      <h3>Enhance Equipment</h3>
      <div id="blacksmith-item-selector" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {itemData.types.map((type) => {
          const it = state.inventory.find((i) => i.id === state.equipment[type]);
          return (
            <div key={type} className={`blacksmith-slot${selected === type ? ' selected' : ''}`} onClick={() => setSelected(type)} style={{ cursor: 'pointer', padding: 8, border: '1px solid var(--border-color)' }}>
              {it ? <span style={{ color: itemData.rarities[it.rarity].color }}>{SLOT_ICON[type]} {it.name}{it.enhancementLevel ? ` +${it.enhancementLevel}` : ''}</span> : <span style={{ color: 'var(--disabled-text-color)' }}>{SLOT_ICON[type]} {type}</span>}
            </div>
          );
        })}
      </div>
      {item ? (
        <div id="blacksmith-enhancement-panel">
          <p style={{ textAlign: 'center' }}><strong style={{ color: itemData.rarities[item.rarity].color }}>{item.name} ({item.rarity})</strong></p>
          {getEnhanceableStats(item).map((stat) => (
            <p key={stat}>{stat}: {Math.round(((item[stat] as number) || 0) + (item.enhancementBonusStats[stat] || 0))}</p>
          ))}
          <p style={{ textAlign: 'center' }}>Level {item.enhancementLevel}/10 — Cost: <span style={{ color: 'var(--gold-color)' }}>{getEnhancementCost(item)}G</span></p>
          <button style={{ textAlign: 'center' }} disabled={item.enhancementLevel >= 10 || state.gold < getEnhancementCost(item)} onClick={() => enhance(item.id)}>Enhance</button>

          <div style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
            <h3 style={{ marginTop: 0 }}>🎲 Reforge Affixes</h3>
            {canReforgeItem(item) ? (
              <>
                <div style={{ marginBottom: 8 }}>
                  {item.affixes?.length ? item.affixes.map((af) => (
                    <p key={af.key} style={{ margin: '2px 0', color: 'var(--set-bonus-active, #6cc)' }}>
                      {affixLabelOf(af.key)}: +{(af.value * 100).toFixed(1)}%
                    </p>
                  )) : <p style={{ margin: 0, color: 'var(--muted-color)' }}><em>No affixes — reforge to roll some.</em></p>}
                </div>
                <p style={{ textAlign: 'center', color: 'var(--muted-color)', fontSize: 12, marginTop: 0 }}>
                  Rerolls all affixes{item.reforges ? ` · reforged ${item.reforges}×` : ''} — Cost: <span style={{ color: 'var(--gold-color)' }}>{getReforgeCost(item)}G</span>
                </p>
                <button className="button-secondary" style={{ textAlign: 'center' }} disabled={state.gold < getReforgeCost(item)} onClick={() => reforge(item.id)}>Reforge</button>
              </>
            ) : (
              <p style={{ color: 'var(--muted-color)', margin: 0 }}>Only SR+ gear carries affixes to reforge.</p>
            )}
          </div>
        </div>
      ) : (
        <p>Equip an item in this slot to enhance it.</p>
      )}
    </>
  );
}

const REBIRTH_LABELS: Record<string, string> = {
  atk: 'ATK', def: 'DEF', hp: 'Max HP', gold: 'Gold', xp: 'XP',
  critDmg: 'Crit DMG', dropRate: 'Drop Rate',
};

function RebirthTab() {
  const state = useGame();
  const spend = useGameStore((s) => s.spendRebirth);
  const bonuses = state.rebirth.bonuses;
  return (
    <div>
      <div className="rebirth-points">Points: <span>{state.rebirth.points}</span></div>
      {(Object.keys(bonuses) as (keyof typeof bonuses)[]).map((stat) => (
        <div className="rebirth-stat" key={stat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span>{REBIRTH_LABELS[stat] ?? stat} Bonus: +<span className="rebirth-value">{Math.round(bonuses[stat] * 100)}</span>%</span>
          <button disabled={state.rebirth.points <= 0} onClick={() => spend(stat)}>+</button>
        </div>
      ))}
      <AutomationSection />
    </div>
  );
}

function AutomationSection() {
  const state = useGame();
  const buyAuto = useGameStore((s) => s.buyAuto);
  const setAuto = useGameStore((s) => s.setAuto);
  const a = state.automation;
  const keys: AutomationKey[] = ['autoEquip', 'autoSell', 'autoBoss', 'autoPotion'];
  return (
    <>
      <h3 style={{ marginTop: 18, borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>⚙️ Automation</h3>
      <p style={{ color: 'var(--muted-color)', fontSize: 12, marginTop: 0 }}>Spend Rebirth Points to permanently unlock hands-off play.</p>
      {keys.map((key) => {
        const unlocked = a.unlocked[key];
        const info = AUTOMATION_INFO[key];
        return (
          <div className="rebirth-stat" key={key} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <strong>{info.name}</strong>
              {!unlocked ? (
                <button style={{ width: 'auto' }} disabled={state.rebirth.points < AUTOMATION_COSTS[key]} onClick={() => buyAuto(key)}>
                  Unlock ({AUTOMATION_COSTS[key]} pts)
                </button>
              ) : (
                <AutomationControl k={key} setAuto={setAuto} a={a} />
              )}
            </div>
            <span style={{ color: 'var(--muted-color)', fontSize: 11 }}>{info.desc}</span>
          </div>
        );
      })}
    </>
  );
}

function AutomationControl({ k, setAuto, a }: { k: AutomationKey; setAuto: (key: AutomationKey, v: boolean | number | Rarity | 'off') => void; a: ReturnType<typeof useGame>['automation'] }) {
  const ctrl = { width: 'auto', margin: 0, padding: '4px 8px' } as const;
  if (k === 'autoSell') {
    return (
      <select style={ctrl} value={a.autoSellRarity} onChange={(e) => setAuto(k, e.target.value as Rarity | 'off')}>
        <option value="off">Off</option>
        {RARITY_ORDER.map((r) => <option key={r} value={r}>≤ {r}</option>)}
      </select>
    );
  }
  if (k === 'autoPotion') {
    return (
      <select style={ctrl} value={a.autoPotionPct} onChange={(e) => setAuto(k, Number(e.target.value))}>
        <option value={0}>Off</option>
        {[20, 30, 40, 50].map((p) => <option key={p} value={p}>at {p}% HP</option>)}
      </select>
    );
  }
  const on = k === 'autoEquip' ? a.autoEquip : a.autoBoss;
  return <button style={ctrl} className={on ? '' : 'button-secondary'} onClick={() => setAuto(k, !on)}>{on ? 'ON' : 'OFF'}</button>;
}

function GoalsTab() {
  const state = useGame();
  const claimDaily = useGameStore((s) => s.claimDaily);
  const claimLogin = useGameStore((s) => s.claimLogin);
  const daily = state.daily;
  const unlocked = new Set(state.achievements);
  return (
    <>
      <h3 style={{ marginTop: 0 }}>📅 Daily</h3>
      {daily ? (
        <>
          <div className="rebirth-stat" style={{ justifyContent: 'space-between' }}>
            <span>🎁 Login reward {daily.streak > 0 && <small>(streak {daily.streak})</small>}</span>
            <button style={{ width: 'auto' }} disabled={daily.loginClaimed} onClick={claimLogin}>{daily.loginClaimed ? 'Claimed' : 'Claim'}</button>
          </div>
          {daily.objectives.map((o) => {
            const done = o.progress >= o.target;
            const reward = o.reward.gold ? `${o.reward.gold}G` : o.reward.rebirthPoints ? `${o.reward.rebirthPoints} RP` : '';
            return (
              <div className="rebirth-stat" key={o.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>{o.desc} <small style={{ color: 'var(--gold-color)' }}>→ {reward}</small></span>
                  <button style={{ width: 'auto' }} disabled={!done || o.claimed} onClick={() => claimDaily(o.id)}>{o.claimed ? '✓' : done ? 'Claim' : `${Math.min(o.progress, o.target)}/${o.target}`}</button>
                </div>
                <div className="stat-bar" style={{ margin: 0, height: 8 }}><div className="stat-bar-fill xp" style={{ width: `${Math.min(100, (o.progress / o.target) * 100)}%` }} /></div>
              </div>
            );
          })}
        </>
      ) : <em>Daily objectives load shortly…</em>}

      <h3 style={{ marginTop: 18 }}>🏅 Achievements <small style={{ color: 'var(--muted-color)' }}>({unlocked.size}/{achievements.length})</small></h3>
      <div style={{ display: 'grid', gap: 6 }}>
        {achievements.map((ach) => {
          const got = unlocked.has(ach.id);
          return (
            <div key={ach.id} className="achievement-row" style={{ opacity: got ? 1 : 0.5 }}>
              <span style={{ fontSize: 20 }}>{ach.icon}</span>
              <div style={{ flexGrow: 1 }}>
                <div><strong>{ach.name}</strong> {got && <span className="log-system">✓</span>}</div>
                <small style={{ color: 'var(--muted-color)' }}>{ach.desc} — <span style={{ color: 'var(--gold-color)' }}>{ach.rewardText}</span></small>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
