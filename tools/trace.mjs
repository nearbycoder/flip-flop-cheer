import { Ragdoll, STEP } from '../src/ragdoll.js';
const seq = JSON.parse(process.argv[2]); const every = +(process.argv[3]||6);
const r = new Ragdoll({ springFloor: true });
let i=0;
for (const [dur,k] of seq){ const keys={q:k.includes('q'),w:k.includes('w'),o:k.includes('o'),p:k.includes('p')};
 for(let t=0;t<dur;t+=STEP){ r.step(keys); if(i++%every==0){const c=r.com();
  console.log(`${r.time.toFixed(2)} ${k||'-'} torso=${(r.bodies.torso.getAngle()*57.3).toFixed(0)} knee=${r.angle('knee').toFixed(2)} hip=${r.angle('hip').toFixed(2)} ank=${r.angle('ankle').toFixed(2)} com=(${c.x.toFixed(2)},${c.y.toFixed(2)}) L=${r.angularMomentum().toFixed(1)} av=${r.bodies.torso.getAngularVelocity().toFixed(1)} feet=${r.feetDown} hands=${r.handsDown} crash=${r.crashPart}`);}}}
