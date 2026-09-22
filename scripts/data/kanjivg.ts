import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Stroke paths (in stroke order) for every base KanjiVG file, keyed by 5-digit hex id. */
export async function readKanjivg(dir: string): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const files = (await readdir(dir)).filter((f) => /^[0-9a-f]{5}\.svg$/.test(f));
  await Promise.all(
    files.map(async (f) => {
      const id = f.slice(0, 5);
      const svg = await readFile(join(dir, f), 'utf8');
      const strokes: [number, string][] = [];
      for (const m of svg.matchAll(/<path\s[^>]*id="kvg:[0-9a-f]+-s(\d+)"[^>]*\sd="([^"]+)"/g)) {
        strokes.push([Number(m[1]), m[2]]);
      }
      if (strokes.length) out.set(id, strokes.sort((a, b) => a[0] - b[0]).map(([, d]) => d));
    }),
  );
  return out;
}

export const kvgId = (ch: string) => ch.codePointAt(0)!.toString(16).padStart(5, '0');
