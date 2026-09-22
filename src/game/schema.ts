// Shared data contract between the preprocessing scripts and the app.

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export const TYPES = [
  'water', 'fire', 'wood', 'metal', 'earth', 'sky',
  'human', 'spirit', 'voice', 'beast', 'body', 'path',
] as const;
export type TypeId = (typeof TYPES)[number];

export interface Card {
  /** Lowercase hex codepoint, zero-padded to 5 digits: same key as KanjiVG ("065e5"). */
  id: string;
  kanji: string;
  rarity: Rarity;
  type: TypeId;
  /** Kangxi (classical) radical number, 1–214. */
  radical: number;
  atk: number;
  def: number;
  /** JMdict entries whose kanji spelling contains this character. */
  words: number;
  strokes: number;
  /** KANJIDIC newspaper frequency rank (1 = most frequent), null when outside the top 2,500. */
  freq: number | null;
  /** 1–6 kyōiku, 8 remaining jōyō, 9–10 jinmeiyō. */
  grade: number | null;
  jlpt: number | null;
  meanings: string[];
  on: string[];
  kun: string[];
}

/** A JMdict word made only of card kanji: the combo dictionary. */
export interface Word {
  w: string;
  /** Accepted readings (hiragana/katakana as in JMdict). */
  r: string[];
  /** First English gloss. */
  g: string;
  /** Has a JMdict priority tag (news1, ichi1, spec1, gai1). */
  c: boolean;
}

export interface Meta {
  generatedAt: string;
  cardCount: number;
  wordCount: number;
  sources: { name: string; version: string }[];
}

export const isJoyo = (c: Pick<Card, 'grade'>) => c.grade !== null && c.grade <= 8;

/** Stroke data file holding a card: `strokes/<shard>.json`. */
export const strokeShard = (id: string) => id.slice(0, 3);
