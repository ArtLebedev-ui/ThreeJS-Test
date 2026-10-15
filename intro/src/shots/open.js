import * as THREE from 'three';
import { config } from '../config.js';
import { ease, lerp, range, tween, wobble } from '../lib/anim.js';
import { darkGloss } from '../assets.js';
import { decode, hairline } from '../overlay.js';
import { baseScene, camera, W, H } from './common.js';

// Extreme macro of an unidentified glossy edge; a single light sweeps across it.
// It is the juror's cursor, revealed later in "ONE JURY".
export function createOpen(A) {
  const [start, end] = config.shots.open;
  const dur = end - start;
  const scene = baseScene(A.env.hairline, 0.55);
  const cam = camera(24);
  const cursor = new THREE.Mesh(A.cursorGeo, darkGloss({ roughness: 0.12, metalness: 0.5 }));
  cursor.scale.setScalar(4);
  cursor.rotation.set(0.25, -0.55, 0.1);
  scene.add(cursor);

  const key = new THREE.PointLight(0xffffff, 0, 12, 1.5);
  scene.add(key);

  return {
    name: 'open',
    start,
    end,
    update(lt) {
      const p = lt / dur;
      const push = ease.inExpo(range(lt, dur - 0.5, dur));
      cam.position.set(
        lerp(-0.2, 0.25, p) + wobble(lt, 1, 0.6) * 0.01,
        lerp(-0.5, -0.9, ease.inOutCubic(p)) + wobble(lt, 2, 0.6) * 0.01,
        lerp(4.2, 3.4, ease.outCubic(p)) - push * 2.2
      );
      cam.lookAt(lerp(0.6, 0.8, p), lerp(-1.1, -1.4, p), 0);
      cam.rotation.z += lerp(0.12, 0.02, p);
      scene.environmentRotation.set(0, lerp(-1.3, 1.1, ease.inOutCubic(p)), 0.25);
      scene.environmentIntensity = 0.55 * (1 - 0.5 * ease.inOutCubic(range(lt, 2.2, 2.7)));
      key.position.set(lerp(-3, 3, ease.inOutCubic(p)), 1.5, -1.5);
      key.intensity = 6 * range(lt, 0.3, 1.2) * (1 - ease.inOutCubic(range(lt, 2.25, 2.6)));
      return { scene, camera: cam };
    },
    overlay(ctx, ctxD, lt, t, frame) {
      const [l1, l2] = config.open.lines;
      const out = 1 - range(lt, 2.45, 2.75);
      const s = 30;
      decode(ctx, l1, W / 2, H / 2 - 28, range(lt, 0.45, 1.25), { size: s, align: 'center', alpha: out, frame, seed: 3 });
      decode(ctx, l2, W / 2, H / 2 + 52, range(lt, 1.0, 1.8), { size: s, align: 'center', alpha: out * 0.6, frame, seed: 9 });
      const lw = 380 * ease.outExpo(range(lt, 0.3, 1.4));
      hairline(ctx, W / 2 - lw, H / 2 + 4, W / 2 + lw, H / 2 + 4, { alpha: 0.35 * out, width: 1.5 });
    },
    post(lt) {
      return {
        fade: tween(lt, 0, 0.9, ease.outCubic),
        flash: ease.inExpo(range(lt, dur - 0.18, dur)) * 0.9,
        bloom: 0.7,
        bloomThreshold: 0.8,
        vignette: 0.75,
      };
    },
    samples: (lt) => (lt > dur - 0.55 ? 5 : 1),
    hud: () => ({ alpha: 0 }),
  };
}
