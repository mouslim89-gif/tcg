import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadCards } from '../data/loaders';
import { useAsync } from '../data/useAsync';
import type { Card } from '../game/schema';
import { isRarePlus, PACK_SIZE, PITY_EVERY, SLOT_WEIGHTS } from '../game/packs';
import { RARITY_INFO } from '../game/labels';
import { CardView } from '../components/CardView';
import { useSave } from '../store/save';
import styles from './Packs.module.css';

interface Opened {
  cards: Card[];
  fresh: boolean[];
  flipped: boolean[];
  pityTriggered: boolean;
}

export function Packs() {
  const { data: db } = useAsync(loadCards);
  const packs = useSave((s) => s.packs);
  const pity = useSave((s) => s.pity);
  const openPack = useSave((s) => s.openPack);
  const [opened, setOpened] = useState<Opened | null>(null);
  const navigate = useNavigate();

  const open = () => {
    if (!db) return;
    const res = openPack(db);
    if (res) setOpened({ ...res, flipped: res.cards.map(() => false) });
  };

  const flip = (i: number) =>
    setOpened((o) => (o ? { ...o, flipped: o.flipped.map((f, j) => f || j === i) } : o));
  const flipAll = () => setOpened((o) => (o ? { ...o, flipped: o.flipped.map(() => true) } : o));

  const allFlipped = opened?.flipped.every(Boolean);
  const untilPity = PITY_EVERY - pity;

  return (
    <main className="page">
      <header className={styles.head}>
        <div>
          <p className="eyebrow">Packs</p>
          <h1>Open a pack</h1>
        </div>
        <p className={styles.count}>
          <strong>{packs}</strong> {packs === 1 ? 'pack' : 'packs'} left
        </p>
      </header>

      {!opened && (
        <section className={styles.stage}>
          <button className={styles.pack} onClick={open} disabled={!packs || !db} aria-label="Open pack">
            <span className={`${styles.packSeal} jp`}>漢</span>
            <span className={styles.packName}>Kanjigacha</span>
            <span className={styles.packSub}>{PACK_SIZE} cards</span>
          </button>
          <button className="btn seal" onClick={open} disabled={!packs || !db}>
            {packs ? 'Tear it open' : 'No packs left'}
          </button>
          {!packs && (
            <p className="muted">
              Win battles (+2) or come back tomorrow for your daily gift. <Link to="/battle">Go battle →</Link>
            </p>
          )}
          <p className={styles.pity}>
            {untilPity <= 1
              ? 'Your next pack is guaranteed to hold a Rare or better.'
              : `Rare or better guaranteed within ${untilPity} packs.`}
          </p>
          <Odds />
        </section>
      )}

      {opened && (
        <section className={styles.reveal}>
          <div className={styles.row}>
            {opened.cards.map((card, i) => (
              <div
                key={i}
                className={`${styles.slot} ${opened.flipped[i] ? styles.flipped : ''}`}
                style={{ '--i': i } as React.CSSProperties}
              >
                <button
                  className={`${styles.back} ${isRarePlus(card.rarity) ? styles[`glow_${card.rarity}`] : ''}`}
                  onClick={() => flip(i)}
                  aria-label={`Reveal card ${i + 1}`}
                >
                  <span className="jp">漢</span>
                </button>
                <div className={styles.front}>
                  {opened.flipped[i] && (
                    <CardView
                      card={card}
                      strokes
                      isNew={opened.fresh[i]}
                      onClick={() => navigate(`/card/${card.id}`)}
                    />
                  )}
                  {opened.flipped[i] && (
                    <span className={styles.caption} style={{ color: `var(--rarity-${card.rarity})` }}>
                      {RARITY_INFO[card.rarity].name}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {opened.pityTriggered && allFlipped && <p className={styles.pity}>Pity bonus: a Rare+ was guaranteed.</p>}
          <div className={styles.actions}>
            {!allFlipped ? (
              <button className="btn" onClick={flipAll}>
                Reveal all
              </button>
            ) : (
              <>
                <button className="btn seal" onClick={open} disabled={!packs}>
                  {packs ? `Open another (${packs})` : 'No packs left'}
                </button>
                <button className="btn ghost" onClick={() => setOpened(null)}>
                  Done
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function Odds() {
  const total = Object.values(SLOT_WEIGHTS).reduce((a, b) => a + b, 0);
  return (
    <details className={styles.odds}>
      <summary>Drop rates per card</summary>
      <ul>
        {Object.entries(SLOT_WEIGHTS).map(([r, w]) => (
          <li key={r}>
            <span style={{ color: `var(--rarity-${r})` }}>{RARITY_INFO[r as keyof typeof RARITY_INFO].name}</span>
            <span>{((100 * w) / total).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
