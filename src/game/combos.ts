import type { Card, Word } from './schema';
import type { Lexicon } from './words';

export interface Combo {
  /** First slot of the word on the field. */
  start: number;
  length: number;
  word: Word;
}

export const MIN_WORD = 2;
export const MAX_WORD = 4;

/**
 * Words spelled left→right by contiguous occupied slots. When `fresh` is given,
 * only words using at least one of those slots count (a word triggers when it
 * is completed, not every turn). Overlapping matches are resolved greedily:
 * longest word first, then highest total ATK.
 */
export function findCombos(
  slots: readonly (Card | null)[],
  lexicon: Lexicon,
  fresh?: ReadonlySet<number>,
): Combo[] {
  const found: (Combo & { atk: number })[] = [];
  for (let start = 0; start < slots.length; start++) {
    for (let len = MIN_WORD; len <= MAX_WORD && start + len <= slots.length; len++) {
      const run = slots.slice(start, start + len);
      if (run.some((c) => !c)) break;
      if (fresh && !run.some((_, i) => fresh.has(start + i))) continue;
      const word = lexicon.get(run.map((c) => c!.kanji).join(''));
      if (word) found.push({ start, length: len, word, atk: run.reduce((s, c) => s + c!.atk, 0) });
    }
  }
  found.sort((a, b) => b.length - a.length || b.atk - a.atk || a.start - b.start);
  const used = new Set<number>();
  const out: Combo[] = [];
  for (const { atk: _atk, ...c } of found) {
    const span = Array.from({ length: c.length }, (_, i) => c.start + i);
    if (span.some((i) => used.has(i))) continue;
    span.forEach((i) => used.add(i));
    out.push(c);
  }
  return out.sort((a, b) => a.start - b.start);
}

export const COMBO_COMMON_BONUS = 1.2;
export const READING_BONUS = 1.5;

/** Direct damage dealt by a combo. */
export function comboDamage(cards: readonly Card[], word: Word, readingCorrect: boolean): number {
  const atk = cards.reduce((s, c) => s + c.atk, 0);
  const lengthFactor = 0.5 + 0.25 * (cards.length - 2);
  const raw = atk * lengthFactor * (word.c ? COMBO_COMMON_BONUS : 1) * (readingCorrect ? READING_BONUS : 1);
  return Math.max(1, Math.round(raw));
}
