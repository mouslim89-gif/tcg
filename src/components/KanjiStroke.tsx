import { useEffect, useState } from 'react';
import { loadStrokes } from '../data/loaders';
import styles from './KanjiStroke.module.css';

interface Props {
  id: string;
  kanji: string;
  /** Draw stroke by stroke. Change `replay` to restart the animation. */
  animate?: boolean;
  replay?: number;
  /** Seconds per stroke. */
  speed?: number;
  /** Cap on the whole drawing, in seconds: long kanji draw faster per stroke. */
  total?: number;
  className?: string;
}

/** KanjiVG stroke paths, optionally drawn in stroke order. Falls back to the font glyph. */
export function KanjiStroke({ id, kanji, animate = false, replay = 0, speed = 0.32, total, className }: Props) {
  const [paths, setPaths] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    loadStrokes(id).then((p) => live && setPaths(p), () => {});
    return () => {
      live = false;
    };
  }, [id]);

  if (!paths) {
    return (
      <span className={`${styles.fallback} ${className ?? ''}`} aria-label={kanji}>
        {kanji}
      </span>
    );
  }
  const step = total ? Math.min(speed, total / paths.length) : speed;
  return (
    <svg key={replay} className={`${styles.svg} ${className ?? ''}`} viewBox="0 0 109 109" role="img" aria-label={kanji}>
      {/* Faint full kanji underneath, so it reads before the drawing finishes. */}
      {animate && (
        <g className={styles.ghost}>
          {paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      )}
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          pathLength={1}
          className={animate ? styles.draw : undefined}
          style={animate ? { animationDelay: `${i * step}s`, animationDuration: `${step * 1.3}s` } : undefined}
        />
      ))}
    </svg>
  );
}
