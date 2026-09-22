import type { Rarity } from '../../src/game/schema';

// All tuning knobs of the card generator live here.

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** ATK from JMdict word count, log2 scale: 1 word → 1, 31 → 5, 1023+ → 10. */
export const atkFromWords = (words: number) => clamp(Math.ceil(Math.log2(1 + words)), 1, 10);

/** DEF from stroke count: 1–3 strokes → 1, 28+ → 10. */
export const defFromStrokes = (strokes: number) => clamp(Math.ceil(strokes / 3), 1, 10);

export const RARITY_THRESHOLDS = {
  commonMaxFreq: 800,
  uncommonMaxFreq: 1800,
  /** Non-jōyō kanji with fewer JMdict words than this are legendary. */
  legendaryMaxWords: 5,
};

export function rarityOf(k: { grade: number | null; freq: number | null; words: number }): Rarity {
  const t = RARITY_THRESHOLDS;
  const joyo = k.grade !== null && k.grade <= 8;
  if (joyo) {
    if (k.freq !== null && k.freq <= t.commonMaxFreq) return 'common';
    if (k.freq !== null && k.freq <= t.uncommonMaxFreq) return 'uncommon';
    return 'rare';
  }
  const jinmeiyo = k.grade === 9 || k.grade === 10;
  if (jinmeiyo || k.words >= t.legendaryMaxWords) return 'epic';
  return 'legendary';
}
