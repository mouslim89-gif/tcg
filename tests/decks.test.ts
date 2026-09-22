import { describe, expect, it } from 'vitest';
import { checkDeck, deckWords, pairSuggestions } from '../src/game/decks';
import { createBattle, playCard } from '../src/game/battle/engine';
import { comboReadyHand, placementHints } from '../src/game/battle/hints';
import { mulberry32 } from '../src/game/rng';
import { Lexicon } from '../src/game/words';
import { card } from './fixtures';

const lex = new Lexicon([
  { w: '日本', r: ['にほん'], g: 'Japan', c: true },
  { w: '本人', r: ['ほんにん'], g: 'oneself', c: true },
  { w: '人口', r: ['じんこう'], g: 'population', c: false },
]);
const [日, 本, 人, 口] = ['日', '本', '人', '口'].map((k) => card(k));

describe('deck helpers', () => {
  it('lists words spelled inside the deck', () => {
    expect(deckWords([日, 本, 人], lex).map((w) => w.w)).toEqual(['日本', '本人']);
  });

  it('needs two copies for a doubled kanji', () => {
    const l = new Lexicon([{ w: '人人', r: ['ひとびと'], g: 'people', c: true }]);
    expect(deckWords([人], l)).toEqual([]);
    expect(deckWords([人, 人], l).map((w) => w.w)).toEqual(['人人']);
  });

  it('suggests an owned card that completes a word', () => {
    const owned = new Map([日, 本, 人, 口].map((c) => [c.kanji, { card: c, count: 1 }]));
    const s = pairSuggestions([日, 人], owned, lex);
    expect(s.map((x) => `${x.word.w}+${x.add.kanji}`).sort()).toEqual(['人口+口', '日本+本', '本人+本']);
  });

  it('validates copies and ownership', () => {
    const byId = new Map([日, 本].map((c) => [c.id, c]));
    const ids = [日.id, 日.id, 本.id];
    expect(checkDeck(ids, { [日.id]: 2, [本.id]: 1 }, byId, 3).valid).toBe(true);
    expect(checkDeck(ids, { [日.id]: 1, [本.id]: 1 }, byId, 3).valid).toBe(false);
    expect(checkDeck([日.id, 日.id, 日.id], { [日.id]: 5 }, byId, 3).valid).toBe(false);
  });
});

describe('placement hints', () => {
  it('shows the lanes where a hand card completes a word', () => {
    const deck = [日, 本, 日, 本, 日, 本, 日, 本].map((c) => ({ ...c }));
    let s = createBattle(deck, deck, mulberry32(4));
    s = { ...s, sides: [{ ...s.sides[0], hand: [日, 本, 口] }, s.sides[1]] };
    s = playCard(s, 0, 1).state; // 日 in lane 1; 本 now at hand index 0
    const hints = placementHints(s, 0, lex);
    expect([...hints.keys()]).toEqual([2]);
    expect(hints.get(2)![0].word.w).toBe('日本');
    expect(comboReadyHand(s, lex)).toEqual(new Set([0]));
  });
});
