import type { GameState } from '../types';
import { SAVE_KEY } from '../data/constants';
import { isValidSave, migrateSave } from './migrate';
import { serializableState, type SaveProvider } from './types';

/** localStorage-backed save, compatible with the legacy v13 save key/format. */
export class LocalSaveProvider implements SaveProvider {
  readonly name = 'local';

  isAvailable(): boolean {
    return typeof localStorage !== 'undefined';
  }

  async load(): Promise<GameState | null> {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!isValidSave(parsed)) throw new Error('Invalid save.');
      return migrateSave(parsed);
    } catch (e) {
      console.error('Failed to load local save:', e);
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
  }

  async save(state: GameState): Promise<void> {
    if (!state.player || !state.isRunning) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(serializableState(state)));
  }

  async clear(): Promise<void> {
    localStorage.removeItem(SAVE_KEY);
  }
}

/** Base64 export string for manual backup (legacy "Export Save"). */
export function exportSave(state: GameState): string {
  return btoa(JSON.stringify(serializableState(state)));
}

/** Parse a base64 export string back into a migrated GameState. */
export function importSave(encoded: string): GameState {
  const parsed = JSON.parse(atob(encoded.trim()));
  if (!isValidSave(parsed)) throw new Error('Invalid save code.');
  return migrateSave(parsed);
}
