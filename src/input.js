// Unified input: keyboard, multi-touch buttons (thumbs can slide between
// buttons) and gamepads. Produces { q, w, o, p } plus edge-triggered actions.

const KEYMAP = { KeyQ: 'q', KeyW: 'w', KeyO: 'o', KeyP: 'p' };

// Standard gamepad layout:
//   LB / X  -> Q (tuck)     LT / Y -> W (arch)
//   RB / A  -> O (bend)     RT / B -> P (jump)
//   Start -> go / restart after a fall, Back/Select -> help
const PAD = {
  q: [4, 2], // LB, X
  w: [6, 3], // LT, Y
  o: [5, 0], // RB, A
  p: [7, 1], // RT, B
};

export class Input {
  constructor() {
    this.keys = { q: false, w: false, o: false, p: false };
    this.kb = { q: false, w: false, o: false, p: false };
    this.touch = { q: false, w: false, o: false, p: false };
    this.pad = { q: false, w: false, o: false, p: false };
    this.actions = new Set();
    this.padConnected = false;
    this.padStartPrev = false;
    this.padBackPrev = false;
    this.listeners = [];

    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const k = KEYMAP[e.code];
      if (k) { this.kb[k] = true; e.preventDefault(); }
      if (e.code === 'Space' || e.code === 'Enter') { this.actions.add('go'); e.preventDefault(); }
      if (e.code === 'KeyR') this.actions.add('restart');
      if (e.code === 'KeyH' || e.code === 'Slash') this.actions.add('help');
      if (e.code === 'Escape') this.actions.add('close');
    });
    addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code];
      if (k) this.kb[k] = false;
    });
    addEventListener('blur', () => {
      for (const k in this.kb) this.kb[k] = false;
      for (const k in this.touch) this.touch[k] = false;
    });

    addEventListener('gamepadconnected', () => { this.padConnected = true; this.emit('pad', true); });
    addEventListener('gamepaddisconnected', () => {
      this.padConnected = [...(navigator.getGamepads?.() || [])].some(Boolean);
      this.emit('pad', this.padConnected);
    });
  }

  on(fn) { this.listeners.push(fn); }
  emit(type, v) { for (const fn of this.listeners) fn(type, v); }

  // Touch buttons: elements with data-key="q|w|o|p". We hit-test every
  // active touch so a thumb can roll from one button to the next.
  bindTouch(container) {
    const buttons = [...container.querySelectorAll('[data-key]')];
    const active = new Map(); // pointerId -> {x, y}
    const recompute = () => {
      for (const k in this.touch) this.touch[k] = false;
      for (const { x, y } of active.values()) {
        for (const b of buttons) {
          const r = b.getBoundingClientRect();
          const pad = 10;
          if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) this.touch[b.dataset.key] = true;
        }
      }
    };
    const down = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      active.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { container.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      recompute();
    };
    const move = (e) => {
      if (!active.has(e.pointerId)) return;
      e.preventDefault();
      active.set(e.pointerId, { x: e.clientX, y: e.clientY });
      recompute();
    };
    const up = (e) => {
      active.delete(e.pointerId);
      recompute();
    };
    container.addEventListener('pointerdown', down);
    container.addEventListener('pointermove', move);
    container.addEventListener('pointerup', up);
    container.addEventListener('pointercancel', up);
    container.addEventListener('lostpointercapture', up);
    container.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const k in this.pad) this.pad[k] = false;
    let start = false, back = false, any = false;
    for (const gp of pads) {
      if (!gp) continue;
      any = true;
      const pressed = (i) => {
        const b = gp.buttons[i];
        return !!b && (b.pressed || b.value > 0.35);
      };
      for (const [k, idx] of Object.entries(PAD)) if (idx.some(pressed)) this.pad[k] = true;
      // Sticks as an alternative: left stick up/down = W/Q, right stick up/down = P/O
      const [lx, ly, rx, ry] = gp.axes;
      if (ly < -0.55) this.pad.w = true;
      if (ly > 0.55) this.pad.q = true;
      if (ry < -0.55) this.pad.p = true;
      if (ry > 0.55) this.pad.o = true;
      void lx; void rx;
      if (pressed(9)) start = true;
      if (pressed(8)) back = true;
    }
    if (any !== this.padConnected) { this.padConnected = any; this.emit('pad', any); }
    if (start && !this.padStartPrev) this.actions.add('go');
    if (back && !this.padBackPrev) this.actions.add('help');
    this.padStartPrev = start;
    this.padBackPrev = back;
  }

  rumble(strength = 0.6, ms = 180) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 })?.catch?.(() => {});
    }
    if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) {
      try { navigator.vibrate(Math.min(ms, 120)); } catch { /* ignore */ }
    }
  }

  update() {
    this.pollPad();
    for (const k of ['q', 'w', 'o', 'p']) this.keys[k] = this.kb[k] || this.touch[k] || this.pad[k];
    return this.keys;
  }

  takeActions() {
    const a = this.actions;
    this.actions = new Set();
    return a;
  }
}
