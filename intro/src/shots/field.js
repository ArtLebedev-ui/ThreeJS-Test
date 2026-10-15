import * as THREE from 'three';
import { config } from '../config.js';
import { ease, lerp, range, mulberry32, wobble } from '../lib/anim.js';
import { kinetic, fitSize } from '../overlay.js';
import { baseScene, camera, makePanels, W, H } from './common.js';

// Camera flies through a dense field of floating website panels.
export function createField(A) {
  const [start, end] = config.shots.field;
  const dur = end - start;
  const scene = baseScene(A.env.studio, 0.9);
  scene.fog = new THREE.Fog(0x000000, 6, 38);
  const cam = camera(42);

  const N = 520;
  const panels = makePanels(N, A.atlas, { screen: 0.75 });
  scene.add(panels.group);
  const rand = mulberry32(11);
  const items = [];
  for (let i = 0; i < N; i++) {
    const a = rand() * Math.PI * 2;
    const r = 1.6 + Math.pow(rand(), 0.8) * 9;
    items.push({
      x: Math.cos(a) * r * 1.3,
      y: Math.sin(a) * r * 0.85,
      z: 6 - rand() * 150,
      rx: (rand() - 0.5) * 0.5,
      ry: (rand() - 0.5) * 1.1,
      rz: (rand() - 0.5) * 0.3,
      spin: (rand() - 0.5) * 0.5,
      tile: Math.floor(rand() * 16),
      bright: 0.35 + rand() * 0.75,
      s: 0.8 + rand() * 0.7,
    });
  }
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  const camZ = (lt) => 9 - lt * 24 - 70 * ease.inQuart(range(lt, 2.3, dur));

  return {
    name: 'field',
    start,
    end,
    update(lt) {
      items.forEach((it, i) => {
        pos.set(it.x, it.y, it.z);
        e.set(it.rx + it.spin * lt * 0.3, it.ry + it.spin * lt, it.rz);
        q.setFromEuler(e);
        panels.set(i, pos, q, it.s, it.tile, it.bright);
      });
      panels.commit();
      const z = camZ(lt);
      cam.position.set(wobble(lt, 4, 0.5) * 0.15, wobble(lt, 5, 0.5) * 0.1, z);
      cam.lookAt(wobble(lt, 6, 0.4) * 0.3, 0, z - 10);
      cam.rotation.z = lerp(-0.08, 0.22, ease.inOutCubic(lt / dur));
      return { scene, camera: cam };
    },
    overlay(ctx, ctxD, lt) {
      const [w1, w2] = config.field.words;
      const size = fitSize(ctx, w1, W * 0.62);
      const x = 72;
      const y = H * 0.6;
      const out = range(lt, dur - 0.45, dur - 0.05);
      kinetic(ctx, w1, { x, y, size, pIn: range(lt, 0.12, 0.85), pOut: out, stagger: 0.07 });
      kinetic(ctx, w2, { x, y: y + size * 0.86, size, pIn: range(lt, 0.45, 1.2), pOut: out, stagger: 0.07 });
    },
    post: (lt) => ({ bloom: 0.75, flash: 0.5 * Math.pow(1 - range(lt, 0, 0.25), 2) }),
    samples: (lt) => (lt > 2.2 ? 6 : 3),
    hud(lt) {
      const n = Math.floor(2147 * ease.outCubic(range(lt, 0.1, 2.6)));
      return {
        alpha: range(lt, 0, 0.3),
        label: '00 / SELECTION',
        meta: `${config.field.counterLabel} ${n.toLocaleString('en-US').padStart(5, '0')}`,
        labelP: range(lt, 0.1, 0.8),
      };
    },
  };
}
