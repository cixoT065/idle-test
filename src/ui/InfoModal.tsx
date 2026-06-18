import { useState } from 'react';
import { itemData, itemSets } from '../game/data/items';
import { classes, promotionInfo } from '../game/data/classes';
import { promotionSkills } from '../game/data/skills';
import { getRarityProbabilities } from '../game/engine';
import { getDefaultGameState } from '../game/engine/state';
import type { Rarity } from '../game/types';

type InfoTab = 'stats' | 'items' | 'combat' | 'classes' | 'rebirth' | 'drops';
const TABS: InfoTab[] = ['stats', 'items', 'combat', 'classes', 'rebirth', 'drops'];

// A bare state is enough for getRarityProbabilities (it only reads `wave`).
const baseState = getDefaultGameState();

const StatsInfo = () => (
  <div dangerouslySetInnerHTML={{ __html: `
<h3>Primary Stats</h3>
<p>Each stat now has a clear role. Invest your level-up points to lean into your build.</p>
<ul>
  <li><strong>STR:</strong> Melee attack power (huge for Warriors, moderate for Rogues) and DEF per point.</li>
  <li><strong>CON:</strong> Increases Max HP (on top of your class's base HP) and grants minor HP regen.</li>
  <li><strong>DEF:</strong> Mitigation — reduces normal damage taken. Each invested point is worth extra DEF, so stacking it pairs well with CON for a durable tank (CON scales better very deep into a run).</li>
  <li><strong>DEX:</strong> Finesse attack power (Rogues), Accuracy, and Crit Chance.</li>
  <li><strong>AGL:</strong> Evasion (dodge chance) and finesse attack power for Rogues.</li>
  <li><strong>INT:</strong> Magic attack power (Wizards) and True Damage (soft cap 35%, hard cap 60%).</li>
  <li><strong>Crit Chance</strong> is capped at 100% — past that, invest elsewhere.</li>
</ul>
<p><strong>Piercing armor:</strong> heavily-armored bosses shrug off normal hits, so each class earns some True Damage from its main attack stat — Wizards from INT, Warriors from STR, Rogues from DEX.</p>
<h3>Secondary Stats</h3>
<ul>
  <li><strong>ATK / DEF / HP:</strong> Total output, mitigation, and life.</li>
  <li><strong>Accuracy / Evasion:</strong> Hit and dodge chances.</li>
  <li><strong>Crit Chance / Crit DMG:</strong> Critical hit probability and multiplier.</li>
  <li><strong style="color:#8888FF">True Damage:</strong> Ignores all enemy defense.</li>
</ul>` }} />
);

function ItemsInfo() {
  return (
    <div>
      <h3>Rarities</h3>
      <table>
        <tbody>
          <tr><th>Rarity</th><th>Stat Mod</th><th>Base Stats</th><th>Bonus Stats</th><th>Sell</th></tr>
          {(Object.keys(itemData.rarities) as Rarity[]).map((r) => {
            const info = itemData.rarities[r];
            return (
              <tr key={r}>
                <td><strong style={{ color: info.color }}>{r}</strong></td>
                <td>x{info.statMod}</td><td>{info.baseStatCount}</td><td>{info.bonusStats}</td><td>{info.value}G</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>Equipment Slots</h3>
      <p>Five slots: <strong>weapon, helm, body, legs, accessory</strong>. Each slot favours a core stat. Drops are biased toward your class so most loot is usable.</p>
      <h3>Affixes</h3>
      <p>Higher-rarity items roll extra <strong>affixes</strong> (Lifesteal, Max HP, Damage Reflect, …) on top of their base stats.</p>
      <h3>Enhancement</h3>
      <p>Enhance equipped items at the Blacksmith (max +10). Cost rises with rarity and level.</p>
      <h3>Item Sets</h3>
      <p>Wear matching set pieces for threshold bonuses. <strong>LR sets are 5-piece</strong> and grant powerful <em>set skills</em> at 2/5, 4/5 and 5/5.</p>
      <table>
        <tbody>
          <tr><th>Set</th><th>Class</th><th>Rarity</th><th>Bonuses</th></tr>
          {Object.keys(itemSets).map((name) => {
            const set = itemSets[name];
            return (
              <tr key={name}>
                <td>{name}</td><td>{set.class}</td>
                <td style={{ color: itemData.rarities[set.rarity].color }}>{set.rarity}</td>
                <td>{Object.keys(set.bonuses).map((k) => String(set.bonuses[Number(k)].description)).join(' · ')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const CombatInfo = () => (
  <div dangerouslySetInnerHTML={{ __html: `
<h3>Damage Calculation</h3>
<ol>
  <li><strong>Hit Chance:</strong> Your Accuracy vs the enemy's Evasion (min 25%, max 95%).</li>
  <li><strong>Critical Hit:</strong> Crit Chance rolls a crit; Crit DMG multiplies it.</li>
  <li><strong>Damage Reduction:</strong> Enemy DEF softens normal damage; True Damage ignores it.</li>
  <li><strong>Final Damage:</strong> Minimum of 1.</li>
</ol>
<h3>Monster Modifiers</h3>
<p>Mutants and elites can spawn with affixes — <strong>Armored</strong>, <strong>Swift</strong>, <strong>Frenzied</strong>, <strong>Vampiric</strong>, <strong>Volatile</strong> — that make them tougher but far more rewarding.</p>
<h3>Boss Phases</h3>
<p>Bosses (and the final boss) <strong>enrage</strong> below 50% HP and enter a <strong>frenzy</strong> below 25%, hitting much harder. Burst them down or bring sustain.</p>
<h3>The Final Boss — Chronos Tyrant</h3>
<p>You can <strong>Challenge the Final Boss at any time</strong> from the combat panel — but at full power it is brutally hard and will crush most builds. Every <strong>wave boss</strong> you defeat <strong>weakens it (−2.5%)</strong>, down to 10% power. That weakening <strong>resets each run and on rebirth</strong>, so to stand a chance you must clear wave bosses first, then strike. It is not meant to fall in your first few attempts — even after rebirthing.</p>
<h3>Skills &amp; Procs</h3>
<p>Promotions and item sets grant effects that proc during combat — extra hits, healing, debuffs. Watch the battle log!</p>` }} />
);

function ClassesInfo() {
  return (
    <div>
      <h3>Base Classes</h3>
      {(Object.keys(classes) as (keyof typeof classes)[]).map((c) => (
        <div key={c}><h4>{c}</h4><p>{classes[c].description}</p></div>
      ))}
      <h3>Promotions</h3>
      <table>
        <tbody>
          <tr><th>Promotion</th><th>Skill</th><th>Description</th></tr>
          {Object.keys(promotionInfo).map((name) => {
            const skill = promotionSkills[name];
            return (
              <tr key={name}>
                <td><strong>{name}</strong></td>
                <td>{skill ? skill.name : 'N/A'}</td>
                <td>{promotionInfo[name].description}{skill && <><br /><em>{skill.description}</em></>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const RebirthInfo = () => (
  <div dangerouslySetInnerHTML={{ __html: `
<h3>What is Rebirth?</h3>
<p>At Level 70 you may Rebirth: restart from Level 1 with a new class, losing items/gold/invested points, but gaining permanent <strong>Rebirth Points</strong>.</p>
<h3>Rebirth Points</h3>
<p>Spend them in the Rebirth tab for permanent bonuses to ATK, DEF, HP, Gold, XP, Crit DMG and Drop Rate — the key to long-term power. You can also <strong>unlock Automation</strong> (auto-equip, auto-sell, auto-boss, auto-potion) there for hands-off play.</p>
<h3>Idle &amp; Retention</h3>
<ul>
  <li><strong>Offline progress:</strong> your hero keeps fighting while you're away (60% rate, capped at 12h) — collect the haul when you return.</li>
  <li><strong>Endless waves:</strong> waves no longer cap at 35 — they scale forever, so there's always a higher peak to chase.</li>
  <li><strong>Champions:</strong> rare ⭐ elites with big HP and guaranteed boss-tier loot.</li>
  <li><strong>Daily &amp; Achievements:</strong> the Goals tab has daily login rewards, rotating objectives, and milestone achievements that grant permanent bonuses.</li>
  <li><strong>Loadouts:</strong> save gear presets in the sidebar to swap between farm and boss builds instantly.</li>
</ul>` }} />
);

function DropsInfo() {
  const types = ['regular', 'mutant', 'elite', 'boss'] as const;
  return (
    <div>
      <h3>Item Drop Rates by Monster Type</h3>
      <p>Higher waves shift drops toward better rarities. ~75% of drops match your class; modified monsters and the Drop Rate rebirth bonus increase how often items drop.</p>
      {types.map((type) => {
        const probs = getRarityProbabilities(baseState, type);
        const keys = Object.keys(probs) as Rarity[];
        return (
          <div key={type}>
            <h4 style={{ textTransform: 'capitalize' }}>{type} Monsters</h4>
            <table>
              <tbody>
                <tr>{keys.map((r) => <th key={r}>{r}</th>)}</tr>
                <tr>{keys.map((r) => <td key={r}>{(probs[r] * 100).toFixed(1)}%</td>)}</tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export function InfoModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<InfoTab>('stats');
  return (
    <div className="modal" style={{ display: 'flex' }} onClick={onClose}>
      <div className="modal-content info-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Game Information</h2>
        <div className="info-tab-buttons">
          {TABS.map((t) => (
            <button key={t} className={`info-tab-button${tab === t ? ' active' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>
        <div className="info-tab-content-container">
          <div className="info-tab-content active">
            {tab === 'stats' && <StatsInfo />}
            {tab === 'items' && <ItemsInfo />}
            {tab === 'combat' && <CombatInfo />}
            {tab === 'classes' && <ClassesInfo />}
            {tab === 'rebirth' && <RebirthInfo />}
            {tab === 'drops' && <DropsInfo />}
          </div>
        </div>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
