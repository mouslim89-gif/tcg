import { all, first, records } from './xml';

export interface KanjidicEntry {
  literal: string;
  radical: number;
  grade: number | null;
  strokes: number;
  freq: number | null;
  jlpt: number | null;
  on: string[];
  kun: string[];
  meanings: string[];
}

const int = (s: string | null) => (s === null ? null : Number.parseInt(s, 10));

export async function readKanjidic(path: string) {
  const out = new Map<string, KanjidicEntry>();
  let version = 'unknown';
  for await (const lines of records(path, 'header')) {
    version = `${first(lines, 'database_version') ?? '?'} (${first(lines, 'date_of_creation') ?? '?'})`;
  }
  for await (const lines of records(path, 'character')) {
    const literal = first(lines, 'literal');
    const radical = int(first(lines, 'rad_value', 'rad_type="classical"'));
    const strokes = int(first(lines, 'stroke_count'));
    if (!literal || radical === null || strokes === null) continue;
    out.set(literal, {
      literal,
      radical,
      strokes,
      grade: int(first(lines, 'grade')),
      freq: int(first(lines, 'freq')),
      jlpt: int(first(lines, 'jlpt')),
      on: all(lines, 'reading', 'r_type="ja_on"'),
      kun: all(lines, 'reading', 'r_type="ja_kun"'),
      // English meanings carry no m_lang attribute.
      meanings: all(lines, 'meaning', ''),
    });
  }
  return { entries: out, version };
}
