import { useEffect } from 'react';
import { useGameStore, persistGame } from './gameStore';

const TICK_MS = 1000;
const AUTOSAVE_MS = 15000;

/** Drives the idle loop and periodic autosave for the lifetime of the app. */
export function useGameLoop(): void {
  const tick = useGameStore((s) => s.tick);

  useEffect(() => {
    const tickId = setInterval(tick, TICK_MS);
    const saveId = setInterval(() => void persistGame(), AUTOSAVE_MS);
    const onUnload = () => void persistGame();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(tickId);
      clearInterval(saveId);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [tick]);
}
