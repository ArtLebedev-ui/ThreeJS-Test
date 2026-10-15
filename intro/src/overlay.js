import { clamp, ease, range, mulberry32 } from './lib/anim.js';
import { config } from './config.js';

export const FONTS = {
  black: "'IT-Black'",
  bold: "'IT-XB'",
  light: "'IT-Light'",
  mono: "'FMono', 'PlexMono', monospace",
};

export async function loadFonts() {
  const list = [
    ['IT-Black', 'InterTight-Black.ttf'],
    ['IT-XB', 'InterTight-ExtraBold.ttf'],
    ['IT-Light', 'InterTight-Light.ttf'],
    ['FMono', 'FragmentMono-Regular.ttf'],
    ['PlexMono', 'IBMPlexMono-Regular.ttf'],
  ];
  await Promise.all(
    list.map(async ([name, file]) => {
      const f = new FontFace(name, `url(/fonts/${file})`);
      await f.load();
      document.fonts.add(f);
    })
  );
}

/**
 * Big kinetic type: each glyph rises from below a baseline mask, then exits upward.
 * pIn / pOut are 0..1 progress values; stagger is the per-letter delay in progress units.
 */
export function kinetic(ctx, text, o) {
  const {
    x = 0,
    y = 0,
    size = 200,
    family = FONTS.black,
    tracking = -0.045,
    align = 'left',
    pIn = 1,
    pOut = 0,
    stagger = 0.06,
    color = '#fff',
    alpha = 1,
    easeIn = ease.outExpo,
    easeOut = ease.inExpo,
    maskTop = 0.82,
    maskBottom = 0.2,
  } = o;
  if (pIn <= 0 || pOut >= 1 || alpha <= 0) return 0;
  ctx.save();
  ctx.font = `${size}px ${family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  const chars = [...text];
  const n = chars.length;
  const track = tracking * size;
  const xs = [];
  for (let i = 0; i < n; i++) xs.push(ctx.measureText(chars.slice(0, i).join('')).width + track * i);
  const total = ctx.measureText(text).width + track * (n - 1);
  const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const span = 1 + stagger * (n - 1);
  for (let i = 0; i < n; i++) {
    const c = chars[i];
    if (c === ' ') continue;
    const li = clamp(pIn * span - i * stagger);
    const lo = clamp(pOut * span - i * stagger);
    if (li <= 0 || lo >= 1) continue;
    const dy = (1 - easeIn(li)) * size * 1.05 - easeOut(lo) * size * 1.05;
    const cw = ctx.measureText(c).width;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 + xs[i] - size * 0.1, y - size * maskTop, cw + size * 0.2, size * (maskTop + maskBottom));
    ctx.clip();
    ctx.fillText(c, x0 + xs[i], y + dy);
    ctx.restore();
  }
  ctx.restore();
  return total;
}

export function measure(ctx, text, size, family = FONTS.black, tracking = -0.045) {
  ctx.save();
  ctx.font = `${size}px ${family}`;
  const w = ctx.measureText(text).width + tracking * size * ([...text].length - 1);
  ctx.restore();
  return w;
}

/** Size that makes `text` span `width` pixels. */
export function fitSize(ctx, text, width, family = FONTS.black, tracking = -0.045) {
  return (width / measure(ctx, text, 100, family, tracking)) * 100;
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#%*+-_<>';

/** Monospace text that decodes left-to-right from random glyphs. */
export function decode(ctx, text, x, y, p, o = {}) {
  const { size = 24, color = '#fff', align = 'left', alpha = 1, seed = 7, frame = 0, tracking = 0.04 } = o;
  if (p <= 0 || alpha <= 0) return;
  const chars = [...text];
  const n = chars.length;
  const shown = p * (n + 6);
  const rand = mulberry32(seed * 7919 + Math.floor(frame / 2));
  let out = '';
  for (let i = 0; i < n; i++) {
    if (i < shown - 6) out += chars[i];
    else if (i < shown) out += chars[i] === ' ' ? ' ' : GLYPHS[Math.floor(rand() * GLYPHS.length)];
    else break;
  }
  mono(ctx, out, x, y, { size, color, align, alpha, tracking, fullText: text });
}

export function mono(ctx, text, x, y, o = {}) {
  const { size = 24, color = '#fff', align = 'left', alpha = 1, tracking = 0.04, fullText } = o;
  ctx.save();
  ctx.font = `${size}px ${FONTS.mono}`;
  ctx.letterSpacing = `${tracking * size}px`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  let xx = x;
  if (align !== 'left') {
    const w = ctx.measureText(fullText ?? text).width;
    xx = align === 'center' ? x - w / 2 : x - w;
  }
  ctx.fillText(text, xx, y);
  ctx.restore();
}

export function hairline(ctx, x1, y1, x2, y2, o = {}) {
  const { color = '#fff', alpha = 1, width = 2 } = o;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

const pad2 = (n) => String(Math.floor(n)).padStart(2, '0');
export const timecode = (t, fps) =>
  `${pad2(t / 3600)}:${pad2((t / 60) % 60)}:${pad2(t % 60)}:${pad2((t * fps) % fps)}`;

/**
 * Persistent corner HUD, modelled on the mono corner labels of artemiilebedev.com.
 * `label` / `meta` are the bottom-left / bottom-right strings for the current shot.
 */
export function hud(ctx, t, { alpha = 1, label = '', meta = '', labelP = 1, frame = 0 } = {}) {
  if (alpha <= 0) return;
  const W = config.width;
  const H = config.height;
  const m = 72;
  const s = 26;
  const a = 0.86 * alpha;
  const [tl1, tl2] = config.hud.topLeft;
  mono(ctx, tl1, m, m + s, { size: s, alpha: a });
  mono(ctx, tl2, m, m + s * 2.3, { size: s, alpha: a * 0.55 });
  mono(ctx, config.tagline, W / 2, m + s, { size: s, alpha: a, align: 'center' });
  mono(ctx, timecode(t, config.fps), W - m, m + s, { size: s, alpha: a, align: 'right' });

  const blink = Math.floor(t * 2) % 2 === 0 ? 1 : 0.25;
  ctx.save();
  ctx.globalAlpha = a * blink;
  ctx.fillStyle = config.accent;
  ctx.beginPath();
  ctx.arc(W - m - 8, m + s * 2.3 - 9, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  mono(ctx, config.hud.topRight, W - m - 30, m + s * 2.3, { size: s, alpha: a * 0.55, align: 'right' });

  if (label) decode(ctx, label, m, H - m, labelP, { size: s, alpha: a, frame, seed: label.length });
  if (meta) decode(ctx, meta, W - m, H - m, labelP, { size: s, alpha: a, align: 'right', frame, seed: meta.length + 3 });
}

export const fadeInOut = (t, a, b, fi = 0.2, fo = 0.2) => range(t, a, a + fi) * (1 - range(t, b - fo, b));
