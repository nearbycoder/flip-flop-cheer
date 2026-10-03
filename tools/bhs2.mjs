import { Ragdoll, STEP } from '../src/ragdoll.js';
const mode = process.argv[2] || 'soft';
function attempt(d1b, d2, d4, k4, k5, delay) {
  const r = new Ragdoll({ springFloor: mode === 'soft', ...JSON.parse(process.env.OPTS||'{}') });
  let phase = 0, t0 = 0, hands = false, crash = null;
  const K = (s) => ({ q: s.includes('q'), w: s.includes('w'), o: s.includes('o'), p: s.includes('p') });
  const T = 4.5;
  while (r.time < T) {
    const t = r.time;
    let k = '';
    if (t < 1) k = '';
    else if (t < 1.4) k = 'o';
    else if (t < 1.4 + d1b) k = 'ow';
    else if (t < 1.4 + d1b + d2) k = 'pw';
    else {
      if (phase === 0) { k = 'w'; if (r.handsDown) { phase = 1; t0 = t; } if (t > 3) phase = 3; }
      if (phase === 1) { k = t - t0 < delay ? 'w' : k4; if (t - t0 > delay + d4) phase = 2; }
      if (phase === 2) k = r.time - t0 < delay + d4 + 0.3 ? k5 : '';
    }
    r.step(K(k));
    if (r.handsDown) hands = true;
    if (!crash && r.crashPart) crash = r.crashPart;
  }
  const rot = r.bodies.torso.getAngle() / (2 * Math.PI);
  return { rot, crash, hands, feet: r.feetDown };
}
let ok = 0, n = 0; const hist = {}; const wins = [];
for (const d1b of [0.2, 0.3, 0.4, 0.5, 0.6]) for (const d2 of [0.1, 0.2]) for (const delay of [0, 0.05, 0.1]) for (const d4 of [0.1, 0.2, 0.3, 0.4]) for (const k4 of ['q', 'qp']) for (const k5 of ['', 'p']) {
  const r = attempt(d1b, d2, d4, k4, k5, delay); n++;
  const turns = Math.round(r.rot), tilt = Math.abs(r.rot - turns) * 360;
  const good = !r.crash && turns === 1 && r.feet && tilt < 30 && r.hands;
  const key = `${r.rot.toFixed(1)} ${r.crash || '-'}`; hist[key] = (hist[key] || 0) + 1;
  if (good) { ok++; wins.push([d1b, d2, delay, d4, k4, k5].join(' ')); }
}
console.log(Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 8));
console.log(`${mode} reactive bhs ${ok}/${n}`); console.log(wins.slice(0, 40).join(' | '));
