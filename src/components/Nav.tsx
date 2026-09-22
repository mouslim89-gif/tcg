import { NavLink } from 'react-router-dom';
import { useSave } from '../store/save';
import styles from './Nav.module.css';

const LINKS = [
  { to: '/', label: 'Home', glyph: '家', end: true },
  { to: '/packs', label: 'Packs', glyph: '札' },
  { to: '/collection', label: 'Collection', glyph: '集' },
  { to: '/battle', label: 'Battle', glyph: '戦' },
];

export function Nav() {
  const packs = useSave((s) => s.packs);
  return (
    <nav className={styles.nav} aria-label="Main">
      <NavLink to="/" className={styles.brand}>
        <span className={`${styles.seal} jp`}>漢</span>
        <span>Kanjigacha</span>
      </NavLink>
      <div className={styles.links}>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
            <span className={`${styles.glyph} jp`} aria-hidden>
              {l.glyph}
            </span>
            <span>{l.label}</span>
            {l.to === '/packs' && packs > 0 && <span className={styles.badge}>{packs}</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
