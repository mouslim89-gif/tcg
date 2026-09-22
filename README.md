# Kanjigacha

A browser trading card game where **every kanji is a card**, in the spirit of Wikigacha.
Open packs, collect 6,418 kanji and battle an AI by placing cards side by side to spell real Japanese words.

- **Rarity** comes from real usage (KANJIDIC2): frequent jōyō → Common, rest of jōyō → Uncommon/Rare, jinmeiyō and
  non-jōyō with ≥ 5 words → Epic, obscure kanji → Legendary.
- **ATK** = number of JMdict words containing the kanji (log₂ scale, 1–10). **DEF** = stroke count ÷ 3 (1–10).
- **Type** = Kangxi radical mapped to 12 types (Water, Fire, Wood, Metal, Earth, Sky, Human, Spirit, Voice, Beast,
  Body, Path). Wu Xing cycles for the elements, a 7-step wheel for the rest.
- **Combos**: adjacent cards spelling a JMdict word (left → right) deal bonus damage; read the word correctly for ×1.5.
- Stroke-order animation from KanjiVG. Static front-end, progress saved in `localStorage`.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # game logic + data sanity + AI-vs-AI simulation
npm run build      # static site in dist/ (relative base, works on GitHub Pages)
```

## Data pipeline

The generated data is committed in `public/data/`, so the app builds without the raw sources.
To regenerate it:

```sh
npm run data:fetch   # KANJIDIC2 + JMdict_e from EDRDG, KanjiVG via git → data/raw/
npm run data:build   # → public/data/{cards.json, words.txt, meta.json, strokes/*.json}
```

`data:build` prints the rarity/type/ATK/DEF distributions. Balance knobs live in `scripts/data/balance.ts`,
the radical → type table in `scripts/data/radical-types.ts`.

If `ftp.edrdg.org` is unreachable, `scripts/data/fallback_jamdict.py` rebuilds the two EDRDG XML files from the
`jamdict-data` PyPI package (an older, 2021 snapshot of the same data). The committed data was built this way;
rerun the pipeline with direct EDRDG access to refresh it.

| File | Content |
| --- | --- |
| `cards.json` | 6,418 cards (KANJIDIC2 ∩ KanjiVG) |
| `words.txt` | 103,510 combo words, TSV: `word`, `readings`, `gloss`, `common` |
| `strokes/<hex>.json` | KanjiVG stroke paths, loaded on demand |

## Layout

```
scripts/data/   preprocessing (streaming XML parsers, balance, radical types)
src/game/       pure TS game logic: packs, combos, reading quiz, battle engine, AI, decks
src/data/       static data loaders
src/store/      zustand + persist save (localStorage)
src/components/ Card, KanjiStroke, battle board
src/pages/      Home, Packs, Collection, CardDetail, Battle, Credits
tests/          vitest
```

## Licences

- Code: MIT (`LICENSE`).
- Data in `public/data/` is derived from JMdict and KANJIDIC2 (© EDRDG, CC BY-SA 4.0) and KanjiVG
  (© Ulrich Apel, CC BY-SA 3.0) and is distributed under CC BY-SA 4.0. See `DATA_LICENSE.md` and the in-app
  Credits page.
