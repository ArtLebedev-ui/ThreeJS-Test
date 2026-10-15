import * as THREE from 'three';
import { RectAreaLight } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { config, finalScore } from '../config.js';
import { ease, lerp, range } from '../lib/anim.js';
import { label, measure, dot, colX, FONTS, PAPER, CAP } from '../overlay.js';
import { darkGloss } from '../assets.js';
import { baseScene, camera, toScreen, SLAB, W, H } from './common.js';
import { SCORE } from './score-timing.js';

const NUM = { size: 760, family: FONTS.medium, tracking: -0.05 };

/** "8.46" with rolling digits and the accent dot as the decimal point. */
export function drawScore(ctx, t, { pOut = 0 } = {}) {
  const str = finalScore().toFixed(2);
  const digits = [...str].filter((c) => c !== '.');
  const { size, family, tracking } = NUM;
  const gap = size * 0.2;
  const ws = digits.map((d) => measure(ctx, d, size, family, tracking));
  const total = ws.reduce((a, b) => a + b, 0) + gap;
  const y = H / 2 + (CAP * size) / 2 + 30;
  let x = W / 2 - total / 2;
  const lh = size * 1.05;
  const K = 7;
  ctx.save();
  ctx.font = `${size}px ${family}`;
  ctx.letterSpacing = `${tracking * size}px`;
  ctx.fillStyle = PAPER;
  const a0 = SCORE.roll;
  digits.forEach((d, k) => {
    const prog = (tt) => ease.outExpo(range(tt, a0 + k * SCORE.rollStagger, a0 + k * SCORE.rollStagger + SCORE.rollDur));
    const offs = (e, eo) => (1 - e) * K * lh + (1 - Math.min(1, e * 4)) * lh - eo * lh * 1.1;
    const e = prog(t);
    const eo = ease.inExpo(range(pOut, k * 0.12, 0.76 + k * 0.12));
    if (e > 0 && eo < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - size * 0.01, y - size * 0.77, ws[k] + size * 0.02, size * 0.81);
      ctx.clip();
      // Fast rolls are drawn as several additive sub-frames: overlay motion blur.
      const dt = 0.5 / 30;
      const speed = Math.abs(offs(prog(t + dt / 2), eo) - offs(prog(t - dt / 2), eo));
      // Powers of two keep the additive 8-bit sum neutral (no colour drift).
      const n = speed > 3 ? Math.min(32, 2 ** Math.ceil(Math.log2(speed / 5))) : 1;
      if (n > 1) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#fff';
      }
      ctx.globalAlpha = 1 / n;
      for (let s = 0; s < n; s++) {
        const ts = n === 1 ? t : t + ((s + 0.5) / n - 0.5) * dt;
        const off = offs(prog(ts), eo);
        for (let j = 0; j <= K; j++) {
          const yy = y - (K - j) * lh + off;
          if (yy < y - size * 0.1 || yy > y + size * 0.9) continue;
          const g = j === K ? d : String((Number(d) + 3 * (K - j) + k) % 10);
          const gw = j === K ? ws[k] : ctx.measureText(g).width - tracking * size;
          ctx.fillText(g, x + (ws[k] - gw) / 2, yy);
        }
      }
      ctx.restore();
    }
    x += ws[k];
    if (k === 0) {
      const r = size * 0.068;
      const s = ease.outBack(range(t, SCORE.dot, SCORE.dot + 0.35), 2) * (1 - ease.inExpo(range(pOut, 0.1, 0.7)));
      dot(ctx, x + gap / 2, y - r, r * s);
      x += gap;
    }
  });
  ctx.restore();
  return { y, left: W / 2 - total / 2, right: W / 2 + total / 2 };
}

// The site is cut into its four criteria — slices as wide as their weights — which rise by
// their contribution, then fuse back and sink beneath the final number.
export function createScore(A) {
  const [start, end] = config.shots.score;
  const dur = end - start;
  const scene = baseScene(A.env.front, 0.5);
  const cam = camera(26);
  cam.setViewOffset(W, H, 0, H * 0.04, W, H);
  const key = new RectAreaLight(0xffffff, 5, 8, 0.5);
  key.position.set(0, 4, 3);
  key.lookAt(0, 0, 0);
  scene.add(key);

  const root = new THREE.Group();
  scene.add(root);
  const bodyMat = darkGloss({ color: 0x0c0c0d, metalness: 0.7, roughness: 0.32, clearcoat: 0.4 });
  const crit = config.criteria;
  const contrib = crit.map((c) => (c.weight * c.score) / 100);
  const maxC = Math.max(...contrib);
  let acc = 0;
  const slices = crit.map((c, i) => {
    const w = (SLAB.w * c.weight) / 100;
    const u0 = acc / SLAB.w;
    acc += w;
    const u1 = acc / SLAB.w;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(w - 0.004, SLAB.h, SLAB.d, 3, 0.02), bodyMat);
    const fg = new THREE.PlaneGeometry(w - 0.016, SLAB.h - 0.012);
    const uv = fg.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, lerp(u0, u1, uv.getX(k)));
    const faceMat = new THREE.MeshPhysicalMaterial({
      color: 0x000000,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      emissive: 0xffffff,
      emissiveMap: A.hero.tex,
      emissiveIntensity: 0.85,
    });
    const face = new THREE.Mesh(fg, faceMat);
    face.position.z = SLAB.d / 2 + 0.0008;
    g.add(body, face);
    root.add(g);
    return { g, faceMat, x: -SLAB.w / 2 + (u0 + u1) * 0.5 * SLAB.w, w, rise: (contrib[i] / maxC) * 0.7, c };
  });
  const GAP = 0.3;

  const state = (lt) => {
    const open = ease.outExpo(range(lt, SCORE.open[0], SCORE.open[1])) * (1 - ease.inOutQuart(range(lt, SCORE.close[0], SCORE.close[1])));
    return slices.map((s, i) => {
      const r = ease.inOutCubic(range(lt, SCORE.rise + i * 0.08, SCORE.rise + 0.7 + i * 0.08));
      const back = ease.inOutQuart(range(lt, SCORE.close[0], SCORE.close[1]));
      return { x: s.x + (i - 1.5) * GAP * open, y: s.rise * r * (1 - back) };
    });
  };

  return {
    name: 'score',
    start,
    end,
    update(lt) {
      const st = state(lt);
      slices.forEach((s, i) => s.g.position.set(st[i].x, st[i].y, 0));
      const sink = ease.inCubic(range(lt, SCORE.sink[0], SCORE.sink[1]));
      root.position.set(0, lerp(0, -4.2, sink), lerp(0, -1.5, sink));
      root.visible = sink < 1;
      root.rotation.set(lerp(0, -1.45, sink), 0, 0);
      slices.forEach((s) => (s.faceMat.emissiveIntensity = lerp(0.85, 0.0, sink)));
      cam.position.set(0, lerp(0.3, 0.6, lt / dur), lerp(12.6, 11.8, ease.outCubic(lt / dur)));
      cam.lookAt(0, 0.35, 0);
      scene.environmentRotation.set(0, lerp(-0.4, 0.5, lt / dur), 0);
      return { scene, camera: cam };
    },
    overlay(ctx, ctxD, ctxM, lt) {
      const st = state(lt);
      root.updateMatrixWorld(true);
      const lo = range(lt, SCORE.close[0] - 0.1, SCORE.close[0] + 0.2);
      slices.forEach((s, i) => {
        const p = toScreen(new THREE.Vector3(st[i].x - s.w / 2 + 0.02, st[i].y + SLAB.h / 2, 0).applyMatrix4(root.matrixWorld), cam);
        const pin = range(lt, 0.55 + i * 0.1, 1.15 + i * 0.1);
        label(ctx, s.c.word, p.x, p.y - 96, { pIn: pin, pOut: lo, size: 30 });
        label(ctx, s.c.score.toFixed(1), p.x, p.y - 34, {
          pIn: pin,
          pOut: lo,
          size: 60,
          family: FONTS.medium,
          tracking: -0.03,
          alpha: 1,
        });
      });
      const L = drawScore(ctx, lt);
      label(ctx, config.copy.score, colX(0), L.y - NUM.size * CAP, { pIn: range(lt, 2.6, 3.2), size: 34 });
      label(ctx, '/ 10', colX(12), L.y, { pIn: range(lt, 2.85, 3.4), size: 34, align: 'right' });
    },
    frame: () => ({ chapter: 'Verdict' }),
    post: () => ({ bloom: 0.25 }),
    samples: (lt) => (lt < SCORE.sink[1] + 0.1 ? 4 : 1),
  };
}
