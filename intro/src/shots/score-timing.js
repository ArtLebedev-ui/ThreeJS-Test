// Shared with the soundtrack.
export const SCORE = {
  open: [0.15, 0.8],
  rise: 0.3,
  close: [1.85, 2.35],
  sink: [1.95, 2.45],
  roll: 2.42,
  rollDur: 0.95,
  rollStagger: 0.13,
  dot: 3.05,
};
export const rollEnd = (k) => SCORE.roll + k * SCORE.rollStagger + SCORE.rollDur;
