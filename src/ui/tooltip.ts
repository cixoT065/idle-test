import { create } from 'zustand';
import type { Item } from '../game/types';

interface TooltipState {
  item: Item | null;
  isEquipped: boolean;
  rect: DOMRect | null;
  show: (item: Item, isEquipped: boolean, rect: DOMRect) => void;
  hide: () => void;
}

/** Tiny global store so any element can drive the single floating tooltip. */
export const useTooltip = create<TooltipState>((set) => ({
  item: null,
  isEquipped: false,
  rect: null,
  show: (item, isEquipped, rect) => set({ item, isEquipped, rect }),
  hide: () => set({ item: null, rect: null }),
}));

/** Spread onto any element to give it an item tooltip on hover. */
export function tooltipHandlers(item: Item, isEquipped: boolean) {
  return {
    onMouseEnter: (e: React.MouseEvent) =>
      useTooltip.getState().show(item, isEquipped, (e.currentTarget as HTMLElement).getBoundingClientRect()),
    onMouseLeave: () => useTooltip.getState().hide(),
  };
}
