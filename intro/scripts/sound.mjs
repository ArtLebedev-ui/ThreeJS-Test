// Procedural sound design synced to the intro timeline.
// Usage: node scripts/sound.mjs [out/sound.wav]
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { SCORE_LANDS, SCORE_SPIN_START, drumAngle } from '../src/shots/score-timing.js';
import { USABILITY_CLICKS } from '../src/shots/criteria-timing.js';

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

// Opening: a low hum, a light sweep and decoding text, pulled into the first cut.
drone(0, S.score[1] + 0.3, { gain: 0.22 });
whoosh(0.2, 2.6, { gain: 0.22, f0: 900, f1: 5000, pan0: -0.8, pan1: 0.8 });
blips(0.45, 1.4, { gain: 0.035 });
riser(S.field[0], 1.6, { gain: 0.38 });
riser(S.field[0], 0.5, { gain: 0.25, f0: 2000, f1: 12000 });

// Cuts.
impact(S.field[0], { size: 1.3, gain: 1 });
impact(S.one[0], { size: 0.9, gain: 0.75, tone: 0.9 });
config.criteria.forEach((c, i) => impact(S[c.key][0], { size: 0.8, gain: 0.7, tone: 1 + i * 0.06 }));
impact(S.score[0], { size: 1, gain: 0.8, tone: 0.8 });
impact(S.title[0], { size: 2.2, gain: 1.1, tone: 0.75 });

// Flight through the field: rushing air that accelerates into the next cut.
{
  const f = svf();
  const [a, b] = S.field;
  mix(a, b - a, (t) => {
    const p = t / (b - a);
    const fc = 500 + 3500 * Math.pow(p, 2.5);
    return f(noise(), fc, 0.9).bp * (0.5 + 1.4 * Math.pow(p, 3)) * Math.min(1, t * 6);
  }, { gain: 0.5, send: 0.2, panFn: (t) => Math.sin(t * 1.7) * 0.5 });
  riser(b, 0.9, { gain: 0.35, f0: 800, f1: 9000 });
  for (let k = 0; k < 9; k++) whoosh(a + 0.2 + k * 0.33 + rnd() * 0.1, 0.35, { gain: 0.12, f0: 700, f1: 3000, pan0: rnd() * 2 - 1, pan1: rnd() * 2 - 1 });
}

// The juror's click.
whoosh(S.one[0] + 0.15, 0.9, { gain: 0.25, pan0: 0.7, pan1: 0 });
click(S.one[0] + 1.4, { gain: 0.8 });
riser(S.design[0], 0.7, { gain: 0.3 });

// Heartbeat pulse on the beat grid from the first cut to the verdict.
for (let t = S.field[0]; t < S.score[0] - 0.01; t += beat) pulse(t, { gain: t < S.design[0] ? 0.35 : 0.5 });

// Clock-like 16th ticks across the four criteria, growing in intensity.
for (let t = S.design[0]; t < S.score[0] - 0.01; t += beat / 4) {
  const p = (t - S.design[0]) / (S.score[0] - S.design[0]);
  const step = Math.round((t - S.design[0]) / (beat / 4)) % 4;
  tick(t, { gain: (step === 2 ? 0.1 : 0.045) * (0.6 + p), pan: step % 2 ? 0.35 : -0.35 });
}

// Per-criterion accents.
whoosh(S.design[0] + 0.05, 1.6, { gain: 0.16, f0: 2000, f1: 7000 });
blips(S.design[0] + 1.0, 0.8, { gain: 0.03 });
whoosh(S.usability[0], 0.9, { gain: 0.22, pan0: 0.5, pan1: -0.1, f0: 300, f1: 1500 });
USABILITY_CLICKS.forEach((c) => click(S.usability[0] + c, { gain: 0.85 }));
{
  const f = svf();
  const [a, b] = S.creativity;
  mix(a + 0.2, b - a - 0.2, (t) => {
    const fc = 250 + 900 * (0.5 + 0.5 * Math.sin(t * 5 + Math.sin(t * 2.3) * 2));
    return f(noise(), fc, 4).bp * Math.min(1, t * 1.5) * 0.9;
  }, { gain: 0.3, send: 0.4, panFn: (t) => Math.sin(t * 2.2) * 0.7 });
  whoosh(a + 1.4, 0.4, { gain: 0.3, f0: 1500, f1: 6000 });
}
blips(S.content[0] + 0.2, 2.4, { gain: 0.03, rate: 14 });
whoosh(S.content[0], 2.8, { gain: 0.18, f0: 300, f1: 1200, pan0: -0.3, pan1: 0.3 });
riser(S.score[0], 1.0, { gain: 0.4 });

// Verdict: each passing numeral on each drum is a tick; each landing is a heavy clunk.
{
  const value = config.criteria.reduce((s, c) => s + (c.score * c.weight) / 100, 0).toFixed(2);
  const digits = [...value].filter((c) => c !== '.').map(Number);
  digits.forEach((d, idx) => {
    const pan = (idx - 1) * 0.45;
    let last = 0;
    for (let t = SCORE_SPIN_START; t < SCORE_LANDS[idx] + 0.01; t += 1 / 960) {
      const k = Math.floor(drumAngle(t, d, idx) / (TAU / 10));
      if (k !== last) {
        tick(S.score[0] + t, { gain: 0.05, pan, freq: 2600 + idx * 500 });
        last = k;
      }
    }
    impact(S.score[0] + SCORE_LANDS[idx], { size: 0.45, gain: 0.5, tone: 1.4 + idx * 0.15 });
    click(S.score[0] + SCORE_LANDS[idx], { gain: 0.5, pan });
  });
  const total = S.score[0] + SCORE_LANDS[SCORE_LANDS.length - 1];
  impact(total, { size: 1.2, gain: 0.6, tone: 0.9 });
}
riser(S.title[0], 1.2, { gain: 0.5 });
riser(S.title[0], 0.35, { gain: 0.3, f0: 3000, f1: 14000 });

// Title: a slow E-minor swell under the light sweep, then out.
pad(S.title[0], S.title[1] - S.title[0] - 0.4, [82.41, 123.47, 164.81, 196.0, 246.94], { gain: 0.35, a: 1.4, r: 1.4, cut0: 250, cut1: 2400 });
whoosh(S.title[0] + 1.6, 2.6, { gain: 0.2, f0: 1500, f1: 7000, pan0: -0.7, pan1: 0.7 });
blips(S.title[0] + 2.5, 0.9, { gain: 0.03 });
{
  let ph = 0;
  mix(S.title[0], 5, (t) => {
    ph += (TAU * 41.2) / SR;
    return Math.sin(ph) * Math.min(1, t / 0.05) * Math.exp(-t / 1.8);
  }, { gain: 0.5, send: 0.05 });
}

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
