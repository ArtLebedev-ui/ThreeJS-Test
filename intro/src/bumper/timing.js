// Bumper timeline in seconds, shared by the renderer and the sound design.
export const BUMPER = {
  fps: 30,
  duration: 6,
  fadeIn: [0, 0.35],
  letters: { start: 0.2, stagger: 0.075, dur: 0.85 },
  brackets: [1.45, 2.35],
  reels: { start: 1.35, land: 3.0, stagger: 0.16, turns: 1 },
  pullBack: [2.15, 3.25],
  sweep: [3.05, 4.55],
  exit: { start: 4.6, stagger: 0.07, dur: 0.7 },
  fadeOut: [5.25, 5.7],
};
