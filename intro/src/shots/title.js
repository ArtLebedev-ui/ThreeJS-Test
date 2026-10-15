import * as THREE from 'three';
import { RectAreaLight } from 'three';
import { config } from '../config.js';
import { ease, lerp, range } from '../lib/anim.js';
import { type, label, rule, dot, measure, colX, FONTS } from '../overlay.js';
import { baseScene, camera, makeSlab, SLAB, H, W } from './common.js';
import { drawScore } from './score.js';
import { TITLE } from './title-timing.js';

// We fly into the slab's screen until its glass is the frame itself, and the title is
// set inside it. The film closes on the same point it opened with.
export function createTitle(A) {
  const [start, end] = config.shots.title;
  const scene = baseScene(A.env.front, 1.3);
  const empty = new THREE.Scene();
  empty.background = new THREE.Color(0x000000);
  const cam = camera(26);
  const slab = makeSlab({ screen: A.hero.tex, intensity: 0.85 });
  scene.add(slab.group);
  const streak = new RectAreaLight(0xffffff, 0, 0.25, 8);
  scene.add(streak);

  const faceH = SLAB.h - 0.012;
  const fillZ = SLAB.d / 2 + faceH / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const endZ = SLAB.d / 2 + (fillZ - SLAB.d / 2) * 0.97;

  let L = null;
  const layout = (ctx) => {
    if (L) return L;
    const size = 1060;
    const x = colX(0) - size * 0.045;
    const y = H - 250;
    const w = measure(ctx, config.title, size, FONTS.medium, -0.055);
    const r = size * 0.068;
    L = { size, x, y, w, r, dx: x + w + r * 1.4, dy: y - r };
    return L;
  };

  return {
    name: 'title',
    start,
    end,
    update(lt) {
      if (lt > TITLE.fill + 0.05) return { scene: empty, camera: cam };
      const e = ease.inOutQuart(range(lt, 0.05, TITLE.fill));
      slab.group.position.set(0, lerp(-2.3, 0, ease.outCubic(range(lt, 0, TITLE.fill - 0.2))), 0);
      slab.group.rotation.set(lerp(0.5, 0, ease.outCubic(range(lt, 0, TITLE.fill - 0.1))), lerp(-0.25, 0, e), 0);
      cam.position.set(0, 0, lerp(12.5, endZ, e));
      cam.lookAt(0, 0, 0);
      streak.intensity = 6;
      slab.faceMat.emissiveIntensity = 0.85 * (1 - ease.inOutCubic(range(lt, 0.75, TITLE.fill - 0.05)));
      streak.position.set(lerp(-5, 4, e), 0.5, 4);
      streak.lookAt(0, 0, 0);
      scene.environmentRotation.set(0, lerp(-0.8, 0.8, e), 0);
      return { scene, camera: cam };
    },
    overlay(ctx, ctxD, ctxM, lt) {
      if (lt < 0.6) drawScore(ctx, 10, { pOut: range(lt, 0, 0.55) });
      const T = layout(ctx);
      const out = range(lt, TITLE.out, TITLE.out + 0.5);
      type(ctx, config.title, {
        x: T.x,
        y: T.y,
        size: T.size,
        tracking: -0.055,
        stagger: 0.1,
        pIn: range(lt, TITLE.fill, TITLE.fill + 1.2),
        pOut: out,
        maskBottom: 0.3,
      });

      const ruleY = 470;
      rule(ctx, colX(0), ruleY, colX(12), range(lt, TITLE.fill + 0.3, TITLE.fill + 1.3), { pOut: range(lt, TITLE.out, TITLE.out + 0.5) });
      const o = { size: 54, family: FONTS.regular, tracking: -0.02, alpha: 1, pOut: out };
      const [s1, s2] = config.subtitle;
      label(ctx, s1, colX(0), ruleY - 92, { ...o, pIn: range(lt, TITLE.fill + 0.5, TITLE.fill + 1.1) });
      label(ctx, s2, colX(0), ruleY - 28, { ...o, pIn: range(lt, TITLE.fill + 0.58, TITLE.fill + 1.18) });
      label(ctx, 'with', colX(8), ruleY - 92, { ...o, family: FONTS.lightItalic, pIn: range(lt, TITLE.fill + 0.66, TITLE.fill + 1.26) });
      label(ctx, config.author, colX(8), ruleY - 28, { ...o, pIn: range(lt, TITLE.fill + 0.74, TITLE.fill + 1.34) });
      label(ctx, config.platform, colX(12), ruleY + 70, { size: 30, align: 'right', pIn: range(lt, TITLE.fill + 0.9, TITLE.fill + 1.5), pOut: out });
      label(ctx, config.year, colX(0), ruleY + 70, { size: 30, pIn: range(lt, TITLE.fill + 0.9, TITLE.fill + 1.5), pOut: out });

      // The period of "Jury." is the accent dot; it outlives the title and closes the film.
      const grow = ease.outBack(range(lt, TITLE.fill + 1.0, TITLE.fill + 1.35), 2);
      const travel = ease.inOutQuart(range(lt, TITLE.dotTravel[0], TITLE.dotTravel[1]));
      const gone = ease.inExpo(range(lt, TITLE.dotGone[0], TITLE.dotGone[1]));
      const x = lerp(T.dx, W / 2, travel);
      const y = lerp(T.dy, H / 2, travel);
      dot(ctx, x, y, T.r * grow * lerp(1, 0.35, travel) * (1 - gone));
    },
    frame: (lt) => ({ chapter: config.tagline.join(' '), out: range(lt, TITLE.out, TITLE.out + 0.5) }),
    post: () => ({ bloom: 0.25 }),
    samples: (lt) => (lt < TITLE.fill + 0.05 ? 5 : 1),
  };
}
