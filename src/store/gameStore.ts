import { create } from 'zustand';
import type { GameState, EngineContext, LogEntry, BaseClassName, ItemType, Rarity, StatName, Item } from '../game/types';
import {
  getDefaultGameState,
  selectClass as engineSelectClass,
  startGame,
  rebirth as engineRebirth,
  runTick,
  applyPromotion,
  equipItem,
  unequipItem,
  sellItem,
  sellByRarity,
  sellItems,
  buyPotion,
  buyXpBoost,
  enhanceItem,
  reforgeItem,
  investStat,
  spendRebirthPoint,
  challengeWaveBoss,
  challengeFinalBoss,
  toggleWager,
  setBuildFocus,
  equipSkill,
  unequipSkill,
  applyOfflineProgress,
  runAutomation,
  buyAutomation,
  setAutomation,
  ensureDaily,
  claimDailyObjective,
  claimDailyLogin,
  saveLoadout as engineSaveLoadout,
  loadLoadout as engineLoadLoadout,
  deleteLoadout as engineDeleteLoadout,
  type OfflineReport,
  type AutomationKey,
} from '../game/engine';
import { saveManager, exportSave, importSave } from '../game/save';

const MAX_LOG = 120;

/** Per-tick combat summary the UI turns into choreographed animations. */
export interface CombatFx {
  id: number;
  playerDmg: number;
  monsterDmg: number;
  playerCrit: boolean;
  spell: boolean;
  playerMiss: boolean;
  monsterMiss: boolean;
  kill: boolean;
  death: boolean;
}

const NO_FX: CombatFx = {
  id: 0, playerDmg: 0, monsterDmg: 0, playerCrit: false, spell: false,
  playerMiss: false, monsterMiss: false, kill: false, death: false,
};

interface GameStore {
  state: GameState;
  eventLog: LogEntry[];
  battleLog: LogEntry[];
  version: number;
  hasPlayer: boolean;
  gameWon: boolean;
  cloudEnabled: boolean;
  offlineReport: OfflineReport | null;
  lrFlash: number;
  combatFx: CombatFx;

  initialize: () => Promise<void>;
  tick: () => void;
  dismissOffline: () => void;
  buyAuto: (key: AutomationKey) => void;
  setAuto: (key: AutomationKey, value: boolean | number | Rarity | 'off') => void;
  claimDaily: (id: string) => void;
  claimLogin: () => void;
  saveLoadout: (slot: number, name?: string) => void;
  loadLoadout: (slot: number) => void;
  deleteLoadout: (slot: number) => void;
  chooseClass: (name: BaseClassName) => void;
  choosePromotion: (selection: string) => void;
  equip: (item: Item) => void;
  unequip: (type: ItemType) => void;
  sell: (itemId: number) => void;
  sellRarity: (rarity: Rarity) => void;
  sellMany: (itemIds: number[]) => void;
  invest: (stat: StatName, amount: number) => void;
  potion: (percent: 25 | 50 | 75 | 100) => void;
  xpBoost: (multiplier: 2 | 3) => void;
  enhance: (itemId: number) => void;
  reforge: (itemId: number) => void;
  rebirthRun: () => void;
  spendRebirth: (stat: keyof GameState['rebirth']['bonuses']) => void;
  challengeBoss: () => void;
  challengeFinal: () => void;
  toggleWager: (key: string) => void;
  setFocus: (focus: string) => void;
  slotSkill: (name: string) => void;
  unslotSkill: (name: string) => void;
  exportSaveCode: () => string;
  importSaveCode: (code: string) => boolean;
  setCloudUser: (userId: string | null) => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  // Engine context: logs flow into store buffers instead of the DOM.
  let logBuffer: LogEntry[] = [];
  const ctx: EngineContext = {
    rng: Math.random,
    log: (message, className = 'log-system', logType = 'event') => {
      logBuffer.push({ message, className, logType });
    },
    onGameWon: () => set({ gameWon: true }),
  };

  /** Run a mutation against the engine, then commit state + logs to React. */
  function runAction(fn: (state: GameState, ctx: EngineContext) => void): void {
    const { state, eventLog, battleLog } = get();
    logBuffer = [];
    fn(state, ctx);

    const newEvents = logBuffer.filter((l) => l.logType === 'event');
    const newBattle = logBuffer.filter((l) => l.logType === 'battle');
    set({
      state: { ...state },
      version: get().version + 1,
      hasPlayer: !!state.player,
      eventLog: newEvents.length ? [...eventLog, ...newEvents].slice(-MAX_LOG) : eventLog,
      battleLog: newBattle.length ? [...battleLog, ...newBattle].slice(-MAX_LOG) : battleLog,
    });
  }

  return {
    state: getDefaultGameState(),
    eventLog: [],
    battleLog: [],
    version: 0,
    hasPlayer: false,
    gameWon: false,
    cloudEnabled: false,
    offlineReport: null,
    lrFlash: 0,
    combatFx: NO_FX,

    initialize: async () => {
      const loaded = await saveManager.load();
      if (!loaded) return;
      const elapsed = Date.now() - (loaded.lastSeen ?? Date.now());
      set({ state: loaded, hasPlayer: !!loaded.player });
      runAction((s, c) => startGame(s, c));
      runAction((s, c) => ensureDaily(s, c, Date.now()));
      if (loaded.player) {
        let report: OfflineReport | null = null;
        runAction((s, c) => { report = applyOfflineProgress(s, c, elapsed); });
        if (report) set({ offlineReport: report });
      }
    },

    tick: () => {
      const { state } = get();
      if (!state.isRunning || !state.player) return;
      const prevLr = state.stats.lrDrops;
      const prevMonHp = state.currentMonster?.hp ?? 0;
      const prevPlayerHp = state.player.currentHp;
      const prevBL = get().battleLog.length;
      runAction((s, c) => { ensureDaily(s, c, Date.now()); runTick(s, c); runAutomation(s, c); });
      const ns = get().state;
      if (ns.stats.lrDrops > prevLr) set({ lrFlash: get().lrFlash + 1 });

      // Distil this tick's battle log + HP deltas into an animation event.
      const txt = get().battleLog.slice(prevBL).map((l) => l.message).join('\n');
      const has = (sub: string) => txt.includes(sub);
      const kill = has('You have defeated the');
      const death = has('have been defeated');
      const newMonHp = ns.currentMonster?.hp ?? 0;
      const fx: CombatFx = {
        id: get().combatFx.id + 1,
        playerDmg: kill ? Math.max(0, Math.ceil(prevMonHp)) : Math.max(0, Math.round(prevMonHp - newMonHp)),
        monsterDmg: death ? 0 : Math.max(0, Math.round(prevPlayerHp - (ns.player?.currentHp ?? prevPlayerHp))),
        playerCrit: has('(CRIT!)'),
        spell: has('Arcane Power') || has('Chain Lightning') || has('Reality Break') || has('Combustion') || has('Paradox') || has('true damage'),
        playerMiss: has('Your attack was evaded'),
        monsterMiss: (has('attack was evaded') && !has('Your attack was evaded')) || has('nullified') || has('phase through'),
        kill,
        death,
      };
      set({ combatFx: fx });
    },

    dismissOffline: () => set({ offlineReport: null }),
    buyAuto: (key) => runAction((s, c) => buyAutomation(s, c, key)),
    setAuto: (key, value) => runAction((s) => setAutomation(s, key, value)),
    claimDaily: (id) => runAction((s, c) => claimDailyObjective(s, c, id)),
    claimLogin: () => runAction((s, c) => claimDailyLogin(s, c)),
    saveLoadout: (slot, name) => runAction((s) => engineSaveLoadout(s, slot, name)),
    loadLoadout: (slot) => runAction((s, c) => engineLoadLoadout(s, c, slot)),
    deleteLoadout: (slot) => runAction((s) => engineDeleteLoadout(s, slot)),

    chooseClass: (name) => runAction((s, c) => engineSelectClass(s, c, name)),
    choosePromotion: (selection) => runAction((s, c) => applyPromotion(s, c, selection)),
    equip: (item) => runAction((s, c) => equipItem(s, c, item)),
    unequip: (type) => runAction((s, c) => unequipItem(s, c, type)),
    sell: (itemId) => runAction((s, c) => sellItem(s, c, itemId)),
    sellRarity: (rarity) => runAction((s, c) => sellByRarity(s, c, rarity)),
    sellMany: (itemIds) => runAction((s, c) => sellItems(s, c, itemIds)),
    invest: (stat, amount) => runAction((s) => investStat(s, stat, amount)),
    potion: (percent) => runAction((s, c) => buyPotion(s, c, percent)),
    xpBoost: (multiplier) => runAction((s, c) => buyXpBoost(s, c, multiplier)),
    enhance: (itemId) => runAction((s, c) => enhanceItem(s, c, itemId)),
    reforge: (itemId) => runAction((s, c) => reforgeItem(s, c, itemId)),
    rebirthRun: () =>
      runAction((s, c) => {
        engineRebirth(s, c);
      }),
    spendRebirth: (stat) => runAction((s) => spendRebirthPoint(s, stat)),
    challengeBoss: () => runAction((s, c) => challengeWaveBoss(s, c)),
    challengeFinal: () => runAction((s, c) => challengeFinalBoss(s, c)),
    toggleWager: (key) => runAction((s) => toggleWager(s, key)),
    setFocus: (focus) => runAction((s) => setBuildFocus(s, focus)),
    slotSkill: (name) => runAction((s, c) => equipSkill(s, c, name)),
    unslotSkill: (name) => runAction((s) => unequipSkill(s, name)),

    exportSaveCode: () => exportSave(get().state),
    importSaveCode: (code) => {
      try {
        const loaded = importSave(code);
        set({ state: loaded, hasPlayer: !!loaded.player, gameWon: false });
        runAction((s, c) => startGame(s, c));
        return true;
      } catch (e) {
        console.error(e);
        runAction((_s, c) => c.log('IMPORT FAILED: Invalid save code.', 'log-error', 'event'));
        return false;
      }
    },

    setCloudUser: (userId) => {
      saveManager.setUser(userId);
      set({ cloudEnabled: saveManager.cloud.isAvailable() });
    },
  };
});

/**
 * When true, all persistence is suppressed. Set before a hard reset (New Game)
 * so the `beforeunload` autosave can't re-write the old save we just cleared.
 */
let persistenceDisabled = false;
export function disablePersistence(): void {
  persistenceDisabled = true;
}

/** Persist the current state through the SaveManager (local + cloud). */
export async function persistGame(): Promise<void> {
  if (persistenceDisabled) return;
  // Stamp the save time so the next load can award offline progress.
  useGameStore.getState().state.lastSeen = Date.now();
  await saveManager.save(useGameStore.getState().state);
}
