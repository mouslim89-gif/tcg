import type { Card, Word } from './schema';
import { shuffle, type Rng } from './rng';

export const toHiragana = (s: string) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** Kun readings carry okurigana after "." and affix markers "-": keep the stem. */
const stem = (r: string) => toHiragana(r.replace(/-/g, '').split('.')[0]);

export interface Quiz {
  options: string[];
  /** Every accepted reading (normalised to hiragana). */
  answers: string[];
}

/**
 * Four-option reading quiz. Distractors are built by gluing together readings
 * of the component kanji, which yields plausible but wrong answers (e.g. 日本 →
 * じつほん, ひもと…).
 */
export function makeQuiz(word: Word, cards: readonly Card[], rng: Rng, fallback: readonly Word[] = []): Quiz {
  const answers = [...new Set(word.r.map(toHiragana))];
  const perKanji = cards.map((c) => [...new Set([...c.on, ...c.kun].map(stem).filter(Boolean))]);
  const candidates = new Set<string>();
  const build = (i: number, acc: string) => {
    if (candidates.size > 200) return;
    if (i === perKanji.length) {
      candidates.add(acc);
      return;
    }
    for (const r of perKanji[i].slice(0, 4)) build(i + 1, acc + r);
  };
  build(0, '');
  answers.forEach((a) => candidates.delete(a));
  let distractors = shuffle(rng, [...candidates]).slice(0, 3);
  if (distractors.length < 3) {
    const extra = shuffle(rng, fallback.map((w) => toHiragana(w.r[0])))
      .filter((r) => !answers.includes(r) && !distractors.includes(r));
    distractors = [...distractors, ...extra].slice(0, 3);
  }
  return { options: shuffle(rng, [answers[0], ...distractors]), answers };
}

export const isCorrect = (quiz: Quiz, choice: string) => quiz.answers.includes(toHiragana(choice));
