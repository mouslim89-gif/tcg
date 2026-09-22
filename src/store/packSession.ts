import { create } from 'zustand';
import type { Card } from '../game/schema';

/** The pack currently on the table. Kept in memory so leaving for a card page and coming back restores it. */
export interface OpenedPack {
  cards: Card[];
  fresh: boolean[];
  flipped: boolean[];
  /** Flip animation finished: the card is laid flat again (crisp, no 3D layer). */
  settled: boolean[];
  pityTriggered: boolean;
}

interface PackSession {
  opened: OpenedPack | null;
  set: (update: OpenedPack | null | ((o: OpenedPack | null) => OpenedPack | null)) => void;
}

export const usePackSession = create<PackSession>()((set) => ({
  opened: null,
  set: (update) => set((s) => ({ opened: typeof update === 'function' ? update(s.opened) : update })),
}));
