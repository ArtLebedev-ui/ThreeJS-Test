import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { config } from './config.js';
import { range } from './lib/anim.js';
import { Engine, createEnvironments } from './engine.js';
import { loadFonts, frameUI } from './overlay.js';
import { cursorGeo, makeSiteAtlas, makeHeroSite, makeArticle } from './assets.js';
import { createGlint } from './shots/glint.js';
import { createFieldShots } from './shots/field.js';
import { createCriterion } from './shots/criteria.js';
import { createScore } from './shots/score.js';
import { createTitle } from './shots/title.js';

const params = new URLSearchParams(location.search);
const renderMode = params.has('render');

async function boot() {
  await loadFonts();
  RectAreaLightUniformsLib.init();
  const canvas = document.getElementById('c');
  const engine = new Engine(canvas, config, Number(params.get('scale') ?? 1));
  if (renderMode) {
    canvas.style.width = `${engine.width}px`;
    canvas.style.height = `${engine.height}px`;
  }

  const A = {
    env: createEnvironments(engine.renderer),
    cursorGeo: cursorGeo(),
    atlas: makeSiteAtlas(),
    hero: makeHeroSite(),
    article: makeArticle(),
  };

  const shots = [
    createGlint(A),
    ...createFieldShots(A),
    ...config.criteria.map((c, i) => createCriterion(A, c, i)),
    createScore(A),
    createTitle(A),
  ];

  const shotAt = (t) => shots.find((s) => t >= s.start && t < s.end) ?? shots[shots.length - 1];
  const totalFrames = Math.round(config.duration * config.fps);

  function renderFrame(frame) {
    const t = frame / config.fps;
    const shot = shotAt(t);
    const lt = t - shot.start;
    engine.render({
      t,
      frame,
      samples: params.has('fast') ? 1 : shot.samples?.(lt) ?? 1,
      drawScene: (tk) => shot.update(Math.max(0, tk - shot.start)),
      drawOverlay: (ctx, ctxD, ctxM) => {
        shot.overlay?.(ctx, ctxD, ctxM, lt, t, frame);
        const f = shot.frame?.(lt) ?? {};
        const prev = shots[shots.indexOf(shot) - 1]?.frame?.(0) ?? {};
        const fresh = f.chapter !== prev.chapter || f.index !== prev.index;
        frameUI(ctx, t, { chapterP: fresh ? range(lt, 0.05, 0.6) : 1, ...f });
      },
      post: shot.post?.(lt) ?? {},
    });
  }

  // Compile every shot's shaders up front so the first frames don't stall.
  for (const s of shots) {
    const { scene, camera } = s.update(0.01);
    engine.renderer.compile(scene, camera);
  }

  window.__intro = { renderFrame, totalFrames, config, shots: shots.map((s) => [s.name, s.start, s.end]) };
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
    const t = frame / config.fps;
    label.textContent = `${t.toFixed(2)}s · f${frame} · ${shotAt(t).name}`;
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
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') play.click();
    if (e.code === 'ArrowRight') (frame = Math.min(totalFrames - 1, frame + 1)), draw();
    if (e.code === 'ArrowLeft') (frame = Math.max(0, frame - 1)), draw();
  });
  const loop = (now) => {
    if (playing) {
      acc += (now - last) / 1000;
      const step = Math.floor(acc * config.fps);
      if (step > 0) {
        acc -= step / config.fps;
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
