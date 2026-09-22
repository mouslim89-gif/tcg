import { describe, expect, it } from 'vitest';
import { RARITIES, TYPES } from '../src/game/schema';
import { realData } from './fixtures';

describe('generated data', () => {
  const { cards, lexicon, byKanji } = realData();

  it('has cards of every rarity and type with sane stats', () => {
    for (const r of RARITIES) expect(cards.some((c) => c.rarity === r)).toBe(true);
    for (const t of TYPES) expect(cards.some((c) => c.type === t)).toBe(true);
    for (const c of cards) {
      expect(c.atk).toBeGreaterThanOrEqual(1);
      expect(c.atk).toBeLessThanOrEqual(10);
      expect(c.def).toBeGreaterThanOrEqual(1);
      expect(c.def).toBeLessThanOrEqual(10);
    }
  });

  it('maps well-known kanji as expected', () => {
    expect(byKanji.get('海')!.type).toBe('water');
    expect(byKanji.get('炎')!.type).toBe('fire');
    expect(byKanji.get('日')!.rarity).toBe('common');
    expect(lexicon.get('日本')!.r).toContain('にほん');
  });

  it('only keeps words made of card kanji', () => {
    for (const w of lexicon.byWord.values()) for (const ch of w.w) expect(byKanji.has(ch)).toBe(true);
  });
});
