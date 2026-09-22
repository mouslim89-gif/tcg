import type { Card, Rarity } from './schema';
import { RULES } from './battle/engine';
import type { Difficulty } from './battle/ai';
import { shuffle, type Rng } from './rng';
import type { Lexicon } from './words';

export const MAX_COPIES = 2;

const power = (c: Card) => c.atk + c.def;

/**
 * Builds a deck from owned cards: first secure a few two-kanji words the
 * collection can spell (combos are the heart of the game), then fill with the
 * strongest cards. At most two copies of a kanji.
 */
export function autoDeck(owned: { card: Card; count: number }[], lexicon: Lexicon, size = RULES.deckSize): Card[] {
  const left = new Map(owned.map(({ card, count }) => [card.kanji, { card, n: Math.min(count, MAX_COPIES) }]));
  const deck: Card[] = [];
  const take = (k: string) => {
    const e = left.get(k)!;
    e.n--;
    deck.push(e.card);
  };

  const words = [...lexicon.byWord.values()]
    .filter((w) => [...w.w].length === 2)
    .map((w) => ({ w, chars: [...w.w] }))
    .filter(({ chars }) => chars.every((c) => left.has(c)) && (chars[0] !== chars[1] || left.get(chars[0])!.n >= 2))
    .map(({ w, chars }) => ({ chars, score: chars.reduce((s, c) => s + power(left.get(c)!.card), 0) + (w.c ? 6 : 0) }))
    .sort((a, b) => b.score - a.score);

  const wordBudget = Math.floor(size * 0.6);
  for (const { chars } of words) {
    if (deck.length + 2 > wordBudget) break;
    // Prefer words that reuse nothing already exhausted and add at least one new kanji.
    if (!chars.every((c) => left.get(c)!.n > 0)) continue;
    if (chars.every((c) => deck.some((d) => d.kanji === c))) continue;
    chars.forEach(take);
  }

  const rest = [...left.values()].sort((a, b) => power(b.card) - power(a.card));
  for (const e of rest) {
    while (e.n > 0 && deck.length < size) take(e.card.kanji);
  }
  return deck;
}

const AI_RARITIES: Record<Difficulty, Rarity[]> = {
  easy: ['common', 'uncommon'],
  normal: ['common', 'uncommon', 'rare'],
  hard: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
};

/** Opponent deck: random cards of allowed rarities, seeded with a handful of common words. */
export function aiDeck(cards: Card[], lexicon: Lexicon, difficulty: Difficulty, rng: Rng): Card[] {
  const allowed = new Set(AI_RARITIES[difficulty]);
  const byKanji = new Map(cards.filter((c) => allowed.has(c.rarity)).map((c) => [c.kanji, c]));
  const owned = new Map<string, number>();
  const add = (c: Card) => owned.set(c.kanji, (owned.get(c.kanji) ?? 0) + 1);

  const words = shuffle(
    rng,
    [...lexicon.byWord.values()].filter((w) => w.c && [...w.w].length === 2 && [...w.w].every((k) => byKanji.has(k))),
  );
  for (const w of words.slice(0, difficulty === 'easy' ? 3 : 5)) [...w.w].forEach((k) => add(byKanji.get(k)!));

  const pool = shuffle(rng, [...byKanji.values()]);
  for (const c of pool) {
    if ([...owned.values()].reduce((a, b) => a + b, 0) >= RULES.deckSize * 1.5) break;
    add(c);
  }
  return autoDeck(
    [...owned].map(([k, count]) => ({ card: byKanji.get(k)!, count })),
    lexicon,
  );
}
