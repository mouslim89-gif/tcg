import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadCards, loadLexicon } from '../data/loaders';
import { useAsync } from '../data/useAsync';
import { useSave } from '../store/save';
import styles from './Words.module.css';

/** Every word the player has spelled in battle: a personal vocabulary list. */
export function Words() {
  const { data: db } = useAsync(loadCards);
  const { data: lexicon } = useAsync(loadLexicon);
  const spelled = useSave((s) => s.lexicon);
  const collection = useSave((s) => s.collection);
  const [order, setOrder] = useState<'recent' | 'kana'>('recent');

  const words = useMemo(() => {
    if (!lexicon) return [];
    const list = [...spelled].reverse().map((w) => lexicon.get(w)).filter((w) => !!w);
    if (order === 'kana') list.sort((a, b) => a.r[0].localeCompare(b.r[0], 'ja'));
    return list;
  }, [lexicon, spelled, order]);

  return (
    <main className="page">
      <header className={styles.head}>
        <div>
          <p className="eyebrow">Lexicon</p>
          <h1>
            {spelled.length} <span className="muted">{spelled.length === 1 ? 'word' : 'words'} spelled</span>
          </h1>
        </div>
        <div className={styles.order} role="group" aria-label="Order">
          <button className="chip" aria-pressed={order === 'recent'} onClick={() => setOrder('recent')}>
            Recent
          </button>
          <button className="chip" aria-pressed={order === 'kana'} onClick={() => setOrder('kana')}>
            <span className="jp">あいう</span>
          </button>
        </div>
      </header>

      {spelled.length === 0 ? (
        <div className={styles.empty}>
          <p className="jp">言葉</p>
          <p>Words you spell in battle are collected here, with their reading and meaning.</p>
          <Link className="btn seal" to="/battle">
            Go battle
          </Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {words.map((w) => (
            <li key={w.w}>
              <span className={`${styles.word} jp`}>
                {[...w.w].map((k, i) => {
                  const c = db?.byKanji.get(k);
                  return c ? (
                    <Link key={i} to={`/card/${c.id}`} className={collection[c.id] ? '' : styles.missing}>
                      {k}
                    </Link>
                  ) : (
                    k
                  );
                })}
              </span>
              <span className={`${styles.reading} jp`}>{w.r.join('・')}</span>
              <span className={styles.gloss}>{w.g}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
