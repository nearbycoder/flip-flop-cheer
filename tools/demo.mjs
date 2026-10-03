// Scripted demo run used for README captures: back tuck, back handspring,
// handspring -> tuck combo, then a deliberate flop.
import { Ragdoll, STEP } from '../src/ragdoll.js';
import { SkillTracker } from '../src/skills.js';

export function demoPolicy(o = {}) {
  const { lean = 0.4, jump = 0.2, qHold = 0.15, pHold = 0.3, gap = 2.0, gap2 = 0.05, plan: custom } = o;
  // steps: [kind, ...] executed in order
  const plan = custom || [
    ['wait', 1.2],
    ['tuck'], ['wait', gap],
    ['bhs'], ['wait', gap],
    ['bhs'], ['wait', gap2], ['tuck'], ['wait', 2.2],
    ['fall'], ['wait', 3.0],
  ];
  let i = 0, t0 = 0, phase = 0, handT = 0;
  return (t, r) => {
    if (i >= plan.length) return null;
    const [kind, arg] = plan[i];
    if (t0 === 0) t0 = t;
    const e = t - t0;
    const next = () => { i++; t0 = 0; phase = 0; handT = 0; };
    switch (kind) {
      case 'wait': if (e >= arg) next(); return '';
      case 'tuck':
        if (e < 0.4) return 'o';
        if (e < 0.5) return 'pw';
        if (e < 0.9) return 'q';
        next(); return '';
      case 'bhs':
        if (e < 0.4) return 'o';
        if (e < 0.4 + lean) return 'ow';
        if (e < 0.4 + lean + jump) return 'pw';
        if (phase === 0) { if (r.handsDown) { phase = 1; handT = t; } if (e > 2.5) next(); return 'w'; }
        if (t - handT < qHold) return 'q';
        if (t - handT < qHold + pHold) return 'p';
        next(); return '';
      case 'fall':
        if (e < 1.6) return 'w';
        next(); return '';
    }
    return '';
  };
}

// Validate the run headlessly: node tools/demo.mjs
export function simulate(o) {
  const r = new Ragdoll({ springFloor: true, ...JSON.parse(process.env.OPTS || '{}') });
  const ev = [];
  const st = new SkillTracker((type, d) => ev.push(`${r.time.toFixed(2)} ${type}:${d.name || d.part || d.total}`));
  st.reset(r);
  const pol = demoPolicy(o);
  const FRAME = o.frame || 1 / 30;
  let t = 0;
  for (;;) {
    const k = pol(t, r);
    if (k === null) break;
    const keys = { q: k.includes('q'), w: k.includes('w'), o: k.includes('o'), p: k.includes('p') };
    for (let n = 0; n < Math.round(FRAME / STEP); n++) { r.step(keys); st.update(r, keys); }
    t += FRAME;
  }
  return { ev, t, score: st.score };
}

if (process.argv[1]?.endsWith('/demo.mjs')) {
  const o = JSON.parse(process.argv[2] || '{}');
  const { ev, t, score } = simulate(o);
  console.log(ev.join('\n'));
  console.log('duration', t.toFixed(1), 's, score', score);
}
