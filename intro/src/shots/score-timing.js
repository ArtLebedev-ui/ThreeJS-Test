import { ease, range } from '../lib/anim.js';

// Shared by the drum animation and the soundtrack (ticks + landing clunks).
export const SCORE_LANDS = [2.1, 2.45, 2.8];
export const SCORE_SPIN_START = 0.55;

/** Drum rotation (radians) at shot-local time lt, for the drum showing `digit` at position idx. */
export function drumAngle(lt, digit, idx) {
  const land = SCORE_LANDS[idx];
  const target = (digit / 10) * Math.PI * 2 + Math.PI * 2 * (4 + idx * 2);
  const p = range(lt, SCORE_SPIN_START, land);
  const settle = p >= 1 ? Math.sin((lt - land) * 26) * Math.exp(-(lt - land) * 9) * 0.06 : 0;
  return target * ease.outQuart(p) + settle;
}
