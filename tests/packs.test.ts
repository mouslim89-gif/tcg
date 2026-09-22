import { describe, expect, it } from 'vitest';
import { openPack, PACK_SIZE, PITY_EVERY, isRarePlus } from '../src/game/packs';
import { mulberry32 } from '../src/game/rng';
import { RARITIES, type Card, type Rarity } from '../src/game/schema';
import { card } from './fixtures';

const byRarity = Object.fromEntries(RARITIES.map((r) => [r, [card(r[0], { rarity: r })]])) as Record<Rarity, Card[]>;

describe('packs', () => {
  it('opens five cards', () => {
    expect(openPack(byRarity, 0, mulberry32(1)).cards).toHaveLength(PACK_SIZE);
  });

  it('guarantees a rare+ at least every 10 packs', () => {
    const rng = mulberry32(42);
    let pity = 0;
    let dry = 0;
    for (let i = 0; i < 5000; i++) {
      const res = openPack(byRarity, pity, rng);
      const hit = res.cards.some((c) => isRarePlus(c.rarity));
      dry = hit ? 0 : dry + 1;
      expect(dry).toBeLessThan(PITY_EVERY);
      expect(res.pity).toBe(dry);
      pity = res.pity;
    }
  });

  it('follows the slot weights roughly', () => {
    const rng = mulberry32(7);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) {
      for (const c of openPack(byRarity, 0, rng).cards) counts[c.rarity] = (counts[c.rarity] ?? 0) + 1;
    }
    expect(counts.common / 100000).toBeCloseTo(0.62, 1);
    expect(counts.legendary / 100000).toBeLessThan(0.01);
  });
});
