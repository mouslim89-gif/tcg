import { describe, expect, it } from 'vitest';
import { createBattle, endTurn, pendingCombos, playCard, RULES, type BattleState } from '../src/game/battle/engine';
import { aiReadsCorrectly, chooseLine, type Difficulty } from '../src/game/battle/ai';
import { aiDeck, autoDeck } from '../src/game/decks';
import { mulberry32 } from '../src/game/rng';
import { Lexicon } from '../src/game/words';
import { card, realData } from './fixtures';

describe('engine', () => {
  const lex = new Lexicon([{ w: '日本', r: ['にほん'], g: 'Japan', c: true }]);
  const deck = Array.from({ length: 20 }, (_, i) => card(i % 2 ? '本' : '日'));

  it('plays, triggers a combo and attacks', () => {
    let s = createBattle(deck, deck, mulberry32(1));
    const iHi = s.sides[0].hand.findIndex((c) => c.kanji === '日');
    s = playCard(s, iHi, 0).state;
    const iHon = s.sides[0].hand.findIndex((c) => c.kanji === '本');
    s = playCard(s, iHon, 1).state;
    const combos = pendingCombos(s, lex);
    expect(combos.map((c) => c.word.w)).toEqual(['日本']);
    const { state, events } = endTurn(s, combos.map((combo) => ({ combo, correct: true })));
    expect(events.some((e) => e.kind === 'combo')).toBe(true);
    // combo (5+5)*0.5*1.2*1.5 = 9; fresh cards don't attack yet
    expect(state.sides[1].hp).toBe(RULES.hp - 9);
    expect(events.some((e) => e.kind === 'direct')).toBe(false);
    expect(state.active).toBe(1);
  });

  it('rejects a third play and replaying a fresh lane', () => {
    let s: BattleState = createBattle(deck, deck, mulberry32(2));
    s = playCard(s, 0, 0).state;
    expect(() => playCard(s, 0, 0)).toThrow();
    s = playCard(s, 0, 1).state;
    expect(() => playCard(s, 0, 2)).toThrow();
  });
});

describe('AI vs AI on real data', () => {
  it('finishes games in a reasonable number of turns', () => {
    const { cards, lexicon } = realData();
    const rng = mulberry32(99);
    const turns: number[] = [];
    let combos = 0;
    for (let g = 0; g < 12; g++) {
      const d: Difficulty = (['easy', 'normal', 'hard'] as const)[g % 3];
      let s = createBattle(aiDeck(cards, lexicon, 'normal', rng), aiDeck(cards, lexicon, d, rng), rng);
      while (s.winner === null) {
        for (const p of chooseLine(s, lexicon, 'normal', rng)) s = playCard(s, p.handIndex, p.lane).state;
        const pc = pendingCombos(s, lexicon);
        combos += pc.length;
        s = endTurn(s, pc.map((combo) => ({ combo, correct: aiReadsCorrectly('normal', rng) }))).state;
      }
      turns.push(s.turn);
    }
    const avg = turns.reduce((a, b) => a + b, 0) / turns.length;
    console.log(`avg rounds ${avg.toFixed(1)} (${turns.join(',')}), combos ${combos}`);
    expect(avg).toBeGreaterThan(3);
    expect(avg).toBeLessThan(20);
    expect(combos).toBeGreaterThan(0);
  }, 60_000);

  it('auto-builds a 20-card deck with word pairs', () => {
    const { cards, lexicon } = realData();
    const owned = cards.filter((c) => c.rarity === 'common').slice(0, 60).map((card) => ({ card, count: 1 }));
    const deck = autoDeck(owned, lexicon);
    expect(deck).toHaveLength(20);
  });
});
