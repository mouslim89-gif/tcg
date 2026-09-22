import type { Card } from '../schema';
import { comboDamage, findCombos, type Combo } from '../combos';
import { resonates, RESONANCE_BONUS, typeMultiplier } from '../typeChart';
import { shuffle, type Rng } from '../rng';
import type { Lexicon } from '../words';

export const RULES = {
  hp: 50,
  lanes: 4,
  deckSize: 20,
  startingHand: 4,
  handLimit: 7,
  playsPerTurn: 2,
  /** Hard stop: after this many turns the higher HP wins. */
  maxTurns: 40,
};

export type SideId = 0 | 1;
export const PLAYER: SideId = 0;
export const AI: SideId = 1;

export interface Unit {
  uid: number;
  card: Card;
  /** Remaining DEF. */
  hp: number;
}

export interface Side {
  hp: number;
  deck: Card[];
  hand: Card[];
  field: (Unit | null)[];
  discard: Card[];
}

export type BattleEvent =
  | { kind: 'draw'; side: SideId }
  | { kind: 'play'; side: SideId; card: Card; lane: number; replaced?: Card }
  | { kind: 'combo'; side: SideId; combo: Combo; correct: boolean; damage: number }
  | { kind: 'attack'; side: SideId; lane: number; damage: number; multiplier: number; resonance: boolean }
  | { kind: 'direct'; side: SideId; lane: number; damage: number }
  | { kind: 'destroy'; side: SideId; lane: number; card: Card }
  | { kind: 'turn'; side: SideId; turn: number }
  | { kind: 'end'; winner: SideId | 'draw' };

export interface BattleState {
  sides: [Side, Side];
  active: SideId;
  turn: number;
  playsLeft: number;
  /** Lanes filled this turn: only words touching them trigger. */
  fresh: number[];
  winner: SideId | 'draw' | null;
  nextUid: number;
}

export const other = (s: SideId): SideId => (s === 0 ? 1 : 0);

function draw(side: Side): boolean {
  if (!side.deck.length || side.hand.length >= RULES.handLimit) return false;
  side.hand.push(side.deck.shift()!);
  return true;
}

export function createBattle(playerDeck: Card[], aiDeck: Card[], rng: Rng): BattleState {
  const side = (deck: Card[]): Side => {
    const s: Side = { hp: RULES.hp, deck: shuffle(rng, deck), hand: [], field: Array(RULES.lanes).fill(null), discard: [] };
    for (let i = 0; i < RULES.startingHand; i++) draw(s);
    return s;
  };
  // The player always opens; to offset the tempo they draw nothing on turn 1.
  return { sides: [side(playerDeck), side(aiDeck)], active: PLAYER, turn: 1, playsLeft: RULES.playsPerTurn, fresh: [], winner: null, nextUid: 1 };
}

export const clone = (s: BattleState): BattleState => structuredClone(s);

export function canPlay(s: BattleState, handIndex: number, lane: number): boolean {
  const side = s.sides[s.active];
  return (
    s.winner === null &&
    s.playsLeft > 0 &&
    handIndex >= 0 &&
    handIndex < side.hand.length &&
    lane >= 0 &&
    lane < RULES.lanes &&
    !s.fresh.includes(lane)
  );
}

/** Places a hand card in a lane (replacing whatever was there). Mutates a copy. */
export function playCard(state: BattleState, handIndex: number, lane: number): { state: BattleState; event: BattleEvent } {
  if (!canPlay(state, handIndex, lane)) throw new Error('illegal play');
  const s = clone(state);
  const side = s.sides[s.active];
  const [card] = side.hand.splice(handIndex, 1);
  const prev = side.field[lane];
  if (prev) side.discard.push(prev.card);
  side.field[lane] = { uid: s.nextUid++, card, hp: card.def };
  s.playsLeft--;
  s.fresh.push(lane);
  return { state: s, event: { kind: 'play', side: s.active, card, lane, replaced: prev?.card } };
}

/** Words completed this turn by the active side, before any reading check. */
export function pendingCombos(s: BattleState, lexicon: Lexicon): Combo[] {
  const cards = s.sides[s.active].field.map((u) => u?.card ?? null);
  return findCombos(cards, lexicon, new Set(s.fresh));
}

export function attackPower(field: readonly (Unit | null)[], lane: number): { atk: number; resonance: boolean } {
  const u = field[lane]!;
  const neighbours = [field[lane - 1], field[lane + 1]].filter(Boolean) as Unit[];
  const resonance = neighbours.some((n) => resonates(u.card.type, n.card.type));
  return { atk: u.card.atk + (resonance ? RESONANCE_BONUS : 0), resonance };
}

/**
 * Ends the active side's turn: combos (with the reading results), then every
 * unit attacks the opposing lane, then the other side starts its turn.
 */
export function endTurn(
  state: BattleState,
  combos: { combo: Combo; correct: boolean }[],
): { state: BattleState; events: BattleEvent[] } {
  const s = clone(state);
  const events: BattleEvent[] = [];
  const me = s.sides[s.active];
  const foe = s.sides[other(s.active)];

  for (const { combo, correct } of combos) {
    const cards = me.field.slice(combo.start, combo.start + combo.length).map((u) => u!.card);
    const damage = comboDamage(cards, combo.word, correct);
    foe.hp -= damage;
    events.push({ kind: 'combo', side: s.active, combo, correct, damage });
  }

  if (foe.hp > 0) {
    for (let lane = 0; lane < RULES.lanes; lane++) {
      // Cards placed this turn are still settling in: they attack from next turn.
      if (!me.field[lane] || s.fresh.includes(lane)) continue;
      const { atk, resonance } = attackPower(me.field, lane);
      const target = foe.field[lane];
      if (target) {
        const multiplier = typeMultiplier(me.field[lane]!.card.type, target.card.type);
        const damage = Math.max(1, Math.round(atk * multiplier));
        target.hp -= damage;
        events.push({ kind: 'attack', side: s.active, lane, damage, multiplier, resonance });
        if (target.hp <= 0) {
          foe.discard.push(target.card);
          foe.field[lane] = null;
          events.push({ kind: 'destroy', side: other(s.active), lane, card: target.card });
        }
      } else {
        foe.hp -= atk;
        events.push({ kind: 'direct', side: s.active, lane, damage: atk });
        if (foe.hp <= 0) break;
      }
    }
  }

  s.winner = winnerOf(s);
  if (s.winner !== null) {
    events.push({ kind: 'end', winner: s.winner });
    return { state: s, events };
  }

  s.active = other(s.active);
  if (s.active === 0) s.turn++;
  s.playsLeft = RULES.playsPerTurn;
  s.fresh = [];
  events.push({ kind: 'turn', side: s.active, turn: s.turn });
  if (draw(s.sides[s.active])) events.push({ kind: 'draw', side: s.active });
  return { state: s, events };
}

function winnerOf(s: BattleState): SideId | 'draw' | null {
  const [a, b] = s.sides;
  if (a.hp <= 0 && b.hp <= 0) return 'draw';
  if (a.hp <= 0) return 1;
  if (b.hp <= 0) return 0;
  const exhausted = (x: Side) => !x.deck.length && !x.hand.length && x.field.every((u) => !u);
  if (s.turn > RULES.maxTurns || (exhausted(a) && exhausted(b))) {
    return a.hp === b.hp ? 'draw' : a.hp > b.hp ? 0 : 1;
  }
  return null;
}
