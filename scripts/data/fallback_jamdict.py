#!/usr/bin/env python3
"""Fallback source: rebuild minimal EDRDG-format XML from the `jamdict-data` package.

Use this only when ftp.edrdg.org is unreachable (e.g. restricted CI sandboxes).
`jamdict-data` (PyPI) ships JMdict + KANJIDIC2 as an SQLite database. This script
re-emits the subset of fields the build pipeline reads, in the official XML
layout, so `npm run data:build` has a single code path.

    pip download jamdict-data==1.5 --no-deps   # or fetch the sdist from PyPI
    tar xzf jamdict_data-1.5.tar.gz && xz -d jamdict_data-1.5/jamdict_data/jamdict.db.xz
    mv jamdict_data-1.5/jamdict_data/jamdict.db data/raw/
    python3 scripts/data/fallback_jamdict.py

The data is the same EDRDG material (CC BY-SA 4.0), just an older snapshot.
"""
import gzip
import os
import sqlite3
import sys
from collections import defaultdict
from xml.sax.saxutils import escape

RAW = os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw")
DB = os.path.join(RAW, "jamdict.db")


def group(rows):
    out = defaultdict(list)
    for key, *rest in rows:
        out[key].append(rest[0] if len(rest) == 1 else tuple(rest))
    return out


def write_kanjidic(c):
    radicals = dict(c.execute("select cid, value from radical where rad_type='classical'"))
    readings = group(c.execute(
        "select g.cid, r.r_type, r.value from reading r join rm_group g on g.ID = r.gid "
        "where r.r_type in ('ja_on','ja_kun') order by g.ID"))
    meanings = group(c.execute(
        "select g.cid, m.value from meaning m join rm_group g on g.ID = m.gid "
        "where m.m_lang = '' order by g.ID"))
    path = os.path.join(RAW, "kanjidic2.xml.gz")
    with gzip.open(path, "wt", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<kanjidic2>\n')
        f.write("<header>\n<file_version>4</file_version>\n"
                "<database_version>jamdict-data 1.5</database_version>\n"
                "<date_of_creation>2021-04-17</date_of_creation>\n</header>\n")
        for cid, literal, strokes, grade, freq, jlpt in c.execute(
                "select ID, literal, stroke_count, grade, freq, jlpt from character order by ID"):
            f.write(f"<character>\n<literal>{escape(literal)}</literal>\n<radical>\n")
            if cid in radicals:
                f.write(f'<rad_value rad_type="classical">{radicals[cid]}</rad_value>\n')
            f.write("</radical>\n<misc>\n")
            if grade:
                f.write(f"<grade>{grade}</grade>\n")
            f.write(f"<stroke_count>{strokes}</stroke_count>\n")
            if freq:
                f.write(f"<freq>{freq}</freq>\n")
            if jlpt:
                f.write(f"<jlpt>{jlpt}</jlpt>\n")
            f.write("</misc>\n<reading_meaning>\n<rmgroup>\n")
            for r_type, value in readings.get(cid, []):
                f.write(f'<reading r_type="{r_type}">{escape(value)}</reading>\n')
            for value in meanings.get(cid, []):
                f.write(f"<meaning>{escape(value)}</meaning>\n")
            f.write("</rmgroup>\n</reading_meaning>\n</character>\n")
        f.write("</kanjidic2>\n")
    print("wrote", path)


def write_jmdict(c):
    kanji = group(c.execute("select idseq, ID, text from Kanji order by ID"))
    kana = group(c.execute("select idseq, ID, text from Kana order by ID"))
    kpri = group(c.execute("select kid, text from KJP"))
    rpri = group(c.execute("select kid, text from KNP"))
    restr = group(c.execute("select kid, text from KNR"))
    senses = group(c.execute("select idseq, ID from Sense order by ID"))
    gloss = group(c.execute("select sid, text from SenseGloss where lang = 'eng'"))
    path = os.path.join(RAW, "JMdict_e.gz")
    with gzip.open(path, "wt", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<JMdict>\n')
        for (idseq,) in c.execute("select idseq from Entry order by idseq"):
            f.write(f"<entry>\n<ent_seq>{idseq}</ent_seq>\n")
            for kid, text in kanji.get(idseq, []):
                f.write(f"<k_ele>\n<keb>{escape(text)}</keb>\n")
                for p in kpri.get(kid, []):
                    f.write(f"<ke_pri>{p}</ke_pri>\n")
                f.write("</k_ele>\n")
            for kid, text in kana.get(idseq, []):
                f.write(f"<r_ele>\n<reb>{escape(text)}</reb>\n")
                for r in restr.get(kid, []):
                    f.write(f"<re_restr>{escape(r)}</re_restr>\n")
                for p in rpri.get(kid, []):
                    f.write(f"<re_pri>{p}</re_pri>\n")
                f.write("</r_ele>\n")
            for sid in senses.get(idseq, []):
                f.write("<sense>\n")
                for g in gloss.get(sid, []):
                    f.write(f"<gloss>{escape(g)}</gloss>\n")
                f.write("</sense>\n")
            f.write("</entry>\n")
        f.write("</JMdict>\n")
    print("wrote", path)


if __name__ == "__main__":
    if not os.path.exists(DB):
        sys.exit(f"missing {DB} (see docstring)")
    conn = sqlite3.connect(DB)
    write_kanjidic(conn)
    write_jmdict(conn)
