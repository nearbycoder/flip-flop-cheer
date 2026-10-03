import { run } from './sim.mjs';
const mode = process.argv[2] || 'soft';
let ok=0,n=0; const out=[]; const hist={};
for (const d1 of [0.4]) for (const d1b of [0.1,0.2,0.3,0.4]) for (const d2 of [0.1,0.2]) for (const d3 of [0.1,0.2,0.3,0.4]) for (const k4 of ['q','qp']) for (const d4 of [0.15,0.3]) for (const k5 of ['','p']) {
  const seq=[[1,''],[d1,'o'],[d1b,'ow'],[d2,'pw'],[d3,'w'],[d4,k4],[0.3,k5],[1.5,'']];
  const r=run(seq,{springFloor:mode==='soft'}); n++;
  const turns=Math.round(r.rot), tilt=Math.abs(r.rot-turns)*360;
  const good=!r.crash&&turns===1&&r.feet&&tilt<30&&r.handsTouched;
  const key=`${r.rot.toFixed(1)} ${r.crash?.part||'-'} hands=${r.handsTouched}`; hist[key]=(hist[key]||0)+1;
  if(good){ok++; out.push(JSON.stringify(seq));}
  if(process.argv[3]) console.log(d1b,d2,d3,k4,d4,k5,key, r.maxAir.toFixed(2));
}
console.log(Object.entries(hist).sort((a,b)=>b[1]-a[1]).slice(0,10));
console.log(`${mode} bhs ${ok}/${n}`); console.log(out.slice(0,10).join('\n'));
