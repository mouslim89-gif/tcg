import { describe, expect, it } from 'vitest';
import { comboDamage, findCombos } from '../src/game/combos';
import { Lexicon } from '../src/game/words';
import { makeQuiz, isCorrect } from '../src/game/reading';
import { mulberry32 } from '../src/game/rng';
import { card, realData } from './fixtures';

const lex = new Lexicon([
  { w: '日本', r: ['にほん', 'にっぽん'], g: 'Japan', c: true },
  { w: '本日', r: ['ほんじつ'], g: 'today', c: true },
  { w: '日本人', r: ['にほんじん'], g: 'Japanese person', c: true },
  { w: '本人', r: ['ほんにん'], g: 'the person himself', c: true },
]);
const [日, 本, 人] = ['日', '本', '人'].map((k) => card(k));

describe('findCombos', () => {
  it('reads left to right', () => {
    expect(findCombos([日, 本, null, null], lex).map((c) => c.word.w)).toEqual(['日本']);
    expect(findCombos([本, 日, null, null], lex).map((c) => c.word.w)).toEqual(['本日']);
  });

  it('prefers the longest word on overlaps', () => {
    expect(findCombos([日, 本, 人, null], lex).map((c) => c.word.w)).toEqual(['日本人']);
  });

  it('needs contiguous cards', () => {
    expect(findCombos([日, null, 本, null], lex)).toEqual([]);
  });

  it('only triggers words touching a fresh lane', () => {
    expect(findCombos([日, 本, null, 人], lex, new Set([3]))).toEqual([]);
    expect(findCombos([日, 本, 人, null], lex, new Set([2])).map((c) => c.word.w)).toEqual(['日本人']);
  });

  it('scales damage with the reading bonus', () => {
    const w = lex.get('日本')!;
    expect(comboDamage([日, 本], w, true)).toBeGreaterThan(comboDamage([日, 本], w, false));
  });
});

describe('reading quiz', () => {
  it('offers four distinct options with one accepted answer', () => {
    const { byKanji, lexicon } = realData();
    const word = lexicon.get('日本')!;
    const quiz = makeQuiz(word, [byKanji.get('日')!, byKanji.get('本')!], mulberry32(3));
    expect(new Set(quiz.options).size).toBe(4);
    expect(quiz.options.filter((o) => isCorrect(quiz, o))).toHaveLength(1);
    expect(isCorrect(quiz, 'にっぽん')).toBe(true);
  });
});
