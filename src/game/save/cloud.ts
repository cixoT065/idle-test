import type { GameState } from '../types';
import { supabase } from '../../lib/supabase';
import { isValidSave, migrateSave } from './migrate';
import { serializableState, type SaveProvider } from './types';

const TABLE = 'saves';

/**
 * Supabase-backed cloud save. One row per authenticated user (PK = user id),
 * protected by row-level security (see supabase/schema.sql). Available only
 * when Supabase is configured AND a user is signed in.
 */
export class CloudSaveProvider implements SaveProvider {
  readonly name = 'cloud';
  private userId: string | null = null;

  setUser(userId: string | null): void {
    this.userId = userId;
  }

  isAvailable(): boolean {
    return Boolean(supabase && this.userId);
  }

  async load(): Promise<GameState | null> {
    if (!this.isAvailable()) return null;
    const { data, error } = await supabase!
      .from(TABLE)
      .select('data')
      .eq('user_id', this.userId!)
      .maybeSingle();
    if (error) {
      console.error('Cloud load failed:', error.message);
      return null;
    }
    if (!data?.data || !isValidSave(data.data)) return null;
    return migrateSave(data.data as Record<string, unknown>);
  }

  async save(state: GameState): Promise<void> {
    if (!this.isAvailable() || !state.player) return;
    const { error } = await supabase!.from(TABLE).upsert(
      {
        user_id: this.userId!,
        data: serializableState(state),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) console.error('Cloud save failed:', error.message);
  }

  async clear(): Promise<void> {
    if (!this.isAvailable()) return;
    await supabase!.from(TABLE).delete().eq('user_id', this.userId!);
  }
}
