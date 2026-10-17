// Procedural sound design synced to the intro timeline.
// Usage: node scripts/sound.mjs [out/sound.wav]
import { config, finalScore } from '../src/config.js';
import { SCORE, rollEnd } from '../src/shots/score-timing.js';
import { USABILITY_CLICKS, CREATIVITY_MORPH, CONTENT_HIGHLIGHT } from '../src/shots/criteria-timing.js';
import { TITLE } from '../src/shots/title-timing.js';
import { createMixer, SR, TAU } from './synth.mjs';

const S = config.shots;
const { mix, svf, rnd, noise, impact, riser, whoosh, click, tick, pulse, pad, drone, ping, typeTicks, glide, crackle, master } =
  createMixer(config.duration);

// ---------------------------------------------------------------- score

const beat = config.beat;
const at = (key, dt = 0) => S[key][0] + dt;

drone(0, config.duration - 0.4, { gain: 0.16 });

// Prologue: a point of light, a line, an edge.
ping(0.35, { freq: 2637, gain: 0.1, decay: 1.4 });
glide(0.7, 0.8, 330, 1320, { gain: 0.05 });
riser(1.4, 0.7, { gain: 0.2, f0: 1500, f1: 9000 });
impact(1.4, { size: 0.6, gain: 0.45, tone: 1.3 });
whoosh(1.55, 1.5, { gain: 0.16, f0: 1200, f1: 6000, pan0: 0.7, pan1: -0.7 });
typeTicks(1.75, 0.85, 2, 0.25, { gain: 0.08, freq: 2400 });
riser(at('thousands'), 0.9, { gain: 0.32 });

// Thousands: every letter lands, then we dive through the T.
impact(at('thousands'), { size: 1.1, gain: 0.9 });
typeTicks(at('thousands'), 1.0, 9, 0.07, { gain: 0.07 });
riser(at('thousands', 2.1), 0.8, { gain: 0.45, f0: 400, f1: 8000 });
whoosh(at('thousands', 1.3), 0.95, { gain: 0.4, f0: 300, f1: 2400, pan0: 0, pan1: 0 });
impact(at('thousands', 2.1), { size: 1.4, gain: 0.7, tone: 0.8 });
typeTicks(at('thousands', 2.0), 0.7, 3, 0.12, { gain: 0.05 });
typeTicks(at('thousands', 2.1), 0.7, 3, 0.12, { gain: 0.05 });

// Noise: the field degrades and switches off towards one survivor.
crackle(at('noise'), 1.15, { gain: 0.08 });
for (let k = 0; k < 14; k++) tick(at('noise', 0.4 + k * 0.055 + rnd() * 0.02), { gain: 0.06 * (1 - k / 16), freq: 1800 + rnd() * 900, pan: rnd() * 1.6 - 0.8 });
typeTicks(at('noise', 0.1), 0.65, 3, 0.15, { gain: 0.05 });
ping(at('noise', 1.2), { freq: 1318, gain: 0.06, decay: 0.8 });

// One jury: the last slab rises.
impact(at('one'), { size: 0.9, gain: 0.75, tone: 0.9 });
whoosh(at('one', 0.05), 1.5, { gain: 0.26, f0: 200, f1: 1400, pan0: 0, pan1: 0 });
glide(at('one', 0.1), 1.4, 110, 220, { gain: 0.06 });
impact(at('one', 1.0), { size: 0.5, gain: 0.4, tone: 1.2 });
impact(at('one', 1.15), { size: 0.5, gain: 0.35, tone: 1.35 });
riser(at('design'), 0.7, { gain: 0.3 });

// Heartbeat pulse on the beat grid through the criteria and the verdict.
for (let t = at('design'); t < at('score', 2.3) - 0.01; t += beat) pulse(t, { gain: 0.45 });
for (let t = at('design'); t < at('score') - 0.01; t += beat / 4) {
  const step = Math.round((t - at('design')) / (beat / 4)) % 4;
  tick(t, { gain: step === 2 ? 0.05 : 0.022, pan: step % 2 ? 0.35 : -0.35 });
}

config.criteria.forEach((c, i) => {
  impact(at(c.key), { size: 0.75, gain: 0.65, tone: 1 + i * 0.06 });
  typeTicks(at(c.key, 0.1), 0.9, c.word.length, 0.05, { gain: 0.045 });
});

// Design: lines are drawn like a pen on glass, the spiral rings.
for (let k = 0; k < 6; k++) whoosh(at('design', 0.45 + k * 0.12), 0.35, { gain: 0.07, f0: 3000, f1: 7000, pan0: -0.4, pan1: 0.4 });
glide(at('design', 1.05), 0.7, 880, 1760, { gain: 0.035 });

// Usability: two precise clicks.
whoosh(at('usability', 0.1), 1.2, { gain: 0.14, pan0: 0.6, pan1: -0.1, f0: 400, f1: 1600 });
USABILITY_CLICKS.forEach((c) => click(at('usability', c), { gain: 0.75 }));

// Creativity: a liquid swell.
{
  const f = svf();
  const [a, b] = S.creativity;
  mix(a + CREATIVITY_MORPH[0], b - a - CREATIVITY_MORPH[0], (t) => {
    const fc = 220 + 700 * (0.5 + 0.5 * Math.sin(t * 4 + Math.sin(t * 1.7) * 2));
    return f(noise(), fc, 5).bp * Math.min(1, t * 1.2) * Math.min(1, (b - a - t) * 2);
  }, { gain: 0.26, send: 0.45, panFn: (t) => Math.sin(t * 1.8) * 0.6 });
  glide(a + 0.1, 1.3, 82, 164, { gain: 0.08 });
}

// Content: the sentence is read.
{
  const [h0, h1] = CONTENT_HIGHLIGHT;
  typeTicks(at('content', h0), h1 - h0, 19, 0.04, { gain: 0.035, freq: 5200 });
  ping(at('content', h1), { freq: 1975, gain: 0.05, decay: 0.7 });
}

// Verdict: four slices, then the number.
impact(at('score'), { size: 0.9, gain: 0.75, tone: 0.8 });
config.criteria.forEach((c, i) => {
  whoosh(at('score', SCORE.open[0] + i * 0.05), 0.4, { gain: 0.12, f0: 2500, f1: 9000, pan0: (i - 1.5) * 0.4, pan1: (i - 1.5) * 0.5 });
  tick(at('score', 0.55 + i * 0.1), { gain: 0.07, freq: 3000 + i * 400, pan: (i - 1.5) * 0.4 });
});
impact(at('score', SCORE.close[1]), { size: 0.5, gain: 0.4, tone: 1.1 });
whoosh(at('score', SCORE.sink[0]), 0.7, { gain: 0.16, f0: 900, f1: 250, pan0: 0, pan1: 0 });
{
  const value = finalScore().toFixed(2);
  const digits = [...value].filter((ch) => ch !== '.');
  digits.forEach((d, k) => {
    const s0 = at('score', SCORE.roll + k * SCORE.rollStagger);
    for (let j = 0; j < 8; j++) tick(s0 + 0.03 + Math.pow(j / 8, 2.2) * 0.45, { gain: 0.05, freq: 2600 + k * 500, pan: (k - 1) * 0.45 });
    click(at('score', rollEnd(k) - 0.55), { gain: 0.35, pan: (k - 1) * 0.45 });
  });
  ping(at('score', SCORE.dot), { freq: 1568, gain: 0.08, decay: 0.9 });
}

// Title: into the screen; the name lands on the downbeat.
riser(at('title', TITLE.fill), 1.3, { gain: 0.45 });
riser(at('title', TITLE.fill), 0.35, { gain: 0.25, f0: 3000, f1: 14000 });
whoosh(at('title', 0.1), TITLE.fill, { gain: 0.25, f0: 200, f1: 1800, pan0: 0, pan1: 0 });
impact(at('title', TITLE.fill), { size: 2.2, gain: 1.05, tone: 0.75 });
typeTicks(at('title', TITLE.fill), 1.2, 4, 0.1, { gain: 0.06, freq: 2200 });
pad(at('title', TITLE.fill - 0.2), TITLE.out - TITLE.fill + 1.4, [82.41, 123.47, 164.81, 196.0, 246.94], { gain: 0.32, a: 0.9, r: 1.1, cut0: 250, cut1: 2200 });
{
  let ph = 0;
  mix(at('title', TITLE.fill), 4, (t) => {
    ph += (TAU * 41.2) / SR;
    return Math.sin(ph) * Math.min(1, t / 0.05) * Math.exp(-t / 1.6);
  }, { gain: 0.45, send: 0.05 });
}
whoosh(at('title', TITLE.out), 0.6, { gain: 0.16, f0: 2000, f1: 500, pan0: 0.3, pan1: -0.3 });
ping(at('title', TITLE.dotTravel[0]), { freq: 2637, gain: 0.08, decay: 0.9 });
pulse(at('title', TITLE.dotGone[1] - 0.05), { gain: 0.35 });

master(process.argv[2] ?? 'out/sound.wav');
