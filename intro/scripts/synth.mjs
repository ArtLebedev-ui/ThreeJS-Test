// Tiny procedural synth shared by the intro and bumper sound designs.
import fs from 'node:fs';
import path from 'node:path';

export const SR = 48000;
export const TAU = Math.PI * 2;

export function createMixer(duration) {
  const N = Math.round(duration * SR);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  const sendL = new Float32Array(N);
  const sendR = new Float32Array(N);

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

  /** A soft pure tone with a long tail. */
  function ping(t0, { freq = 2600, gain = 0.12, decay = 1.2, pan = 0 } = {}) {
    mix(t0, decay * 4, (t) => (Math.sin(TAU * freq * t) + 0.3 * Math.sin(TAU * freq * 2.01 * t)) * env(t, 0.003, decay), {
      gain,
      pan,
      send: 0.6,
    });
  }

  /** Ticks for a per-letter / per-word reveal with a stagger. */
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

  /** Granular digital crackle. */
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

  /** Reverb, soft-clip, tail fade, normalise and write a 16-bit stereo WAV. */
  function master(file, { wet = 0.09, tail = 0.6 } = {}) {
    const revL = reverb(sendL, 0);
    const revR = reverb(sendR, 23);
    const outL = new Float32Array(N);
    const outR = new Float32Array(N);
    let peak = 0;
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      const fadeOut = Math.min(1, Math.max(0, (duration - 0.05 - t) / tail));
      outL[i] = Math.tanh((L[i] + revL[i] * wet) * 1.1) * fadeOut;
      outR[i] = Math.tanh((R[i] + revR[i] * wet) * 1.1) * fadeOut;
      peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
    }
    const norm = 0.89 / peak;

    const out = path.resolve(file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
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
    fs.writeFileSync(out, Buffer.concat([header, data]));
    console.log(`wrote ${out} (peak ${peak.toFixed(3)} → normalised)`);
  }

  return { mix, svf, env, rnd, noise, impact, riser, whoosh, click, tick, pulse, blips, pad, drone, ping, typeTicks, glide, crackle, master };
}
