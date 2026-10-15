import * as THREE from 'three';
import { config } from '../config.js';
import { ease, lerp, range, mulberry32, wobble, tween } from '../lib/anim.js';
import { darkGloss } from '../assets.js';
import { kinetic, fitSize } from '../overlay.js';
import { baseScene, camera, makePanels, W, H } from './common.js';

// A wall of thousands of sites. The juror's cursor enters, clicks one,
// and every other site goes dark.
export function createOne(A) {
  const [start, end] = config.shots.one;
  const dur = end - start;
  const scene = baseScene(A.env.studio, 0.8);
  scene.fog = new THREE.Fog(0x000000, 8, 34);
  const cam = camera(34);

  const cols = 31;
  const rows = 21;
  const N = cols * rows;
  const sx = 1.78;
  const sy = 1.14;
  const panels = makePanels(N, A.atlas, { screen: 0.8 });
  scene.add(panels.group);
  const rand = mulberry32(5);
  const cells = [];
  const center = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = (c - (cols - 1) / 2) * sx;
      const y = (r - (rows - 1) / 2) * sy;
      cells.push({ x, y, d: Math.hypot(x, y * 1.2), tile: i === center ? 2 : Math.floor(rand() * 16), b: 0.22 + rand() * 0.4, j: rand() });
    }
  }

  const cursor = new THREE.Mesh(A.cursorGeo, darkGloss({ roughness: 0.16, metalness: 0.9, color: 0x2a2a2e }));
  scene.add(cursor);

  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const clickT = 1.4;

  return {
    name: 'one',
    start,
    end,
    update(lt) {
      const wave = (lt - clickT) * 22;
      cells.forEach((c, i) => {
        let bright = c.b * (0.85 + 0.15 * Math.sin(lt * 3 + c.j * 20));
        let z = 0;
        if (i === center) {
          bright = lerp(c.b, 1.25, ease.outCubic(range(lt, clickT, clickT + 0.4)));
          z = 0.35 * ease.outExpo(range(lt, clickT, clickT + 0.8));
        } else if (lt > clickT) {
          const k = ease.outCubic(range(wave - c.d, 0, 3));
          bright *= lerp(1, 0.04, k);
          z = -0.25 * k;
        }
        pos.set(c.x, c.y, z);
        q.identity();
        panels.set(i, pos, q, 1, c.tile, bright);
      });
      panels.commit();

      const enter = ease.inOutQuart(range(lt, 0.15, clickT - 0.1));
      const press = Math.sin(Math.PI * range(lt, clickT - 0.08, clickT + 0.14));
      cursor.position.set(
        lerp(4.5, 0.2, enter) + Math.sin(enter * Math.PI) * 0.6,
        lerp(-4, -0.08, enter) - Math.sin(enter * Math.PI) * 0.5,
        1.2 - press * 0.4 + Math.sin(enter * Math.PI) * 0.8
      );
      cursor.rotation.set(0.15 - press * 0.15, lerp(-0.6, -0.12, enter), lerp(0.35, 0.05, enter));
      cursor.scale.setScalar(1.1 - press * 0.08);

      const p = lt / dur;
      const z = lerp(17, 8.5, ease.outCubic(p)) - 1.2 * ease.inExpo(range(lt, dur - 0.35, dur));
      cam.position.set(lerp(-3.2, -0.6, ease.inOutCubic(p)) + wobble(lt, 1) * 0.04, lerp(1.6, 0.4, ease.inOutCubic(p)), z);
      cam.lookAt(lerp(0.6, 0.15, p), 0, 0);
      scene.environmentRotation.set(0, lerp(-0.6, 0.5, p), 0);
      return { scene, camera: cam };
    },
    overlay(ctx, ctxD, lt) {
      const [w1, w2] = config.one.words;
      const size = fitSize(ctx, 'THOUSANDS', W * 0.62);
      const out = range(lt, dur - 0.4, dur - 0.05);
      kinetic(ctxD, w1, { x: 72, y: H * 0.6, size, pIn: range(lt, 0.05, 0.6), pOut: out });
      kinetic(ctxD, w2, { x: 72, y: H * 0.6 + size * 0.86, size, pIn: range(lt, 0.3, 0.95), pOut: out });
    },
    post: (lt) => ({ bloom: 0.8, flash: 0.35 * Math.pow(1 - range(lt, clickT, clickT + 0.25), 3) * (lt > clickT ? 1 : 0) }),
    samples: (lt) => (lt < 1.1 || lt > dur - 0.4 ? 4 : 2),
    hud: (lt) => ({ alpha: 1, label: '00 / SELECTION', meta: 'SUBMISSIONS 02,147 → 001', labelP: tween(lt, 1.3, 2.0) }),
  };
}
