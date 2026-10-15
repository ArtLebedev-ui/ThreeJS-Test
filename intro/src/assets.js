import * as THREE from 'three';
import { mulberry32 } from './lib/anim.js';
import { FONTS } from './overlay.js';
import { config } from './config.js';

/** Classic arrow pointer, tip at the origin, pointing up-left, ~1 unit tall. */
export function cursorGeo({ depth = 0.1, bevel = 0.025 } = {}) {
  const pts = [
    [0, 0],
    [0, 17],
    [4.2, 13.2],
    [7.0, 19.6],
    [9.7, 18.4],
    [6.9, 12.1],
    [12.3, 12.1],
  ];
  const s = 1 / 19.6;
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? shape.lineTo(x * s, -y * s) : shape.moveTo(x * s, -y * s)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: 8,
    curveSegments: 4,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

export const darkGloss = (o = {}) =>
  new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0b,
    metalness: 0.35,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1,
    ...o,
  });

const canvasTex = (canvas) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

const font = (ctx, size, family, tracking = -0.03) => {
  ctx.font = `${size}px ${family}`;
  ctx.letterSpacing = `${tracking * size}px`;
};

// The slab's face is 16:10; layouts are expressed in "units" where the face is 1.6 x 1.0.
export const FACE = { u: 1.6, v: 1 };

/**
 * Golden-ratio subdivision of the 16:10 face (≈φ). Returns squares in unit coords
 * (u right, v down) plus the spiral direction per step: left, top, right, bottom.
 */
export function goldenSquares(steps = 7) {
  let [x, y, w, h] = [0, 0, FACE.u, FACE.v];
  const out = [];
  for (let i = 0; i < steps && Math.min(w, h) > 1e-3; i++) {
    const dir = i % 4;
    if (dir === 0) {
      out.push({ x, y, s: h, dir });
      x += h;
      w -= h;
    } else if (dir === 1) {
      out.push({ x, y, s: w, dir });
      y += w;
      h -= w;
    } else if (dir === 2) {
      out.push({ x: x + w - h, y, s: h, dir });
      w -= h;
    } else {
      out.push({ x, y: y + h - w, s: w, dir });
      h -= w;
    }
  }
  return out;
}

/**
 * The website under review. Its layout sits on the golden subdivision of the face:
 * headline in the first square, image in the second, copy and CTA in the remainder.
 */
export function makeHeroSite() {
  const PX = 1280; // pixels per unit
  const cw = PX * FACE.u;
  const ch = PX * FACE.v;
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0c0c0c';
  ctx.fillRect(0, 0, cw, ch);
  const ink = '#ecebe7';

  // Image block: a soft grey form in the second square.
  const ix = PX * 1.0 + 40;
  const iy = 40;
  const is = PX * 0.6 - 80;
  const g = ctx.createRadialGradient(ix + is * 0.42, iy + is * 0.38, 10, ix + is * 0.5, iy + is * 0.5, is * 0.75);
  g.addColorStop(0, '#9a9893');
  g.addColorStop(0.45, '#3a3936');
  g.addColorStop(1, '#141413');
  ctx.fillStyle = g;
  ctx.fillRect(ix, iy, is, is);
  ctx.fillStyle = '#0c0c0c';
  ctx.beginPath();
  ctx.arc(ix + is * 0.5, iy + is * 1.08, is * 0.62, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = ink;
  font(ctx, 26, FONTS.medium, 0);
  ctx.fillText('Monolith®', 56, 76);
  font(ctx, 26, FONTS.regular, 0);
  ctx.globalAlpha = 0.7;
  ['Work', 'Studio', 'Journal'].forEach((w, i) => ctx.fillText(w, 520 + i * 150, 76));
  ctx.globalAlpha = 1;

  font(ctx, 300, FONTS.medium, -0.05);
  ctx.fillText('Quiet', 44, 560);
  ctx.fillText('machines', 44, 830);
  font(ctx, 30, FONTS.regular, -0.01);
  ctx.globalAlpha = 0.6;
  ['A studio for objects that', 'do one thing, and do it', 'without noise.'].forEach((l, i) =>
    ctx.fillText(l, 56, 1010 + i * 40)
  );
  ctx.globalAlpha = 1;

  const bx = PX * 1.0 + 40;
  font(ctx, 26, FONTS.regular, 0);
  ctx.globalAlpha = 0.55;
  ctx.fillText('(01) Selected work', bx, PX * 0.6 + 90);
  ctx.globalAlpha = 1;
  font(ctx, 44, FONTS.regular, -0.02);
  ['Instruments for', 'a slower internet.'].forEach((l, i) => ctx.fillText(l, bx, PX * 0.6 + 170 + i * 54));

  // CTA pill — the usability shot clicks it.
  const cta = { x: bx, y: 1080, w: 360, h: 84 };
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cta.x, cta.y, cta.w, cta.h, cta.h / 2);
  ctx.stroke();
  font(ctx, 30, FONTS.regular, 0);
  ctx.fillText('Explore work  →', cta.x + 40, cta.y + 53);

  const tex = canvasTex(c);
  const toUnit = (px, py) => ({ u: px / PX, v: py / PX });
  return {
    tex,
    targets: {
      nav: toUnit(520 + 150 + 30, 68),
      cta: toUnit(cta.x + cta.w * 0.5, cta.y + cta.h * 0.5),
    },
  };
}

const WORDS = [
  'Monolith', 'Ponder', 'Atelier', 'Northwind', 'Halo', 'Orbit', 'Silent', 'Form',
  'Aura', 'Void', 'Cantor', 'Field', 'Index', 'Tide', 'Prism', 'Still',
];

/** 4x4 atlas of monochrome editorial website "screenshots" (16:10 tiles) for the field. */
export function makeSiteAtlas() {
  const TW = 640;
  const TH = 400;
  const canvas = document.createElement('canvas');
  canvas.width = TW * 4;
  canvas.height = TH * 4;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(42);

  for (let i = 0; i < 16; i++) {
    const ox = (i % 4) * TW;
    const oy = Math.floor(i / 4) * TH;
    const light = i % 5 === 2;
    const bg = light ? '#e4e2dd' : ['#0b0b0b', '#121212', '#0e0e0e'][i % 3];
    const fg = light ? '#101010' : '#ecebe7';
    ctx.save();
    ctx.translate(ox, oy);
    ctx.beginPath();
    ctx.rect(0, 0, TW, TH);
    ctx.clip();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, TW, TH);

    const word = WORDS[i];
    const img = (x, y, w, h) => {
      const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
      const a = light ? ['#b9b6af', '#7d7a74'] : ['#4a4946', '#1a1a19'];
      g.addColorStop(0, a[0]);
      g.addColorStop(1, a[1]);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    };

    ctx.fillStyle = fg;
    font(ctx, 13, FONTS.medium, 0);
    ctx.fillText(word, 22, 30);
    font(ctx, 13, FONTS.regular, 0);
    ctx.globalAlpha = 0.6;
    ['Work', 'About', 'Contact'].forEach((w, k) => ctx.fillText(w, TW - 210 + k * 64, 30));
    ctx.globalAlpha = 1;

    const layout = i % 4;
    if (layout === 0) {
      font(ctx, 150, FONTS.medium, -0.05);
      ctx.fillText(word, 16, TH * 0.68);
      font(ctx, 13, FONTS.regular, 0);
      ctx.fillText('(Scroll)', 22, TH - 28);
    } else if (layout === 1) {
      img(TW * 0.42, 52, TW * 0.55, TH - 80);
      font(ctx, 64, FONTS.medium, -0.04);
      ctx.fillText(word, 20, 130);
      font(ctx, 64, FONTS.lightItalic, -0.04);
      ctx.fillText('studio', 20, 195);
    } else if (layout === 2) {
      for (let k = 0; k < 3; k++) img(22 + k * 204, 120, 190, 200);
      font(ctx, 40, FONTS.medium, -0.03);
      ctx.fillStyle = fg;
      ctx.fillText(`${word} — Index`, 22, 96);
      font(ctx, 13, FONTS.regular, 0);
      for (let k = 0; k < 3; k++) ctx.fillText(`(0${k + 1}) Project`, 22 + k * 204, 344);
    } else {
      img(0, 0, TW, TH);
      ctx.fillStyle = fg;
      font(ctx, 210, FONTS.medium, -0.06);
      ctx.textAlign = 'center';
      ctx.fillText(word.slice(0, 4), TW / 2, TH * 0.8);
      ctx.textAlign = 'left';
    }
    rand();
    ctx.restore();
  }
  return canvasTex(canvas);
}

/**
 * A typeset article for the content shot. The highlighted sentence is lit from left to
 * right with progress `p`; call `draw(p)` and flag the texture for upload.
 */
export function makeArticle() {
  const PX = 1280;
  const cw = PX * FACE.u;
  const ch = PX * FACE.v;
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d');
  const tex = canvasTex(c);
  const left = [
    'A website is a sequence of decisions.',
    'Most of them are invisible: a margin,',
    'the length of a line, the pause before',
    'something moves. Together they decide',
    'whether a page is read or scrolled past.',
    '',
    'We look at the words before the effects.',
    'What is the site trying to say, and does',
    'every element help it say that? Content',
    'is the part of the work that remains',
    'when the animation is over.',
  ];
  const right = [
    'The best submissions share one quality.',
    'They know what to leave out. Every block',
    'earns its place, every sentence carries',
    'weight, every transition means something.',
    '',
  ];
  const hl = config.tagline.join(' ');
  const after = [
    '',
    'That is what we are looking for: work',
    'that is felt first and explained later.',
  ];
  const lineH = 50;
  const x1 = 64;
  const x2 = PX * 0.84;
  const y0 = 420;
  let hlPos = null;

  function draw(p = 0) {
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#ecebe7';
    font(ctx, 24, FONTS.regular, 0);
    ctx.globalAlpha = 0.5;
    ctx.fillText('(04) Content', x1, 80);
    ctx.fillText('Reading time — 2 min', x2, 80);
    ctx.globalAlpha = 1;
    font(ctx, 150, FONTS.medium, -0.045);
    ctx.fillText('On what', x1 - 8, 250);
    font(ctx, 150, FONTS.lightItalic, -0.045);
    ctx.fillText('remains', x1 + 600, 250);

    font(ctx, 34, FONTS.regular, -0.01);
    ctx.globalAlpha = 0.34;
    left.forEach((l, i) => ctx.fillText(l, x1, y0 + i * lineH));
    right.forEach((l, i) => ctx.fillText(l, x2, y0 + i * lineH));
    const yh = y0 + right.length * lineH + 30;
    after.forEach((l, i) => ctx.fillText(l, x2, yh + 20 + i * lineH));

    font(ctx, 72, FONTS.medium, -0.03);
    const w = ctx.measureText(hl).width;
    ctx.globalAlpha = 0.22;
    ctx.fillText(hl, x2, yh);
    if (p > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x2 - 4, yh - 80, (w + 8) * p, 110);
      ctx.clip();
      ctx.globalAlpha = 1;
      ctx.fillText(hl, x2, yh);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    hlPos = { u: (x2 + w * 0.5) / PX, v: (yh - 24) / PX, w: w / PX };
    tex.needsUpdate = true;
  }
  draw(0);
  return { tex, draw, get highlight() { return hlPos; } };
}
