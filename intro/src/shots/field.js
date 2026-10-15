import * as THREE from 'three';
import { RectAreaLight } from 'three';
import { config } from '../config.js';
import { ease, lerp, range, mulberry32 } from '../lib/anim.js';
import { type, label, fitSize, measure, colX, FONTS, CAP } from '../overlay.js';
import { baseScene, camera, makePanels, makeSlab, SLAB, H } from './common.js';

// One shared field of slabs lying face-up, used by "Thousands", "Noise" and "One".
function createFieldScene(A) {
  const scene = baseScene(A.env.studio, 0.5);
  scene.fog = new THREE.Fog(0x000000, 14, 46);
  const COLS = 25;
  const ROWS = 31;
  const GX = SLAB.w + 0.45;
  const GZ = SLAB.h + 0.45;
  const count = COLS * ROWS;
  const panels = makePanels(count, A.atlas, { screen: 1.0 });
  scene.add(panels.group);
  const rand = mulberry32(7);
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const items = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const x = (c - (COLS - 1) / 2) * GX;
      const z = (r - (ROWS - 1) / 2) * GZ;
      items.push({
        pos: new THREE.Vector3(x, 0, z),
        tile: Math.floor(rand() * 16),
        base: 0.55 + rand() * 0.45,
        seed: rand() * 1000,
        dist: Math.hypot(x / GX, z / GZ),
        center: r === (ROWS - 1) / 2 && c === (COLS - 1) / 2,
      });
    }
  const centerIdx = items.findIndex((i) => i.center);
  items[centerIdx].tile = 0;
  return {
    scene,
    panels,
    items,
    centerIdx,
    flat,
    /** brightness(item, i) -> [bright, noise] */
    apply(fn) {
      items.forEach((it, i) => {
        const [b, n, tile, pos] = fn(it, i);
        panels.set(i, pos ?? it.pos, flat, tile ?? it.tile, b, n ?? 0);
      });
      panels.commit();
    },
  };
}

export function createFieldShots(A) {
  const F = createFieldScene(A);
  return [thousands(A, F), noise(A, F), one(A, F)];
}

// "Thousands" — the field is only visible through the letters, then we fly through a stem.
function thousands(A, F) {
  const [start, end] = config.shots.thousands;
  const dur = end - start;
  const cam = camera(32);
  const ZOOM = [1.3, 2.1];
  const word = config.copy.thousands;
  let layout = null;
  const getLayout = (ctx) => {
    if (layout) return layout;
    const x0 = colX(0);
    const size = fitSize(ctx, word, colX(12) - x0, FONTS.medium, -0.05);
    const y = H / 2 + (CAP * size) / 2;
    const tw = measure(ctx, 'T', size, FONTS.medium, -0.05);
    layout = { x0, size, y, px: x0 + tw * 0.47, py: y - CAP * size * 0.45 };
    return layout;
  };

  return {
    name: 'thousands',
    start,
    end,
    update(lt) {
      const z = ease.inExpo(range(lt, ZOOM[0], ZOOM[1] + 0.2));
      const after = ease.outCubic(range(lt, ZOOM[1], dur));
      const drift = lt * 0.7;
      cam.position.set(-0.6 + lt * 0.3, lerp(lerp(21, 9, z), 10, after), lerp(4, 2, z) + lerp(0, 6, after) - drift);
      cam.lookAt(0, 0, -drift - lerp(0, 2, after));
      F.panels.uniforms.uTime.value = lt;
      F.panels.uniforms.uScreen.value = lerp(1.6, 1.0, range(lt, ZOOM[0], ZOOM[1] + 0.3));
      F.panels.uniforms.uInvert.value = 1 - ease.inOutCubic(range(lt, ZOOM[0] + 0.3, ZOOM[1] + 0.1));
      F.scene.environmentIntensity = 0.5;
      F.apply((it) => [it.base, 0]);
      return { scene: F.scene, camera: cam };
    },
    overlay(ctx, ctxD, ctxM, lt) {
      const L = getLayout(ctxM);
      const zp = range(lt, ZOOM[0], ZOOM[1]);
      const s = 1 + ease.inExpo(zp) * 70;
      ctxM.save();
      ctxM.translate(L.px, L.py);
      ctxM.scale(s, s);
      ctxM.translate(-L.px, -L.py);
      type(ctxM, word, {
        x: L.x0,
        y: L.y,
        size: L.size,
        tracking: -0.05,
        color: '#fff',
        pIn: range(lt, 0, 1.0),
        stagger: 0.07,
        tilt: 0,
      });
      ctxM.restore();
      if (zp <= 0)
        type(ctx, word, {
          x: L.x0,
          y: L.y,
          size: L.size,
          tracking: -0.05,
          alpha: 0.1,
          pIn: range(lt, 0, 1.0),
          stagger: 0.07,
          tilt: 0,
        });

      const [l1, l2] = config.copy.thousandsSub;
      const o = { size: 76, family: FONTS.regular, tracking: -0.025, split: 'words', stagger: 0.12, pOut: range(lt, dur - 0.25, dur) };
      type(ctx, l1, { ...o, x: colX(0), y: H - 330, pIn: range(lt, 2.0, 2.7) });
      type(ctx, l2, { ...o, x: colX(0), y: H - 330 + 90, pIn: range(lt, 2.1, 2.8) });
    },
    frame: () => ({ chapter: 'Prologue' }),
    post: (lt) => {
      const zp = range(lt, ZOOM[0], ZOOM[1]);
      return { mask: zp >= 1 ? 0 : 1, maskOut: 0.0, bloom: 0.25 };
    },
    samples: (lt) => (lt > ZOOM[0] && lt < ZOOM[1] + 0.4 ? 8 : 3),
  };
}

// "Most of it is noise." — screens dissolve into static and switch off, all but one.
function noise(A, F) {
  const [start, end] = config.shots.noise;
  const dur = end - start;
  const cam = camera(30);
  return {
    name: 'noise',
    start,
    end,
    update(lt) {
      const az = lerp(0.55, 0.35, lt / dur);
      const r = lerp(11, 9.5, ease.outCubic(lt / dur));
      cam.position.set(Math.sin(az) * r, lerp(6.2, 6.8, lt / dur), Math.cos(az) * r);
      cam.lookAt(0, 0, 0);
      F.panels.uniforms.uTime.value = lt;
      F.panels.uniforms.uScreen.value = 1;
      F.panels.uniforms.uInvert.value = 0;
      const radius = lerp(16, 0.5, ease.inOutCubic(range(lt, 0.35, 1.2)));
      F.apply((it) => {
        if (it.center) return [1, 0.55 * range(lt, 0.05, 0.35) * (1 - range(lt, 0.85, 1.15))];
        const on = 1 - range(it.dist, radius - 1.5, radius);
        const flick = 0.5 + 0.5 * Math.sin(it.seed + Math.floor(lt * 12) * 2.1);
        const n = range(lt, 0.0, 0.45) * (0.55 + 0.45 * flick) * (0.6 + 0.4 * range(it.dist, radius, radius - 4));
        return [it.base * on * (0.75 + 0.25 * flick), n];
      });
      return { scene: F.scene, camera: cam };
    },
    overlay(ctx, ctxD, ctxM, lt) {
      const [l1, l2] = config.copy.noise;
      type(ctx, l1, {
        x: colX(0),
        y: H - 640,
        size: 96,
        family: FONTS.regular,
        tracking: -0.03,
        split: 'words',
        stagger: 0.15,
        pIn: range(lt, 0.1, 0.75),
        pOut: range(lt, dur - 0.2, dur),
      });
      type(ctx, l2, {
        x: colX(0) - 8,
        y: H - 250,
        size: 400,
        family: FONTS.lightItalic,
        tracking: -0.05,
        stagger: 0.04,
        pIn: range(lt, 0.25, 1.05),
        pOut: range(lt, dur - 0.2, dur),
      });
    },
    frame: () => ({ chapter: 'Prologue' }),
    post: () => ({ bloom: 0.25 }),
    samples: () => 2,
  };
}

// "One jury." — the last lit slab rises out of the field and turns to face us.
function one(A, F) {
  const [start, end] = config.shots.one;
  const dur = end - start;
  const cam = camera(26);
  const slab = makeSlab({ screen: A.hero.tex, intensity: 0.9 });
  const group = new THREE.Group();
  group.add(slab.group);
  group.visible = false;
  F.scene.add(group);
  const top = new RectAreaLight(0xffffff, 0, 5, 0.3);
  F.scene.add(top);
  const RISE = [0.0, 1.55];
  const Y = 1.25;

  return {
    name: 'one',
    start,
    end,
    update(lt) {
      const e = ease.inOutQuart(range(lt, RISE[0], RISE[1]));
      group.visible = true;
      group.position.set(0, lerp(SLAB.d / 2, Y, e), 0);
      group.rotation.set(lerp(-Math.PI / 2, 0, e), 0, 0);
      const settle = range(lt, RISE[1], dur);
      cam.position.set(lerp(1.2, 0, e), lerp(7.5, Y, e), lerp(4.0, 10.6, e) - settle * 0.5);
      cam.lookAt(0, lerp(0, Y, e), 0);
      top.intensity = 9 * e;
      top.position.set(0, Y + 4.5, 0.3);
      top.lookAt(0, Y, 0);
      F.panels.uniforms.uTime.value = lt;
      F.panels.uniforms.uScreen.value = 1;
      F.panels.uniforms.uInvert.value = 0;
      F.scene.environmentIntensity = lerp(0.5, 0.0, e);
      F.apply((it) => (it.center ? [0, 0, it.tile, new THREE.Vector3(0, -50, 0)] : [0, 0]));
      return { scene: F.scene, camera: cam };
    },
    overlay(ctx, ctxD, ctxM, lt) {
      const [a, b] = config.copy.one;
      const size = 330;
      const y = H / 2 + (CAP * size) / 2;
      const out = range(lt, dur - 0.28, dur);
      const o = { size, tracking: -0.05, stagger: 0.06, pOut: out };
      type(ctx, a, { ...o, x: colX(0) - 6, y, family: FONTS.medium, pIn: range(lt, 1.0, 1.9) });
      type(ctx, b, { ...o, x: colX(12), y, family: FONTS.lightItalic, align: 'right', pIn: range(lt, 1.15, 2.05) });
      const [s1, s2] = config.copy.oneSub;
      label(ctx, s1, colX(0), y + 110, { pIn: range(lt, 1.5, 2.1), pOut: out, size: 36 });
      label(ctx, s2, colX(12), y + 110, { pIn: range(lt, 1.6, 2.2), pOut: out, size: 36, align: 'right' });
    },
    frame: () => ({ chapter: config.role }),
    post: () => ({ bloom: 0.3 }),
    samples: (lt) => (lt < RISE[1] + 0.2 ? 5 : 2),
  };
}
