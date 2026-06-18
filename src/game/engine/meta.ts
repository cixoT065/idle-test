import type { GameState, EngineContext, DailyObjective, DailyMetric, ItemType } from '../types';
import { achievements } from '../data/achievements';
import { itemData } from '../data/items';

// ----------------------------- Achievements -----------------------------

/** Unlock any newly-satisfied achievements and apply their one-time rewards. */
export function checkAchievements(state: GameState, ctx: EngineContext): void {
  for (const a of achievements) {
    if (state.achievements.includes(a.id)) continue;
    if (!a.check(state)) continue;
    state.achievements.push(a.id);
    if (a.reward.gold) state.gold += a.reward.gold;
    if (a.reward.rebirthPoints) state.rebirth.points += a.reward.rebirthPoints;
    if (a.reward.bonus) state.rebirth.bonuses[a.reward.bonus.stat] += a.reward.bonus.amount;
    ctx.log(`🏅 Achievement unlocked: <strong>${a.name}</strong> — ${a.rewardText}!`, 'log-drop', 'event');
  }
}

// ------------------------------- Dailies --------------------------------

export function dateString(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

interface DailyTemplate {
  metric: DailyMetric;
  desc: (n: number) => string;
  targets: number[];
  reward: (target: number) => DailyObjective['reward'];
}

const DAILY_TEMPLATES: DailyTemplate[] = [
  { metric: 'kills', desc: (n) => `Defeat ${n} monsters`, targets: [100, 200, 350], reward: (t) => ({ gold: t * 3 }) },
  { metric: 'bosses', desc: (n) => `Defeat ${n} wave bosses`, targets: [3, 5, 8], reward: () => ({ rebirthPoints: 1 }) },
  { metric: 'gold', desc: (n) => `Earn ${n.toLocaleString()} gold`, targets: [2000, 5000, 10000], reward: (t) => ({ gold: Math.round(t * 0.5) }) },
  { metric: 'enhance', desc: (n) => `Enhance equipment ${n} times`, targets: [5, 10, 15], reward: (t) => ({ gold: t * 80 }) },
  { metric: 'drops', desc: (n) => `Collect ${n} item drops`, targets: [20, 40, 60], reward: (t) => ({ gold: t * 20 }) },
];

function rollObjectives(ctx: EngineContext): DailyObjective[] {
  const pool = [...DAILY_TEMPLATES];
  const out: DailyObjective[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const tpl = pool.splice(Math.floor(ctx.rng() * pool.length), 1)[0];
    const target = tpl.targets[Math.floor(ctx.rng() * tpl.targets.length)];
    out.push({ id: `${tpl.metric}_${i}`, desc: tpl.desc(target), metric: tpl.metric, target, progress: 0, reward: tpl.reward(target), claimed: false });
  }
  return out;
}

/** Roll fresh objectives when the day changes; preserves the login streak. */
export function ensureDaily(state: GameState, ctx: EngineContext, nowTs: number): boolean {
  const today = dateString(nowTs);
  if (state.daily && state.daily.date === today) return false;
  const prev = state.daily;
  let streak = prev?.streak ?? 0;
  if (prev) {
    const yesterday = dateString(nowTs - 86400000);
    if (!(prev.loginClaimed && prev.date === yesterday)) streak = 0; // missed a day
  }
  state.daily = { date: today, objectives: rollObjectives(ctx), loginClaimed: false, streak };
  return true;
}

/** Advance progress on any matching, unclaimed daily objective. */
export function trackDaily(state: GameState, metric: DailyMetric, amount: number): void {
  if (!state.daily) return;
  for (const o of state.daily.objectives) {
    if (o.metric === metric && !o.claimed) o.progress = Math.min(o.target, o.progress + amount);
  }
}

export function claimDailyObjective(state: GameState, ctx: EngineContext, id: string): void {
  const o = state.daily?.objectives.find((x) => x.id === id);
  if (!o || o.claimed || o.progress < o.target) return;
  o.claimed = true;
  if (o.reward.gold) state.gold += o.reward.gold;
  if (o.reward.rebirthPoints) state.rebirth.points += o.reward.rebirthPoints;
  ctx.log(`Daily objective complete: ${o.desc}!`, 'log-drop', 'event');
}

/** Claim the daily login reward; reward scales with the login streak. */
export function claimDailyLogin(state: GameState, ctx: EngineContext): void {
  if (!state.daily || state.daily.loginClaimed) return;
  state.daily.loginClaimed = true;
  state.daily.streak += 1;
  const streak = state.daily.streak;
  const gold = 500 * streak;
  state.gold += gold;
  let extra = '';
  if (streak % 7 === 0) { state.rebirth.points += 1; extra = ' and +1 Rebirth Point'; }
  ctx.log(`Daily login (streak ${streak}): +${gold.toLocaleString()} gold${extra}!`, 'log-drop', 'event');
}

// ------------------------------- Loadouts -------------------------------

export function saveLoadout(state: GameState, slot: number, name?: string): void {
  if (slot < 0 || slot >= state.loadouts.length) return;
  state.loadouts[slot] = { name: name || `Build ${slot + 1}`, equipment: { ...state.equipment } };
}

export function loadLoadout(state: GameState, ctx: EngineContext, slot: number): void {
  const l = state.loadouts[slot];
  if (!l) return;
  let equipped = 0;
  for (const type of itemData.types as readonly ItemType[]) {
    const id = l.equipment[type];
    if (id == null) continue;
    const item = state.inventory.find((i) => i.id === id);
    if (item && item.classReq === state.player?.baseClassName) { state.equipment[type] = id; equipped++; }
  }
  ctx.log(`Loaded ${l.name} (${equipped} pieces equipped).`, 'log-system', 'event');
}

export function deleteLoadout(state: GameState, slot: number): void {
  if (slot >= 0 && slot < state.loadouts.length) state.loadouts[slot] = null;
}
