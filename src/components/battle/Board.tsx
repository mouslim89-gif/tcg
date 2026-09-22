import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CardDb } from '../../data/loaders';
import { aiReadsCorrectly, AI_PROFILE, chooseLine, type Difficulty } from '../../game/battle/ai';
import {
  AI,
  attackPower,
  canPlay,
  endTurn,
  pendingCombos,
  playCard,
  PLAYER,
  RULES,
  type BattleEvent,
  type BattleState,
  type SideId,
} from '../../game/battle/engine';
import type { Combo } from '../../game/combos';
import { isCorrect, makeQuiz, type Quiz } from '../../game/reading';
import { mulberry32 } from '../../game/rng';
import type { Word } from '../../game/schema';
import { typeMultiplier } from '../../game/typeChart';
import type { Lexicon } from '../../game/words';
import { CardView } from '../CardView';
import styles from './Board.module.css';

interface Props {
  initial: BattleState;
  lexicon: Lexicon;
  db: CardDb;
  difficulty: Difficulty;
  seed: number;
  onEnd: (result: 'win' | 'loss' | 'draw', words: Word[]) => void;
}

interface Fx {
  id: number;
  side: SideId;
  /** null → the player's HP bar */
  lane: number | null;
  text: string;
  tone: 'hit' | 'combo' | 'info';
}

interface QuizStep {
  combos: Combo[];
  index: number;
  quiz: Quiz;
  results: { combo: Combo; correct: boolean }[];
  answer: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Board({ initial, lexicon, db, difficulty, seed, onEnd }: Props) {
  const [state, setState] = useState(initial);
  const [history, setHistory] = useState<BattleState[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [quiz, setQuiz] = useState<QuizStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [fx, setFx] = useState<Fx[]>([]);
  const [message, setMessage] = useState('Your turn: place up to two cards.');
  const [spelled, setSpelled] = useState<Word[]>([]);

  const rng = useRef(mulberry32(seed ^ 0x9e3779b9));
  const alive = useRef(true);
  const fxId = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const spelledRef = useRef(spelled);
  spelledRef.current = spelled;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const addFx = useCallback((items: Omit<Fx, 'id'>[]) => {
    const withIds = items.map((f) => ({ ...f, id: ++fxId.current }));
    setFx((cur) => [...cur, ...withIds]);
    setTimeout(() => {
      if (alive.current) setFx((cur) => cur.filter((f) => !withIds.includes(f)));
    }, 1300);
  }, []);

  const cardsOf = (s: BattleState, side: SideId, c: Combo) =>
    s.sides[side].field.slice(c.start, c.start + c.length).map((u) => u!.card);

  /** Shows the events of a resolved turn, then hands over (or ends the game). */
  const applyTurn = useCallback(
    async (s: BattleState, results: { combo: Combo; correct: boolean }[]) => {
      const { state: next, events } = endTurn(s, results);
      const foe = (side: SideId): SideId => (side === 0 ? 1 : 0);
      const effects: Omit<Fx, 'id'>[] = [];
      const lines: string[] = [];
      for (const e of events) {
        if (e.kind === 'combo') {
          effects.push({ side: foe(e.side), lane: null, text: `−${e.damage}`, tone: 'combo' });
          lines.push(`${e.side === PLAYER ? 'You' : 'Opponent'} spelled ${e.combo.word.w}${e.correct ? ' ✓' : ''}: −${e.damage}`);
        } else if (e.kind === 'attack') {
          const tag = e.multiplier > 1 ? ' ▲' : e.multiplier < 1 ? ' ▼' : '';
          effects.push({ side: foe(e.side), lane: e.lane, text: `−${e.damage}${tag}`, tone: 'hit' });
        } else if (e.kind === 'direct') {
          effects.push({ side: foe(e.side), lane: null, text: `−${e.damage}`, tone: 'hit' });
        } else if (e.kind === 'destroy') {
          effects.push({ side: e.side, lane: e.lane, text: '破', tone: 'info' });
        }
      }
      const dealt = events
        .filter((e): e is Extract<BattleEvent, { kind: 'direct' | 'combo' }> => e.kind === 'direct' || e.kind === 'combo')
        .reduce((a, e) => a + e.damage, 0);
      setState(next);
      setHistory([]);
      addFx(effects);
      if (lines.length) setMessage(lines.join(' · '));
      else if (dealt) setMessage(`${s.active === PLAYER ? 'You' : 'Opponent'} dealt ${dealt} damage.`);
      await sleep(1100);
      return next;
    },
    [addFx],
  );

  const finish = useCallback(
    (s: BattleState) => {
      const w = s.winner;
      onEnd(w === PLAYER ? 'win' : w === AI ? 'loss' : 'draw', spelledRef.current);
    },
    [onEnd],
  );

  const runAi = useCallback(
    async (start: BattleState) => {
      setBusy(true);
      setMessage(`${AI_PROFILE[difficulty].label} is thinking…`);
      await sleep(700);
      let s = start;
      for (const p of chooseLine(s, lexicon, difficulty, rng.current)) {
        if (!alive.current) return;
        s = playCard(s, p.handIndex, p.lane).state;
        setState(s);
        await sleep(650);
      }
      const combos = pendingCombos(s, lexicon);
      const results = combos.map((combo) => ({ combo, correct: aiReadsCorrectly(difficulty, rng.current) }));
      for (const r of results) {
        setMessage(
          `Opponent spelled ${r.combo.word.w} and read it ${r.correct ? `correctly (${r.combo.word.r[0]})` : 'wrong'}.`,
        );
        await sleep(1100);
      }
      if (!alive.current) return;
      const next = await applyTurn(s, results);
      if (!alive.current) return;
      if (next.winner !== null) return finish(next);
      setBusy(false);
      setMessage(`Turn ${next.turn}: your move.`);
    },
    [applyTurn, difficulty, finish, lexicon],
  );

  const resolvePlayer = useCallback(
    async (results: { combo: Combo; correct: boolean }[]) => {
      setBusy(true);
      const s = stateRef.current;
      setSpelled((cur) => [...cur, ...results.map((r) => r.combo.word)]);
      spelledRef.current = [...spelledRef.current, ...results.map((r) => r.combo.word)];
      const next = await applyTurn(s, results);
      if (!alive.current) return;
      if (next.winner !== null) return finish(next);
      await runAi(next);
    },
    [applyTurn, finish, runAi],
  );

  const onEndTurn = () => {
    setSelected(null);
    const combos = pendingCombos(state, lexicon);
    if (!combos.length) {
      resolvePlayer([]);
      return;
    }
    const first = combos[0];
    setQuiz({
      combos,
      index: 0,
      quiz: makeQuiz(first.word, cardsOf(state, PLAYER, first), rng.current),
      results: [],
      answer: null,
    });
  };

  const answer = async (choice: string) => {
    if (!quiz || quiz.answer) return;
    const combo = quiz.combos[quiz.index];
    const results = [...quiz.results, { combo, correct: isCorrect(quiz.quiz, choice) }];
    setQuiz({ ...quiz, answer: choice, results });
    await sleep(1300);
    if (!alive.current) return;
    const nextIndex = quiz.index + 1;
    if (nextIndex < quiz.combos.length) {
      const c = quiz.combos[nextIndex];
      setQuiz({
        combos: quiz.combos,
        index: nextIndex,
        quiz: makeQuiz(c.word, cardsOf(state, PLAYER, c), rng.current),
        results,
        answer: null,
      });
    } else {
      setQuiz(null);
      resolvePlayer(results);
    }
  };

  const tapLane = (lane: number) => {
    if (busy || state.active !== PLAYER || selected === null) return;
    if (!canPlay(state, selected, lane)) return;
    setHistory((h) => [...h, state]);
    setState(playCard(state, selected, lane).state);
    setSelected(null);
  };

  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setState(prev);
    setHistory((h) => h.slice(0, -1));
    setSelected(null);
  };

  const forfeit = () => {
    if (confirm('Forfeit this battle? It counts as a loss.')) {
      alive.current = false;
      onEnd('loss', spelledRef.current);
    }
  };

  const myTurn = state.active === PLAYER && !busy && state.winner === null;
  const preview = useMemo(
    () => (state.active === PLAYER ? pendingCombos(state, lexicon) : []),
    [state, lexicon],
  );
  const previewLanes = new Set(preview.flatMap((c) => Array.from({ length: c.length }, (_, i) => c.start + i)));

  const me = state.sides[PLAYER];
  const foe = state.sides[AI];

  const hpFx = (side: SideId) => fx.filter((f) => f.side === side && f.lane === null);
  const laneFx = (side: SideId, lane: number) => fx.filter((f) => f.side === side && f.lane === lane);

  const renderField = (side: SideId) => (
    <div className={`${styles.field} ${side === PLAYER ? styles.mine : styles.theirs}`}>
      {state.sides[side].field.map((u, lane) => {
        const fresh = state.active === side && state.fresh.includes(lane);
        const targetable = side === PLAYER && myTurn && selected !== null && canPlay(state, selected, lane);
        const { resonance } = u ? attackPower(state.sides[side].field, lane) : { resonance: false };
        return (
          <button
            key={lane}
            className={`${styles.lane} ${targetable ? styles.targetable : ''} ${
              side === PLAYER && previewLanes.has(lane) ? styles.inWord : ''
            }`}
            onClick={() => tapLane(lane)}
            disabled={side !== PLAYER}
            aria-label={u ? `${side === PLAYER ? 'Your' : 'Opponent'} lane ${lane + 1}: ${u.card.kanji}` : `${side === PLAYER ? 'Your' : 'Opponent'} empty lane ${lane + 1}`}
          >
            {u ? (
              <CardView
                key={u.uid}
                card={u.card}
                compact
                strokes={fresh}
                hp={u.hp}
                atkBonus={resonance ? 1 : 0}
                className={`${styles.unit} ${fresh ? styles.fresh : ''} ${u.hp < u.card.def ? styles.hurt : ''}`}
              />
            ) : (
              <span className={styles.empty} />
            )}
            {laneFx(side, lane).map((f) => (
              <span key={f.id} className={`${styles.fx} ${styles[f.tone]}`}>
                {f.text}
              </span>
            ))}
          </button>
        );
      })}
    </div>
  );

  const hpBar = (side: SideId, label: string) => {
    const s = state.sides[side];
    return (
      <div className={styles.hpRow}>
        <span className={styles.who}>{label}</span>
        <span className={styles.hp}>
          <span className={styles.hpFill} style={{ width: `${Math.max(0, (100 * s.hp) / RULES.hp)}%` }} />
        </span>
        <span className={styles.hpNum}>
          {Math.max(0, s.hp)}
          {hpFx(side).map((f) => (
            <span key={f.id} className={`${styles.fx} ${styles[f.tone]}`}>
              {f.text}
            </span>
          ))}
        </span>
        <span className={styles.piles} title="Deck · hand">
          <span className="jp">札</span>
          {s.deck.length}
          {side === AI && (
            <>
              <span className="jp">手</span>
              {s.hand.length}
            </>
          )}
        </span>
      </div>
    );
  };

  return (
    <div className={styles.board}>
      <header className={styles.top}>
        {hpBar(AI, AI_PROFILE[difficulty].label)}
        <button className={styles.forfeit} onClick={forfeit} aria-label="Forfeit">
          ✕
        </button>
      </header>

      {renderField(AI)}

      <div className={styles.middle}>
        <div className={styles.matchups}>
          {me.field.map((u, lane) => {
            const t = foe.field[lane];
            if (!u || !t) return <span key={lane} />;
            const mine = typeMultiplier(u.card.type, t.card.type);
            const theirs = typeMultiplier(t.card.type, u.card.type);
            return (
              <span key={lane} className={styles.matchup}>
                {mine > 1 && <span className={styles.up}>▲×{mine}</span>}
                {theirs > 1 && <span className={styles.down}>▼×{theirs}</span>}
              </span>
            );
          })}
        </div>
        <p className={styles.message} aria-live="polite">
          {preview.length > 0 && myTurn ? (
            <>
              <span className={styles.comboTag}>Combo</span>{' '}
              {preview.map((c) => (
                <span key={c.start} className="jp">
                  {c.word.w}{' '}
                </span>
              ))}
              <span className="muted">ready: end your turn to cast it</span>
            </>
          ) : (
            message
          )}
        </p>
      </div>

      {renderField(PLAYER)}

      <footer className={styles.bottom}>
        {hpBar(PLAYER, 'You')}
        <div className={styles.hand} role="listbox" aria-label="Your hand">
          {me.hand.map((c, i) => (
            <button
              key={`${c.id}-${i}`}
              className={`${styles.handCard} ${selected === i ? styles.selected : ''}`}
              onClick={() => myTurn && state.playsLeft > 0 && setSelected(selected === i ? null : i)}
              disabled={!myTurn || state.playsLeft === 0}
              role="option"
              aria-selected={selected === i}
            >
              <CardView card={c} compact />
            </button>
          ))}
          {me.hand.length === 0 && <p className="muted">No cards in hand.</p>}
        </div>
        <div className={styles.actions}>
          <button className="btn ghost small" onClick={undo} disabled={!myTurn || !history.length}>
            Undo
          </button>
          <span className={styles.plays}>
            {myTurn
              ? selected !== null
                ? 'Tap one of your lanes'
                : `${state.playsLeft} ${state.playsLeft === 1 ? 'play' : 'plays'} left`
              : 'Opponent’s turn'}
          </span>
          <button className="btn seal small" onClick={onEndTurn} disabled={!myTurn}>
            End turn
          </button>
        </div>
      </footer>

      {quiz && <QuizModal step={quiz} db={db} onAnswer={answer} />}
    </div>
  );
}

function QuizModal({ step, db, onAnswer }: { step: QuizStep; db: CardDb; onAnswer: (c: string) => void }) {
  const combo = step.combos[step.index];
  const { word } = combo;
  return (
    <div className={styles.modalBack} role="dialog" aria-modal aria-labelledby="quiz-title">
      <div className={styles.modal}>
        <p className="eyebrow">
          Combo{step.combos.length > 1 ? ` ${step.index + 1}/${step.combos.length}` : ''}
          {word.c ? ' · common word' : ''}
        </p>
        <p className={`${styles.quizWord} jp`} id="quiz-title">
          {[...word.w].map((k, i) => (
            <span key={i} style={{ color: `var(--t-${db.byKanji.get(k)?.type})` }}>
              {k}
            </span>
          ))}
        </p>
        <p className={styles.quizGloss}>“{word.g}”</p>
        <p className={styles.quizAsk}>How is it read? Get it right for ×1.5 damage.</p>
        <div className={styles.options}>
          {step.quiz.options.map((o) => {
            const chosen = step.answer === o;
            const right = step.quiz.answers.includes(o);
            const state = step.answer ? (right ? styles.right : chosen ? styles.wrong : styles.dim) : '';
            return (
              <button key={o} className={`${styles.option} ${state} jp`} onClick={() => onAnswer(o)} disabled={!!step.answer}>
                {o}
              </button>
            );
          })}
        </div>
        {step.answer && (
          <p className={styles.verdict}>
            {step.quiz.answers.includes(step.answer) ? 'Correct!' : `It reads ${word.r.join(' / ')}.`}
          </p>
        )}
      </div>
    </div>
  );
}
