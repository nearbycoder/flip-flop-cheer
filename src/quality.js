// Adaptive quality: watches real frame times and trades resolution and
// shadow quality for frame rate so the game holds 60 fps on any device.

export const TIERS = [
  { name: 'ultra', pixelRatio: 2, shadows: 2048 },
  { name: 'high', pixelRatio: 1.5, shadows: 1024 },
  { name: 'medium', pixelRatio: 1.15, shadows: 1024 },
  { name: 'low', pixelRatio: 0.9, shadows: 512 },
  { name: 'lowest', pixelRatio: 0.7, shadows: 0 },
];

const WINDOW = 40;          // frames per measurement window
const SLOW_MS = 18.2;       // below ~55 fps -> step down
const STABLE_MS = 17.4;     // comfortably at refresh rate
const UPGRADE_AFTER = 10;   // seconds of stable frames before probing up

export class Quality {
  constructor(apply, { start = 0, mode = 'auto' } = {}) {
    this.apply = apply;
    this.mode = mode;
    this.tier = start;
    this.ceiling = 0;       // best tier known to be sustainable
    this.samples = [];
    this.stableFor = 0;
    this.cooldown = 0;
    this.probing = -1;
    this.fps = 60;
    this.apply(TIERS[this.tier]);
  }

  setMode(mode) {
    this.mode = mode;
    const fixed = { high: 0, medium: 2, low: 3 }[mode];
    if (fixed !== undefined) this.set(fixed);
    else { this.ceiling = 0; this.stableFor = 0; }
  }

  set(t) {
    t = Math.max(0, Math.min(TIERS.length - 1, t));
    if (t === this.tier) return;
    this.tier = t;
    this.samples.length = 0;
    this.cooldown = 1;
    this.apply(TIERS[t]);
  }

  // Call once per frame with the real time since the previous frame (ms).
  frame(ms) {
    if (ms > 250) { this.samples.length = 0; return; } // tab switch, hitch
    this.samples.push(ms);
    if (this.samples.length < WINDOW) return;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const p80 = sorted[Math.floor(sorted.length * 0.8)];
    const seconds = avg * this.samples.length / 1000;
    this.fps = Math.round(1000 / avg);
    this.samples.length = 0;
    if (this.mode !== 'auto') return;
    if (this.cooldown > 0) { this.cooldown -= seconds; return; }

    if (avg > SLOW_MS || p80 > SLOW_MS + 2) {
      // Too slow: drop a tier. If we were probing upward, remember that the
      // probed tier is too expensive so we don't keep bouncing.
      if (this.probing === this.tier) this.ceiling = this.tier + 1;
      this.probing = -1;
      this.stableFor = 0;
      if (this.tier < TIERS.length - 1) this.set(this.tier + 1);
      return;
    }
    if (avg < STABLE_MS && p80 < STABLE_MS + 1.5) {
      this.stableFor += seconds;
      if (this.stableFor > UPGRADE_AFTER && this.tier > this.ceiling) {
        this.stableFor = 0;
        this.probing = this.tier - 1;
        this.set(this.tier - 1);
      }
    } else {
      this.stableFor = 0;
    }
  }
}
