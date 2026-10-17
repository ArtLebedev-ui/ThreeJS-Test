// Preview of the After Effects template: runs ae/JuryVerdict.jsx against the AE mock
// and draws the resulting comp with its expressions, track mattes and motion blur.
//   verdict.html?comp=total|scores&scores=7.2,7.2,7.0,6.7&site=site-name.com
import source from '../../ae/JuryVerdict.jsx?raw';
import { runJsx, indexComp, evaluate, matteOf, ParagraphJustification } from './ae-mock.js';

const params = new URLSearchParams(location.search);
const isRender = params.has('render');
const scale = Number(params.get('scale') ?? 1);
const blurSamples = params.has('fast') ? 1 : 10;

const FONTS = {
  'NeueMontreal-Regular': ['NM Regular', 'Regular'],
  'NeueMontreal-Medium': ['NM Medium', 'Medium'],
};

const canvas = document.getElementById('c');
canvas.width = Math.round(2560 * scale);
canvas.height = Math.round(1600 * scale);
const ctx = canvas.getContext('2d');
const sub = document.createElement('canvas');
sub.width = canvas.width;
sub.height = canvas.height;
const sctx = sub.getContext('2d');

let comps;
let comp;

function build() {
  comps = runJsx(source).comps.map(indexComp);
}

function select(kind) {
  comp = comps.find((c) => (kind === 'scores' ? !/Total/.test(c.name) : /Total/.test(c.name)));
}

function setInputs(scores, site) {
  for (const c of comps) {
    const fx = c.layer('CONTROLS').property('ADBE Effect Parade');
    ['Design', 'UX', 'Creativity', 'Content'].forEach((n, i) => {
      if (scores[i] != null && Number.isFinite(scores[i])) fx.property(n).property(1).value = scores[i];
    });
    if (site) c.layer('Site').property('ADBE Text Properties').property('ADBE Text Document').value.text = site;
  }
}

const tr = (l, name) => evaluate(l.property('ADBE Transform Group').property(name), tNow);
let tNow = 0;

function applyTransform(g, l) {
  const [px, py] = tr(l, 'ADBE Position');
  const [ax, ay] = tr(l, 'ADBE Anchor Point');
  const [sx, sy] = tr(l, 'ADBE Scale');
  g.translate(px, py);
  g.scale(sx / 100, sy / 100);
  g.translate(-ax, -ay);
}

const rgb = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

function shapeItems(l) {
  const out = [];
  const root = l.property('ADBE Root Vectors Group');
  for (let gi = 1; gi <= root.numProperties; gi++) {
    const vectors = root.property(gi).property('ADBE Vectors Group');
    let fill = [1, 1, 1, 1];
    const shapes = [];
    for (let k = 1; k <= vectors.numProperties; k++) {
      const p = vectors.property(k);
      if (p.matchName === 'ADBE Vector Graphic - Fill') fill = evaluate(p.property('ADBE Vector Fill Color'), tNow);
      if (p.matchName === 'ADBE Vector Shape - Rect')
        shapes.push({ kind: 'rect', size: evaluate(p.property(2), tNow), pos: evaluate(p.property(3), tNow) });
      if (p.matchName === 'ADBE Vector Shape - Ellipse')
        shapes.push({ kind: 'ellipse', size: evaluate(p.property(2), tNow), pos: evaluate(p.property(3), tNow) });
    }
    shapes.forEach((s) => out.push({ ...s, fill }));
  }
  return out;
}

function tracePath(g, s) {
  const [w, h] = s.size;
  const [x, y] = s.pos;
  if (s.kind === 'rect') g.rect(x - w / 2, y - h / 2, w, h);
  else g.ellipse(x, y, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
}

function drawLayer(g, l) {
  const opacity = tr(l, 'ADBE Opacity') / 100;
  if (opacity <= 0) return;
  g.save();
  applyTransform(g, l);
  g.globalAlpha = opacity;
  if (l.kind === 'solid') {
    g.fillStyle = rgb(l.color);
    g.fillRect(0, 0, l.width, l.height);
  } else if (l.kind === 'shape') {
    for (const s of shapeItems(l)) {
      g.beginPath();
      tracePath(g, s);
      g.fillStyle = rgb(s.fill, s.fill[3] ?? 1);
      g.fill();
    }
  } else if (l.kind === 'text') {
    const doc = evaluate(l.property('ADBE Text Properties').property('ADBE Text Document'), tNow);
    const family = FONTS[doc.font]?.[0] ?? 'sans-serif';
    g.font = `${doc.fontSize}px "${family}"`;
    g.textBaseline = 'alphabetic';
    g.textAlign =
      doc.justification === ParagraphJustification.RIGHT_JUSTIFY
        ? 'right'
        : doc.justification === ParagraphJustification.CENTER_JUSTIFY
          ? 'center'
          : 'left';
    g.fillStyle = rgb(doc.fillColor);
    const lead = doc.autoLeading ? doc.fontSize * 1.2 : doc.leading;
    String(doc.text)
      .split(/\r\n|\r|\n/)
      .forEach((line, i) => g.fillText(line, 0, i * lead));
  }
  g.restore();
}

// Rectangular shape mattes become clip paths; that is all the template uses.
function clipToMatte(g, matte) {
  g.save();
  applyTransform(g, matte);
  g.beginPath();
  for (const s of shapeItems(matte)) tracePath(g, s);
  g.restore();
  g.clip();
}

function drawComp(g, t) {
  tNow = t;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.fillStyle = rgb(comp.bgColor);
  g.fillRect(0, 0, 2560, 1600);
  const mattes = new Set(comp.layerList.map(matteOf).filter(Boolean));
  for (let i = comp.layerList.length - 1; i >= 0; i--) {
    const l = comp.layerList[i];
    if (mattes.has(l) || !l.enabled || l.kind === 'null') continue;
    const m = matteOf(l);
    g.save();
    if (m) clipToMatte(g, m);
    drawLayer(g, l);
    g.restore();
  }
}

function renderTime(t) {
  const fps = comp.frameRate;
  if (blurSamples === 1) return drawComp(ctx, t);
  // 180° shutter, -90° phase: samples centred on the frame, half a frame wide.
  for (let k = 0; k < blurSamples; k++) {
    const ts = Math.max(0, t + (-0.25 + (0.5 * (k + 0.5)) / blurSamples) / fps);
    drawComp(k === 0 ? ctx : sctx, ts);
    if (k > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1 / (k + 1);
      ctx.drawImage(sub, 0, 0);
      ctx.globalAlpha = 1;
    }
  }
}

async function loadFonts() {
  await Promise.all(
    Object.values(FONTS).map(async ([family, file]) => {
      const f = new FontFace(family, `url(/fonts/NeueMontreal-${file}.otf)`);
      document.fonts.add(await f.load());
    })
  );
}

function totalFrames() {
  return Math.round(comp.duration * comp.frameRate);
}

async function init() {
  await loadFonts();
  build();
  const scores = (params.get('scores') ?? '').split(',').filter(Boolean).map(Number);
  setInputs(scores, params.get('site'));
  select(params.get('comp') ?? 'total');

  window.__intro = {
    get totalFrames() {
      return totalFrames();
    },
    config: { fps: 30 },
    renderFrame: (f) => renderTime(f / comp.frameRate),
  };

  if (!isRender) setupUi(scores);
  window.__ready = true;
}

function setupUi(initial) {
  const ui = document.getElementById('ui');
  ui.hidden = false;
  const scrub = document.getElementById('scrub');
  const label = document.getElementById('label');
  const inputs = document.getElementById('inputs');
  const names = ['Design', 'UX', 'Creativity', 'Content'];
  const defaults = [7.2, 7.2, 7.0, 6.7];
  const fields = names.map((n, i) => {
    const el = document.createElement('input');
    el.type = 'number';
    el.step = '0.1';
    el.min = '0';
    el.max = '10';
    el.value = initial[i] ?? defaults[i];
    el.title = n;
    inputs.append(el);
    return el;
  });
  let frame = 0;
  let playing = false;
  let last = 0;
  const show = () => {
    scrub.max = totalFrames() - 1;
    scrub.value = frame;
    label.textContent = `${(frame / 30).toFixed(2)}s`;
    renderTime(frame / 30);
  };
  fields.forEach((f) =>
    f.addEventListener('input', () => {
      setInputs(fields.map((x) => Number(x.value)));
      show();
    })
  );
  document.getElementById('comp').addEventListener('change', (e) => {
    select(e.target.value);
    frame = Math.min(frame, totalFrames() - 1);
    show();
  });
  scrub.addEventListener('input', () => {
    frame = Number(scrub.value);
    show();
  });
  document.getElementById('play').addEventListener('click', () => {
    playing = !playing;
    last = performance.now();
  });
  const tick = (now) => {
    if (playing && now - last >= 1000 / 30) {
      last = now;
      frame = (frame + 1) % totalFrames();
      show();
    }
    requestAnimationFrame(tick);
  };
  show();
  requestAnimationFrame(tick);
}

init().catch((e) => {
  console.error(e);
  window.__error = String(e?.stack ?? e);
});
