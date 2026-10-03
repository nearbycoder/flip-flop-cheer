import { simulate } from './demo.mjs';
let ok = 0;
for (const lean of [0.1,0.2, 0.3, 0.4, 0.5,0.6]) for (const jump of [0.1, 0.15, 0.2,0.25]) for (const qHold of [0.1, 0.15, 0.25,0.35]) {
  const { ev } = simulate({ lean, jump, qHold, plan: [['wait', 1.0], ['bhs'], ['wait', 2]], frame: +(process.argv[2]||0) || undefined });
  const s = ev.map((e) => e.split(' ')[1]).join(' ');
  if (s.includes('Handspring')) { ok++; console.log(lean, jump, qHold, s); }
}
console.log('ok', ok);
