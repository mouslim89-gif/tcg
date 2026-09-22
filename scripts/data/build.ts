import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { RARITIES, TYPES, type Card, type Meta, type Word } from '../../src/game/schema';
import { encodeWords } from '../../src/game/words';
import { atkFromWords, defFromStrokes, rarityOf } from './balance';
import { readJmdict } from './jmdict';
import { readKanjidic } from './kanjidic';
import { kvgId, readKanjivg } from './kanjivg';
import { RADICAL_TYPE } from './radical-types';

const RAW = 'data/raw';
const OUT = 'public/data';
const MAX_WORD_LEN = 4;
const MAX_GLOSS = 40;

async function main() {
  const t0 = Date.now();
  const kanjidic = await readKanjidic(join(RAW, 'kanjidic2.xml.gz'));
  const strokes = await readKanjivg(join(RAW, 'kanjivg', 'kanji'));
  console.log(`KANJIDIC2: ${kanjidic.entries.size} kanji · KanjiVG: ${strokes.size} files`);

  // Card pool: kanji present in both KANJIDIC2 and KanjiVG.
  const pool = new Map([...kanjidic.entries].filter(([ch]) => strokes.has(kvgId(ch))));

  // One pass over JMdict: word counts per kanji + candidate combo words.
  const wordCount = new Map<string, number>();
  const words = new Map<string, Word>();
  let entries = 0;
  for await (const e of readJmdict(join(RAW, 'JMdict_e.gz'))) {
    entries++;
    const seen = new Set<string>();
    for (const { keb } of e.kanji) for (const ch of keb) if (pool.has(ch)) seen.add(ch);
    for (const ch of seen) wordCount.set(ch, (wordCount.get(ch) ?? 0) + 1);

    for (const { keb, common } of e.kanji) {
      const chars = [...keb];
      if (chars.length < 2 || chars.length > MAX_WORD_LEN || !chars.every((c) => pool.has(c))) continue;
      const r = e.readings
        .filter((x) => !x.nokanji && (x.restr.length === 0 || x.restr.includes(keb)))
        .map((x) => x.reb);
      if (!r.length) continue;
      const prev = words.get(keb);
      if (prev) {
        for (const x of r) if (!prev.r.includes(x)) prev.r.push(x);
        prev.c ||= common;
      } else {
        words.set(keb, { w: keb, r, g: truncate(e.gloss ?? '', MAX_GLOSS), c: common });
      }
    }
  }
  console.log(`JMdict: ${entries} entries · ${words.size} combo words`);

  const cards: Card[] = [...pool.values()].map((k) => {
    const n = wordCount.get(k.literal) ?? 0;
    return {
      id: kvgId(k.literal),
      kanji: k.literal,
      rarity: rarityOf({ grade: k.grade, freq: k.freq, words: n }),
      type: RADICAL_TYPE[k.radical],
      radical: k.radical,
      atk: atkFromWords(n),
      def: defFromStrokes(k.strokes),
      words: n,
      strokes: k.strokes,
      freq: k.freq,
      grade: k.grade,
      jlpt: k.jlpt,
      meanings: k.meanings.slice(0, 4),
      on: k.on.slice(0, 4),
      kun: k.kun.slice(0, 4),
    };
  });
  cards.sort((a, b) => a.id.localeCompare(b.id));

  // Output.
  await rm(join(OUT, 'strokes'), { recursive: true, force: true });
  await mkdir(join(OUT, 'strokes'), { recursive: true });
  await writeFile(join(OUT, 'cards.json'), JSON.stringify(cards));
  await rm(join(OUT, 'words.json'), { force: true });
  await writeFile(join(OUT, 'words.txt'), encodeWords([...words.values()]));
  await Promise.all(
    cards.map((c) => writeFile(join(OUT, 'strokes', `${c.id}.json`), JSON.stringify(strokes.get(c.id)))),
  );
  const meta: Meta = {
    generatedAt: new Date().toISOString().slice(0, 10),
    cardCount: cards.length,
    wordCount: words.size,
    sources: [
      { name: 'KANJIDIC2', version: kanjidic.version },
      { name: 'JMdict', version: `${entries} entries` },
      { name: 'KanjiVG', version: kanjivgVersion() },
    ],
  };
  await writeFile(join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));

  report(cards, words);
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

function kanjivgVersion() {
  const dir = join(RAW, 'kanjivg');
  if (!existsSync(join(dir, '.git'))) return 'unknown';
  return execSync('git log -1 --format=%cs', { cwd: dir }).toString().trim();
}

function report(cards: Card[], words: Map<string, Word>) {
  const count = <K extends string>(keys: readonly K[], f: (c: Card) => K) =>
    Object.fromEntries(keys.map((k) => [k, cards.filter((c) => f(c) === k).length]));
  const hist = (f: (c: Card) => number) =>
    Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, cards.filter((c) => f(c) === i + 1).length]));
  console.table(count(RARITIES, (c) => c.rarity));
  console.table(count(TYPES, (c) => c.type));
  console.log('ATK histogram', hist((c) => c.atk));
  console.log('DEF histogram', hist((c) => c.def));
  const byLen = [2, 3, 4].map((n) => [...words.values()].filter((w) => [...w.w].length === n).length);
  console.log(`words by length 2/3/4: ${byLen.join(' / ')} · common: ${[...words.values()].filter((w) => w.c).length}`);
  for (const r of RARITIES) {
    const sample = cards.filter((c) => c.rarity === r).slice(0, 12).map((c) => c.kanji).join('');
    console.log(`${r.padEnd(10)} e.g. ${sample}`);
  }
}

// Keep a tiny guard so a stale checkout gives a clear error.
for (const f of ['kanjidic2.xml.gz', 'JMdict_e.gz', 'kanjivg/kanji']) {
  if (!existsSync(join(RAW, f))) {
    console.error(`missing ${RAW}/${f}: run \`npm run data:fetch\` first`);
    process.exit(1);
  }
}
main();
