import { useGameStore } from '../store/gameStore';
import { getPlayerTotalStats } from '../game/engine';
import type { TotalStats } from '../game/types';

/** Subscribe to the live game state (re-renders on every committed mutation). */
export function useGame() {
  return useGameStore((s) => s.state);
}

export function useTotalStats(): TotalStats | null {
  const state = useGame();
  return state.player ? getPlayerTotalStats(state) : null;
}
