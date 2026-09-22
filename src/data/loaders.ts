import { RARITIES, type Card, type Meta, type Rarity } from '../game/schema';
import { decodeWords, Lexicon } from '../game/words';

// Static data lives in /public/data; each file is fetched once and memoised.

const url = (path: string) => `${import.meta.env.BASE_URL}data/${path}`;

async function get(path: string, as: 'json' | 'text') {
  const res = await fetch(url(path));
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return as === 'json' ? res.json() : res.text();
}

export interface CardDb {
  cards: Card[];
  byId: Map<string, Card>;
  byKanji: Map<string, Card>;
  byRarity: Record<Rarity, Card[]>;
}

let cardsP: Promise<CardDb> | null = null;
export function loadCards(): Promise<CardDb> {
  cardsP ??= get('cards.json', 'json').then((cards: Card[]) => {
    const byRarity = Object.fromEntries(RARITIES.map((r) => [r, [] as Card[]])) as Record<Rarity, Card[]>;
    for (const c of cards) byRarity[c.rarity].push(c);
    return {
      cards,
      byId: new Map(cards.map((c) => [c.id, c])),
      byKanji: new Map(cards.map((c) => [c.kanji, c])),
      byRarity,
    };
  });
  return cardsP;
}

let wordsP: Promise<Lexicon> | null = null;
export function loadLexicon(): Promise<Lexicon> {
  wordsP ??= get('words.txt', 'text').then((t: string) => new Lexicon(decodeWords(t)));
  return wordsP;
}

let metaP: Promise<Meta> | null = null;
export const loadMeta = (): Promise<Meta> => (metaP ??= get('meta.json', 'json'));

const strokeCache = new Map<string, Promise<string[]>>();
export function loadStrokes(id: string): Promise<string[]> {
  let p = strokeCache.get(id);
  if (!p) {
    p = get(`strokes/${id}.json`, 'json');
    strokeCache.set(id, p);
  }
  return p;
}
