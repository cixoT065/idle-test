import type { GameState } from '../types';
import { LocalSaveProvider } from './local';
import { CloudSaveProvider } from './cloud';

export { exportSave, importSave } from './local';
export type { SaveProvider } from './types';

/**
 * Coordinates local + cloud persistence. Local is always written (offline-first);
 * cloud is mirrored when a user is signed in. On load, cloud wins when available
 * so progress follows the account across devices.
 */
export class SaveManager {
  readonly local = new LocalSaveProvider();
  readonly cloud = new CloudSaveProvider();

  setUser(userId: string | null): void {
    this.cloud.setUser(userId);
  }

  async load(): Promise<GameState | null> {
    if (this.cloud.isAvailable()) {
      const cloud = await this.cloud.load();
      if (cloud) return cloud;
    }
    return this.local.load();
  }

  async save(state: GameState): Promise<void> {
    await this.local.save(state);
    if (this.cloud.isAvailable()) await this.cloud.save(state);
  }

  async clear(): Promise<void> {
    await this.local.clear();
    if (this.cloud.isAvailable()) await this.cloud.clear();
  }
}

export const saveManager = new SaveManager();
