import type { Word } from './schema';

// words.txt: one word per line, `word \t reading|reading \t gloss \t 1 (common) or empty`.
// ~2.5× smaller than JSON once gzipped.

const clean = (s: string) => s.replace(/[\t\n|]/g, ' ');

export const encodeWords = (words: Word[]) =>
  [...words]
    .sort((a, b) => (a.w < b.w ? -1 : a.w > b.w ? 1 : 0))
    .map((w) => [w.w, w.r.map(clean).join('|'), clean(w.g), w.c ? '1' : ''].join('\t'))
    .join('\n');

export function decodeWords(text: string): Word[] {
  const out: Word[] = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const [w, r, g, c] = line.split('\t');
    out.push({ w, r: r.split('|'), g, c: c === '1' });
  }
  return out;
}

/** Word lookup keyed by exact spelling, plus an index of words by first kanji. */
export class Lexicon {
  readonly byWord = new Map<string, Word>();
  readonly byFirst = new Map<string, Word[]>();
  readonly byKanji = new Map<string, Word[]>();

  constructor(words: Word[]) {
    for (const w of words) {
      this.byWord.set(w.w, w);
      const chars = [...w.w];
      push(this.byFirst, chars[0], w);
      for (const ch of new Set(chars)) push(this.byKanji, ch, w);
    }
  }

  get(word: string) {
    return this.byWord.get(word);
  }
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
}
