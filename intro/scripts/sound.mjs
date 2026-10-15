// Procedural sound design synced to the intro timeline.
// Usage: node scripts/sound.mjs [out/sound.wav]
import fs from 'node:fs';
import path from 'node:path';
import { config, finalScore } from '../src/config.js';
import { SCORE, rollEnd } from '../src/shots/score-timing.js';
import { USABILITY_CLICKS, CREATIVITY_MORPH, CONTENT_HIGHLIGHT } from '../src/shots/criteria-timing.js';
import { TITLE } from '../src/shots/title-timing.js';

const SR = 48000;
const N = Math.round(config.duration * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const sendL = new Float32Array(N);
const sendR = new Float32Array(N);
const S = config.shots;
const TAU = Math.PI * 2;

let seed = 1234567;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rnd() * 2 - 1;

/** Mix a mono generator into the stereo bus. gen(t, i) returns a sample; pan -1..1. */
function mix(start, dur, gen, { gain = 1, pan = 0, send = 0.2, panFn } = {}) {
  const i0 = Math.max(0, Math.round(start * SR));
  const i1 = Math.min(N, Math.round((start + dur) * SR));
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    const s = gen(t, i) * gain;
    const p = panFn ? panFn(t) : pan;
    const gl = Math.cos(((p + 1) * Math.PI) / 4);
    const gr = Math.sin(((p + 1) * Math.PI) / 4);
    L[i] += s * gl;
    R[i] += s * gr;
    sendL[i] += s * gl * send;
    sendR[i] += s * gr * send;
  }
}

/** State-variable filter (Chamberlin), returns { lp, bp, hp } per call. */
function svf() {
  let low = 0;
  let band = 0;
  return (x, fc, q = 0.7) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR);
    const high = x - low - band / q;
    band += f * high;
    low += f * band;
    return { lp: low, bp: band, hp: high };
  };
}

const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

// ---------------------------------------------------------------- instruments

function impact(at, { size = 1, gain = 1, tone = 1 } = {}) {
  const fA = svf();
  const fB = svf();
  const partials = [523, 1187, 1873, 2711, 3407].map((f) => f * tone);
  let ph = 0;
  mix(at, 4 * size, (t) => {
    const f = 36 + 120 * Math.exp(-t * 16);
    ph += (TAU * f) / SR;
    const sub = Math.sin(ph) * Math.exp(-t / (0.55 * size)) * 1.1;
    const click = fA(noise(), 5000).lp * Math.exp(-t * 70) * 0.9;
    const body = fB(noise(), 160, 1.2).bp * Math.exp(-t * 6) * 1.4;
    let metal = 0;
    for (let k = 0; k < partials.length; k++) metal += Math.sin(TAU * partials[k] * t + k) * Math.exp(-t * (3 + k * 1.5));
    return Math.tanh((sub + click + body + metal * 0.035 * size) * 1.4);
  }, { gain, send: 0.35 });
}

function riser(end, dur, { gain = 0.5, f0 = 300, f1 = 6000, pan = 0 } = {}) {
  const f = svf();
  mix(end - dur, dur, (t) => {
    const p = t / dur;
    const fc = f0 * Math.pow(f1 / f0, p * p);
    return f(noise(), fc, 2.5).bp * Math.pow(p, 3) * 1.5;
  }, { gain, send: 0.3, panFn: (t) => pan + Math.sin(t * 3) * 0.3 });
}

function whoosh(at, dur, { gain = 0.5, f0 = 400, f1 = 2500, pan0 = -0.6, pan1 = 0.6 } = {}) {
  const f = svf();
  mix(at, dur, (t) => {
    const p = t / dur;
    const fc = f0 * Math.pow(f1 / f0, Math.sin((p * Math.PI) / 2));
    return f(noise(), fc, 1.4).bp * Math.pow(Math.sin(p * Math.PI), 2) * 1.6;
  }, { gain, send: 0.25, panFn: (t) => pan0 + (pan1 - pan0) * (t / dur) });
}

function click(at, { gain = 0.5, pan = 0 } = {}) {
  const f = svf();
  let ph = 0;
  mix(at, 0.5, (t) => {
    ph += (TAU * (70 + 90 * Math.exp(-t * 40))) / SR;
    const thump = Math.sin(ph) * Math.exp(-t * 14);
    const tick = f(noise(), 6000).hp * Math.exp(-t * 400);
    const blip = Math.sin(TAU * 3200 * t) * Math.exp(-t * 120) * 0.4;
    return thump * 0.9 + tick * 0.8 + blip;
  }, { gain, pan, send: 0.25 });
}

function tick(at, { gain = 0.12, pan = 0, freq = 4200 } = {}) {
  const f = svf();
  mix(at, 0.06, (t) => f(noise(), 7000).hp * Math.exp(-t * 600) + Math.sin(TAU * freq * t) * Math.exp(-t * 180) * 0.5, {
    gain,
    pan,
    send: 0.12,
  });
}

function pulse(at, { gain = 0.5 } = {}) {
  let ph = 0;
  mix(at, 0.6, (t) => {
    ph += (TAU * (44 + 30 * Math.exp(-t * 30))) / SR;
    return Math.sin(ph) * env(t, 0.004, 0.16);
  }, { gain, send: 0.05 });
}

function blips(start, dur, { gain = 0.05, rate = 22 } = {}) {
  const count = Math.floor(dur * rate);
  for (let k = 0; k < count; k++) {
    const at = start + rnd() * dur;
    const fq = 1400 + rnd() * 3200;
    const pan = rnd() * 1.4 - 0.7;
    mix(at, 0.03, (t) => Math.sin(TAU * fq * t) * Math.exp(-t * 160), { gain: gain * (0.5 + rnd()), pan, send: 0.2 });
  }
}

/** Detuned saw pad with a sweeping low-pass. */
function pad(start, dur, freqs, { gain = 0.2, a = 1, r = 1.2, cut0 = 300, cut1 = 2000 } = {}) {
  const voices = [];
  freqs.forEach((f) => [-0.12, 0, 0.11].forEach((d) => voices.push({ f: f * Math.pow(2, d / 12), ph: rnd() })));
  const fl = svf();
  const fr = svf();
  const i0 = Math.round(start * SR);
  const len = Math.round(dur * SR);
  for (let n = 0; n < len && i0 + n < N; n++) {
    const t = n / SR;
    let sl = 0;
    let sr = 0;
    voices.forEach((v, k) => {
      v.ph = (v.ph + v.f / SR) % 1;
      const s = v.ph * 2 - 1;
      if (k % 2) sl += s;
      else sr += s;
    });
    const p = t / dur;
    const cut = cut0 * Math.pow(cut1 / cut0, Math.min(1, p * 1.4));
    const e = Math.min(1, t / a) * Math.min(1, (dur - t) / r);
    const g = (gain * e) / voices.length;
    const l = fl(sl, cut, 0.8).lp * g;
    const rr = fr(sr, cut, 0.8).lp * g;
    L[i0 + n] += l;
    R[i0 + n] += rr;
    sendL[i0 + n] += l * 0.5;
    sendR[i0 + n] += rr * 0.5;
  }
}

function drone(start, dur, { gain = 0.25 } = {}) {
  const f = svf();
  let p1 = 0;
  let p2 = 0;
  let p3 = 0;
  mix(start, dur, (t) => {
    p1 = (p1 + 41.2 / SR) % 1;
    p2 = (p2 + 41.45 / SR) % 1;
    p3 += (TAU * 41.2) / SR;
    const saw = f(p1 * 2 - 1 + (p2 * 2 - 1), 140 + 60 * Math.sin(t * 0.7), 0.9).lp;
    const e = Math.min(1, t / 2.5) * Math.min(1, (dur - t) / 1.5);
    return (saw * 0.6 + Math.sin(p3) * 0.7) * e;
  }, { gain, send: 0.1 });
}

// ---------------------------------------------------------------- score

const beat = config.beat;
const at = (key, dt = 0) => S[key][0] + dt;

/** A soft pure tone with a long tail — used for the glint and the closing dot. */
function ping(t0, { freq = 2600, gain = 0.12, decay = 1.2, pan = 0 } = {}) {
  mix(t0, decay * 4, (t) => (Math.sin(TAU * freq * t) + 0.3 * Math.sin(TAU * freq * 2.01 * t)) * env(t, 0.003, decay), {
    gain,
    pan,
    send: 0.6,
  });
}

/** Ticks for a per-letter / per-word reveal that mirrors overlay.type()'s stagger. */
function typeTicks(t0, dur, units, stagger, { gain = 0.06, freq = 3800 } = {}) {
  const span = 1 + stagger * Math.max(0, units - 1);
  for (let k = 0; k < units; k++) tick(t0 + ((k * stagger) / span) * dur, { gain, freq: freq + (k % 3) * 300, pan: (k / Math.max(1, units - 1) - 0.5) * 0.6 });
}

function glide(t0, dur, f0, f1, { gain = 0.1 } = {}) {
  let ph = 0;
  mix(t0, dur, (t) => {
    const p = t / dur;
    ph += (TAU * (f0 * Math.pow(f1 / f0, p))) / SR;
    return Math.sin(ph) * Math.sin(Math.PI * Math.min(1, p * 1.2)) ** 2;
  }, { gain, send: 0.5 });
}

/** Granular digital crackle: the field of sites degrading. */
function crackle(t0, dur, { gain = 0.12, density = 220 } = {}) {
  const count = Math.floor(dur * density);
  for (let k = 0; k < count; k++) {
    const tt = rnd() * dur;
    const fade = 1 - tt / dur;
    const fq = 600 + rnd() * 5000;
    const len = 0.004 + rnd() * 0.02;
    mix(t0 + tt, len, (t) => Math.sign(Math.sin(TAU * fq * t)) * (1 - t / len), {
      gain: gain * fade * (0.3 + rnd()),
      pan: rnd() * 1.6 - 0.8,
      send: 0.15,
    });
  }
}

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

// ---------------------------------------------------------------- reverb + master

function comb(input, out, delay, fb, damp) {
  const buf = new Float32Array(delay);
  let idx = 0;
  let lp = 0;
  for (let i = 0; i < N; i++) {
    const y = buf[idx];
    lp = y * (1 - damp) + lp * damp;
    buf[idx] = input[i] + lp * fb;
    out[i] += y;
    idx = (idx + 1) % delay;
  }
}
function allpass(io, delay, g = 0.5) {
  const buf = new Float32Array(delay);
  let idx = 0;
  for (let i = 0; i < N; i++) {
    const b = buf[idx];
    const x = io[i];
    buf[idx] = x + b * g;
    io[i] = b - x * g;
    idx = (idx + 1) % delay;
  }
}
function reverb(input, spread) {
  const out = new Float32Array(N);
  const scale = SR / 44100;
  [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].forEach((d) => comb(input, out, Math.round((d + spread) * scale * 1.6), 0.86, 0.3));
  [556, 441, 341, 225].forEach((d) => allpass(out, Math.round((d + spread) * scale)));
  return out;
}
const revL = reverb(sendL, 0);
const revR = reverb(sendR, 23);

const outL = new Float32Array(N);
const outR = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fadeOut = Math.min(1, Math.max(0, (config.duration - 0.05 - t) / 0.6));
  outL[i] = Math.tanh((L[i] + revL[i] * 0.09) * 1.1) * fadeOut;
  outR[i] = Math.tanh((R[i] + revR[i] * 0.09) * 1.1) * fadeOut;
  peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
}
const norm = 0.89 / peak;

const file = path.resolve(process.argv[2] ?? 'out/sound.wav');
fs.mkdirSync(path.dirname(file), { recursive: true });
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  const d = (rnd() - rnd()) / 65536;
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((outL[i] * norm + d) * 32767))), i * 4);
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((outR[i] * norm + d) * 32767))), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);
fs.writeFileSync(file, Buffer.concat([header, data]));
console.log(`wrote ${file} (peak ${peak.toFixed(3)} → normalised)`);
