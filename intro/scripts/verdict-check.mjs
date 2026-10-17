// Runs ae/JuryVerdict.jsx against the strict AE mock and evaluates every expression over the timeline.
//   node scripts/verdict-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { runJsx, runScript, createApp, indexComp, evaluate, matteOf } from '../src/verdict/ae-mock.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const source = fs.readFileSync(path.join(root, 'ae/JuryVerdict.jsx'), 'utf8');
const batch = fs.readFileSync(path.join(root, 'ae/JuryVerdict-Batch.jsx'), 'utf8');

function allProps(layer) {
  const out = [];
  const walk = (p) => (p.children ? p.children.forEach(walk) : out.push(p));
  layer.groups.forEach(walk);
  return out;
}

let failures = 0;
const fail = (m) => {
  failures++;
  console.log('  FAIL', m);
};

for (const modern of [true, false]) {
  console.log(`\n== ${modern ? 'AE 2023+ track mattes' : 'legacy track mattes'}`);
  const env = runJsx(source, { modernTrackMattes: modern });
  console.log('  alert:', env.log.join(' | ').replace(/\n/g, ' '));
  for (const comp of env.comps) {
    indexComp(comp);
    const exprProps = comp.layerList.flatMap((l) => allProps(l).filter((p) => p.expression).map((p) => [l, p]));
    console.log(`  ${comp.name}: ${comp.layerList.length} layers, ${exprProps.length} expressions, ${comp.duration}s`);
    console.log(`    essential graphics: ${comp.essentialProperties.map((e) => e.label).join(', ')}`);

    for (const l of comp.layerList) {
      if (l.trackMatteType) {
        const m = matteOf(l);
        if (!m || m.name !== `${l.name} / matte`) fail(`${comp.name}: "${l.name}" matte resolves to "${m?.name}"`);
      }
    }

    for (let t = 0; t <= comp.duration + 1e-9; t += 1 / 30) {
      for (const [l, p] of exprProps) {
        try {
          evaluate(p, t);
        } catch (e) {
          fail(`${comp.name} t=${t.toFixed(2)} "${l.name}" ${p.matchName}: ${e.message}`);
          break;
        }
      }
      if (failures > 10) break;
    }

    const show = (name, prop, t) => {
      const l = comp.layer(name);
      if (!l) return;
      const v = evaluate(prop(l), t);
      console.log(`    t=${t}s ${name}: ${JSON.stringify(v.text ?? v).slice(0, 80)}`);
    };
    const doc = (l) => l.property('ADBE Text Properties').property('ADBE Text Document');
    const pos = (l) => l.property('ADBE Transform Group').property('ADBE Position');
    show('Design / score', doc, 3);
    show('Design / score', pos, 3);
    show('Total / integer', doc, 6);
    show('Total / decimals', doc, 6);
    show('Total / decimals', pos, 6);
    show('UX / weight', doc, 1);
  }
}

console.log('\n== batch');
{
  const lines = 'lusion.co 8.4 7.6 9.1 6.8\n# comment\n\nobys.agency 8,9 8.1 9.3 7.5\n7 7 7 7';
  const env = runScript(createApp({ dialog: { text: lines } }), source);
  env.app.project.activeItem = env.comps.find((c) => /Total/.test(c.name));
  runScript(env, batch);
  console.log('  alert:', env.log[env.log.length - 1]);
  const made = env.comps.slice(2).map(indexComp);
  const last = (l, p) => evaluate(p(l), 6).text.split('\r').pop();
  const doc = (l) => l.property('ADBE Text Properties').property('ADBE Text Document');
  for (const c of made) {
    const total = `${last(c.layer('Total / integer'), doc)}.${last(c.layer('Total / decimals'), doc)}`;
    console.log(`  ${c.name}: site="${evaluate(doc(c.layer('Site')), 0).text}" total=${total}`);
  }
  const want = [['Verdict — lusion.co', '8.14'], ['Verdict — obys.agency', '8.60'], ['Verdict — site 3', '7.00']];
  want.forEach(([n, t], i) => {
    const c = made[i];
    const got = c && `${last(c.layer('Total / integer'), doc)}.${last(c.layer('Total / decimals'), doc)}`;
    if (!c || c.name !== n || got !== t) fail(`batch comp ${i}: ${c?.name} ${got}, want ${n} ${t}`);
  });
  if (env.queue.length !== 3) fail(`render queue has ${env.queue.length} items`);
  try {
    runScript(Object.assign(env, { Window: createApp({ dialog: { text: 'bad.site 7 7 x 7' } }).Window }), batch);
    fail('bad input was accepted');
  } catch (e) {
    console.log('  bad input rejected:', e.message);
  }
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good');
process.exit(failures ? 1 : 0);
