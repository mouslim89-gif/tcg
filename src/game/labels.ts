import type { Card, Rarity, TypeId } from './schema';

export const TYPE_INFO: Record<TypeId, { name: string; glyph: string }> = {
  water: { name: 'Water', glyph: '水' },
  fire: { name: 'Fire', glyph: '火' },
  wood: { name: 'Wood', glyph: '木' },
  metal: { name: 'Metal', glyph: '金' },
  earth: { name: 'Earth', glyph: '土' },
  sky: { name: 'Sky', glyph: '天' },
  human: { name: 'Human', glyph: '人' },
  spirit: { name: 'Spirit', glyph: '霊' },
  voice: { name: 'Voice', glyph: '言' },
  beast: { name: 'Beast', glyph: '獣' },
  body: { name: 'Body', glyph: '身' },
  path: { name: 'Path', glyph: '道' },
};

export const RARITY_INFO: Record<Rarity, { name: string; short: string; rank: number }> = {
  common: { name: 'Common', short: 'C', rank: 1 },
  uncommon: { name: 'Uncommon', short: 'U', rank: 2 },
  rare: { name: 'Rare', short: 'R', rank: 3 },
  epic: { name: 'Epic', short: 'E', rank: 4 },
  legendary: { name: 'Legendary', short: 'L', rank: 5 },
};

/** Kangxi radical glyph from its number (Unicode "Kangxi Radicals" block, NFKC-folded). */
export const radicalGlyph = (n: number) => String.fromCodePoint(0x2f00 + n - 1).normalize('NFKC');

export function gradeLabel(c: Card): string {
  if (c.grade === null) return 'Hyōgai (outside the official lists)';
  if (c.grade <= 6) return `Kyōiku · grade ${c.grade}`;
  if (c.grade === 8) return 'Jōyō · secondary school';
  return 'Jinmeiyō (name kanji)';
}
