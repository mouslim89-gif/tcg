import type { Card, Rarity } from './schema';
import { pick, weighted, type Rng } from './rng';

export const PACK_SIZE = 5;
/** Every 10th pack without a rare-or-better card guarantees one. */
export const PITY_EVERY = 10;

export const SLOT_WEIGHTS: Record<Rarity, number> = {
  common: 62,
  uncommon: 25,
  rare: 9,
  epic: 3.5,
  legendary: 0.5,
};

const RARE_PLUS: Rarity[] = ['rare', 'epic', 'legendary'];
const PITY_WEIGHTS = Object.fromEntries(RARE_PLUS.map((r) => [r, SLOT_WEIGHTS[r]])) as Record<Rarity, number>;

export const isRarePlus = (r: Rarity) => RARE_PLUS.includes(r);

/**
 * Opens one pack. `pity` is the number of packs opened since the last rare+;
 * returns the updated counter.
 */
export function openPack(
  byRarity: Record<Rarity, Card[]>,
  pity: number,
  rng: Rng,
): { cards: Card[]; pity: number; pityTriggered: boolean } {
  const rarities = Array.from({ length: PACK_SIZE }, () => weighted(rng, SLOT_WEIGHTS));
  let pityTriggered = false;
  if (!rarities.some(isRarePlus) && pity + 1 >= PITY_EVERY) {
    rarities[PACK_SIZE - 1] = weighted(rng, PITY_WEIGHTS);
    pityTriggered = true;
  }
  const cards = rarities.map((r) => pick(rng, byRarity[r]));
  return { cards, pity: rarities.some(isRarePlus) ? 0 : pity + 1, pityTriggered };
}
