import { readFileSync } from 'node:fs';
import type { Card, Rarity } from '../src/game/schema';
import { decodeWords, Lexicon } from '../src/game/words';

let cache: { cards: Card[]; lexicon: Lexicon; byKanji: Map<string, Card> } | null = null;

/** The real generated data (public/data). */
export function realData() {
  if (!cache) {
    const cards: Card[] = JSON.parse(readFileSync('public/data/cards.json', 'utf8'));
    const lexicon = new Lexicon(decodeWords(readFileSync('public/data/words.txt', 'utf8')));
    cache = { cards, lexicon, byKanji: new Map(cards.map((c) => [c.kanji, c])) };
  }
  return cache;
}

export function card(kanji: string, over: Partial<Card> = {}): Card {
  return {
    id: kanji.codePointAt(0)!.toString(16).padStart(5, '0'),
    kanji, rarity: 'common' as Rarity, type: 'sky', radical: 72, atk: 5, def: 4, words: 30,
    strokes: 4, freq: 1, grade: 1, jlpt: 4, meanings: [kanji], on: [], kun: [], ...over,
  };
}
