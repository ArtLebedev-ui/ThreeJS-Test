import * as THREE from 'three';
import { config, finalScore } from '../config.js';
import { ease, lerp, range, wobble } from '../lib/anim.js';
import { darkGloss, textGeo } from '../assets.js';
import { kinetic, fitSize, mono, hairline } from '../overlay.js';
import { baseScene, camera, W, H } from './common.js';
import { drumAngle } from './score-timing.js';

// The verdict: mechanical drums of extruded numerals spin and lock onto the weighted score.
export function createScore(A) {
  const [start, end] = config.shots.score;
  const dur = end - start;
  const scene = baseScene(A.env.front, 1.1);
  scene.fog = new THREE.Fog(0x000000, 6, 13);
  const cam = camera(30);
  const value = finalScore().toFixed(2);

  const SIZE = 1.25;
  const R = 2.7;
  const pitch = 1.22;
  const mat = darkGloss({ roughness: 0.2, metalness: 0.85, color: 0x2a2a2e });
  const digitGeos = [...'0123456789'].map((d) => textGeo(A.fontBlack, d, { size: SIZE, depth: 0.45, bevel: 0.03 }));

  const chars = [...value];
  const totalW = (chars.length - 1) * pitch - pitch * 0.45;
  const drums = [];
  let x = -totalW / 2;
  const root = new THREE.Group();
  scene.add(root);
  let dotMesh = null;
  chars.forEach((ch, i) => {
    if (ch === '.') {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 48, 24),
        new THREE.MeshPhysicalMaterial({ color: config.accent, emissive: config.accent, emissiveIntensity: 0.9, roughness: 0.2, clearcoat: 1 })
      );
      dot.position.set(x - pitch * 0.22, -SIZE * 0.5 + 0.17, 0.0);
      root.add(dot);
      dotMesh = dot;
      x += pitch * 0.55;
      return;
    }
    const drum = new THREE.Group();
    drum.position.set(x, 0, -R);
    for (let d = 0; d < 10; d++) {
      const a = (d / 10) * Math.PI * 2;
      const m = new THREE.Mesh(digitGeos[d], mat);
      m.position.set(0, Math.sin(a) * R, Math.cos(a) * R);
      m.rotation.x = -a;
      drum.add(m);
    }
    root.add(drum);
    drums.push({ drum, digit: Number(ch), idx: drums.filter((dd) => dd.drum).length });
    x += pitch;
  });

  const band = new THREE.RectAreaLight(0xffffff, 0, 18, 0.9);
  scene.add(band);

  return {
    name: 'score',
    start,
    end,
    update(lt) {
      drums.forEach((d) => {
        if (d.drum) d.drum.rotation.x = drumAngle(lt, d.digit, d.idx);
      });
      const reveal = ease.outCubic(range(lt, 0.5, 1.4));
      scene.environmentIntensity = 0.45 * reveal;
      band.intensity = 7 * reveal;
      band.position.set(lerp(-0.8, 0.4, range(lt, 0.6, dur)), lerp(3.2, 0.1, ease.inOutCubic(range(lt, 0.6, dur))), 7.5);
      band.lookAt(0, 0, 0);
      dotMesh.scale.setScalar(Math.max(1e-3, ease.outBack(range(lt, 0.85, 1.25), 2.2)));
      root.rotation.y = lerp(0.12, -0.1, ease.inOutCubic(lt / dur));
      const p = lt / dur;
      cam.position.set(
        lerp(-1.6, 0.6, ease.inOutCubic(p)) + wobble(lt, 3, 0.4) * 0.03,
        lerp(-0.9, -0.3, p),
        lerp(9.8, 7.6, p) - 1.5 * ease.inExpo(range(lt, dur - 0.35, dur))
      );
      cam.lookAt(0, 0.05, 0);
      scene.environmentRotation.set(0, lerp(-1.4, 0.3, ease.inOutCubic(range(lt, 0.5, 3.2))), 0.1);
      return { scene, camera: cam };
    },
    overlay(ctx, ctxD, lt) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.16, 'rgba(0,0,0,0.92)');
      g.addColorStop(0.34, 'rgba(0,0,0,0)');
      g.addColorStop(0.68, 'rgba(0,0,0,0)');
      g.addColorStop(0.86, 'rgba(0,0,0,0.92)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const [w1, w2] = config.score.words;
      const size = fitSize(ctx, 'THOUSANDS', W * 0.62);
      const out = range(lt, 0.95, 1.25);
      kinetic(ctx, w1, { x: 72, y: H * 0.6, size, pIn: range(lt, 0.0, 0.45), pOut: out });
      kinetic(ctx, w2, { x: 72, y: H * 0.6 + size * 0.86, size, pIn: range(lt, 0.15, 0.6), pOut: out });

      const x = W - 72;
      const y0 = H * 0.66;
      const vis = range(lt, 1.3, 1.6) * (1 - range(lt, dur - 0.3, dur));
      config.criteria.forEach((c, i) => {
        const p = range(lt, 1.4 + i * 0.22, 1.7 + i * 0.22);
        const s = (c.score * ease.outCubic(p)).toFixed(2);
        const row = `${c.word.padEnd(11, ' ')} ${s}  ×${String(c.weight).padStart(3, ' ')}%`;
        mono(ctx, row, x, y0 + i * 40, { size: 24, align: 'right', alpha: vis * (p > 0 ? 0.85 : 0), fullText: row });
      });
      const ly = y0 + config.criteria.length * 40 - 14;
      const lw = 520 * ease.outExpo(range(lt, 2.4, 3.0));
      hairline(ctx, x - lw, ly, x, ly, { alpha: vis * 0.6, width: 2 });
      mono(ctx, `TOTAL ${value}`, x, ly + 44, { size: 24, align: 'right', alpha: vis * range(lt, 2.8, 2.95), color: '#fff' });
    },
    post: (lt) => ({
      bloom: 0.8,
      flash: 0.22 * Math.pow(1 - range(lt, 2.8, 3.05), 3) * (lt > 2.8 ? 1 : 0) + ease.inExpo(range(lt, dur - 0.12, dur)) * 0.5,
    }),
    samples: (lt) => (lt > 0.5 && lt < 2.85 ? 6 : 2),
    hud: (lt) => ({ alpha: 1, label: 'VERDICT', meta: 'WEIGHTED AVERAGE', labelP: range(lt, 0.1, 0.7) }),
  };
}
