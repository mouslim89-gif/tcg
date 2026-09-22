import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

// KANJIDIC2 and JMdict put one element per line, so a line-based streaming
// reader is enough (and sidesteps JMdict's custom DTD entities like `&n;`).

/** Yields the lines of each <tag>…</tag> record of a gzipped XML file. */
export async function* records(path: string, tag: string): AsyncGenerator<string[]> {
  const input = createReadStream(path).pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Infinity });
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  let buf: string[] | null = null;
  for await (const raw of lines) {
    const line = raw.trim();
    if (line === open) buf = [];
    else if (line === close) {
      if (buf) yield buf;
      buf = null;
    } else if (buf) buf.push(line);
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export const decode = (s: string) => s.replace(/&(\w+);/g, (m, e) => ENTITIES[e] ?? m);

/** Text of a single-line element, or null. `attrs` must match the attribute string when given. */
export function text(line: string, tag: string, attrs?: string): string | null {
  const m = line.match(new RegExp(`^<${tag}(\\s[^>]*)?>(.*)</${tag}>$`));
  if (!m) return null;
  if (attrs !== undefined && (m[1] ?? '').trim() !== attrs) return null;
  return decode(m[2]);
}

export function all(lines: string[], tag: string, attrs?: string): string[] {
  const out: string[] = [];
  for (const l of lines) {
    const t = text(l, tag, attrs);
    if (t !== null) out.push(t);
  }
  return out;
}

export const first = (lines: string[], tag: string, attrs?: string) => {
  for (const l of lines) {
    const t = text(l, tag, attrs);
    if (t !== null) return t;
  }
  return null;
};
