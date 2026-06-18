import type { GameState } from '../types';

/** A pluggable persistence backend (localStorage, Supabase, …). */
export interface SaveProvider {
  readonly name: string;
  /** Whether this provider is usable right now (e.g. cloud requires auth). */
  isAvailable(): boolean;
  load(): Promise<GameState | null>;
  save(state: GameState): Promise<void>;
  clear(): Promise<void>;
}

/** Strip transient/derived fields before persisting (matches legacy behaviour). */
export function serializableState(state: GameState): Omit<GameState, 'playerTemp'> {
  const { playerTemp: _ignored, ...rest } = state;
  void _ignored;
  return rest;
}
