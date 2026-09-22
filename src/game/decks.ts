import type { Card, Rarity, Word } from './schema';
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

/** Two-kanji words spelled entirely by kanji present in the deck, common words first. */
export function deckWords(deck: readonly Card[], lexicon: Lexicon): Word[] {
  const copies = new Map<string, number>();
  for (const c of deck) copies.set(c.kanji, (copies.get(c.kanji) ?? 0) + 1);
  const out: Word[] = [];
  for (const k of copies.keys()) {
    for (const w of lexicon.byFirst.get(k) ?? []) {
      const [a, b, ...rest] = [...w.w];
      // A doubled kanji (時時) needs both copies in the deck.
      if (!rest.length && b && copies.has(b) && (a !== b || copies.get(a)! >= 2)) out.push(w);
    }
  }
  return out.sort((a, b) => Number(b.c) - Number(a.c) || a.w.localeCompare(b.w));
}

/**
 * Words that one owned card would complete with a kanji already in the deck:
 * the cheapest way to add combos. Returns the word and the card to add.
 */
export function pairSuggestions(
  deck: readonly Card[],
  owned: ReadonlyMap<string, { card: Card; count: number }>,
  lexicon: Lexicon,
  limit = 12,
): { word: Word; add: Card }[] {
  const inDeck = new Map<string, number>();
  for (const c of deck) inDeck.set(c.kanji, (inDeck.get(c.kanji) ?? 0) + 1);
  const seen = new Set<string>();
  const out: { word: Word; add: Card; score: number }[] = [];
  for (const k of inDeck.keys()) {
    for (const w of lexicon.byKanji.get(k) ?? []) {
      const chars = [...w.w];
      if (chars.length !== 2 || seen.has(w.w)) continue;
      const missing = chars.filter((c) => !inDeck.has(c));
      if (missing.length !== 1) continue;
      const o = owned.get(missing[0]);
      if (!o) continue;
      seen.add(w.w);
      out.push({ word: w, add: o.card, score: (w.c ? 10 : 0) + o.card.atk + o.card.def });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map(({ word, add }) => ({ word, add }));
}

/** Checks a saved deck (card ids) against the collection. */
export function checkDeck(
  ids: readonly string[],
  collection: Readonly<Record<string, number>>,
  byId: ReadonlyMap<string, Card>,
  size = RULES.deckSize,
): { cards: Card[]; valid: boolean } {
  const counts = new Map<string, number>();
  const cards: Card[] = [];
  for (const id of ids) {
    const card = byId.get(id);
    const n = (counts.get(id) ?? 0) + 1;
    if (!card || n > MAX_COPIES || n > (collection[id] ?? 0)) continue;
    counts.set(id, n);
    cards.push(card);
  }
  return { cards, valid: cards.length === size && cards.length === ids.length };
}
