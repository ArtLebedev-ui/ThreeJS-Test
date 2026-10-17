import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Engine, createEnvironments } from '../engine.js';
import { clamp, lerp, range, ease, tween, wobble, mulberry32 } from '../lib/anim.js';
import { loadFont, glyphGeometry, advance, kerning } from './type3d.js';
import { BUMPER as T } from './timing.js';

const params = new URLSearchParams(location.search);
const renderMode = params.has('render');
const config = { width: 2560, height: 1600, fps: T.fps, duration: T.duration };

const WORD = '\u041e\u0446\u0435\u043d\u043e\u0447\u043d\u0430\u044f';
const number = String(Math.max(0, parseInt(params.get('number') ?? '42', 10) || 0)).padStart(2, '0');

const FLOOR = -0.46;
const THETA = (Math.PI * 2) / 10;
const REEL_R = 2.15;
const TAU = Math.PI * 2;

const smoothstep = (a, b, x) => {
  const u = clamp((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
const wrap = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);

function paperMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xe7e5df,
    emissive: 0xe7e5df,
    emissiveIntensity: 0.42,
    roughness: 0.36,
    metalness: 0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
  });
}
function chromeMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x1a1a1c,
    metalness: 1,
    roughness: 0.3,
    clearcoat: 0.6,
    clearcoatRoughness: 0.22,
  });
}

function floorTexture() {
  const N = 512;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(N, N);
  const SIZE = 60;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1) - 0.5) * SIZE;
      const z = (j / (N - 1) - 0.5) * SIZE;
      const a = clamp(0.84 + 0.16 * smoothstep(0, 9, Math.abs(z)) + 0.2 * smoothstep(6, 14, Math.abs(x)));
      const glow = 0.05 * Math.exp(-(x * x) / 50 - (z * z) / 14);
      const k = (j * N + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(clamp(glow / a) * 255);
      img.data[k + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return { tex, size: SIZE };
}

function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function dust(count = 700) {
  const rand = mulberry32(7);
  const pos = new Float32Array(count * 3);
  const base = [];
  for (let i = 0; i < count; i++) base.push([(rand() - 0.5) * 26, FLOOR + rand() * 7, (rand() - 0.5) * 22, rand()]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.045,
    map: haloTexture(),
    color: new THREE.Color(0xffffff).multiplyScalar(0.55),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return {
    pts,
    update(t) {
      for (let i = 0; i < count; i++) {
        const [x, y, z, s] = base[i];
        pos[i * 3] = x + Math.sin(t * 0.3 + s * 40) * 0.25 + t * 0.12;
        pos[i * 3 + 1] = y + ((t * (0.05 + s * 0.08) + s * 3) % 1) * 0.6;
        pos[i * 3 + 2] = z + Math.cos(t * 0.27 + s * 30) * 0.25;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

async function boot() {
  const [fW, fD, fB] = await Promise.all([
    loadFont('/fonts/Inter-Medium.ttf'),
    loadFont('/fonts/NeueMontreal-Medium.otf'),
    loadFont('/fonts/NeueMontreal-Light.otf'),
  ]);
  RectAreaLightUniformsLib.init();
  const canvas = document.getElementById('c');
  const engine = new Engine(canvas, config, Number(params.get('scale') ?? 1));
  if (renderMode) {
    canvas.style.width = `${engine.width}px`;
    canvas.style.height = `${engine.height}px`;
  }
  const env = createEnvironments(engine.renderer);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = env.studio;
  scene.environmentIntensity = 0.9;
  const cam = new THREE.PerspectiveCamera(30, config.width / config.height, 0.05, 200);

  const content = new THREE.Group();
  scene.add(content);
  const face = paperMat();
  const side = chromeMat();

  // ---------------------------------------------------------------- layout (cap height = 1)
  const sW = 1 / fW.cap;
  const sD = 1 / fD.cap;
  const sB = 1.25 * sD;
  const GAP = 0.46;
  const INNER = 0.14;

  const letters = [];
  let x = 0;
  for (let i = 0; i < WORD.length; i++) {
    const ch = WORD[i];
    const geo = glyphGeometry(fW, ch, sW);
    const cx = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
    geo.translate(-cx, 0, 0);
    const mesh = new THREE.Mesh(geo, [face, side]);
    const pivot = new THREE.Group();
    pivot.add(mesh);
    pivot.userData.x = x + cx;
    letters.push(pivot);
    content.add(pivot);
    x += advance(fW, ch, sW) + (i < WORD.length - 1 ? kerning(fW, ch, WORD[i + 1], sW) : 0);
  }
  const wordW = x;

  const bracket = (ch) => {
    const geo = glyphGeometry(fB, ch, sB, { depth: 0.22, bevel: 0.016 });
    const bb = geo.boundingBox;
    const cx = (bb.min.x + bb.max.x) / 2;
    geo.translate(-cx, -(bb.min.y + bb.max.y) / 2, 0);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, [face, side]));
    return { g, w: bb.max.x - bb.min.x };
  };
  const bl = bracket('(');
  const br = bracket(')');
  content.add(bl.g, br.g);

  x += GAP;
  bl.g.userData.x = x + bl.w / 2;
  x += bl.w + INNER;

  const digitGeo = Array.from({ length: 10 }, (_, d) => {
    const geo = glyphGeometry(fD, String(d), sD);
    const bb = geo.boundingBox;
    geo.translate(-(bb.min.x + bb.max.x) / 2, -0.5, 0);
    return geo;
  });
  const reels = [];
  for (let j = 0; j < number.length; j++) {
    const d = Number(number[j]);
    const w = advance(fD, number[j], sD);
    const reel = new THREE.Group();
    reel.userData = { x: x + w / 2, target: d };
    const cells = [];
    for (let k = 0; k < 10; k++) {
      const holder = new THREE.Group();
      holder.rotation.x = -k * THETA;
      const mats = [face.clone(), side.clone()];
      mats.forEach((m) => (m.transparent = true));
      const mesh = new THREE.Mesh(digitGeo[k], mats);
      mesh.position.z = REEL_R;
      holder.add(mesh);
      reel.add(holder);
      cells.push({ mesh, mats, k });
    }
    reels.push({ reel, cells, d, j });
    content.add(reel);
    x += w + (j < number.length - 1 ? kerning(fD, number[j], number[j + 1], sD) : 0);
  }
  const numEnd = x;
  x += INNER;
  br.g.userData.x = x + br.w / 2;
  x += br.w;

  const total = x;
  const X0 = -total / 2;
  const numStart = bl.g.userData.x - bl.w / 2;
  const numC = X0 + (numStart + br.g.userData.x + br.w / 2) / 2;
  const numDigitsC = X0 + (bl.g.userData.x + bl.w / 2 + INNER + numEnd) / 2;

  // ---------------------------------------------------------------- reflection, floor, atmosphere
  const mirror = content.clone(true);
  mirror.scale.y = -1;
  mirror.position.y = 2 * FLOOR;
  scene.add(mirror);
  const srcNodes = [];
  const dstNodes = [];
  content.traverse((o) => srcNodes.push(o));
  mirror.traverse((o) => dstNodes.push(o));

  const ft = floorTexture();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ft.size, ft.size),
    new THREE.MeshBasicMaterial({ map: ft.tex, transparent: true, depthWrite: false })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR;
  floor.renderOrder = 10;
  scene.add(floor);

  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 22),
    new THREE.MeshBasicMaterial({ map: haloTexture(), transparent: true, depthWrite: false, color: 0x0d0d0d })
  );
  halo.position.set(0, FLOOR + 2, -12);
  scene.add(halo);

  const motes = dust();
  scene.add(motes.pts);

  const rings = [0, 1].map(() => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.985, 1, 160),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(numDigitsC, FLOOR + 0.003, 0);
    m.renderOrder = 11;
    scene.add(m);
    return m;
  });

  const streakTex = (() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 64;
    const ctx = c.getContext('2d');
    const gx = ctx.createLinearGradient(0, 0, 512, 0);
    gx.addColorStop(0, 'rgba(255,255,255,0)');
    gx.addColorStop(0.5, 'rgba(255,255,255,1)');
    gx.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gx;
    ctx.fillRect(0, 0, 512, 64);
    ctx.globalCompositeOperation = 'destination-in';
    const gy = ctx.createLinearGradient(0, 0, 0, 64);
    gy.addColorStop(0, 'rgba(0,0,0,0)');
    gy.addColorStop(0.5, 'rgba(0,0,0,1)');
    gy.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gy;
    ctx.fillRect(0, 0, 512, 64);
    return new THREE.CanvasTexture(c);
  })();
  const streak = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: streakTex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })
  );
  streak.renderOrder = 12;
  scene.add(streak);

  const key = new THREE.RectAreaLight(0xffffff, 3.2, 14, 2.5);
  key.position.set(0, 5.5, 7);
  key.lookAt(0, 0.4, 0);
  scene.add(key);
  const sweep = new THREE.RectAreaLight(0xffffff, 0, 0.5, 7);
  scene.add(sweep);

  // ---------------------------------------------------------------- animation
  const L = T.letters;
  const E = T.exit;

  function animate(t) {
    letters.forEach((p, i) => {
      const a = L.start + i * L.stagger;
      const u = range(t, a, a + L.dur);
      const out = ease.inCubic(range(t, E.start + i * E.stagger, E.start + i * E.stagger + E.dur));
      p.position.set(X0 + p.userData.x, 0, 0);
      p.rotation.x = lerp(-Math.PI / 2, 0, ease.outBack(u, 1.1)) + out * Math.PI * 0.55;
      p.position.z = out * 1.2;
      p.visible = u > 0;
    });

    const [b0, b1] = T.brackets;
    [bl, br].forEach((b, s) => {
      const dir = s ? 1 : -1;
      const u = ease.outExpo(range(t, b0 + s * 0.08, b1 + s * 0.08));
      const out = ease.inCubic(range(t, E.start + 0.2, E.start + 0.2 + E.dur));
      const bx = X0 + b.g.userData.x;
      b.g.position.set(lerp(bx + dir * 0.5, bx, u) + (numDigitsC - bx) * 0.55 * out, 0.5, lerp(-2.8, 0, u));
      b.g.rotation.y = dir * lerp(Math.PI * 0.7, 0, u) - dir * out * Math.PI * 0.5;
      b.g.rotation.z = dir * lerp(0.35, 0, u);
      b.g.visible = u > 0.001;
    });

    const R = T.reels;
    const show = range(t, R.start, R.start + 0.35);
    reels.forEach(({ reel, cells, d, j }) => {
      const land = R.land + j * R.stagger;
      const target = d * THETA + R.turns * TAU;
      const u = range(t, R.start, land);
      let phi = target * ease.outCubic(Math.pow(u, 1.6));
      phi += THETA * 0.16 * Math.sin(Math.PI * range(t, land - 0.28, land + 0.22)) * (t < land + 0.22 ? 1 : 0);
      const out = range(t, E.start + 0.3 + j * 0.08, E.start + 0.3 + j * 0.08 + E.dur);
      phi += THETA * 1.6 * ease.inCubic(out);
      reel.position.set(X0 + reel.userData.x, 0.5, -REEL_R);
      reel.rotation.x = phi;
      const vis = show * (1 - smoothstep(0.2, 0.9, out));
      const others = 1 - range(t, E.start, E.start + 0.3);
      for (const c of cells) {
        const o = smoothstep(0.87, 0.985, Math.cos(wrap(phi - c.k * THETA))) * vis * (c.k === d ? 1 : others);
        c.mats[0].opacity = c.mats[1].opacity = o;
        c.mesh.visible = o > 0.004;
      }
    });

    for (let i = 1; i < srcNodes.length; i++) {
      const s = srcNodes[i];
      const dst = dstNodes[i];
      dst.position.copy(s.position);
      dst.quaternion.copy(s.quaternion);
      dst.scale.copy(s.scale);
      dst.visible = s.visible;
    }

    const [s0, s1] = T.sweep;
    const su = range(t, s0, s1);
    const sx = lerp(-9, 9, ease.inOutCubic(su));
    sweep.position.set(sx, 1.2, 4.5);
    sweep.lookAt(sx * 0.4, 0.5, 0);
    sweep.intensity = 60 * Math.sin(Math.PI * su);

    rings.forEach((m, i) => {
      const r0 = T.reels.land + (number.length - 1) * T.reels.stagger + i * 0.12;
      const u = range(t, r0, r0 + 1.1);
      m.scale.setScalar(lerp(0.4, 12 + i * 3, ease.outQuart(u)));
      m.material.color.setScalar(2.2 * Math.pow(1 - u, 3) * (u > 0 ? 1 : 0) * (i ? 0.5 : 1));
      m.visible = u > 0 && u < 1;
    });

    motes.update(t);
  }

  // Camera: each move adds its offset over its own window, so overlapping moves blend smoothly.
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const camKeys = (() => {
    const p0 = V(X0 + 0.1, 0.22, 2.7);
    const l0 = V(X0 + 1.7, 0.4, 0);
    const moves = [
      { w: [0, 2.3], f: ease.inOutCubic, p: V(X0 + wordW - 1.1, 0.5, 3.1), l: V(X0 + wordW + 0.9, 0.45, 0), fov: 32 },
      { w: [1.55, 2.55], f: ease.inOutCubic, p: V(numC - 0.5, 0.7, 4.6), l: V(numC, 0.5, 0), fov: 30 },
      { w: T.pullBack, f: ease.inOutQuart, p: V(7.4, 0.5, 7.6), l: V(1.5, 0.62, 0), fov: 38 },
      { w: [3.0, 4.75], f: ease.inOutSine, p: V(5.9, 0.74, 9.6), l: V(1.15, 0.6, 0), fov: 38 },
      { w: [4.5, 5.6], f: ease.inCubic, p: V(numC + 0.3, 0.75, 1.5), l: V(numC, 0.5, -1), fov: 36 },
    ];
    let prev = { p: p0, l: l0, fov: 34 };
    for (const m of moves) {
      m.dp = m.p.clone().sub(prev.p);
      m.dl = m.l.clone().sub(prev.l);
      m.dfov = m.fov - prev.fov;
      prev = m;
    }
    return { p0, l0, fov0: 34, moves };
  })();
  const _p = new THREE.Vector3();
  const _l = new THREE.Vector3();

  function placeCamera(t) {
    _p.copy(camKeys.p0);
    _l.copy(camKeys.l0);
    let fov = camKeys.fov0;
    for (const m of camKeys.moves) {
      const k = m.f(range(t, m.w[0], m.w[1]));
      _p.addScaledVector(m.dp, k);
      _l.addScaledVector(m.dl, k);
      fov += m.dfov * k;
    }
    _p.x += wobble(t, 1, 0.6) * 0.03;
    _p.y += wobble(t, 2, 0.6) * 0.02;
    cam.position.copy(_p);
    cam.fov = fov;
    cam.updateProjectionMatrix();
    cam.up.set(0, 1, 0);
    cam.lookAt(_l);
    cam.rotateZ(lerp(0.07, 0, tween(t, 0.3, 3.0)) + wobble(t, 3, 0.5) * 0.004);
  }

  const landT = T.reels.land + (number.length - 1) * T.reels.stagger;
  function drawScene(t) {
    animate(t);
    placeCamera(t);
    const su = range(t, landT - 0.04, landT + 0.75);
    streak.visible = su > 0 && su < 1;
    streak.position.set(numDigitsC, 0.55, 0.4);
    streak.quaternion.copy(cam.quaternion);
    streak.scale.set(lerp(1.5, 30, ease.outExpo(su)), lerp(0.09, 0.025, su), 1);
    streak.material.color.setScalar(3 * Math.pow(1 - su, 2));
    return { scene, camera: cam };
  }

  const bell = (t, c, w) => Math.exp(-((t - c) * (t - c)) / (w * w));
  function post(t) {
    const fade = range(t, T.fadeIn[0], T.fadeIn[1]) * (1 - ease.inQuad(range(t, T.fadeOut[0], T.fadeOut[1])));
    const landHit = bell(t, landT + 0.04, 0.16);
    return {
      fade,
      exposure: 1 + 0.25 * landHit,
      ca: 1 + 3 * bell(t, 2.6, 0.35) + 3 * bell(t, 5.4, 0.3),
      grain: 0.04,
      vignette: 0.4,
      bloom: 0.2 + 0.3 * landHit,
      bloomRadius: 0.35,
      bloomThreshold: 0.95,
    };
  }

  const totalFrames = Math.round(T.duration * T.fps);
  const fast = params.has('fast');
  function renderFrame(frame) {
    const t = frame / T.fps;
    engine.render({
      t,
      frame,
      samples: fast ? 1 : (t > 1.3 && t < 3.3) || t > 4.5 ? 16 : 10,
      shutter: 0.5,
      drawScene,
      drawOverlay: () => {},
      post: post(t),
    });
  }

  engine.renderer.compile(...Object.values(drawScene(3.5)));

  window.__intro = { renderFrame, totalFrames, config };
  window.__ready = true;
  if (renderMode) return;

  const ui = document.getElementById('ui');
  ui.hidden = false;
  const scrub = document.getElementById('scrub');
  const label = document.getElementById('label');
  const play = document.getElementById('play');
  scrub.max = totalFrames - 1;
  let playing = false;
  let frame = Number(params.get('f') ?? 0);
  let last = performance.now();
  let acc = 0;
  const draw = () => {
    renderFrame(frame);
    scrub.value = frame;
    label.textContent = `${(frame / T.fps).toFixed(2)}s · f${frame}`;
  };
  scrub.oninput = () => {
    frame = Number(scrub.value);
    draw();
  };
  play.onclick = () => {
    playing = !playing;
    play.textContent = playing ? 'Pause' : 'Play';
    last = performance.now();
  };
  const loop = (now) => {
    if (playing) {
      acc += (now - last) / 1000;
      const step = Math.floor(acc * T.fps);
      if (step > 0) {
        acc -= step / T.fps;
        frame = (frame + step) % totalFrames;
        draw();
      }
    }
    last = now;
    requestAnimationFrame(loop);
  };
  draw();
  requestAnimationFrame(loop);
}

boot().catch((e) => {
  console.error(e);
  window.__error = String(e?.stack ?? e);
});
