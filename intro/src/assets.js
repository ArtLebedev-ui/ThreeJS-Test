import * as THREE from 'three';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { mulberry32 } from './lib/anim.js';
import { FONTS } from './overlay.js';
import { config } from './config.js';

export async function loadFont3D(file) {
  const buf = await (await fetch(`/fonts/${file}`)).arrayBuffer();
  return new Font(new TTFLoader().parse(buf));
}

const capCache = new WeakMap();
/** Font size that yields a cap height of 1 unit. */
export function capScale(font) {
  if (!capCache.has(font)) {
    const g = new TextGeometry('H', { font, size: 1, depth: 0.01, bevelEnabled: false });
    g.computeBoundingBox();
    capCache.set(font, 1 / (g.boundingBox.max.y - g.boundingBox.min.y));
    g.dispose();
  }
  return capCache.get(font);
}

/**
 * Extruded, bevelled text geometry centred on its bounding box (x/y), front face at z=0.
 * `size` is the cap height in world units.
 */
export function textGeo(font, text, { size = 1, depth = 0.3, bevel = 0.02, segments = 5, curve = 10, center = 'xy' } = {}) {
  const g = new TextGeometry(text, {
    font,
    size: size * capScale(font),
    depth,
    curveSegments: curve,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: segments,
  });
  g.computeBoundingBox();
  const b = g.boundingBox;
  const cx = center.includes('x') ? -(b.min.x + b.max.x) / 2 : 0;
  const cy = center.includes('y') ? -(b.min.y + b.max.y) / 2 : 0;
  g.translate(cx, cy, -depth - bevel);
  g.computeVertexNormals();
  return g;
}

/** Classic arrow pointer, tip at the origin, pointing up-left, ~1 unit tall. */
export function cursorGeo({ depth = 0.12, bevel = 0.03 } = {}) {
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

export const chrome = (o = {}) =>
  new THREE.MeshPhysicalMaterial({
    color: 0x9a9a9e,
    metalness: 1,
    roughness: 0.12,
    clearcoat: 0.6,
    clearcoatRoughness: 0.05,
    ...o,
  });

const WORDS = [
  'MONOLITH', 'PONDER', 'FREQUENCY', 'ATELIER', 'NORTHWIND', 'KINETIC', 'HALO', 'ORBIT',
  'SILENT', 'FORM', 'AURA', 'VOID', 'CANTOR', 'OXI', 'TIGER', 'GOOM',
];

/**
 * 4x4 atlas of procedural website "screenshots" (16:10 tiles) used on panel screens.
 * Returns one texture per tile (shared canvas, different UV offsets).
 */
export function makeSiteAtlas() {
  const TW = 640;
  const TH = 400;
  const canvas = document.createElement('canvas');
  canvas.width = TW * 4;
  canvas.height = TH * 4;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(42);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const accents = [config.accent, config.gold, '#30A8FF', '#e8e4dc', '#9fa3ff'];

  for (let i = 0; i < 16; i++) {
    const ox = (i % 4) * TW;
    const oy = Math.floor(i / 4) * TH;
    const light = i % 5 === 3;
    const bg = light ? '#e9e7e2' : pick(['#0b0b0c', '#111114', '#0d0f12', '#151312']);
    const fg = light ? '#111' : '#f2f2f0';
    const acc = pick(accents);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.beginPath();
    ctx.rect(0, 0, TW, TH);
    ctx.clip();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, TW, TH);

    const layout = i % 4;
    if (layout === 0 || layout === 2) {
      const g = ctx.createRadialGradient(TW * (0.3 + rand() * 0.5), TH * 0.6, 10, TW * 0.5, TH * 0.6, TW * 0.6);
      g.addColorStop(0, acc);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = light ? 0.35 : 0.55;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TW, TH);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.85;
    ctx.font = `13px ${FONTS.mono}`;
    ctx.fillText(WORDS[i], 22, 30);
    for (let k = 0; k < 4; k++) ctx.fillText(pick(['WORK', 'ABOUT', 'INDEX', 'SHOP', 'INFO', 'LAB']), TW - 260 + k * 60, 30);
    ctx.globalAlpha = 1;

    const word = WORDS[(i * 7 + 3) % 16];
    if (layout === 0) {
      ctx.font = `${TW * 0.2}px ${FONTS.black}`;
      ctx.letterSpacing = `${-TW * 0.008}px`;
      ctx.fillText(word, 18, TH * 0.62);
      ctx.fillRect(22, TH - 70, 160, 2);
      ctx.font = `12px ${FONTS.mono}`;
      ctx.letterSpacing = '0px';
      ctx.fillText('SCROLL TO EXPLORE', 22, TH - 40);
    } else if (layout === 1) {
      ctx.font = `${TW * 0.11}px ${FONTS.bold}`;
      ctx.letterSpacing = `${-TW * 0.004}px`;
      ctx.fillText(word, 22, 120);
      ctx.letterSpacing = '0px';
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = c === 1 ? acc : light ? '#cfccc6' : '#26262a';
        ctx.fillRect(22 + c * 204, 170, 190, 170);
        ctx.fillStyle = fg;
        ctx.fillRect(22 + c * 204, 352, 120, 6);
        ctx.globalAlpha = 0.5;
        ctx.fillRect(22 + c * 204, 366, 80, 4);
        ctx.globalAlpha = 1;
      }
    } else if (layout === 2) {
      ctx.fillStyle = light ? '#cfccc6' : '#1d1d21';
      ctx.fillRect(TW * 0.5, 56, TW * 0.46, TH - 90);
      ctx.fillStyle = fg;
      ctx.font = `${TW * 0.085}px ${FONTS.black}`;
      ctx.letterSpacing = `${-TW * 0.004}px`;
      ctx.fillText(word, 22, 150);
      ctx.fillText('STUDIO', 22, 210);
      ctx.letterSpacing = '0px';
      ctx.globalAlpha = 0.55;
      for (let k = 0; k < 5; k++) ctx.fillRect(22, 250 + k * 16, 220 - (k % 2) * 60, 5);
      ctx.globalAlpha = 1;
    } else {
      ctx.font = `${TW * 0.36}px ${FONTS.black}`;
      ctx.letterSpacing = `${-TW * 0.02}px`;
      ctx.textAlign = 'center';
      ctx.fillText(word.slice(0, 4), TW / 2, TH * 0.78);
      ctx.textAlign = 'left';
      ctx.letterSpacing = '0px';
      ctx.fillStyle = acc;
      ctx.beginPath();
      ctx.arc(TW * 0.82, TH * 0.24, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
