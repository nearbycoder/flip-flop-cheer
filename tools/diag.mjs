import { run } from './sim.mjs';
const mode = process.argv[2] || 'soft';
const hist = {};
for (const d2 of [0.15,0.2,0.25]) for (const d3 of [0.2,0.3,0.4,0.5]) for (const k3 of ['q','qo']) for (const k4 of ['','p']) {
  const seq=[[1,''],[0.6,'o'],[d2,'pw'],[d3,k3],[0.2,k4],[1.5,'']];
  const r=run(seq,{springFloor:mode==='soft'});
  console.log(`d2=${d2} d3=${d3} ${k3}/${k4||'-'} rot=${r.rot.toFixed(2)} crash=${r.crash?.part||'-'}@${r.crash?.t||''} air=${r.maxAir.toFixed(2)} feet=${r.feet}`);
}
