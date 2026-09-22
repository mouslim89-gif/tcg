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
  /** Pack-opening entrance: ink-stamp glyph, plus a shine on rare+ cards. */
  reveal?: boolean;
  count?: number;
  isNew?: boolean;
  /** Shows current / max DEF in battle. */
  hp?: number;
  atkBonus?: number;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
}

export function CardView({ card, strokes, replay, slowStrokes, reveal, count, isNew, hp, atkBonus, compact, className, onClick }: Props) {
  const type = TYPE_INFO[card.type];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`${styles.card} ${styles[card.rarity]} ${compact ? styles.compact : ''} ${reveal ? styles.reveal : ''} ${className ?? ''}`}
      style={{ '--type': `var(--t-${card.type})` } as React.CSSProperties}
      onClick={onClick}
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
