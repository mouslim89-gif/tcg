import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadCards, loadLexicon } from '../data/loaders';
import { useAsync } from '../data/useAsync';
import { gradeLabel, radicalGlyph, RARITY_INFO, TYPE_INFO } from '../game/labels';
import { beatenBy, beats, fedBy, feeds } from '../game/typeChart';
import type { TypeId } from '../game/schema';
import { CardView } from '../components/CardView';
import { useSave } from '../store/save';
import styles from './CardDetail.module.css';

const PAGE = 30;

export function CardDetail() {
  const { id = '' } = useParams();
  const { data: db } = useAsync(loadCards);
  const { data: lexicon } = useAsync(loadLexicon);
  const collection = useSave((s) => s.collection);
  const markSeen = useSave((s) => s.markSeen);
  const navigate = useNavigate();
  const [replay, setReplay] = useState(0);
  const [limit, setLimit] = useState(PAGE);

  const card = db?.byId.get(id);
  const count = collection[id] ?? 0;

  useEffect(() => {
    if (count) markSeen([id]);
    setLimit(PAGE);
  }, [id, count, markSeen]);

  const words = useMemo(() => {
    if (!card || !lexicon || !db) return [];
    const ownsAll = (w: string) => [...w].every((k) => collection[db.byKanji.get(k)!.id]);
    return (lexicon.byKanji.get(card.kanji) ?? [])
      .map((w) => ({ w, spellable: ownsAll(w.w) }))
      .sort(
        (a, b) =>
          Number(b.spellable) - Number(a.spellable) ||
          Number(b.w.c) - Number(a.w.c) ||
          [...a.w.w].length - [...b.w.w].length ||
          a.w.w.localeCompare(b.w.w),
      );
  }, [card, lexicon, db, collection]);

  if (db && !card) {
    return (
      <main className="page">
        <p>Unknown card.</p>
        <Link to="/collection">Back to collection</Link>
      </main>
    );
  }
  if (!card) return <main className="page" />;

  const type = TYPE_INFO[card.type];
  const rel = (t: TypeId | undefined) => (t ? `${TYPE_INFO[t].glyph} ${TYPE_INFO[t].name}` : '—');

  return (
    <main className="page">
      <button className={styles.back} onClick={() => navigate(-1)}>
        ← Back
      </button>
      <div className={styles.layout}>
        <div className={styles.cardCol}>
          <div className={styles.cardWrap}>
            <CardView card={card} strokes replay={replay} />
          </div>
          <button className="btn ghost small" onClick={() => setReplay((r) => r + 1)}>
            ↻ Replay strokes
          </button>
          <p className={styles.owned}>{count ? `${count} ${count > 1 ? 'copies' : 'copy'} owned` : 'Not in your collection yet'}</p>
        </div>

        <div className={styles.info}>
          <p className="eyebrow" style={{ color: `var(--rarity-${card.rarity})` }}>
            {RARITY_INFO[card.rarity].name} · {type.name}
          </p>
          <h1 className={styles.meaning}>{card.meanings.join(', ') || 'No English meaning recorded'}</h1>

          <dl className={styles.readings}>
            <div>
              <dt>On’yomi</dt>
              <dd className="jp">{card.on.join('、') || '—'}</dd>
            </div>
            <div>
              <dt>Kun’yomi</dt>
              <dd className="jp">{card.kun.join('、') || '—'}</dd>
            </div>
          </dl>

          <dl className={styles.facts}>
            <div>
              <dt>ATK</dt>
              <dd>{card.atk}</dd>
              <span>{card.words.toLocaleString('en')} words in JMdict</span>
            </div>
            <div>
              <dt>DEF</dt>
              <dd>{card.def}</dd>
              <span>{card.strokes} strokes</span>
            </div>
            <div>
              <dt>Radical</dt>
              <dd className="jp">{radicalGlyph(card.radical)}</dd>
              <span>Kangxi no. {card.radical}</span>
            </div>
            <div>
              <dt>Frequency</dt>
              <dd>{card.freq ? `#${card.freq}` : '—'}</dd>
              <span>{card.freq ? 'in newspapers' : 'outside the top 2,500'}</span>
            </div>
          </dl>
          <p className="muted">{gradeLabel(card)}{card.jlpt ? ` · former JLPT level ${card.jlpt}` : ''}</p>

          <section className={styles.types}>
            <h2>
              <span className={`${styles.typeBadge} jp`} style={{ background: `var(--t-${card.type})` }}>
                {type.glyph}
              </span>
              {type.name} type
            </h2>
            <ul>
              <li>
                <span>Strong against</span> {rel(beats(card.type))}
              </li>
              <li>
                <span>Weak to</span> {rel(beatenBy(card.type))}
              </li>
              {(feeds(card.type) || fedBy(card.type)) && (
                <li>
                  <span>Resonates with</span> {rel(fedBy(card.type))} and {rel(feeds(card.type))} (+1 ATK when adjacent)
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>

      <section className={styles.words}>
        <h2>
          Combo words <span className="muted">{lexicon ? words.length.toLocaleString('en') : '…'}</span>
        </h2>
        <p className="muted">Words you can already spell with your collection are highlighted.</p>
        <ul>
          {words.slice(0, limit).map(({ w, spellable }) => (
            <li key={w.w} className={spellable ? styles.spellable : ''}>
              <span className={`${styles.word} jp`}>
                {[...w.w].map((k, i) => {
                  const c = db!.byKanji.get(k)!;
                  return k === card.kanji ? (
                    <b key={i}>{k}</b>
                  ) : (
                    <Link key={i} to={`/card/${c.id}`} className={collection[c.id] ? '' : styles.missing}>
                      {k}
                    </Link>
                  );
                })}
              </span>
              <span className={`${styles.reading} jp`}>{w.r[0]}</span>
              <span className={styles.gloss}>{w.g}</span>
              {w.c && <span className={styles.common}>common</span>}
            </li>
          ))}
        </ul>
        {words.length > limit && (
          <button className="btn ghost small" onClick={() => setLimit((l) => l + PAGE * 2)}>
            Show more
          </button>
        )}
      </section>
    </main>
  );
}
