import * as THREE from 'three';
import { RectAreaLight } from 'three';
import { config } from '../config.js';
import { ease, lerp, range, clamp } from '../lib/anim.js';
import { type, label, colX, FONTS, PAPER } from '../overlay.js';
import { goldenSquares, FACE } from '../assets.js';
import { baseScene, camera, makeSlab, faceToScreen, contactShadow, SLAB, W, H } from './common.js';
import { USABILITY_CLICKS, CREATIVITY_MORPH, CONTENT_HIGHLIGHT } from './criteria-timing.js';

// Shifts the 3D image up so objects sit in the upper part of the frame, above the type.
const LIFT = 0.09;
function liftedCamera(fov) {
  const cam = camera(fov);
  cam.setViewOffset(W, H, 0, H * LIFT, W, H);
  return cam;
}

/** Chapter type shared by the four criteria: word bottom-left, weight bottom-right. */
function chapterType(ctx, c, lt, dur) {
  const base = H - 210;
  const pOut = range(lt, dur - 0.24, dur);
  type(ctx, c.word, {
    x: colX(0) - 10,
    y: base,
    size: 330,
    tracking: -0.05,
    stagger: 0.05,
    pIn: range(lt, 0.1, 1.0),
    pOut,
  });
  type(ctx, `${c.weight}%`, {
    x: colX(12),
    y: base,
    size: 200,
    family: FONTS.light,
    tracking: -0.04,
    align: 'right',
    stagger: 0.08,
    pIn: range(lt, 0.3, 1.1),
    pOut,
  });
  label(ctx, 'Weight', colX(12), base - 200, { align: 'right', pIn: range(lt, 0.5, 1.1), pOut });
}

function withChapter(c, i, dur, shot) {
  const [start, end] = config.shots[c.key];
  return {
    name: c.key,
    start,
    end,
    ...shot,
    overlay(ctx, ctxD, ctxM, lt, t, frame) {
      shot.overlay?.(ctx, ctxD, ctxM, lt, t, frame);
      chapterType(ctx, c, lt, dur);
    },
    frame: () => ({ chapter: c.note, index: `0${i + 1} / 04` }),
  };
}

export function createCriterion(A, c, i) {
  const [start, end] = config.shots[c.key];
  const dur = end - start;
  const build = { design, usability, creativity, content }[c.key];
  return withChapter(c, i, dur, build(A, dur));
}

function polyline(ctx, pts, { alpha = 0.5, width = 1.5, color = PAPER } = {}) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.restore();
}

/** Line through two screen points, extended to the frame edges. */
function guide(ctx, a, b, p, alpha) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const k = 4000 / L;
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const e = ease.inOutQuart(p);
  polyline(ctx, [
    { x: c.x - dx * k * e, y: c.y - dy * k * e },
    { x: c.x + dx * k * e, y: c.y + dy * k * e },
  ], { alpha, width: 1.2 });
}

// 01 DESIGN — the golden grid hidden inside the layout is drawn over the site.
function design(A, dur) {
  const scene = baseScene(A.env.front, 0.5);
  const cam = liftedCamera(26);
  const slab = makeSlab({ screen: A.hero.tex, intensity: 0.85 });
  scene.add(slab.group);
  const key = new RectAreaLight(0xffffff, 5, 8, 0.5);
  key.position.set(0, 4, 3);
  key.lookAt(0, 0, 0);
  scene.add(key);
  const squares = goldenSquares(8);

  const S = (u, v) => faceToScreen(slab.group, cam, u, v);
  const seg = (u1, v1, u2, v2, p) => {
    const e = ease.inOutQuart(clamp(p));
    return [S(u1, v1), S(lerp(u1, u2, e), lerp(v1, v2, e))];
  };
  const divider = (q) => {
    if (q.dir === 0) return [q.x + q.s, q.y, q.x + q.s, q.y + q.s];
    if (q.dir === 1) return [q.x, q.y + q.s, q.x + q.s, q.y + q.s];
    if (q.dir === 2) return [q.x, q.y, q.x, q.y + q.s];
    return [q.x, q.y, q.x + q.s, q.y];
  };
  const arc = (q, p) => {
    const C = [[q.x + q.s, q.y + q.s], [q.x, q.y + q.s], [q.x, q.y], [q.x + q.s, q.y]][q.dir];
    const a0 = [Math.PI, 1.5 * Math.PI, 0, 0.5 * Math.PI][q.dir];
    const pts = [];
    const n = 24;
    for (let k = 0; k <= n * p; k++) {
      const a = a0 + (k / n) * 0.5 * Math.PI;
      pts.push(S(C[0] + Math.cos(a) * q.s, C[1] + Math.sin(a) * q.s));
    }
    return pts;
  };

  return {
    update(lt) {
      const p = lt / dur;
      slab.group.rotation.set(lerp(-0.06, -0.02, p), lerp(0.2, 0.06, ease.outCubic(p)), 0);
      cam.position.set(0, 0, lerp(9.6, 8.9, ease.outCubic(p)));
      cam.lookAt(0, 0, 0);
      scene.environmentRotation.set(0, lerp(-0.6, 0.4, p), 0);
      return { scene, camera: cam };
    },
    overlay(ctx, ctxD, ctxM, lt) {
      const out = 1 - range(lt, dur - 0.3, dur);
      const fa = range(lt, 0.2, 0.7) * out;
      if (fa > 0) polyline(ctx, [S(0, 0), S(FACE.u, 0), S(FACE.u, 1), S(0, 1), S(0, 0)], { alpha: 0.5 * fa });
      guide(ctx, S(1, 0), S(1, 1), range(lt, 0.4, 1.2), 0.18 * out);
      guide(ctx, S(0, 1), S(FACE.u, 1), range(lt, 0.5, 1.3), 0.12 * out);
      guide(ctx, S(0, 0), S(FACE.u, 0), range(lt, 0.55, 1.35), 0.12 * out);
      squares.forEach((q, k) => {
        const [u1, v1, u2, v2] = divider(q);
        const pl = range(lt, 0.45 + k * 0.12, 0.85 + k * 0.12);
        if (pl > 0) polyline(ctx, seg(u1, v1, u2, v2, pl), { alpha: 0.7 * out, width: 1.8 });
        const pa = range(lt, 1.05 + k * 0.1, 1.25 + k * 0.1);
        if (pa > 0) polyline(ctx, arc(q, pa), { alpha: 0.95 * out, width: 2.5, color: config.accent });
      });
      const pL = range(lt, 1.0, 1.6);
      const a = S(0.5, 1);
      label(ctx, '1 : 1.618', a.x, a.y + 64, { align: 'center', pIn: pL, pOut: range(lt, dur - 0.3, dur), size: 28 });
      const b = S(1.3, 0);
      label(ctx, 'φ', b.x, b.y - 30, { align: 'center', pIn: range(lt, 1.2, 1.7), pOut: range(lt, dur - 0.3, dur), size: 34 });
    },
    post: () => ({ bloom: 0.25 }),
    samples: () => 2,
  };
}

// 02 USABILITY — the slab lies flat like a desk; a cursor finds its way and clicks.
function usability(A, dur) {
  const scene = baseScene(A.env.front, 0.55);
  const cam = liftedCamera(28);
  const slab = makeSlab({ screen: A.hero.tex, intensity: 0.85 });
  slab.group.rotation.x = -Math.PI / 2;
  scene.add(slab.group);
  const key = new RectAreaLight(0xffffff, 6, 6, 1.2);
  key.position.set(-2, 5, 1);
  key.lookAt(0, 0, 0);
  scene.add(key);

  const cursor = new THREE.Mesh(
    A.cursorGeo,
    new THREE.MeshPhysicalMaterial({ color: 0xefeeea, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1 })
  );
  cursor.scale.setScalar(0.46);
  scene.add(cursor);
  const shadow = contactShadow(0.7, 0.75);
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  const world = (u, v) => {
    slab.group.updateMatrixWorld(true);
    const x = (u / FACE.u - 0.5) * SLAB.w;
    const y = (0.5 - v) * SLAB.h;
    return new THREE.Vector3(x, y, SLAB.d / 2).applyMatrix4(slab.group.matrixWorld);
  };
  const { nav, cta } = A.hero.targets;
  const pts = [
    { t: 0.0, p: world(2.1, 1.25) },
    { t: USABILITY_CLICKS[0] - 0.08, p: world(nav.u, nav.v + 0.012) },
    { t: USABILITY_CLICKS[1] - 0.08, p: world(cta.u, cta.v + 0.01) },
    { t: dur, p: world(cta.u + 0.06, cta.v + 0.08) },
  ];
  const HOVER = 0.16;
  const posAt = (lt) => {
    let k = 0;
    while (k < pts.length - 2 && lt > pts[k + 1].t) k++;
    const a = pts[k];
    const b = pts[k + 1];
    const e = ease.inOutCubic(range(lt, a.t, b.t));
    const p = a.p.clone().lerp(b.p, e);
    const side = new THREE.Vector3(-(b.p.z - a.p.z), 0, b.p.x - a.p.x).multiplyScalar(0.18 * Math.sin(e * Math.PI));
    p.add(side);
    let h = HOVER;
    USABILITY_CLICKS.forEach((c) => {
      h -= 0.12 * Math.sin(Math.PI * range(lt, c - 0.08, c + 0.14)) ** 2;
    });
    p.y += h;
    return p;
  };

  const ring = (ctx, centre, r, alpha) => {
    const ptsS = [];
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      const u = centre.u + Math.cos(a) * r;
      const v = centre.v + Math.sin(a) * r;
      ptsS.push(faceToScreen(slab.group, cam, u, v));
    }
    polyline(ctx, ptsS, { alpha, width: 2 });
  };

  return {
    update(lt) {
      const p = lt / dur;
      const az = lerp(0.5, 0.32, p);
      const r = lerp(7.0, 6.4, ease.outCubic(p));
      cam.position.set(Math.sin(az) * r, lerp(5.2, 4.8, p), Math.cos(az) * r);
      cam.lookAt(0.15, 0, 0.1);
      const c = posAt(lt);
      cursor.position.copy(c);
      cursor.rotation.set(-Math.PI / 2 + 0.1, 0, 0.35);
      shadow.position.set(c.x + 0.12, SLAB.d / 2 + 0.003, c.z + 0.18);
      const h = c.y - SLAB.d / 2;
      shadow.scale.setScalar(0.6 + h * 2.5);
      shadow.material.opacity = clamp(1.1 - h * 3.5, 0.2, 1);
      const pulse = USABILITY_CLICKS.reduce((s, t) => s + Math.exp(-Math.max(0, lt - t) * 8) * (lt > t ? 1 : 0), 0);
      slab.faceMat.emissiveIntensity = 0.85 + 0.25 * pulse;
      return { scene, camera: cam };
    },
    overlay(ctx, ctxD, ctxM, lt) {
      const targets = [nav, cta];
      USABILITY_CLICKS.forEach((c, k) => {
        for (let j = 0; j < 2; j++) {
          const q = range(lt, c + j * 0.09, c + 0.75 + j * 0.09);
          if (q > 0 && q < 1) ring(ctx, targets[k], 0.02 + ease.outCubic(q) * 0.16, 0.8 * (1 - q));
        }
      });
      const ul = range(lt, USABILITY_CLICKS[0], USABILITY_CLICKS[0] + 0.35);
      if (ul > 0 && lt < dur - 0.1) {
        const a = faceToScreen(slab.group, cam, nav.u - 0.045, nav.v + 0.03);
        const b = faceToScreen(slab.group, cam, nav.u - 0.045 + 0.09 * ease.outExpo(ul), nav.v + 0.03);
        polyline(ctx, [a, b], { alpha: 0.9, width: 2.5 });
      }
    },
    post: () => ({ bloom: 0.25 }),
    samples: (lt) => (USABILITY_CLICKS.some((c) => Math.abs(lt - c) < 0.6) ? 4 : 2),
  };
}

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/**
 * A sphere mesh that also knows where each vertex sits on the slab, so the slab can
 * inflate into a living form (uMorph 0 → 1).
 */
function morphGeometry(R, detail) {
  const g = new THREE.IcosahedronGeometry(R, detail);
  const pos = g.attributes.position;
  const box = new Float32Array(pos.count * 3);
  const boxN = new Float32Array(pos.count * 3);
  const hx = SLAB.w / 2;
  const hy = SLAB.h / 2;
  const hz = SLAB.d / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(x) / hx;
    const ay = Math.abs(y) / hy;
    const az = Math.abs(z) / hz;
    const m = Math.max(ax, ay, az);
    box.set([x / m, y / m, z / m], i * 3);
    boxN.set(m === az ? [0, 0, Math.sign(z)] : m === ax ? [Math.sign(x), 0, 0] : [0, Math.sign(y), 0], i * 3);
  }
  g.setAttribute('aBox', new THREE.BufferAttribute(box, 3));
  g.setAttribute('aBoxN', new THREE.BufferAttribute(boxN, 3));
  return g;
}

// 03 CREATIVITY — the slab refuses to stay a slab.
function creativity(A, dur) {
  const scene = baseScene(A.env.soft, 1.1);
  const cam = liftedCamera(26);
  const rimA = new THREE.DirectionalLight(0xffffff, 1.6);
  rimA.position.set(-4, 2.5, -4);
  const rimB = new THREE.DirectionalLight(0xffffff, 0.8);
  rimB.position.set(4, 3, -2);
  scene.add(rimA, rimB);
  const R = 1.08;
  const u = { uTime: { value: 0 }, uAmp: { value: 0 }, uMorph: { value: 0 }, uR: { value: R } };
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x2a2a2e,
    metalness: 1,
    roughness: 0.2,
    clearcoat: 0.5,
    clearcoatRoughness: 0.1,
  });
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aBox;
        attribute vec3 aBoxN;
        uniform float uTime, uAmp, uMorph, uR;
        ${NOISE}
        vec3 displace(vec3 p) {
          vec3 n = normalize(p);
          float a = snoise(p * 0.85 + vec3(0.0, uTime * 0.45, uTime * 0.25));
          float b = snoise(p * 1.9 - vec3(uTime * 0.3)) * 0.18;
          return n * uR + n * (a + b) * uAmp;
        }`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 objectNormal;
        {
          vec3 n0 = normalize(position);
          vec3 tt = normalize(cross(n0, abs(n0.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
          vec3 bb = cross(n0, tt);
          float e = 0.01;
          vec3 q0 = displace(n0);
          vec3 q1 = displace(normalize(n0 + tt * e));
          vec3 q2 = displace(normalize(n0 + bb * e));
          vec3 sn = normalize(cross(q1 - q0, q2 - q0));
          objectNormal = normalize(mix(aBoxN, sn, smoothstep(0.0, 0.35, uMorph)));
        }`
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = mix(aBox, displace(normalize(position)), uMorph);');
  };
  const blob = new THREE.Mesh(morphGeometry(1, 72), mat);
  const group = new THREE.Group();
  group.add(blob);
  const face = makeSlab({ screen: A.hero.tex, intensity: 0.85 }).face;
  face.material.transparent = true;
  group.add(face);
  scene.add(group);

  return {
    update(lt) {
      const m = ease.inOutCubic(range(lt, CREATIVITY_MORPH[0], CREATIVITY_MORPH[1]));
      u.uMorph.value = m;
      u.uTime.value = lt * 1.2;
      u.uAmp.value = 0.26 * ease.inOutCubic(range(lt, 0.5, 1.7));
      const fo = 1 - range(lt, 0.0, 0.3);
      face.visible = fo > 0;
      face.material.opacity = fo;
      face.material.emissiveIntensity = 0.85 * fo;
      group.rotation.set(lerp(0, 0.35, m) + lt * 0.05, lerp(0.15, 1.1, ease.inOutCubic(range(lt, 0.1, dur))), 0);
      cam.position.set(0, 0, lerp(9.2, 8.2, ease.outCubic(lt / dur)));
      cam.lookAt(0, 0, 0);
      scene.environmentRotation.set(0.2, lt * 0.5, 0);
      return { scene, camera: cam };
    },
    post: () => ({ bloom: 0.35 }),
    samples: (lt) => (lt < CREATIVITY_MORPH[1] + 0.2 ? 4 : 2),
  };
}

// 04 CONTENT — the slab returns, typeset. One sentence lights up as it is read.
function content(A, dur) {
  const scene = baseScene(A.env.hairline, 0.35);
  const cam = liftedCamera(30);
  const slab = makeSlab({ screen: A.article.tex, intensity: 1.1 });
  slab.group.rotation.x = -0.55;
  scene.add(slab.group);
  const key = new RectAreaLight(0xffffff, 3, 8, 0.4);
  key.position.set(0, 4, -3);
  key.lookAt(0, 0, 0);
  scene.add(key);
  let lastP = -1;

  return {
    update(lt) {
      const p = ease.inOutCubic(range(lt, CONTENT_HIGHLIGHT[0], CONTENT_HIGHLIGHT[1]));
      const q = Math.round(p * 120) / 120;
      if (q !== lastP) {
        A.article.draw(q);
        lastP = q;
      }
      const h = A.article.highlight;
      slab.group.updateMatrixWorld(true);
      const target = new THREE.Vector3((h.u / FACE.u - 0.5) * SLAB.w, (0.5 - h.v) * SLAB.h, 0).applyMatrix4(slab.group.matrixWorld);
      const s = ease.outCubic(lt / dur);
      const c = new THREE.Vector3().setFromMatrixPosition(slab.group.matrixWorld);
      const look = c.clone().lerp(target, lerp(0.25, 0.55, s));
      cam.position.set(look.x + lerp(-1.2, -0.3, s), look.y + lerp(1.9, 1.6, s), look.z + lerp(5.6, 4.6, s));
      cam.lookAt(look.x, look.y + 0.1, look.z);
      scene.environmentRotation.set(0, lerp(0.4, -0.4, s), 0);
      return { scene, camera: cam };
    },
    post: () => ({ bloom: 0.25 }),
    samples: () => 2,
  };
}
