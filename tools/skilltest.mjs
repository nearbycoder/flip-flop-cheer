import { Ragdoll, STEP } from '../src/ragdoll.js';
import { SkillTracker } from '../src/skills.js';
const K=(s)=>({q:s.includes('q'),w:s.includes('w'),o:s.includes('o'),p:s.includes('p')});
function play(seq, label){
  const r=new Ragdoll({springFloor:true}); const ev=[]; const st=new SkillTracker((t,d)=>ev.push(t+':'+(d.name||d.part||d.total)));
  st.reset(r);
  for(const [d,k] of seq) for(let t=0;t<d;t+=STEP){const keys=K(k); r.step(keys); st.update(r,keys);}
  console.log(label, ev.join(' | '), 'score', st.score, 'dist', st.distance.toFixed(2));
}
play([[1,''],[0.4,'o'],[0.1,'pw'],[0.4,'q'],[0,''],[2.5,'']],'tuck');
// BHS reactive via fixed seq found earlier
play([[1,''],[0.4,'o'],[0.4,'ow'],[0.2,'pw'],[0.3,'w'],[0.15,'q'],[0.3,'p'],[2.5,'']],'bhs');
play([[1,''],[0.6,'o'],[1,''],[2,'']],'flop?');
