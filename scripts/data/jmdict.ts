import { all, first, records, text } from './xml';

export interface JmdictEntry {
  /** Kanji spellings, minus search-only / irregular ones. */
  kanji: { keb: string; common: boolean }[];
  /** Kana readings and the spellings they apply to (empty = all). */
  readings: { reb: string; restr: string[]; nokanji: boolean }[];
  gloss: string | null;
}

const COMMON = new Set(['news1', 'ichi1', 'spec1', 'spec2', 'gai1']);
// ke_inf values that mark a spelling nobody should be rewarded for.
const SKIP_INF = /&(iK|oK|sK|rK);/;

function split(lines: string[], tag: string): string[][] {
  const groups: string[][] = [];
  let cur: string[] | null = null;
  for (const l of lines) {
    if (l === `<${tag}>`) cur = [];
    else if (l === `</${tag}>`) {
      if (cur) groups.push(cur);
      cur = null;
    } else if (cur) cur.push(l);
  }
  return groups;
}

export async function* readJmdict(path: string): AsyncGenerator<JmdictEntry> {
  for await (const lines of records(path, 'entry')) {
    const kanji = split(lines, 'k_ele')
      .filter((k) => !k.some((l) => text(l, 'ke_inf') !== null && SKIP_INF.test(l)))
      .map((k) => ({
        keb: first(k, 'keb') ?? '',
        common: all(k, 'ke_pri').some((p) => COMMON.has(p)),
      }))
      .filter((k) => k.keb);
    const readings = split(lines, 'r_ele').map((r) => ({
      reb: first(r, 'reb') ?? '',
      restr: all(r, 're_restr'),
      nokanji: r.some((l) => l.startsWith('<re_nokanji')),
    }));
    let gloss: string | null = null;
    for (const l of lines) {
      const m = l.match(/^<gloss(\s[^>]*)?>(.*)<\/gloss>$/);
      if (m && !/xml:lang="(?!eng)/.test(m[1] ?? '')) {
        gloss = text(l, 'gloss');
        break;
      }
    }
    yield { kanji, readings, gloss };
  }
}
