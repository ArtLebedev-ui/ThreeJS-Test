// Procedural sound for the rubric bumper, synced to src/bumper/timing.js.
// Usage: node scripts/bumper-sound.mjs [out/bumper-sound.wav] [number]
import { BUMPER as T } from '../src/bumper/timing.js';
import { ease, range } from '../src/lib/anim.js';
import { createMixer, SR, TAU } from './synth.mjs';

const number = String(Math.max(0, parseInt(process.argv[3] ?? '42', 10) || 0)).padStart(2, '0');
const { mix, svf, noise, impact, riser, whoosh, click, tick, pad, drone, ping, glide, master } = createMixer(T.duration);

const THETA = TAU / 10;
const L = T.letters;
const R = T.reels;
const E = T.exit;
const landT = R.land + (number.length - 1) * R.stagger;

drone(0, T.duration - 0.2, { gain: 0.14 });
riser(L.start + 0.05, 0.45, { gain: 0.22, f0: 200, f1: 3000 });

// Letters flip up one by one while the camera tracks along the word.
whoosh(0.05, 2.3, { gain: 0.22, f0: 250, f1: 1400, pan0: -0.7, pan1: 0.5 });
for (let i = 0; i < 9; i++) {
  const at = L.start + i * L.stagger + L.dur * 0.42;
  const pan = -0.6 + (i / 8) * 1.0;
  tick(at, { gain: 0.09, freq: 2000 + (i % 3) * 260, pan });
  click(at, { gain: 0.14, pan });
}
impact(L.start + 0.1, { size: 0.55, gain: 0.45, tone: 1.2 });

// Brackets swing in from both sides.
whoosh(T.brackets[0] - 0.05, 0.5, { gain: 0.3, f0: 900, f1: 5000, pan0: -0.9, pan1: -0.2 });
whoosh(T.brackets[0] + 0.03, 0.5, { gain: 0.3, f0: 900, f1: 5000, pan0: 0.9, pan1: 0.2 });
click(T.brackets[0] + 0.32, { gain: 0.25, pan: -0.35 });
click(T.brackets[0] + 0.4, { gain: 0.25, pan: 0.35 });

// Reels: one ratchet tick every time a digit passes the front, from the same curve the picture uses.
for (let j = 0; j < number.length; j++) {
  const land = R.land + j * R.stagger;
  const target = Number(number[j]) * THETA + R.turns * TAU;
  const pan = (j - (number.length - 1) / 2) * 0.5;
  let prev = 0;
  for (let t = R.start; t <= land; t += 1 / SR * 32) {
    const phi = target * ease.outCubic(Math.pow(range(t, R.start, land), 1.6));
    if (Math.floor(phi / THETA + 0.5) > Math.floor(prev / THETA + 0.5)) {
      const speed = 1 - range(t, R.start, land);
      tick(t, { gain: 0.05 + 0.05 * speed, freq: 2600 + j * 500, pan });
    }
    prev = phi;
  }
  click(land, { gain: 0.45, pan });
}
riser(landT, 1.2, { gain: 0.4, f0: 300, f1: 7000 });
whoosh(T.pullBack[0], T.pullBack[1] - T.pullBack[0], { gain: 0.28, f0: 1800, f1: 300, pan0: 0, pan1: 0 });

// The hit: number locks, streak and ring.
impact(landT, { size: 1.8, gain: 1.0, tone: 0.8 });
ping(landT + 0.02, { freq: 2637, gain: 0.06, decay: 0.9 });
glide(landT, 0.6, 5200, 1800, { gain: 0.03 });
pad(landT - 0.05, T.fadeOut[1] - landT + 0.3, [73.42, 110.0, 146.83, 220.0, 277.18], { gain: 0.28, a: 0.25, r: 0.9, cut0: 400, cut1: 2400 });
{
  let ph = 0;
  mix(landT, 2.6, (t) => {
    ph += (TAU * 36.7) / SR;
    return Math.sin(ph) * Math.min(1, t / 0.03) * Math.exp(-t / 1.1);
  }, { gain: 0.42, send: 0.05 });
}

// Light sweep across the faces.
{
  const f = svf();
  const [s0, s1] = T.sweep;
  mix(s0, s1 - s0, (t) => {
    const p = t / (s1 - s0);
    return f(noise(), 3000 + 5000 * p, 3).bp * Math.sin(Math.PI * p) ** 2;
  }, { gain: 0.08, send: 0.5, panFn: (t) => -0.8 + (1.6 * t) / (s1 - s0) });
}

// Exit: everything topples as the camera rushes in.
riser(T.fadeOut[0] + 0.15, E.dur + 0.3, { gain: 0.5, f0: 250, f1: 9000 });
whoosh(E.start, 1.1, { gain: 0.4, f0: 300, f1: 2600, pan0: -0.3, pan1: 0.3 });
for (let i = 0; i < 9; i++) tick(E.start + i * E.stagger + 0.35, { gain: 0.05, freq: 1800 + (i % 3) * 200, pan: -0.6 + (i / 8) * 1.0 });
impact(T.fadeOut[1] - 0.12, { size: 0.5, gain: 0.35, tone: 1.4 });

master(process.argv[2] ?? 'out/bumper-sound.wav', { wet: 0.1, tail: 0.35 });
