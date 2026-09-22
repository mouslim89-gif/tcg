import type { Card } from '../game/schema';
import { RARITY_INFO, TYPE_INFO } from '../game/labels';
import { KanjiStroke } from './KanjiStroke';
import styles from './CardView.module.css';

interface Props {
  card: Card;
  /** Draw the kanji with KanjiVG strokes (animated) instead of the font. */
  strokes?: boolean;
  replay?: number;
  /** Full stroke-order pace (card detail) instead of the quick reveal. */
  slowStrokes?: boolean;
  /** Holographic sheen on rare+ cards that follows the pointer. */
  foil?: boolean;
  count?: number;
  isNew?: boolean;
  /** Shows current / max DEF in battle. */
  hp?: number;
  atkBonus?: number;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
}

export function CardView({ card, strokes, replay, slowStrokes, foil, count, isNew, hp, atkBonus, compact, className, onClick }: Props) {
  const type = TYPE_INFO[card.type];
  const shiny = foil && RARITY_INFO[card.rarity].rank >= RARITY_INFO.rare.rank;
  // Sheen position tracks the pointer: 0–100% across the card.
  const tilt = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`${styles.card} ${styles[card.rarity]} ${compact ? styles.compact : ''} ${className ?? ''}`}
      style={{ '--type': `var(--t-${card.type})` } as React.CSSProperties}
      onClick={onClick}
      onPointerMove={shiny ? tilt : undefined}
      aria-label={`${card.kanji}: ${card.meanings[0] ?? ''}, ${RARITY_INFO[card.rarity].name} ${type.name}, attack ${card.atk}, defense ${card.def}`}
    >
      <span className={styles.inner}>
        <span className={styles.head}>
          <span className={styles.type} title={type.name}>
            <span className="jp">{type.glyph}</span>
          </span>
          <span className={styles.rarity} title={RARITY_INFO[card.rarity].name}>
            {RARITY_INFO[card.rarity].short}
          </span>
        </span>
        <span className={styles.glyph}>
          {strokes ? <KanjiStroke
              id={card.id}
              kanji={card.kanji}
              animate
              replay={replay}
              {...(slowStrokes ? {} : { speed: 0.12, total: 0.9 })}
            /> : card.kanji}
        </span>
        {!compact && <span className={styles.meaning}>{card.meanings[0] ?? '—'}</span>}
        {shiny && <span className={styles.sheen} aria-hidden />}
        <span className={styles.stats}>
          <span className={styles.atk}>
            <small>ATK</small>
            {card.atk + (atkBonus ?? 0)}
          </span>
          <span className={styles.def}>
            <small>DEF</small>
            {hp ?? card.def}
          </span>
        </span>
      </span>
      {count !== undefined && count > 1 && <span className={styles.count}>×{count}</span>}
      {isNew && <span className={styles.new}>New</span>}
    </Tag>
  );
}
