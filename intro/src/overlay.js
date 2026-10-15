import { clamp, ease, range } from './lib/anim.js';
import { config } from './config.js';

export const FONTS = {
  light: "'NM-Light'",
  regular: "'NM-Regular'",
  medium: "'NM-Medium'",
  bold: "'NM-Bold'",
  italic: "'NM-Italic'",
  lightItalic: "'NM-LightItalic'",
  mediumItalic: "'NM-MediumItalic'",
};

export async function loadFonts() {
  const list = [
    ['NM-Light', 'Light'],
    ['NM-Regular', 'Regular'],
    ['NM-Medium', 'Medium'],
    ['NM-Bold', 'Bold'],
    ['NM-Italic', 'Italic'],
    ['NM-LightItalic', 'LightItalic'],
    ['NM-MediumItalic', 'MediumItalic'],
  ];
  await Promise.all(
    list.map(async ([name, file]) => {
      const f = new FontFace(name, `url(/fonts/NeueMontreal-${file}.otf)`);
      await f.load();
      document.fonts.add(f);
    })
  );
}

export const W = config.width;
export const H = config.height;
export const PAPER = config.paper;

// 12-column grid.
export const GRID = { margin: 96, gutter: 32, cols: 12 };
GRID.col = (W - GRID.margin * 2 - GRID.gutter * (GRID.cols - 1)) / GRID.cols;
/** Left edge of column i (0..12); colX(12) is the right margin. */
export const colX = (i) => (i >= GRID.cols ? W - GRID.margin : GRID.margin + i * (GRID.col + GRID.gutter));

// Neue Montreal: cap height is 0.715 em.
export const CAP = 0.715;

function setFont(ctx, size, family, tracking) {
  ctx.font = `${size}px ${family}`;
  ctx.letterSpacing = `${tracking * size}px`;
  ctx.textBaseline = 'alphabetic';
}

export function measure(ctx, text, size, family = FONTS.medium, tracking = -0.04) {
  ctx.save();
  setFont(ctx, size, family, tracking);
  const w = ctx.measureText(text).width - tracking * size;
  ctx.restore();
  return w;
}

/** Size that makes `text` span `width` pixels. */
export function fitSize(ctx, text, width, family = FONTS.medium, tracking = -0.04) {
  return (width / measure(ctx, text, 100, family, tracking)) * 100;
}

/**
 * Masked line reveal: every unit (char / word / whole line) rises from under its own
 * baseline mask with a slight tilt, and leaves upward the same way.
 * pIn / pOut are linear 0..1 progress values; stagger is the per-unit offset in progress units.
 */
export function type(ctx, text, o) {
  const {
    x = 0,
    y = 0,
    size = 100,
    family = FONTS.medium,
    tracking = -0.04,
    align = 'left',
    split = 'chars',
    pIn = 1,
    pOut = 0,
    stagger = 0.05,
    color = PAPER,
    alpha = 1,
    easeIn = ease.outExpo,
    easeOut = ease.inExpo,
    tilt = 0.06,
    maskTop = 1.0,
    maskBottom = 0.28,
  } = o;
  if (pIn <= 0 || pOut >= 1 || alpha <= 0 || !text) return measure(ctx, text, size, family, tracking);
  ctx.save();
  setFont(ctx, size, family, tracking);
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;

  const units = [];
  if (split === 'line') units.push(text);
  else if (split === 'words') text.split(/(\s+)/).forEach((u) => u && units.push(u));
  else [...text].forEach((u) => units.push(u));

  const total = ctx.measureText(text).width - tracking * size;
  const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const visible = units.filter((u) => u.trim()).length;
  const span = 1 + stagger * Math.max(0, visible - 1);
  let acc = '';
  let k = 0;
  for (const u of units) {
    const ux = x0 + (acc ? ctx.measureText(acc).width : 0);
    acc += u;
    if (!u.trim()) continue;
    const li = clamp(pIn * span - k * stagger);
    const lo = clamp(pOut * span - k * stagger);
    k++;
    if (li <= 0 || lo >= 1) continue;
    const ei = easeIn(li);
    const eo = easeOut(lo);
    const dy = (1 - ei) * size * 1.1 - eo * size * 1.1;
    const uw = ctx.measureText(u).width;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ux - size * 0.15, y - size * maskTop, uw + size * 0.3, size * (maskTop + maskBottom));
    ctx.clip();
    ctx.translate(ux, y + dy);
    ctx.rotate((1 - ei) * tilt - eo * tilt * 0.5);
    ctx.fillText(u, 0, 0);
    ctx.restore();
  }
  ctx.restore();
  return total;
}

/** Small running text used for labels and captions. */
export function label(ctx, text, x, y, o = {}) {
  return type(ctx, text, {
    x,
    y,
    size: 30,
    family: FONTS.regular,
    tracking: -0.005,
    split: 'line',
    alpha: 0.72,
    tilt: 0,
    ...o,
  });
}

/** Hairline that draws from (x1) to (x2) with progress p, and retracts with pOut. */
export function rule(ctx, x1, y, x2, p = 1, o = {}) {
  const { pOut = 0, alpha = 0.32, width = 1.5, color = PAPER, fn = ease.inOutQuart } = o;
  const a = fn(clamp(pOut));
  const b = fn(clamp(p));
  if (b <= a) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1 + (x2 - x1) * a, y);
  ctx.lineTo(x1 + (x2 - x1) * b, y);
  ctx.stroke();
  ctx.restore();
}

export function vrule(ctx, x, y1, y2, p = 1, o = {}) {
  const { alpha = 0.32, width = 1.5, color = PAPER, fn = ease.inOutQuart } = o;
  const b = fn(clamp(p));
  if (b <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y1 + (y2 - y1) * b);
  ctx.stroke();
  ctx.restore();
}

export function dot(ctx, x, y, r, color = config.accent, alpha = 1) {
  if (r <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const FRAME_IN = [0.5, 1.6];
/**
 * Editorial frame: four corner labels that sit on the outer grid for the whole film.
 * `chapter` is the bottom-left label of the current shot, revealed from `chapterP`.
 */
export function frameUI(ctx, t, { chapter = '', chapterP = 1, out = 0, alpha = 1, index } = {}) {
  if (alpha <= 0) return;
  const m = GRID.margin;
  const top = m + 22;
  const bottom = H - m + 8;
  const pin = (d) => range(t, FRAME_IN[0] + d, FRAME_IN[1] + d);
  const o = { alpha: 0.72 * alpha, pOut: out };
  label(ctx, config.frame.topLeft, m, top, { ...o, pIn: pin(0) });
  label(ctx, config.frame.topRight, W - m, top, { ...o, pIn: pin(0.08), align: 'right' });
  label(ctx, config.frame.bottomRight, W - m, bottom, { ...o, pIn: pin(0.16), align: 'right' });
  if (index) label(ctx, index, colX(6), top, { ...o, pIn: Math.min(chapterP, pin(0.12)) });
  if (chapter) label(ctx, chapter, m, bottom, { ...o, pIn: Math.min(chapterP, pin(0.24)) });
}

export const fadeInOut = (t, a, b, fi = 0.2, fo = 0.2) => range(t, a, a + fi) * (1 - range(t, b - fo, b));
