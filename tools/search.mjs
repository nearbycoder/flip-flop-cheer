import { run } from './sim.mjs';
const mode = process.argv[2] || 'soft';
const kind = process.argv[3] || 'tuck';
let ok = 0, n = 0; const wins = [];
const D1=[0.4,0.6], D2=[0.1,0.15,0.2,0.25,0.3], D3=[0.2,0.3,0.4,0.5,0.6], D4=[0,0.15,0.3], K3=['q','qo'], K4=['','p','o'];
for (const d1 of D1) for (const d2 of D2) for (const d3 of D3) for (const k3 of K3) for (const d4 of D4) for (const k4 of K4) {
  const seq = kind==='tuck'
    ? [[1,''],[d1,'o'],[d2,'pw'],[d3,k3],[d4,k4],[+(process.env.HOLD||1.5),'']]
    : [[1,''],[d1,'o'],[d2,'pw'],[d3,'w'],[0.25,k3],[d4,k4],[+(process.env.HOLD||1.5),'']];
  const r = run(seq, { springFloor: mode==='soft', ...JSON.parse(process.env.OPTS||'{}') });
  n++;
  const turns = Math.round(r.rot);
  const tilt = Math.abs(r.rot - turns) * 360;
  if (!r.crash && turns === 1 && r.feet && tilt < 30) { ok++; wins.push(JSON.stringify(seq) + ` hands=${r.handsTouched} air=${r.maxAir.toFixed(2)}`); }
}
console.log(`${mode} ${kind}: ${ok}/${n}`); console.log(wins.slice(0,12).join('\n'));
