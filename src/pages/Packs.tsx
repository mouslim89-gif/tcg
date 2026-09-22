import { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadCards } from '../data/loaders';
import { useAsync } from '../data/useAsync';
import { isRarePlus, PITY_EVERY, SLOT_WEIGHTS } from '../game/packs';
import { RARITY_INFO } from '../game/labels';
import { CardView } from '../components/CardView';
import { PackTear } from '../components/PackTear';
import { useSave } from '../store/save';
import { usePackSession } from '../store/packSession';
import styles from './Packs.module.css';

export function Packs() {
  const { data: db } = useAsync(loadCards);
  const packs = useSave((s) => s.packs);
  const pity = useSave((s) => s.pity);
  const openPack = useSave((s) => s.openPack);
  const packsOpened = useSave((s) => s.packsOpened);
  const opened = usePackSession((s) => s.opened);
  const setOpened = usePackSession((s) => s.set);
  const navigate = useNavigate();
  // Coming back from a card page: show the table as it was, without replaying the deal.
  const restored = useRef(opened !== null);

  const open = () => {
    if (!db) return;
    const res = openPack(db);
    restored.current = false;
    if (res) setOpened({ ...res, flipped: res.cards.map(() => false), settled: res.cards.map(() => false) });
  };

  const inspect = (id: string) => {
    setOpened((o) => (o ? { ...o, settled: [...o.flipped] } : o));
    navigate(`/card/${id}`);
  };

  const flip = (i: number) =>
    setOpened((o) => (o ? { ...o, flipped: o.flipped.map((f, j) => f || j === i) } : o));
  const settle = (i: number) =>
    setOpened((o) => (o ? { ...o, settled: o.settled.map((f, j) => f || j === i) } : o));
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
          <PackTear key={packsOpened} disabled={!packs || !db} onDone={open} />
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
          <div className={`${styles.row} ${restored.current ? styles.instant : ''}`}>
            {opened.cards.map((card, i) => (
              <div
                key={i}
                className={`${styles.slot} ${opened.flipped[i] ? styles.flipped : ''} ${opened.settled[i] ? styles.settled : ''}`}
                style={{ '--i': i } as React.CSSProperties}
              >
                <span className={styles.shadow} aria-hidden />
                <div className={styles.flipper} onAnimationEnd={(e) => e.target === e.currentTarget && settle(i)}>
                  <button
                    className={`${styles.back} ${isRarePlus(card.rarity) ? styles[`glow_${card.rarity}`] : ''}`}
                    onClick={() => flip(i)}
                    aria-label={`Reveal card ${i + 1}`}
                  >
                    <span className="jp">漢</span>
                  </button>
                  <div className={styles.front}>
                    {opened.flipped[i] && (
                      <CardView card={card} foil isNew={opened.fresh[i]} onClick={() => inspect(card.id)} />
                    )}
                  </div>
                </div>
                {opened.flipped[i] && (
                  <span className={styles.caption} style={{ color: `var(--rarity-${card.rarity})` }}>
                    {RARITY_INFO[card.rarity].name}
                  </span>
                )}
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
                <button className="btn seal" onClick={() => setOpened(null)} disabled={!packs}>
                  {packs ? `Next pack (${packs})` : 'No packs left'}
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
