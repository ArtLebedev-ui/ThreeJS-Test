import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { config } from '../config.js';
import { ease, lerp, range, wobble, mulberry32 } from '../lib/anim.js';
import { darkGloss, capScale } from '../assets.js';
import { decode, hairline } from '../overlay.js';
import { baseScene, camera, W, H } from './common.js';

// Title card: the rubric name as monumental extruded type, assembling out of depth.
export function createTitle(A) {
  const [start, end] = config.shots.title;
  const dur = end - start;
  const scene = baseScene(A.env.front, 1.2);
  const cam = camera(26);
  const font = A.fontBlack;
  const SIZE = 1.55 * capScale(font);
  const DEPTH = 0.55;
  const tracking = -0.035 * SIZE;
  const scale = SIZE / font.data.resolution;
  const mat = darkGloss({ roughness: 0.2, metalness: 0.85, color: 0x222226 });

  const chars = [...config.title];
  let pen = 0;
  const letters = [];
  const rand = mulberry32(3);
  chars.forEach((ch) => {
    const glyph = font.data.glyphs[ch] ?? font.data.glyphs['?'];
    const adv = glyph.ha * scale;
    if (ch !== ' ') {
      const g = new TextGeometry(ch, { font, size: SIZE, depth: DEPTH, curveSegments: 14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 8 });
      g.computeBoundingBox();
      const b = g.boundingBox;
      const cx = (b.min.x + b.max.x) / 2;
      const cy = (b.min.y + b.max.y) / 2;
      g.translate(-cx, -cy, -DEPTH);
      const mesh = new THREE.Mesh(g, mat);
      scene.add(mesh);
      letters.push({ mesh, x: pen + cx, y: cy, dz: -3 - rand() * 5, ry: (rand() - 0.5) * 1.4, rx: (rand() - 0.5) * 0.6, dy: (rand() - 0.5) * 1.5 });
    }
    pen += adv + tracking;
  });
  const total = pen - tracking;
  letters.forEach((l) => {
    l.x -= total / 2;
    l.y -= SIZE * 0.25;
  });

  const band = new THREE.RectAreaLight(0xffffff, 0, 16, 1.1);
  const fill = new THREE.RectAreaLight(0xe8eeff, 0, 18, 3.2);
  fill.position.set(0, 1.4, 10);
  fill.lookAt(0, 0, 0);
  scene.add(band, fill);

  return {
    name: 'title',
    start,
    end,
    update(lt) {
      letters.forEach((l, i) => {
        const p = ease.outExpo(range(lt, 0.05 + i * 0.12, 1.8 + i * 0.12));
        l.mesh.position.set(l.x, l.y + l.dy * (1 - p), l.dz * (1 - p));
        l.mesh.rotation.set(l.rx * (1 - p), l.ry * (1 - p), 0);
      });
      const p = ease.inOutCubic(range(lt, 0, 2.6));
      const drift = range(lt, 2.6, dur);
      const first = letters[0];
      cam.position.set(
        lerp(first.x - 2.6, 0, p) + wobble(lt, 9, 0.4) * 0.02,
        lerp(0.4, 0.25, p),
        lerp(3.4, 12.5, p) - drift * 0.8
      );
      cam.lookAt(lerp(first.x + 0.2, 0, p), lerp(0.1, 0.15, p), 0);
      scene.environmentRotation.set(0.15, lerp(-1.2, 1.0, ease.inOutCubic(range(lt, 0.2, 4.2))), 0);
      const sweep = ease.inOutCubic(range(lt, 1.6, 3.6));
      band.intensity = 14 * range(lt, 0.4, 1.6);
      fill.intensity = 2.2 * ease.inOutCubic(range(lt, 2.6, 3.8));
      band.position.set(lerp(-3, 3, sweep), lerp(4.5, -1.8, sweep), 10);
      band.lookAt(0, 0, 0);
      return { scene, camera: cam };
    },
    overlay(ctx, ctxD, lt, t, frame) {
      const vis = 1 - range(lt, dur - 0.9, dur - 0.55);
      const y = H * 0.78;
      const lw = 260 * ease.outExpo(range(lt, 1.9, 2.7));
      hairline(ctx, W / 2 - lw, y - 52, W / 2 + lw, y - 52, { alpha: 0.4 * vis, width: 1.5 });
      decode(ctx, config.subtitle, W / 2, y, range(lt, 2.1, 2.8), { size: 30, align: 'center', alpha: vis, frame, seed: 11 });
    },
    post: (lt) => ({
      bloom: 0.7,
      fade: 1 - ease.inOutCubic(range(lt, dur - 0.9, dur - 0.45)),
      flash: 0.35 * Math.pow(1 - range(lt, 0, 0.2), 2),
    }),
    samples: (lt) => (lt < 2.0 ? 4 : 1),
    hud: (lt) => ({
      alpha: 1,
      label: `WITH ${config.author}`,
      meta: `${config.platform} — ${config.episode}`,
      labelP: range(lt, 2.6, 3.3),
    }),
  };
}
