// Preview of the After Effects templates: runs ae/*.jsx against the AE mock and draws the
// resulting comp with its expressions, text animators, track mattes and motion blur.
//   verdict.html?comp=total|scores&scores=7.2,7.2,7.0,6.7&site=site-name.com
//   verdict.html?jsx=transition&number=42&title=...
import verdictSource from '../../ae/JuryVerdict.jsx?raw';
import transitionSource from '../../ae/JuryTransition.jsx?raw';
import { runJsx, indexComp, evaluate, matteOf, ParagraphJustification } from './ae-mock.js';

const params = new URLSearchParams(location.search);
const isRender = params.has('render');
const scale = Number(params.get('scale') ?? 1);
const blurSamples = params.has('fast') ? 1 : 10;
const which = params.get('jsx') === 'transition' ? 'transition' : 'verdict';
const source = which === 'transition' ? transitionSource : verdictSource;

// PostScript name -> [CSS family, Neue Montreal file to load (null = system font), weight]
const FONTS = {
  'NeueMontreal-Light': ['NM Light', 'Light', 400],
  'NeueMontreal-Regular': ['NM Regular', 'Regular', 400],
  'NeueMontreal-Medium': ['NM Medium', 'Medium', 400],
  'Inter-Regular': ['Inter', null, 400],
  'Inter-Medium': ['Inter', null, 500],
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
  if (which === 'transition') comp = comps[0];
  else comp = comps.find((c) => (kind === 'scores' ? !/Total/.test(c.name) : /Total/.test(c.name)));
}

function setText(c, layerName, text) {
  const l = c.layer(layerName);
  if (text && l) l.property('ADBE Text Properties').property('ADBE Text Document').value.text = text;
}

function setInputs({ scores = [], site, number, title }) {
  for (const c of comps) {
    const fx = c.layer('CONTROLS').property('ADBE Effect Parade');
    ['Design', 'UX', 'Creativity', 'Content'].forEach((n, i) => {
      if (fx.property(n) && Number.isFinite(scores[i])) fx.property(n).property(1).value = scores[i];
    });
    if (fx.property('Number') && Number.isFinite(number)) fx.property('Number').property(1).value = number;
    setText(c, 'Site', site);
    setText(c, 'Title', title);
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
    drawText(g, l, opacity);
  }
  g.restore();
}

// Per-character state from text animators: position offset and opacity factor.
function charAnimators(l, total) {
  const group = l.property('ADBE Text Properties').property('ADBE Text Animators');
  const anims = [];
  for (let a = 1; a <= group.numProperties; a++) {
    const anim = group.property(a);
    const props = anim.property('ADBE Text Animator Properties');
    const pos = props.property('ADBE Text Position 3D');
    const op = props.property('ADBE Text Opacity');
    const sels = anim.property('ADBE Text Selectors');
    anims.push({
      pos: pos && evaluate(pos, tNow),
      op: op && evaluate(op, tNow),
      amount(i) {
        let k = 1;
        for (let s = 1; s <= sels.numProperties; s++) {
          const sel = sels.property(s);
          if (sel.matchName === 'ADBE Text Expressible Selector') {
            const v = evaluate(sel.property('ADBE Text Expressible Amount'), tNow, { textIndex: i, textTotal: total });
            k *= Math.min(100, Math.max(0, Array.isArray(v) ? v[0] : v)) / 100;
          }
        }
        return k;
      },
    });
  }
  return anims;
}

function drawText(g, l, layerOpacity) {
  const doc = evaluate(l.property('ADBE Text Properties').property('ADBE Text Document'), tNow);
  const [family, , weight] = FONTS[doc.font] ?? ['sans-serif', null, 400];
  g.font = `${weight} ${doc.fontSize}px "${family}"`;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = rgb(doc.fillColor);
  g.strokeStyle = rgb(doc.strokeColor ?? [0, 0, 0]);
  g.lineWidth = doc.strokeWidth ?? 1;
  g.lineJoin = 'round';
  const track = ((doc.tracking ?? 0) * doc.fontSize) / 1000;
  const lead = doc.autoLeading ? doc.fontSize * 1.2 : doc.leading;
  const paint = (str, x, y) => {
    if (doc.applyFill) g.fillText(str, x, y);
    if (doc.applyStroke) g.strokeText(str, x, y);
  };
  String(doc.text)
    .split(/\r\n|\r|\n/)
    .forEach((line, li) => {
      const chars = [...line];
      const advance = (n) => g.measureText(chars.slice(0, n).join('')).width + n * track;
      const width = advance(chars.length);
      const x0 =
        doc.justification === ParagraphJustification.RIGHT_JUSTIFY
          ? -width
          : doc.justification === ParagraphJustification.CENTER_JUSTIFY
            ? -width / 2
            : 0;
      const anims = charAnimators(l, chars.length);
      if (!anims.length && !track) return paint(line, x0, li * lead);
      chars.forEach((ch, i) => {
        let dx = 0;
        let dy = 0;
        let op = 1;
        for (const a of anims) {
          const k = a.amount(i + 1);
          if (a.pos) {
            dx += a.pos[0] * k;
            dy += a.pos[1] * k;
          }
          if (a.op != null) op *= 1 + (a.op / 100 - 1) * k;
        }
        if (op <= 0) return;
        g.globalAlpha = layerOpacity * op;
        paint(ch, x0 + advance(i) + dx, li * lead + dy);
      });
    });
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
    Object.values(FONTS).map(async ([family, file, weight]) => {
      if (!file) return document.fonts.load(`${weight} 40px "${family}"`, 'Оценочная');
      const f = new FontFace(family, `url(/fonts/NeueMontreal-${file}.otf)`);
      document.fonts.add(await f.load());
    }),
  );
}

function totalFrames() {
  return Math.round(comp.duration * comp.frameRate);
}

async function init() {
  await loadFonts();
  build();
  const scores = (params.get('scores') ?? '').split(',').filter(Boolean).map(Number);
  setInputs({
    scores,
    site: params.get('site'),
    number: params.has('number') ? Number(params.get('number')) : undefined,
    title: params.get('title'),
  });
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
  const fields = (which === 'verdict' ? names : []).map((n, i) => {
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
      setInputs({ scores: fields.map((x) => Number(x.value)) });
      show();
    }),
  );
  document.getElementById('comp').hidden = which !== 'verdict';
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
