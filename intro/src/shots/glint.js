import * as THREE from 'three';
import { RectAreaLight } from 'three';
import { config } from '../config.js';
import { ease, lerp, range } from '../lib/anim.js';
import { type, dot, colX, FONTS, PAPER } from '../overlay.js';
import { baseScene, camera, makeSlab, toScreen, SLAB, H } from './common.js';

// A point of light stretches into a line — the edge of a slab seen side-on — and the
// camera orbits to reveal its face. The slab is the protagonist of the whole film.
export function createGlint(A) {
  const [start, end] = config.shots.glint;
  const dur = end - start;
  const scene = baseScene(A.env.hairline, 0);
  const cam = camera(26);
  const slab = makeSlab({ screen: A.hero.tex, intensity: 0 });
  scene.add(slab.group);

  const key = new RectAreaLight(0xffffff, 0, 0.6, 5);
  scene.add(key);
  const sweep = new RectAreaLight(0xffffff, 0, 0.35, 7);
  scene.add(sweep);

  const R = 8.2;
  const REVEAL = 1.4;
  const azAt = (lt) => lerp(Math.PI / 2 - 0.004, 0.38, ease.inOutCubic(range(lt, REVEAL, REVEAL + 1.55)));
  const place = (lt) => {
    const az = azAt(lt);
    const el = lerp(0, 0.1, range(lt, REVEAL, dur));
    const r = R - 0.5 * range(lt, 0, dur);
    cam.position.set(Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld(true);
  };

  // Where the side edge lands on screen at the start, so the drawn line matches it exactly.
  place(0);
  const edgeTop = toScreen(new THREE.Vector3(SLAB.w / 2, SLAB.h / 2, 0), cam);
  const edgeBot = toScreen(new THREE.Vector3(SLAB.w / 2, -SLAB.h / 2, 0), cam);

  return {
    name: 'glint',
    start,
    end,
    update(lt) {
      place(lt);
      const lit = range(lt, REVEAL - 0.15, REVEAL + 0.25);
      key.intensity = 22 * lit;
      key.position.set(7, 0.6, 1.2);
      key.lookAt(0, 0, 0);
      const s = ease.inOutCubic(range(lt, REVEAL + 0.2, dur + 0.4));
      sweep.intensity = 16 * range(lt, REVEAL, REVEAL + 0.5);
      sweep.position.set(lerp(6, -4, s), 0.4, lerp(3, 6, s));
      sweep.lookAt(0, 0, 0);
      scene.environmentIntensity = 0.45 * range(lt, REVEAL, REVEAL + 0.8);
      scene.environmentRotation.set(0, lerp(0.9, -0.5, s), 0);
      slab.faceMat.emissiveIntensity = 0.9 * ease.inQuad(range(lt, 2.15, dur));
      return { scene, camera: cam };
    },
    overlay(ctx, ctxD, ctxM, lt) {
      const x = (edgeTop.x + edgeBot.x) / 2;
      const yc = (edgeTop.y + edgeBot.y) / 2;
      const half = (edgeBot.y - edgeTop.y) / 2;
      const r = 5 * ease.outBack(range(lt, 0.35, 0.65));
      const stretch = ease.inOutQuart(range(lt, 0.75, REVEAL));
      const a = 1 - range(lt, REVEAL, REVEAL + 0.3);
      if (a > 0 && r > 0) {
        if (stretch <= 0) dot(ctx, x, yc, r, PAPER);
        else {
          ctx.save();
          ctx.globalAlpha = a;
          ctx.fillStyle = PAPER;
          const hh = Math.max(r, half * stretch);
          const ww = lerp(r * 2, 3, stretch);
          ctx.beginPath();
          ctx.roundRect(x - ww / 2, yc - hh, ww, hh * 2, ww / 2);
          ctx.fill();
          ctx.restore();
        }
      }
      type(ctx, config.copy.glint, {
        x: colX(0),
        y: H - 300,
        size: 132,
        family: FONTS.regular,
        tracking: -0.035,
        split: 'words',
        pIn: range(lt, 1.75, 2.6),
        pOut: range(lt, dur - 0.22, dur),
        stagger: 0.25,
      });
    },
    frame: () => ({ chapter: 'Prologue' }),
    post: () => ({ bloom: 0.35, bloomThreshold: 0.85 }),
    samples: (lt) => (lt < REVEAL ? 1 : 4),
  };
}
