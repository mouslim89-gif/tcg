import { useEffect, useMemo, useRef, useState } from 'react';
import { PACK_SIZE } from '../game/packs';
import styles from './PackTear.module.css';

interface Props {
  disabled?: boolean;
  /** Called once the pack is torn and the cards have slid out. */
  onDone: () => void;
}

/** Tear line position and tooth depth, in % of the pack width (cqw). */
const LINE = 18;
const TEETH = 22;
const DEPTH = 3.2;
/** Horizontal travel (fraction of the width) needed to tear all the way. */
const TRAVEL = 0.72;
/** Release past this point and the tear finishes by itself. */
const COMMIT = 0.55;
const EXIT_MS = 950;

/** A foil pack you open by swiping across its perforated top. */
export function PackTear({ disabled, onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [torn, setTorn] = useState(false);
  const [nudge, setNudge] = useState(0);
  const drag = useRef<{ x: number; base: number; dir: 1 | -1 | null; moved: boolean } | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const raf = useRef(0);

  // One jagged line shared by the strip's lower edge and the body's upper edge.
  const teeth = useMemo(
    () =>
      Array.from({ length: TEETH + 1 }, (_, i) => ({
        x: (100 * i) / TEETH,
        y: (i % 2 ? DEPTH : 0) + ((i * 37) % 7) / 10,
      })),
    [],
  );
  const bodyClip = `polygon(${teeth.map((t) => `${t.x}% ${t.y}cqw`).join(', ')}, 100% 100%, 0% 100%)`;
  const stripClip = `polygon(0% 0%, 100% 0%, ${[...teeth]
    .reverse()
    .map((t) => `${t.x}% ${LINE + t.y}cqw`)
    .join(', ')})`;
  const edgePoints = teeth.map((t) => `${t.x},${t.y}`).join(' ');

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const finish = (from: number) => {
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, from + (1 - from) * ((now - t0) / 160));
      setProgress(p);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else {
        setTorn(true);
        try {
          navigator.vibrate?.(12);
        } catch {
          /* not available */
        }
        setTimeout(() => done.current(), EXIT_MS);
      }
    };
    raf.current = requestAnimationFrame(step);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || torn) return;
    const r = e.currentTarget.getBoundingClientRect();
    // The tear has to start on the strip above the perforation (with a little slack).
    if (e.clientY - r.top > r.width * ((LINE + 14) / 100)) {
      setNudge((n) => n + 1);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, base: progress, dir: progress > 0 ? dir : null, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || torn) return;
    const dx = e.clientX - d.x;
    if (!d.dir) {
      if (Math.abs(dx) < 6) return;
      d.dir = dx > 0 ? 1 : -1;
      setDir(d.dir);
    }
    d.moved = true;
    const width = e.currentTarget.getBoundingClientRect().width;
    const p = Math.min(1, Math.max(progress, d.base + (dx * d.dir) / (width * TRAVEL)));
    if (p >= 1) {
      drag.current = null;
      finish(p);
    } else setProgress(p);
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || torn) return;
    if (!d.moved) setNudge((n) => n + 1);
    else if (progress >= COMMIT) finish(progress);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || torn || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    setDir(1);
    finish(progress);
  };

  const tilt = progress * 9 * -dir;
  const reveal = dir === 1 ? `inset(0 ${100 - progress * 100}% 0 0)` : `inset(0 0 0 ${100 - progress * 100}%)`;

  return (
    <div className={styles.wrap}>
      <div
        key={nudge}
        className={`${styles.pack} ${disabled ? styles.disabled : ''} ${torn ? styles.torn : ''} ${nudge ? styles.nudge : ''}`}
        style={{ '--dir': dir } as React.CSSProperties}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="Tear open the pack"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <div className={styles.stack} aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ '--k': i } as React.CSSProperties} />
          ))}
        </div>

        <div className={styles.body} style={{ clipPath: bodyClip }}>
          <PackSkin offset={-LINE} />
          <svg className={styles.edge} viewBox={`0 0 100 ${DEPTH + 1}`} preserveAspectRatio="none" style={{ clipPath: reveal }}>
            <polyline points={edgePoints} />
          </svg>
        </div>

        <div
          className={styles.strip}
          style={{
            clipPath: stripClip,
            transformOrigin: dir === 1 ? '100% 100%' : '0% 100%',
            // Kept while torn: the fly-off animation starts from wherever the tear left it.
            transform: `translateY(${-progress * 2}cqw) rotate(${tilt}deg)`,
          }}
        >
          <PackSkin offset={0} />
          <svg
            className={styles.edge}
            style={{ top: `${LINE}cqw`, clipPath: reveal }}
            viewBox={`0 0 100 ${DEPTH + 1}`}
            preserveAspectRatio="none"
          >
            <polyline points={edgePoints} />
          </svg>
        </div>

        {progress === 0 && !disabled && (
          <span className={styles.finger} aria-hidden style={{ top: `${LINE - 3}cqw` }} />
        )}
      </div>
      <p className={styles.help}>
        {disabled ? 'No packs left' : torn ? ' ' : 'Swipe across the top to tear it open'}
      </p>
    </div>
  );
}

/** The printed wrapper, drawn once at full pack size and shifted into each piece. */
function PackSkin({ offset }: { offset: number }) {
  return (
    <div className={styles.skin} style={{ top: `${offset}cqw` }}>
      <span className={styles.crimpTop} />
      <span className={styles.perf} style={{ top: `${LINE + 1.2}cqw` }}>
        <span className="jp">切り取り線</span>
      </span>
      <span className={`${styles.seal} jp`}>漢</span>
      <span className={styles.name}>Kanjigacha</span>
      <span className={styles.sub}>{PACK_SIZE} cards · booster</span>
      <span className={styles.crimpBottom} />
    </div>
  );
}
