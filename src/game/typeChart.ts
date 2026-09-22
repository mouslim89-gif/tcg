import type { TypeId } from './schema';

// Five elements (Wu Xing) for water/fire/wood/metal/earth, and a seven-step
// wheel for the others. Elements and non-elements are neutral to each other.

/** Overcoming cycle: key beats value. */
const BEATS: Partial<Record<TypeId, TypeId>> = {
  wood: 'earth', // roots split the earth
  earth: 'water', // dams hold the water
  water: 'fire', // water quenches fire
  fire: 'metal', // fire melts metal
  metal: 'wood', // the axe fells the tree
  voice: 'spirit', // incantations bind spirits
  spirit: 'human', // spirits haunt people
  human: 'beast', // people tame beasts
  beast: 'body', // fang over flesh
  body: 'path', // feet master the road
  path: 'sky', // roads reach the horizon
  sky: 'voice', // thunder drowns voices
};

/** Generating cycle: key feeds value. Adjacent allies in this relation resonate. */
const FEEDS: Partial<Record<TypeId, TypeId>> = {
  wood: 'fire',
  fire: 'earth',
  earth: 'metal',
  metal: 'water',
  water: 'wood',
};

export const ADVANTAGE = 1.5;
export const DISADVANTAGE = 0.75;
export const RESONANCE_BONUS = 1;

export function typeMultiplier(attacker: TypeId, defender: TypeId): number {
  if (BEATS[attacker] === defender) return ADVANTAGE;
  if (BEATS[defender] === attacker) return DISADVANTAGE;
  return 1;
}

export const resonates = (a: TypeId, b: TypeId) => FEEDS[a] === b || FEEDS[b] === a;

export const beats = (t: TypeId) => BEATS[t];
export const beatenBy = (t: TypeId) =>
  (Object.keys(BEATS) as TypeId[]).find((k) => BEATS[k] === t);
export const feeds = (t: TypeId) => FEEDS[t];
export const fedBy = (t: TypeId) => (Object.keys(FEEDS) as TypeId[]).find((k) => FEEDS[k] === t);
