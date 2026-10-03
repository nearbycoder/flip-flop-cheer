import { Ragdoll } from '../src/ragdoll.js';
const [d1b,d2,delay,d4,k4,k5] = process.argv.slice(2).map((x,i)=>i<4?+x:(x==='-'?'':x));
const r = new Ragdoll({ springFloor: true });
let phase=0,t0=0,i=0;
const K=(s)=>({q:s.includes('q'),w:s.includes('w'),o:s.includes('o'),p:s.includes('p')});
while(r.time<3.6){const t=r.time;let k='';
 if(t<1)k='';else if(t<1.4)k='o';else if(t<1.4+d1b)k='ow';else if(t<1.4+d1b+d2)k='pw';else{
 if(phase===0){k='w';if(r.handsDown){phase=1;t0=t;}}
 if(phase===1){k=t-t0<delay?'w':k4;if(t-t0>delay+d4)phase=2;}
 if(phase===2)k=t-t0<delay+d4+0.3?k5:'';}
 r.step(K(k));
 if(t>1.5 && i++%4==0){const c=r.com();console.log(`${t.toFixed(2)} ${k||'-'} torso=${(r.bodies.torso.getAngle()*57.3).toFixed(0)} hip=${r.angle('hip').toFixed(2)} sh=${r.angle('shoulder').toFixed(2)} com=(${c.x.toFixed(2)},${c.y.toFixed(2)}) L=${r.angularMomentum().toFixed(1)} feet=${r.feetDown} hands=${r.handsDown} crash=${r.crashPart} pop=${r.popBack?.toFixed?.(2)}`);}}
