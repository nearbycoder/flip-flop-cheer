import { simulate } from './demo.mjs';
const res = [];
for (const lean of [0.2, 0.3, 0.4, 0.5]) for (const jump of [0.1, 0.2]) for (const qHold of [0.1, 0.15, 0.2, 0.3]) for (const pHold of [0, 0.15, 0.3]) for (const gap of [2.2]) for (const gap2 of [0, 0.1, 0.2, 0.3, 0.45]) {
  const o = { lean, jump, qHold, pHold, gap, gap2 };
  const { ev, score } = simulate(o);
  const names = ev.map((e) => e.slice(e.indexOf(' ') + 1));
  const skills = names.filter((e) => e.startsWith('skill:'));
  const flopIdx = names.findIndex((e) => e.startsWith('flop'));
  const flopT = flopIdx >= 0 ? +ev[flopIdx].split(' ')[0] : 99;
  res.push({ o, n: skills.length, score, flopT, s: names.join(' | ') });
}
res.sort((a, b) => b.n - a.n || b.score - a.score);
for (const r of res.slice(0, 5)) console.log(JSON.stringify(r.o), r.n, r.score, r.flopT, r.s);
