import type { Lexicon } from '../words';
import { comboDamage } from '../combos';
import type { Rng } from '../rng';
import { endTurn, pendingCombos, playCard, RULES, type BattleState, type Side } from './engine';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const AI_PROFILE: Record<Difficulty, { reading: number; topK: number; label: string; blurb: string }> = {
  easy: { reading: 0.4, topK: 6, label: 'Apprentice', blurb: 'Plays loosely, often misreads.' },
  normal: { reading: 0.7, topK: 2, label: 'Scholar', blurb: 'Solid plays, knows most readings.' },
  hard: { reading: 0.9, topK: 1, label: 'Sensei', blurb: 'Always takes the best line.' },
};

export interface Play {
  handIndex: number;
  lane: number;
}

const boardValue = (side: Side) =>
  side.field.reduce((s, u) => s + (u ? u.card.atk + u.hp : 0), 0);

/** Evaluates a line of plays from the active side's point of view. */
function evaluate(start: BattleState, plays: Play[], lexicon: Lexicon, reading: number): number {
  let s = start;
  for (const p of plays) s = playCard(s, p.handIndex, p.lane).state;
  const me = s.active;
  const combos = pendingCombos(s, lexicon);
  // Expected extra damage from getting the reading right.
  let bonus = 0;
  for (const c of combos) {
    const cards = s.sides[me].field.slice(c.start, c.start + c.length).map((u) => u!.card);
    bonus += reading * (comboDamage(cards, c.word, true) - comboDamage(cards, c.word, false));
  }
  const after = endTurn(s, combos.map((combo) => ({ combo, correct: false }))).state;
  const foe = after.sides[me === 0 ? 1 : 0];
  if (foe.hp <= 0) return 1e6;
  const dealt = start.sides[me === 0 ? 1 : 0].hp - foe.hp + bonus;
  return dealt * 1.2 + 0.35 * boardValue(after.sides[me]) - 0.35 * boardValue(foe);
}

/** Candidate lines: pass, every single play, every ordered pair on distinct lanes. */
function candidates(s: BattleState): Play[][] {
  const hand = s.sides[s.active].hand.length;
  const lines: Play[][] = [[]];
  const max = Math.min(RULES.playsPerTurn, s.playsLeft);
  for (let h = 0; h < hand; h++) {
    for (let l = 0; l < RULES.lanes; l++) {
      lines.push([{ handIndex: h, lane: l }]);
      if (max < 2) continue;
      for (let h2 = 0; h2 < hand - 1; h2++) {
        for (let l2 = 0; l2 < RULES.lanes; l2++) {
          if (l2 !== l) lines.push([{ handIndex: h, lane: l }, { handIndex: h2, lane: l2 }]);
        }
      }
    }
  }
  return lines;
}

export function chooseLine(s: BattleState, lexicon: Lexicon, difficulty: Difficulty, rng: Rng): Play[] {
  const { reading, topK } = AI_PROFILE[difficulty];
  const scored = candidates(s)
    .map((line) => ({ line, score: evaluate(s, line, lexicon, reading) }))
    .sort((a, b) => b.score - a.score);
  if (scored[0].score >= 1e6) return scored[0].line;
  const pool = scored.slice(0, topK);
  return pool[Math.floor(rng() * pool.length)].line;
}

export const aiReadsCorrectly = (difficulty: Difficulty, rng: Rng) => rng() < AI_PROFILE[difficulty].reading;
