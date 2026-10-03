import { Ragdoll, STEP } from '../src/ragdoll.js';
const r = new Ragdoll({ springFloor: true });
const K = (s) => ({ q: s.includes('q'), w: s.includes('w'), o: s.includes('o'), p: s.includes('p') });
const show = (l) => { const c = r.com(), f = r.bodies.foot.getPosition(); console.log(l, `lean=${(r.torsoTurn*57.3%360).toFixed(1)} knee=${r.angle('knee').toFixed(2)} hip=${r.angle('hip').toFixed(2)} ank=${r.angle('ankle').toFixed(2)} waist=${r.angle('waist').toFixed(2)} comx-foot=${(c.x-f.x).toFixed(3)} comy=${c.y.toFixed(2)} footAng=${(r.bodies.foot.getAngle()*57.3).toFixed(1)} vx=${r.comVel().x.toFixed(2)}`); };
show('start');
for (const [d, k] of [[1.2, ''], [0.4, 'o'], [0.1, 'pw'], [0.4, 'q'], [1, ''], [1.2, '']]) { for (let t = 0; t < d; t += STEP) r.step(K(k)); show(k || '-'); }
