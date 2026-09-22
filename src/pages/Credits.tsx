import { loadMeta } from '../data/loaders';
import { useAsync } from '../data/useAsync';
import styles from './Credits.module.css';

export function Credits() {
  const { data: meta } = useAsync(loadMeta);
  const version = (name: string) => meta?.sources.find((s) => s.name === name)?.version;

  return (
    <main className={`page ${styles.page}`}>
      <p className="eyebrow">Attribution</p>
      <h1>Data sources &amp; credits</h1>
      <p className={styles.lede}>
        Kanjigacha is built entirely on open dictionary data. Every card, word and stroke comes from the projects
        below. Thank you to their authors and contributors.
      </p>

      <section>
        <h2>JMdict &amp; KANJIDIC2</h2>
        <p>
          This site uses the{' '}
          <a href="https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project">JMdict</a> and{' '}
          <a href="https://www.edrdg.org/wiki/index.php/KANJIDIC_Project">KANJIDIC2</a> dictionary files. These files
          are the property of the{' '}
          <a href="https://www.edrdg.org/">Electronic Dictionary Research and Development Group</a>, and are used in
          conformance with the Group’s <a href="https://www.edrdg.org/edrdg/licence.html">licence</a>.
        </p>
        <p className="muted">
          Licensed under{' '}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">Creative Commons Attribution-ShareAlike 4.0</a>.
          KANJIDIC2 provides readings, meanings, stroke counts, radicals, school grades and frequency ranks (card
          rarity, DEF and type). JMdict provides the word list (card ATK and combos).
          {version('KANJIDIC2') && <> Version used: KANJIDIC2 {version('KANJIDIC2')}; JMdict {version('JMdict')}.</>}
        </p>
      </section>

      <section>
        <h2>KanjiVG</h2>
        <p>
          Stroke-order drawings come from <a href="https://kanjivg.tagaini.net/">KanjiVG</a>, copyright © Ulrich
          Apel and contributors, licensed under{' '}
          <a href="https://creativecommons.org/licenses/by-sa/3.0/">Creative Commons Attribution-ShareAlike 3.0</a>.
        </p>
        {version('KanjiVG') && <p className="muted">Snapshot: {version('KanjiVG')}.</p>}
      </section>

      <section>
        <h2>Derived data licence</h2>
        <p>
          The card data this site serves (<code>cards.json</code>, <code>words.txt</code>, <code>strokes/</code>) is
          derived from the works above. It was reduced, reformatted and combined, and card statistics were computed
          from it. As required by the ShareAlike terms, these derived files are distributed under{' '}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. The application source code
          is under the MIT licence.
        </p>
      </section>

      <section>
        <h2>Fonts &amp; inspiration</h2>
        <p className="muted">
          Typefaces: Zen Old Mincho, Noto Serif JP, Fraunces and Inter, served by Google Fonts under the SIL Open
          Font License. Concept inspired by Wikigacha, where every Wikipedia article is a card.
        </p>
      </section>

      {meta && (
        <p className={styles.build}>
          Data built {meta.generatedAt} · {meta.cardCount.toLocaleString('en')} cards ·{' '}
          {meta.wordCount.toLocaleString('en')} combo words
        </p>
      )}
    </main>
  );
}
