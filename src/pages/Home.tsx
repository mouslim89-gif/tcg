import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { loadCards } from '../data/loaders';
import { useAsync } from '../data/useAsync';
import { RARITIES } from '../game/schema';
import { RARITY_INFO, TYPE_INFO } from '../game/labels';
import { KanjiStroke } from '../components/KanjiStroke';
import { ConfirmButton } from '../components/ConfirmButton';
import { dailyAvailable, ECONOMY, useSave } from '../store/save';
import styles from './Home.module.css';

const dayIndex = (n: number) => {
  const d = new Date().toISOString().slice(0, 10);
  let h = 2166136261;
  for (const ch of d) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % n;
};

export function Home() {
  const { data: db } = useAsync(loadCards);
  const save = useSave();
  const [replay, setReplay] = useState(0);
  const [claimed, setClaimed] = useState(false);

  const daily = useMemo(() => {
    if (!db) return null;
    const pool = db.byRarity.common;
    return pool[dayIndex(pool.length)];
  }, [db]);

  const owned = Object.keys(save.collection);
  const ownedByRarity = useMemo(() => {
    const out = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<string, number>;
    if (db) for (const id of owned) out[db.byId.get(id)?.rarity ?? 'common']++;
    return out;
  }, [db, owned.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="page">
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className="eyebrow">Every kanji is a card</p>
          <h1 className={styles.title}>Kanjigacha</h1>
          <p className={styles.lede}>
            Open packs, collect all {db ? db.cards.length.toLocaleString('en') : '6,000+'} kanji, and battle by
            placing cards side by side to spell real Japanese words.
          </p>
          <div className={styles.ctas}>
            <Link className="btn seal" to="/packs">
              Open packs{save.packs > 0 && <span className={styles.pill}>{save.packs}</span>}
            </Link>
            <Link className="btn ghost" to="/battle">
              Battle
            </Link>
          </div>
          {dailyAvailable(save) && !claimed && (
            <button
              className={`btn small ${styles.daily}`}
              onClick={() => setClaimed(save.claimDaily())}
            >
              Claim daily gift · {ECONOMY.dailyPacks} packs
            </button>
          )}
        </div>
        {daily && (
          <button className={styles.daily_card} onClick={() => setReplay((r) => r + 1)} aria-label="Replay stroke order">
            <span className="eyebrow">Kanji of the day</span>
            <span className={styles.dailyGlyph}>
              <KanjiStroke id={daily.id} kanji={daily.kanji} animate replay={replay} speed={0.4} />
            </span>
            <span className={styles.dailyMeta}>
              <strong>{daily.meanings.slice(0, 2).join(', ')}</strong>
              <span className="jp muted">{[...daily.on.slice(0, 2), ...daily.kun.slice(0, 2)].join('・')}</span>
              <span className="muted">
                {TYPE_INFO[daily.type].name} · {daily.strokes} strokes · in {daily.words.toLocaleString('en')} words
              </span>
            </span>
          </button>
        )}
      </section>

      <section className={styles.progress}>
        <div className={styles.progressHead}>
          <h2>Your collection</h2>
          <Link to="/collection" className="muted">
            View all →
          </Link>
        </div>
        <p className={styles.big}>
          {owned.length.toLocaleString('en')}
          <span className="muted"> / {db ? db.cards.length.toLocaleString('en') : '…'} kanji</span>
        </p>
        <ul className={styles.bars}>
          {RARITIES.map((r) => {
            const total = db?.byRarity[r].length ?? 1;
            return (
              <li key={r} style={{ '--c': `var(--rarity-${r})` } as React.CSSProperties}>
                <span className={styles.barLabel}>{RARITY_INFO[r].name}</span>
                <span className={styles.bar}>
                  <span style={{ width: `${(100 * ownedByRarity[r]) / total}%` }} />
                </span>
                <span className={styles.barNum}>
                  {ownedByRarity[r]} / {total.toLocaleString('en')}
                </span>
              </li>
            );
          })}
        </ul>
        <dl className={styles.stats}>
          <div>
            <dt>Packs opened</dt>
            <dd>{save.packsOpened}</dd>
          </div>
          <div>
            <dt>Battles won</dt>
            <dd>{save.stats.wins}</dd>
          </div>
          <Link to="/words" className={styles.statLink}>
            <dt>Words spelled</dt>
            <dd>{save.lexicon.length}</dd>
          </Link>
        </dl>
      </section>

      <section className={styles.how}>
        <h2>How it works</h2>
        <ol>
          <li>
            <strong>Rarity</strong> follows real-world usage: everyday jōyō kanji are common, name kanji are epic,
            and the obscure ones hardly anyone can read are legendary.
          </li>
          <li>
            <strong>ATK</strong> is how many dictionary words use the kanji. <strong>DEF</strong> is its stroke
            count.
          </li>
          <li>
            <strong>Type</strong> comes from the radical: 氵 water, 火 fire, 木 wood… The five elements
            overcome and feed each other.
          </li>
          <li>
            <strong>Combos</strong>: place kanji side by side to spell a word (日 + 本 → 日本). Read it correctly
            for bonus damage.
          </li>
        </ol>
      </section>

      <footer className={styles.footer}>
        <Link to="/credits">Data sources &amp; credits</Link>
        <ConfirmButton className={styles.reset} question="Erase your collection?" confirmLabel="Erase" onConfirm={save.reset}>
          Reset save
        </ConfirmButton>
      </footer>
    </main>
  );
}
