import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Card } from '../game/schema';
import { openPack as roll } from '../game/packs';
import { mulberry32, randomSeed } from '../game/rng';
import type { CardDb } from '../data/loaders';

export const ECONOMY = {
  startingPacks: 10,
  dailyPacks: 3,
  winPacks: 2,
  lossPacks: 1,
};

export interface SaveData {
  version: 1;
  /** kanji id → copies owned */
  collection: Record<string, number>;
  /** id → first obtained (ms), for "newest" sorting and NEW badges */
  obtainedAt: Record<string, number>;
  packs: number;
  packsOpened: number;
  pity: number;
  lastDaily: string | null;
  stats: { wins: number; losses: number; draws: number; combos: number };
  /** Words the player has spelled in battle. */
  lexicon: string[];
  seen: string[];
  /** Custom battle deck (card ids, duplicates allowed). null = built automatically. */
  deck: string[] | null;
}

interface Actions {
  openPack: (db: CardDb) => { cards: Card[]; fresh: boolean[]; pityTriggered: boolean } | null;
  claimDaily: () => boolean;
  recordBattle: (result: 'win' | 'loss' | 'draw', words: string[]) => number;
  markSeen: (ids: string[]) => void;
  setDeck: (ids: string[] | null) => void;
  reset: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

const initial = (): SaveData => ({
  version: 1,
  collection: {},
  obtainedAt: {},
  packs: ECONOMY.startingPacks,
  packsOpened: 0,
  pity: 0,
  lastDaily: today(),
  stats: { wins: 0, losses: 0, draws: 0, combos: 0 },
  lexicon: [],
  seen: [],
  deck: null,
});

export const useSave = create<SaveData & Actions>()(
  persist(
    (set, get) => ({
      ...initial(),

      openPack(db) {
        const s = get();
        if (s.packs <= 0) return null;
        const res = roll(db.byRarity, s.pity, mulberry32(randomSeed()));
        const collection = { ...s.collection };
        const obtainedAt = { ...s.obtainedAt };
        const now = Date.now();
        const fresh = res.cards.map((c) => {
          const isNew = !collection[c.id];
          collection[c.id] = (collection[c.id] ?? 0) + 1;
          if (isNew) obtainedAt[c.id] = now;
          return isNew;
        });
        set({ collection, obtainedAt, packs: s.packs - 1, packsOpened: s.packsOpened + 1, pity: res.pity });
        return { cards: res.cards, fresh, pityTriggered: res.pityTriggered };
      },

      claimDaily() {
        if (get().lastDaily === today()) return false;
        set((s) => ({ packs: s.packs + ECONOMY.dailyPacks, lastDaily: today() }));
        return true;
      },

      recordBattle(result, words) {
        const reward = result === 'win' ? ECONOMY.winPacks : ECONOMY.lossPacks;
        set((s) => ({
          packs: s.packs + reward,
          stats: {
            wins: s.stats.wins + (result === 'win' ? 1 : 0),
            losses: s.stats.losses + (result === 'loss' ? 1 : 0),
            draws: s.stats.draws + (result === 'draw' ? 1 : 0),
            combos: s.stats.combos + words.length,
          },
          lexicon: [...new Set([...s.lexicon, ...words])],
        }));
        return reward;
      },

      markSeen(ids) {
        set((s) => ({ seen: [...new Set([...s.seen, ...ids])] }));
      },

      setDeck(ids) {
        set({ deck: ids });
      },

      reset() {
        set(initial());
      },
    }),
    {
      name: 'kanji-tcg-save',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const { openPack: _o, claimDaily: _c, recordBattle: _r, markSeen: _m, setDeck: _d, reset: _x, ...data } = s;
        return data;
      },
    },
  ),
);

export const ownedCount = (s: SaveData) => Object.keys(s.collection).length;
export const dailyAvailable = (s: SaveData) => s.lastDaily !== today();
