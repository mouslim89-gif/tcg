import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadCards, loadLexicon } from '../data/loaders';
import { useAsync } from '../data/useAsync';
import { RULES } from '../game/battle/engine';
import { autoDeck, checkDeck, deckWords, MAX_COPIES, pairSuggestions } from '../game/decks';
import { toHiragana } from '../game/reading';
import type { Card } from '../game/schema';
import { CardView } from '../components/CardView';
import { useSave } from '../store/save';
import styles from './Deck.module.css';

const power = (c: Card) => c.atk + c.def;

export function Deck() {
  const { data: db } = useAsync(loadCards);
  const { data: lexicon } = useAsync(loadLexicon);
  const collection = useSave((s) => s.collection);
  const saved = useSave((s) => s.deck ?? null);
  const setDeck = useSave((s) => s.setDeck);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const owned = useMemo(
    () =>
      db
        ? Object.entries(collection)
            .map(([id, count]) => ({ card: db.byId.get(id)!, count }))
            .filter((o) => o.card)
        : [],
    [db, collection],
  );

  const auto = useMemo(() => (lexicon ? autoDeck(owned, lexicon) : []), [owned, lexicon]);
  const isAuto = saved === null;
  const deck: Card[] = useMemo(() => {
    if (!db) return [];
    return isAuto ? auto : checkDeck(saved!, collection, db.byId, Infinity).cards;
  }, [db, isAuto, auto, saved, collection]);

  const inDeck = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of deck) m.set(c.id, (m.get(c.id) ?? 0) + 1);
    return m;
  }, [deck]);

  const words = useMemo(() => (lexicon ? deckWords(deck, lexicon) : []), [deck, lexicon]);
  const suggestions = useMemo(() => {
    if (!lexicon || deck.length >= RULES.deckSize) return [];
    const available = new Map(
      owned
        .filter((o) => (inDeck.get(o.card.id) ?? 0) < Math.min(MAX_COPIES, o.count))
        .map((o) => [o.card.kanji, o]),
    );
    return pairSuggestions(deck, available, lexicon, 8);
  }, [deck, owned, inDeck, lexicon]);

  const canAdd = (c: Card) =>
    deck.length < RULES.deckSize && (inDeck.get(c.id) ?? 0) < Math.min(MAX_COPIES, collection[c.id] ?? 0);

  const commit = (cards: Card[]) => setDeck(cards.map((c) => c.id));
  const add = (c: Card) => canAdd(c) && commit([...deck, c]);
  const removeAt = (i: number) => commit(deck.filter((_, j) => j !== i));
  const autoFill = () => {
    if (!lexicon) return;
    const rest = owned
      .map((o) => ({ card: o.card, count: Math.min(o.count, MAX_COPIES) - (inDeck.get(o.card.id) ?? 0) }))
      .filter((o) => o.count > 0);
    commit([...deck, ...autoDeck(rest, lexicon, RULES.deckSize - deck.length)]);
  };

  const pool = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qk = toHiragana(q);
    return owned
      .map((o) => o.card)
      .filter(
        (c) =>
          !q ||
          c.kanji === q ||
          c.meanings.some((m) => m.toLowerCase().includes(q)) ||
          [...c.on, ...c.kun].some((r) => toHiragana(r.replace(/[.-]/g, '')).startsWith(qk)),
      )
      .sort((a, b) => power(b) - power(a) || a.id.localeCompare(b.id));
  }, [owned, query]);

  const full = deck.length === RULES.deckSize;
  const copies = owned.reduce((a, o) => a + Math.min(o.count, MAX_COPIES), 0);

  return (
    <main className="page">
      <button className={styles.back} onClick={() => navigate(-1)}>
        ← Back
      </button>
      <header className={styles.head}>
        <div>
          <p className="eyebrow">Deck</p>
          <h1>
            {deck.length}
            <span className="muted"> / {RULES.deckSize}</span>
          </h1>
        </div>
        <span className={`${styles.status} ${full ? styles.ok : styles.todo}`}>
          {isAuto ? 'Auto-built' : full ? 'Ready' : `${RULES.deckSize - deck.length} to add`}
        </span>
      </header>

      <p className="muted">
        {isAuto
          ? 'Your deck is built automatically from your best cards and word pairs. Change anything to make it yours.'
          : 'Tap a card below to add it, tap a slot to remove it. Up to two copies of each kanji.'}
      </p>

      <ol className={`${styles.slots} jp`}>
        {Array.from({ length: RULES.deckSize }, (_, i) => {
          const c = deck[i];
          return c ? (
            <li key={i}>
              <button
                style={{ '--t': `var(--t-${c.type})` } as React.CSSProperties}
                onClick={() => removeAt(i)}
                aria-label={`Remove ${c.kanji} (${c.meanings[0] ?? ''})`}
                title={c.meanings[0]}
              >
                {c.kanji}
              </button>
            </li>
          ) : (
            <li key={i} className={styles.emptySlot} aria-hidden />
          );
        })}
      </ol>

      <div className={styles.actions}>
        <button className="btn small" onClick={autoFill} disabled={full || !lexicon || copies <= deck.length}>
          Auto-fill
        </button>
        <button className="btn ghost small" onClick={() => commit([])} disabled={!deck.length}>
          Clear
        </button>
        {!isAuto && (
          <button className="btn ghost small" onClick={() => setDeck(null)}>
            Back to auto
          </button>
        )}
        <Link className="btn seal small" to="/battle" aria-disabled={!full}>
          Battle →
        </Link>
      </div>

      <section className={styles.section}>
        <h2>
          Words in this deck <span className="muted">{words.length}</span>
        </h2>
        {words.length ? (
          <p className={`${styles.words} jp`}>
            {words.slice(0, 24).map((w) => (
              <span key={w.w} title={`${w.r[0]} · ${w.g}`} className={w.c ? styles.common : ''}>
                {w.w}
              </span>
            ))}
            {words.length > 24 && <span className="muted">+{words.length - 24}</span>}
          </p>
        ) : (
          <p className="muted">No two-kanji words yet: combos need pairs like 日 + 本.</p>
        )}
        {suggestions.length > 0 && (
          <>
            <h3 className={styles.sub}>Complete a word</h3>
            <ul className={styles.suggest}>
              {suggestions.map(({ word, add: card }) => (
                <li key={word.w}>
                  <span className={`${styles.sw} jp`}>{word.w}</span>
                  <span className={styles.sg}>
                    <span className="jp">{word.r[0]}</span> · {word.g}
                  </span>
                  <button className="chip" onClick={() => add(card)} disabled={!canAdd(card)}>
                    + <span className="jp">{card.kanji}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.poolHead}>
          <h2>Your cards</h2>
          <input
            className={styles.search}
            type="search"
            placeholder="Search meaning, reading or kanji"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search your cards"
          />
        </div>
        <ul className={styles.pool}>
          {pool.map((c) => {
            const n = inDeck.get(c.id) ?? 0;
            return (
              <li key={c.id} className={canAdd(c) ? '' : styles.maxed}>
                <CardView card={c} compact onClick={() => add(c)} />
                {n > 0 && <span className={styles.inDeck}>{n} in deck</span>}
              </li>
            );
          })}
        </ul>
        {!owned.length && (
          <p className="muted">
            No cards yet. <Link to="/packs">Open a pack →</Link>
          </p>
        )}
      </section>
    </main>
  );
}
