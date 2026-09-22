import { createWriteStream, existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';

// Downloads the raw sources into data/raw (gitignored).
//   KANJIDIC2 + JMdict (English): EDRDG, CC BY-SA 4.0
//   KanjiVG: git repository (one SVG per kanji), CC BY-SA 3.0

const RAW = 'data/raw';
const EDRDG = [
  ['kanjidic2.xml.gz', 'http://ftp.edrdg.org/pub/Nihongo/kanjidic2.xml.gz'],
  ['JMdict_e.gz', 'http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz'],
] as const;
const KANJIVG_REPO = 'https://github.com/KanjiVG/kanjivg.git';

async function download(file: string, url: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(join(RAW, file)));
}

async function main() {
  await mkdir(RAW, { recursive: true });
  let failed = false;
  for (const [file, url] of EDRDG) {
    process.stdout.write(`${file} ← ${url} … `);
    try {
      await download(file, url);
      console.log('ok');
    } catch (e) {
      failed = true;
      console.log(`FAILED (${(e as Error).message})`);
    }
  }

  const kvg = join(RAW, 'kanjivg');
  if (existsSync(kvg)) {
    console.log('kanjivg: pulling');
    execSync('git pull --ff-only', { cwd: kvg, stdio: 'inherit' });
  } else {
    console.log('kanjivg: cloning');
    execSync(`git clone --depth 1 ${KANJIVG_REPO} ${kvg}`, { stdio: 'inherit' });
  }

  if (failed) {
    console.log(
      '\nEDRDG download failed. If ftp.edrdg.org is unreachable from this machine, use the\n' +
        'jamdict-data fallback described in scripts/data/fallback_jamdict.py.',
    );
    process.exit(1);
  }
}

main();
