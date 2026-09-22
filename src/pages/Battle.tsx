import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadCards, loadLexicon, type CardDb } from '../data/loaders';
import { useAsync } from '../data/useAsync';
import { AI_PROFILE, type Difficulty } from '../game/battle/ai';
import { createBattle, RULES, type BattleState } from '../game/battle/engine';
import { aiDeck, autoDeck, MAX_COPIES } from '../game/decks';
import { mulberry32, randomSeed } from '../game/rng';
import type { Word } from '../game/schema';
import type { Lexicon } from '../game/words';
import { Board } from '../components/battle/Board';
import { useSave } from '../store/save';
import styles from './Battle.module.css';

type Phase =
  | { kind: 'setup' }
  | { kind: 'playing'; state: BattleState; difficulty: Difficulty; seed: number }
  | { kind: 'over'; result: 'win' | 'loss' | 'draw'; words: Word[]; reward: number; difficulty: Difficulty };

export function Battle() {
  const { data: db } = useAsync(loadCards);
  const { data: lexicon, error } = useAsync(loadLexicon);
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const recordBattle = useSave((s) => s.recordBattle);

  const start = (d: Difficulty, deck: BattleState['sides'][0]['deck']) => {
    if (!db || !lexicon) return;
    const seed = randomSeed();
    const rng = mulberry32(seed);
    const state = createBattle(deck, aiDeck(db.cards, lexicon, d, rng), rng);
    setPhase({ kind: 'playing', state, difficulty: d, seed });
  };

  if (error) return <main className="page">Could not load the word list: {error.message}</main>;
  if (!db || !lexicon) {
    return (
      <main className="page">
        <p className="muted">Loading the dictionary…</p>
      </main>
    );
  }

  if (phase.kind === 'playing') {
    return (
      <Board
        initial={phase.state}
        lexicon={lexicon}
        db={db}
        difficulty={phase.difficulty}
        seed={phase.seed}
        onEnd={(result, words) => {
          const reward = recordBattle(result, words.map((w) => w.w));
          setPhase({ kind: 'over', result, words, reward, difficulty: phase.difficulty });
        }}
      />
    );
  }

  return (
    <Setup
      db={db}
      lexicon={lexicon}
      difficulty={difficulty}
      setDifficulty={setDifficulty}
      onStart={start}
      last={phase.kind === 'over' ? phase : null}
    />
  );
}

function Setup({
  db,
  lexicon,
  difficulty,
  setDifficulty,
  onStart,
  last,
}: {
  db: CardDb;
  lexicon: Lexicon;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  onStart: (d: Difficulty, deck: BattleState['sides'][0]['deck']) => void;
  last: Extract<Phase, { kind: 'over' }> | null;
}) {
  const collection = useSave((s) => s.collection);
  const deck = useMemo(() => {
    const owned = Object.entries(collection)
      .map(([id, count]) => ({ card: db.byId.get(id)!, count }))
      .filter((o) => o.card);
    return autoDeck(owned, lexicon);
  }, [collection, db, lexicon]);

  const pairs = useMemo(() => {
    const out: Word[] = [];
    const kanji = new Set(deck.map((c) => c.kanji));
    for (const k of kanji) {
      for (const w of lexicon.byFirst.get(k) ?? []) {
        if ([...w.w].length === 2 && [...w.w].every((c) => kanji.has(c))) out.push(w);
      }
    }
    return out.sort((a, b) => Number(b.c) - Number(a.c));
  }, [deck, lexicon]);

  const ready = deck.length >= RULES.deckSize;

  return (
    <main className="page">
      {last && (
        <section className={`${styles.result} ${styles[last.result]}`}>
          <p className={`${styles.resultGlyph} jp`}>{last.result === 'win' ? '勝' : last.result === 'loss' ? '負' : '分'}</p>
          <div>
            <h1>{last.result === 'win' ? 'Victory' : last.result === 'loss' ? 'Defeat' : 'Draw'}</h1>
            <p>
              +{last.reward} {last.reward > 1 ? 'packs' : 'pack'} earned.{' '}
              <Link to="/packs">Open them →</Link>
            </p>
            {last.words.length > 0 && (
              <ul className={styles.spelled}>
                {last.words.map((w, i) => (
                  <li key={i}>
                    <span className="jp">{w.w}</span> <span className="jp muted">{w.r[0]}</span>{' '}
                    <span className="muted">{w.g}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <p className="eyebrow">Battle</p>
      <h1>Choose your opponent</h1>
      <div className={styles.opponents}>
        {(Object.keys(AI_PROFILE) as Difficulty[]).map((d) => (
          <button
            key={d}
            className={styles.opponent}
            aria-pressed={difficulty === d}
            onClick={() => setDifficulty(d)}
          >
            <span className={`${styles.oppGlyph} jp`}>{d === 'easy' ? '初' : d === 'normal' ? '学' : '師'}</span>
            <strong>{AI_PROFILE[d].label}</strong>
            <span className="muted">{AI_PROFILE[d].blurb}</span>
          </button>
        ))}
      </div>

      <section className={styles.deck}>
        <div className={styles.deckHead}>
          <h2>Your deck</h2>
          <span className="muted">
            {Math.min(deck.length, RULES.deckSize)} / {RULES.deckSize} · built automatically (max {MAX_COPIES} copies)
          </span>
        </div>
        {ready ? (
          <>
            <ul className={`${styles.deckList} jp`}>
              {deck.map((c, i) => (
                <li key={i} style={{ '--t': `var(--t-${c.type})` } as React.CSSProperties} title={c.meanings[0]}>
                  {c.kanji}
                </li>
              ))}
            </ul>
            {pairs.length > 0 && (
              <p className={styles.pairs}>
                <span className="muted">Words in your deck:</span>{' '}
                {pairs.slice(0, 12).map((w) => (
                  <span key={w.w} className="jp">
                    {w.w}
                  </span>
                ))}
                {pairs.length > 12 && <span className="muted">+{pairs.length - 12}</span>}
              </p>
            )}
            <button className="btn seal" onClick={() => onStart(difficulty, deck)}>
              Start battle
            </button>
          </>
        ) : (
          <p>
            You need at least {RULES.deckSize} cards to battle (you have {deck.length}).{' '}
            <Link to="/packs">Open packs →</Link>
          </p>
        )}
      </section>

      <details className={styles.rules}>
        <summary>Rules</summary>
        <ul>
          <li>Both players start with {RULES.hp} HP and 4 lanes. Each turn you draw a card and may place up to {RULES.playsPerTurn}.</li>
          <li>At the end of your turn each card attacks the lane opposite. If it is empty, the damage hits the opponent.</li>
          <li>Cards attack from the turn after they are placed. A card is destroyed when its DEF drops to 0.</li>
          <li>You may place a card over one of your own to replace it.</li>
          <li>
            <strong>Combos:</strong> adjacent cards that spell a word left to right deal bonus damage right away.
            Read the word correctly for ×1.5.
          </li>
          <li>
            <strong>Types:</strong> Wood › Earth › Water › Fire › Metal › Wood; Voice › Spirit › Human › Beast › Body ›
            Path › Sky › Voice. Advantage deals ×1.5, disadvantage ×0.75. Neighbours in the cycle Wood → Fire → Earth →
            Metal → Water → Wood gain +1 ATK.
          </li>
        </ul>
      </details>
    </main>
  );
}
