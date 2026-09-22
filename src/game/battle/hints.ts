import type { Combo } from '../combos';
import type { Lexicon } from '../words';
import { canPlay, pendingCombos, playCard, type BattleState } from './engine';

/** For a hand card: the lanes where placing it would complete a word, and which. */
export function placementHints(s: BattleState, handIndex: number, lexicon: Lexicon): Map<number, Combo[]> {
  const out = new Map<number, Combo[]>();
  for (let lane = 0; lane < s.sides[s.active].field.length; lane++) {
    if (!canPlay(s, handIndex, lane)) continue;
    const next = playCard(s, handIndex, lane).state;
    const combos = pendingCombos(next, lexicon).filter((c) => lane >= c.start && lane < c.start + c.length);
    if (combos.length) out.set(lane, combos);
  }
  return out;
}

/** Hand cards that can complete a word somewhere this turn. */
export function comboReadyHand(s: BattleState, lexicon: Lexicon): Set<number> {
  const ready = new Set<number>();
  if (s.playsLeft <= 0) return ready;
  s.sides[s.active].hand.forEach((_, i) => {
    if (placementHints(s, i, lexicon).size) ready.add(i);
  });
  return ready;
}
