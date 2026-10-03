// Watches the ragdoll and recognises cheer tumbling skills, combos and falls.
const TAU = Math.PI * 2;

const POINTS = {
  'Back Handspring': 100,
  'Back Walkover': 60,
  'Back Tuck': 150,
  'Back Pike': 175,
  'Back Layout': 200,
  'Front Handspring': 120,
  'Front Tuck': 150,
  'Front Layout': 200,
};

export class SkillTracker {
  constructor(emit) {
    this.emit = emit;
  }

  reset(r) {
    this.baseTurn = Math.round(r.torsoTurn / TAU);
    this.seg = this.newSeg();
    this.combo = [];
    this.comboPoints = 0;
    this.score = 0;
    this.skills = 0;
    this.fallen = false;
    this.lastLand = -10;
    this.stillT = 0;
    this.startX = r.com().x;
    this.distance = 0;
    this.leftGround = false;
  }

  newSeg() {
    return { hands: false, air: 0, maxHip: 0, minKnee: 0 };
  }

  update(r, keys) {
    const dt = 1 / 120;
    if (this.fallen) return;

    const crash = r.crashPart;
    if (crash) {
      this.fallen = true;
      // A fall right after landing a skill takes that skill back.
      const lostLast = r.time - this.lastLand < 0.45 && this.combo.length > 0;
      if (lostLast) {
        const last = this.combo.pop();
        this.comboPoints -= last.points * (this.combo.length + 1);
        this.skills--;
      }
      this.bank(false);
      this.emit('flop', { part: crash, score: this.score, skills: this.skills, distance: this.distance });
      return;
    }

    this.distance = Math.max(this.distance, this.startX - r.com().x);

    const ta = r.torsoTurn;
    const turnF = ta / TAU;
    const lean = ta - Math.round(turnF) * TAU;
    const seg = this.seg;

    if (r.handsDown) seg.hands = true;
    if (r.airborne) seg.air += dt;
    seg.maxHip = Math.max(seg.maxHip, r.angle('hip'));
    seg.minKnee = Math.min(seg.minKnee, r.angle('knee'));
    if (!r.feetDown) this.leftGround = true;

    const uprightFeet = r.feetDown && !r.handsDown && Math.abs(lean) < 0.9;
    if (uprightFeet) {
      const turns = Math.round(turnF) - this.baseTurn;
      if (turns !== 0) {
        // A real flip needs flight time or a hand plant; anything else was a
        // roll or a glitch, so don't score it.
        if (seg.hands || seg.air > 0.15) this.land(r, turns, seg);
        this.baseTurn += turns;
      }
      this.seg = this.newSeg();
    }

    // Standing still after a skill sticks the landing and banks the combo.
    const calm = uprightFeet && !keys.q && !keys.w && !keys.p &&
      Math.abs(r.bodies.torso.getAngularVelocity()) < 1.2 && Math.abs(r.comVel().x) < 0.6;
    this.stillT = calm ? this.stillT + dt : 0;
    if (this.combo.length && this.stillT > 0.8) this.bank(true);
  }

  land(r, turns, seg) {
    const dir = turns > 0 ? 'Back' : 'Front';
    const n = Math.abs(turns);
    let name;
    if (seg.hands) {
      name = seg.air > 0.12 ? `${dir} Handspring` : `${dir} Walkover`;
      if (dir === 'Front' && seg.air <= 0.12) name = 'Front Walkover';
    } else {
      const shape = seg.maxHip > 1.5 ? 'Tuck' : seg.maxHip > 0.9 ? 'Pike' : 'Layout';
      name = `${dir} ${shape}`;
    }
    let points = POINTS[name] ?? 80;
    if (n === 2) { name = `Double ${name}`; points *= 3; }
    if (n >= 3) { name = `Triple ${name}`; points *= 6; }

    const connected = r.time - this.lastLand < 1.2 && this.combo.length > 0;
    if (!connected && this.combo.length) this.bank(false);
    this.combo.push({ name, points });
    const mult = this.combo.length;
    this.comboPoints += points * mult;
    this.skills++;
    this.lastLand = r.time;
    this.stillT = 0;
    this.emit('skill', { name, points: points * mult, mult, combo: this.combo.map((c) => c.name) });
  }

  bank(stuck) {
    if (!this.combo.length) return;
    let total = this.comboPoints;
    if (stuck) total += 50;
    this.score += total;
    this.emit('bank', { stuck, total, combo: this.combo.map((c) => c.name), score: this.score });
    this.combo = [];
    this.comboPoints = 0;
  }
}
