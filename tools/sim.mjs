import { Ragdoll, STEP } from '../src/ragdoll.js';
// seq: array of [duration, keys string]
export function run(seq, opts = {}) {
  const r = new Ragdoll(opts);
  const log = [];
  let handsTouched = false, maxAir = 0, air = 0, crash = null, maxH = 0;
  for (const [dur, k] of seq) {
    const keys = { q: k.includes('q'), w: k.includes('w'), o: k.includes('o'), p: k.includes('p') };
    for (let t = 0; t < dur; t += STEP) {
      r.step(keys);
      if (r.handsDown) handsTouched = true;
      if (r.airborne) { air += STEP; maxAir = Math.max(maxAir, air); } else air = 0;
      if (!crash && r.crashPart) crash = { part: r.crashPart, t: r.time.toFixed(2) };
      maxH = Math.max(maxH, r.com().y);
    }
    log.push(`${k||'-'}@${r.time.toFixed(2)} ang=${(r.bodies.torso.getAngle()*180/Math.PI).toFixed(0)} com=${r.com().y.toFixed(2)} x=${r.com().x.toFixed(2)}`);
  }
  return { r, log, handsTouched, maxAir, crash, maxH, rot: r.bodies.torso.getAngle() / (2 * Math.PI), feet: r.feetDown };
}
if (process.argv[1]?.endsWith('sim.mjs') && process.argv[2]) {
  const seq = JSON.parse(process.argv[2]);
  const res = run(seq, { springFloor: process.argv[3] !== 'hard' });
  console.log(res.log.join('\n'));
  console.log({ hands: res.handsTouched, maxAir: res.maxAir.toFixed(2), crash: res.crash, rot: res.rot.toFixed(2), feet: res.feet, maxH: res.maxH.toFixed(2) });
}
