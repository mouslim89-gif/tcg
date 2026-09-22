import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadCards } from '../data/loaders';
import { useAsync } from '../data/useAsync';
import { RARITIES, TYPES, type Card, type Rarity, type TypeId } from '../game/schema';
import { RARITY_INFO, TYPE_INFO } from '../game/labels';
import { toHiragana } from '../game/reading';
import { CardView } from '../components/CardView';
import { useSave } from '../store/save';
import styles from './Collection.module.css';

const SORTS = {
  newest: { label: 'Newest', fn: (_a: Card, _b: Card) => 0 },
  rarity: { label: 'Rarity', fn: (a: Card, b: Card) => RARITY_INFO[b.rarity].rank - RARITY_INFO[a.rarity].rank },
  atk: { label: 'ATK', fn: (a: Card, b: Card) => b.atk - a.atk || b.words - a.words },
  def: { label: 'DEF', fn: (a: Card, b: Card) => b.def - a.def || b.strokes - a.strokes },
  frequency: { label: 'Frequency', fn: (a: Card, b: Card) => (a.freq ?? 1e5) - (b.freq ?? 1e5) },
  codepoint: { label: 'Unicode', fn: (a: Card, b: Card) => a.id.localeCompare(b.id) },
} as const;
type SortKey = keyof typeof SORTS;

export function Collection() {
  const { data: db } = useAsync(loadCards);
  const collection = useSave((s) => s.collection);
  const obtainedAt = useSave((s) => s.obtainedAt);
  const seen = useSave((s) => s.seen);
  const navigate = useNavigate();

  const [sort, setSort] = useState<SortKey>('newest');
  const [types, setTypes] = useState<Set<TypeId>>(new Set());
  const [rarities, setRarities] = useState<Set<Rarity>>(new Set());
  const [query, setQuery] = useState('');

  const owned = useMemo(
    () => (db ? Object.keys(collection).map((id) => db.byId.get(id)).filter((c): c is Card => !!c) : []),
    [db, collection],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qk = toHiragana(q);
    const list = owned.filter(
      (c) =>
        (!types.size || types.has(c.type)) &&
        (!rarities.size || rarities.has(c.rarity)) &&
        (!q ||
          c.kanji === q ||
          c.meanings.some((m) => m.toLowerCase().includes(q)) ||
          [...c.on, ...c.kun].some((r) => toHiragana(r.replace(/[.-]/g, '')).startsWith(qk))),
    );
    if (sort === 'newest') return list.sort((a, b) => (obtainedAt[b.id] ?? 0) - (obtainedAt[a.id] ?? 0) || a.id.localeCompare(b.id));
    return list.sort((a, b) => SORTS[sort].fn(a, b) || a.id.localeCompare(b.id));
  }, [owned, types, rarities, query, sort, obtainedAt]);

  const toggle = <T,>(set: Set<T>, v: T, update: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    update(next);
  };

  const copies = Object.values(collection).reduce((a, b) => a + b, 0);
  const seenSet = new Set(seen);

  return (
    <main className="page">
      <header className={styles.head}>
        <div>
          <p className="eyebrow">Collection</p>
          <h1>
            {owned.length.toLocaleString('en')}
            <span className="muted"> / {db?.cards.length.toLocaleString('en') ?? '…'}</span>
          </h1>
        </div>
        <p className="muted">
          {copies} cards · <Link to="/deck">Edit deck</Link>
        </p>
      </header>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          placeholder="Search meaning, reading or kanji"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search"
        />
        <label className={styles.sort}>
          <span className="eyebrow">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.chips} role="group" aria-label="Filter by rarity">
        {RARITIES.map((r) => (
          <button
            key={r}
            className="chip"
            aria-pressed={rarities.has(r)}
            onClick={() => toggle(rarities, r, setRarities)}
          >
            <span className={styles.dot} style={{ background: `var(--rarity-${r})` }} />
            {RARITY_INFO[r].name}
          </button>
        ))}
      </div>
      <div className={styles.chips} role="group" aria-label="Filter by type">
        {TYPES.map((t) => (
          <button key={t} className="chip" aria-pressed={types.has(t)} onClick={() => toggle(types, t, setTypes)}>
            <span className={`${styles.typeDot} jp`} style={{ background: `var(--t-${t})` }}>
              {TYPE_INFO[t].glyph}
            </span>
            {TYPE_INFO[t].name}
          </button>
        ))}
      </div>

      {db && owned.length === 0 && (
        <div className={styles.empty}>
          <p className="jp">空</p>
          <p>Your collection is empty.</p>
          <Link className="btn seal" to="/packs">
            Open your first pack
          </Link>
        </div>
      )}
      {owned.length > 0 && shown.length === 0 && <p className="muted">No card matches these filters.</p>}

      <ul className={styles.grid}>
        {shown.map((c) => (
          <li key={c.id}>
            <CardView
              card={c}
              compact
              count={collection[c.id]}
              isNew={!seenSet.has(c.id)}
              onClick={() => navigate(`/card/${c.id}`)}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
