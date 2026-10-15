import * as THREE from 'three';
import { config } from '../config.js';
import { ease, lerp, range, mulberry32, wobble, tween } from '../lib/anim.js';
import { darkGloss } from '../assets.js';
import { kinetic, hairline, mono } from '../overlay.js';
import { baseScene, camera, makePanels, lightBar, W, H } from './common.js';
import { USABILITY_CLICKS } from './criteria-timing.js';

const BUILDERS = { design, usability, creativity, content };

export function createCriterion(A, crit, index) {
  const [start, end] = config.shots[crit.key];
  const dur = end - start;
  const b = BUILDERS[crit.key](A, dur);
  const label = `0${index + 1} / 0${config.criteria.length} — ${crit.word}`;

  return {
    name: crit.key,
    start,
    end,
    update: b.update,
    overlay(ctx, ctxD, lt) {
      const size = 400;
      const x = 66;
      const y = H - 170;
      const out = range(lt, dur - 0.32, dur - 0.02);
      kinetic(ctxD, crit.word, { x, y, size, pIn: range(lt, 0.04, 0.7), pOut: out, stagger: 0.05 });

      const barY = y - size * 0.86;
      const barW = 560;
      const vis = range(lt, 0.2, 0.5) * (1 - out);
      hairline(ctx, x + 6, barY, x + 6 + barW, barY, { alpha: 0.25 * vis, width: 2 });
      const fill = ease.outExpo(range(lt, 0.35, 1.3)) * (crit.weight / 100) * 2.5;
      hairline(ctx, x + 6, barY, x + 6 + barW * Math.min(1, fill), barY, { alpha: vis, width: 4 });
      const pct = Math.round(crit.weight * ease.outExpo(range(lt, 0.35, 1.3)));
      mono(ctx, `${String(pct).padStart(2, '0')}%`, x + 6 + barW + 28, barY + 9, { size: 26, alpha: vis });
      mono(ctx, `WEIGHT`, x + 6, barY - 22, { size: 22, alpha: vis * 0.5 });
      b.overlay?.(ctx, ctxD, lt);
    },
    post: (lt) => ({
      bloom: 0.75,
      flash: 0.4 * Math.pow(1 - range(lt, 0, 0.18), 2),
      ...(b.post?.(lt) ?? {}),
    }),
    samples: b.samples ?? (() => 2),
    hud: (lt) => ({ alpha: 1, label, meta: `WEIGHT ${crit.weight}%`, labelP: range(lt, 0.05, 0.6) }),
  };
}

// 01 DESIGN — one chosen site, overlaid with luminous construction geometry.
function design(A, dur) {
  const scene = baseScene(A.env.studio, 0.9);
  const cam = camera(30);
  const panels = makePanels(1, A.atlas, { screen: 0.5 });
  panels.set(0, new THREE.Vector3(), new THREE.Quaternion(), 4, 2, 1);
  panels.commit();
  scene.add(panels.group);

  const PW = 6.4;
  const PH = 4.0;
  const lines = [];
  const g = new THREE.Group();
  scene.add(g);
  const addLine = (x1, y1, x2, y2, z, delay, intensity = 2.2, color) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const m = lightBar(1, 0.0065, intensity, color);
    m.geometry.translate(0.5, 0, 0);
    m.position.set(x1, y1, z);
    m.rotation.z = Math.atan2(y2 - y1, x2 - x1);
    g.add(m);
    lines.push({ m, len, delay });
  };
  const ext = 1.4;
  for (let c = 0; c <= 12; c++) {
    const x = -PW / 2 + 0.25 + (c * (PW - 0.5)) / 12;
    addLine(x, -PH / 2 - ext, x, PH / 2 + ext, 0.06, 0.05 + c * 0.035, c % 6 === 0 ? 2.6 : 0.9);
  }
  [-1.2, -0.25, 0.75, 1.55].forEach((y, i) => addLine(-PW / 2 - ext * 1.6, y, PW / 2 + ext * 1.6, y, 0.06, 0.25 + i * 0.06, 1.6));
  const phi = 1.618;
  const gx = PW / 2 - PH / phi;
  addLine(gx, -PH / 2 - ext, gx, PH / 2 + ext, 0.45, 0.6, 3.2, new THREE.Color(config.accent));
  addLine(-PW / 2 - ext, -PH / 2 + PH / phi, PW / 2 + ext, -PH / 2 + PH / phi, 0.45, 0.7, 2.4);
  addLine(-PW / 2 - 0.6, -PH / 2 - 0.6, PW / 2 + 0.6, PH / 2 + 0.6, 0.8, 0.85, 1.2);

  const segs = 220;
  const arc = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.0065, 0.0065), lightBar(1, 1, 2.2).material, segs);
  const R = PH / phi;
  const cx = gx;
  const cy = -PH / 2;
  const mm = new THREE.Matrix4();
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 0.5 + Math.PI * 0.5;
    const a1 = ((i + 1) / segs) * Math.PI * 0.5 + Math.PI * 0.5;
    const p0 = new THREE.Vector3(cx + Math.cos(a0) * R * -1, cy + Math.sin(a0) * R, 0.45);
    const p1 = new THREE.Vector3(cx + Math.cos(a1) * R * -1, cy + Math.sin(a1) * R, 0.45);
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(p1.y - p0.y, p1.x - p0.x));
    mm.compose(mid, q, new THREE.Vector3(p0.distanceTo(p1) * 1.05, 1, 1));
    arc.setMatrixAt(i, mm);
  }
  g.add(arc);

  return {
    update(lt) {
      lines.forEach(({ m, len, delay }) => {
        const p = ease.outExpo(range(lt, delay, delay + 0.9));
        m.scale.set(Math.max(1e-4, len * p), 1, 1);
        m.visible = p > 0.001;
      });
      arc.count = Math.floor(segs * ease.inOutCubic(range(lt, 0.9, 1.9)));
      const p = lt / dur;
      const az = lerp(-0.7, -0.32, ease.outCubic(p));
      const dist = lerp(13.5, 11.5, ease.outCubic(p));
      const el = lerp(0.22, 0.1, p);
      cam.position.set(Math.sin(az) * dist, Math.sin(el) * dist, Math.cos(az) * dist);
      cam.lookAt(0.9, -0.1, 0);
      cam.rotation.z += wobble(lt, 7, 0.5) * 0.006;
      scene.environmentRotation.set(0, lerp(-0.9, 0.6, p), 0);
      return { scene, camera: cam };
    },
    overlay(ctx, ctxD, lt) {
      const a = range(lt, 1.0, 1.3) * (1 - range(lt, dur - 0.3, dur));
      mono(ctx, 'GRID  12 COL', W - 72, H * 0.36, { size: 22, align: 'right', alpha: a * 0.7 });
      mono(ctx, 'RATIO 1:1.618', W - 72, H * 0.36 + 34, { size: 22, align: 'right', alpha: a * 0.7 });
    },
    samples: () => 1,
  };
}

// 02 USABILITY — a monumental cursor clicks; light ripples across a dark mirror floor.
function usability(A, dur) {
  const scene = baseScene(A.env.studio, 1.0);
  scene.fog = new THREE.Fog(0x000000, 6, 22);
  const cam = camera(28);
  const mat = darkGloss({ roughness: 0.16, metalness: 0.9, color: 0x2a2a2e });
  const rig = new THREE.Group();
  const cursor = new THREE.Mesh(A.cursorGeo, mat);
  rig.add(cursor);
  scene.add(rig);
  const mirror = new THREE.Group();
  const mcursor = new THREE.Mesh(A.cursorGeo, mat);
  mirror.add(mcursor);
  mirror.scale.y = -1;
  scene.add(mirror);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.45, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.25, transparent: true, opacity: 0.88 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ringMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const rings = [];
  const clicks = USABILITY_CLICKS;
  clicks.forEach((ct, ci) => {
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 256), ringMat());
      if (ci === 1 && k === 0) m.material.color.set(config.accent);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.004;
      scene.add(m);
      rings.push({ m, t0: ct + k * 0.09, k });
    }
  });

  return {
    update(lt) {
      let press = 0;
      clicks.forEach((ct) => {
        press = Math.max(press, Math.sin(Math.PI * range(lt, ct - 0.12, ct + 0.16)));
      });
      const arrive = ease.outExpo(range(lt, 0, 0.9));
      const hover = lerp(2.4, 0.42, arrive) - press * 0.38 + Math.sin(lt * 2.2) * 0.03;
      rig.position.set(lerp(1.2, 0, arrive), hover, 0);
      rig.rotation.set(-0.62 + press * 0.12, lerp(1.4, 0.35, arrive) + lt * 0.12, Math.PI * 0.82);
      rig.scale.setScalar(1.45 * (1 - press * 0.04));
      mirror.rotation.set(-rig.rotation.x, rig.rotation.y, -rig.rotation.z);
      mirror.position.set(rig.position.x, -rig.position.y, rig.position.z);
      mirror.scale.set(rig.scale.x, -rig.scale.y, rig.scale.z);

      rings.forEach(({ m, t0, k }) => {
        const p = range(lt, t0, t0 + 1.4);
        const r = 0.05 + ease.outCubic(p) * (5.5 - k * 1.1);
        m.scale.setScalar(r);
        m.material.opacity = p > 0 && p < 1 ? (1 - p) * (k === 0 ? 2.5 : 1.2) : 0;
        m.position.x = rig.position.x;
        m.visible = p > 0 && p < 1;
      });

      const p = lt / dur;
      const az = lerp(0.55, 0.15, ease.inOutCubic(p));
      const dist = lerp(6.8, 5.6, ease.outCubic(p));
      cam.position.set(Math.sin(az) * dist, lerp(1.5, 1.05, p) + press * -0.03, Math.cos(az) * dist);
      cam.lookAt(-0.2, 0.85, 0);
      scene.environmentRotation.set(0, lerp(0.8, -0.5, p), 0);
      return { scene, camera: cam };
    },
    post: (lt) => ({ bloom: 0.9, flash: 0.12 * Math.pow(1 - range(lt, 1.0, 1.2), 3) * (lt > 1 ? 1 : 0) }),
    samples: (lt) => (lt < 0.8 ? 4 : 2),
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

// 03 CREATIVITY — a perfect sphere of black liquid that refuses to stay a sphere.
function creativity(A, dur) {
  const scene = baseScene(A.env.studio, 1.5);
  const cam = camera(30);
  const rimA = new THREE.DirectionalLight(0xd6e4ff, 4);
  rimA.position.set(-4, 2.5, -4);
  const rimB = new THREE.DirectionalLight(0xffffff, 2);
  rimB.position.set(4, 3, -2);
  scene.add(rimA, rimB);
  const u = { uTime: { value: 0 }, uAmp: { value: 0 }, uSpike: { value: 0 }, uFreq: { value: 1.1 } };
  const mat = darkGloss({ roughness: 0.1, metalness: 1, color: 0x5a5a60, clearcoat: 0 });
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime, uAmp, uSpike, uFreq;
        ${NOISE}
        vec3 displace(vec3 p) {
          vec3 n = normalize(p);
          float a = snoise(p * uFreq + vec3(0.0, uTime * 0.55, uTime * 0.3));
          float b = snoise(p * uFreq * 2.4 - vec3(uTime * 0.4)) * 0.3;
          float s = pow(max(0.0, snoise(p * 2.2 + vec3(uTime * 0.25, 0.0, 0.0))), 2.0) * uSpike;
          return p + n * ((a + b) * uAmp + s);
        }`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 objectNormal;
        {
          vec3 n0 = normalize(position);
          vec3 tt = normalize(cross(n0, abs(n0.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
          vec3 bb = cross(n0, tt);
          float L = length(position);
          float e = 0.012;
          vec3 q0 = displace(position);
          vec3 q1 = displace(normalize(position + tt * e) * L);
          vec3 q2 = displace(normalize(position + bb * e) * L);
          objectNormal = normalize(cross(q1 - q0, q2 - q0));
        }`
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = displace(position);');
  };
  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 80), mat);
  scene.add(blob);

  return {
    update(lt) {
      u.uTime.value = lt * 1.4 + Math.pow(lt, 2) * 0.35;
      u.uAmp.value = 0.34 * ease.inOutCubic(range(lt, 0.25, 1.3));
      u.uSpike.value = 0.55 * ease.inOutCubic(range(lt, 1.5, 2.5));
      blob.rotation.set(lt * 0.2, lt * 0.45, 0);
      const macro = lt > 1.4;
      if (!macro) {
        const p = lt / 1.4;
        const az = lerp(-0.4, 0.15, p);
        const dist = lerp(6.2, 5.4, ease.outCubic(p));
        cam.position.set(Math.sin(az) * dist + 0.55, 0.3, Math.cos(az) * dist);
        cam.lookAt(0.55, 0.15, 0);
      } else {
        const p = range(lt, 1.4, dur);
        cam.position.set(lerp(1.0, 0.6, p), lerp(0.85, 0.55, p), lerp(2.6, 2.2, ease.outCubic(p)));
        cam.lookAt(lerp(1.1, 0.8, p), 0.55, 0);
      }
      scene.environmentRotation.set(0.2, lt * 0.6, 0);
      return { scene, camera: cam };
    },
    post: (lt) => ({ bloom: 0.8, flash: lt > 1.4 ? 0.25 * Math.pow(1 - range(lt, 1.4, 1.55), 2) : 0 }),
    samples: () => 2,
  };
}

// 04 CONTENT — a landscape of text lines rising out of the dark, being written.
function content(A, dur) {
  const scene = baseScene(A.env.soft, 0.6);
  scene.fog = new THREE.Fog(0x000000, 3, 20);
  const cam = camera(36);
  const rand = mulberry32(21);
  const bars = [];
  const cols = [
    [-6.8, 4.2],
    [-2.2, 4.2],
    [2.4, 4.4],
  ];
  cols.forEach(([x0, w], ci) => {
    let z = 2 - ci * 0.6;
    while (z > -42) {
      if (rand() < 0.16) {
        const words = 1 + Math.floor(rand() * 3);
        let x = x0;
        for (let k = 0; k < words && x < x0 + w; k++) {
          const len = Math.min(0.6 + rand() * 1.8, x0 + w - x);
          bars.push({ x, z, len, h: 0.45, d: 0.42, hi: false });
          x += len + 0.18;
        }
        z -= 0.95;
      }
      const lines = 2 + Math.floor(rand() * 5);
      for (let l = 0; l < lines; l++) {
        let x = x0;
        const lineW = l === lines - 1 ? w * (0.3 + rand() * 0.5) : w;
        while (x < x0 + lineW - 0.15) {
          const len = Math.min(0.12 + rand() * 0.7, x0 + lineW - x);
          bars.push({ x, z, len, h: 0.1, d: 0.13, hi: rand() < 0.012 });
          x += len + 0.09;
        }
        z -= 0.26;
      }
      z -= 0.5;
    }
  });

  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0.5, 0.5, 0);
  const dark = bars.filter((b) => !b.hi);
  const hi = bars.filter((b) => b.hi);
  const meshD = new THREE.InstancedMesh(
    box,
    new THREE.MeshPhysicalMaterial({ color: 0x5c5c62, roughness: 0.5, metalness: 0.2, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 0.45 }),
    dark.length
  );
  const hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-3, 6, 2);
  const back = new THREE.DirectionalLight(0xdfe6ff, 0.7);
  back.position.set(2, 1.2, -8);
  scene.add(sun, back);
  const meshH = new THREE.InstancedMesh(box, hiMat, hi.length);
  meshD.frustumCulled = meshH.frustumCulled = false;
  scene.add(meshD, meshH);

  const caret = lightBar(0.04, 1, 4);
  caret.geometry = new THREE.BoxGeometry(0.035, 0.42, 0.035);
  caret.geometry.translate(0, 0.21, 0);
  scene.add(caret);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const camZ = (lt) => lerp(6, -9, ease.inOutCubic(lt / dur)) - 4 * ease.inExpo(range(lt, dur - 0.4, dur));
  const place = (mesh, list, front) => {
    list.forEach((b, i) => {
      const rise = ease.outExpo(range(b.z - front, 0, 2.2));
      v.set(b.x, 0, b.z);
      s.set(b.len, Math.max(0.0005, b.h * rise), b.d);
      m.compose(v, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  return {
    update(lt) {
      const zc = camZ(lt);
      const front = zc - 2 - 14 * ease.outCubic(range(lt, 0, 1.6));
      place(meshD, dark, front);
      place(meshH, hi, front);
      const p = lt / dur;
      cam.position.set(lerp(-1.5, 0.6, p), lerp(2.6, 1.7, p), zc);
      cam.lookAt(lerp(-0.4, 0.8, p), 0, zc - 4.5);
      cam.rotation.z += lerp(0.06, -0.04, p);
      const cz = Math.round((zc - 3.2) / 0.26) * 0.26;
      caret.position.set(-2.2 + ((lt * 2.6) % 4.2), 0, cz);
      caret.visible = Math.floor(lt * 4) % 2 === 0;
      scene.environmentRotation.set(0, lerp(-0.7, 0.7, p), 0);
      return { scene, camera: cam };
    },
    samples: () => 2,
  };
}
