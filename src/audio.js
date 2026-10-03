// Tiny synthesized sound effects (no audio files needed).
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  ok() { return this.ctx && !this.muted; }

  noiseBurst({ freq = 1000, q = 1, dur = 0.5, gain = 0.4, type = 'bandpass', sweepTo = null, attack = 0.02 }) {
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  tone(freq, dur, { type = 'sine', gain = 0.2, to = null, delay = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  whoosh() { if (this.ok()) this.noiseBurst({ freq: 400, sweepTo: 2200, q: 0.8, dur: 0.35, gain: 0.25 }); }
  thump() { if (this.ok()) this.tone(140, 0.12, { gain: 0.3, to: 60 }); }

  cheer(big = false) {
    if (!this.ok()) return;
    this.noiseBurst({ freq: 1800, q: 0.6, dur: big ? 2.2 : 1.4, gain: big ? 0.5 : 0.35, attack: 0.15 });
    this.noiseBurst({ freq: 700, q: 0.7, dur: big ? 1.8 : 1.1, gain: 0.25, attack: 0.1 });
    // a few "woo!"s
    for (let i = 0; i < (big ? 6 : 3); i++) {
      const f = 500 + Math.random() * 500;
      this.tone(f, 0.45, { type: 'triangle', gain: 0.05, to: f * 1.6, delay: Math.random() * 0.4 });
    }
    this.tone(880, 0.12, { type: 'square', gain: 0.06 });
    this.tone(1320, 0.2, { type: 'square', gain: 0.05, delay: 0.1 });
  }

  flop() {
    if (!this.ok()) return;
    this.tone(90, 0.25, { gain: 0.4, to: 40 });
    this.noiseBurst({ freq: 300, q: 0.5, dur: 0.3, gain: 0.3, type: 'lowpass' });
    // sad trombone
    [392, 370, 349, 311].forEach((f, i) => this.tone(f, i === 3 ? 0.8 : 0.32, { type: 'sawtooth', gain: 0.07, delay: 0.35 + i * 0.32, to: i === 3 ? f * 0.94 : null }));
  }
}
