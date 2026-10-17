// Usage:
//   node scripts/render.mjs --out out/frames                 render every frame
//   node scripts/render.mjs --times 1.2,4.5 --out out/stills  render stills at given seconds
//   node scripts/render.mjs --worker 0/2                      render every 2nd frame starting at 0
//   --fast  disables motion-blur sub-frames (preview quality)
//   --scale 0.5  renders the 3D at half resolution (preview quality)
//   --page verdict.html --query "comp=scores&scores=8.1,7.4,8.8,7.0"  renders the score card preview
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, [])
);

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.resolve(root, args.out ?? 'out/frames');
fs.mkdirSync(outDir, { recursive: true });
const port = Number(args.port ?? 5183 + Number(String(args.worker ?? '0/1').split('/')[0]));

const server = await createServer({
  root,
  server: { port, strictPort: true, hmr: false, watch: null },
  logLevel: 'error',
});
await server.listen();

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/local/bin/google-chrome',
  headless: 'new',
  protocolTimeout: 600000,
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--force-device-scale-factor=1',
  ],
});
const page = await browser.newPage();
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const scale = Number(args.scale ?? 1);
const vw = Math.round(2560 * scale);
const vh = Math.round(1600 * scale);
await page.setViewport({ width: vw, height: vh, deviceScaleFactor: 1 });
const q = `?render&scale=${scale}${args.fast ? '&fast' : ''}${args.query ? `&${args.query}` : ''}`;
await page.goto(`http://localhost:${port}/${args.page ?? ''}${q}`);
await page.waitForFunction('window.__ready || window.__error', { timeout: 300000 });
const err = await page.evaluate('window.__error');
if (err) {
  console.error(err);
  process.exit(1);
}
const { totalFrames, config } = await page.evaluate('({ totalFrames: window.__intro.totalFrames, config: window.__intro.config })');

let frames;
if (args.times) frames = String(args.times).split(',').map((s) => Math.round(Number(s) * config.fps));
else if (args.frames) {
  const [a, b] = String(args.frames).split('-').map(Number);
  frames = Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
} else frames = Array.from({ length: totalFrames }, (_, i) => i);
if (args.worker) {
  const [wi, wn] = String(args.worker).split('/').map(Number);
  frames = frames.filter((f) => f % wn === wi);
}
if (args.resume) frames = frames.filter((f) => !fs.existsSync(path.join(outDir, `${String(f).padStart(5, '0')}.png`)));

const t0 = Date.now();
for (let i = 0; i < frames.length; i++) {
  const f = frames[i];
  // Read the WebGL drawing buffer directly; page screenshots can include stale compositor tiles.
  const dataUrl = await page.evaluate((fr) => {
    window.__intro.renderFrame(fr);
    return document.getElementById('c').toDataURL('image/png');
  }, f);
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  const name = args.times ? `t${(f / config.fps).toFixed(2).padStart(5, '0')}.png` : `${String(f).padStart(5, '0')}.png`;
  fs.writeFileSync(path.join(outDir, name), buf);
  const el = (Date.now() - t0) / 1000;
  if (i % 10 === 0 || i === frames.length - 1)
    console.log(`frame ${f} (${i + 1}/${frames.length}) ${(el / (i + 1)).toFixed(2)}s/frame, eta ${((el / (i + 1)) * (frames.length - i - 1) / 60).toFixed(1)}m`);
}

await browser.close();
await server.close();
