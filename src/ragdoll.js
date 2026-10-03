// Physics-only ragdoll (no rendering). Runs in the browser and in Node for tuning.
// The gymnast is simulated in 2D (x/y plane), facing +x. Tumbling backwards
// means rotating counter-clockwise (positive angles).
//
// Legs and arms are simulated as a single chain each (tumblers keep their legs
// together); the renderer draws a left and right copy of each.
import { World, Vec2, Box, Circle, RevoluteJoint } from 'planck';

export const STEP = 1 / 120;

// Body layout in the standing pose (metres). Each body's origin is its
// proximal joint, so limbs hang down along -y.
const LAYOUT = {
  foot:     { origin: [0, 0.085], mass: 1.2,  shapes: [{ box: [0.115, 0.042, 0.035, -0.043] }], friction: 1.2 },
  shin:     { origin: [0, 0.465], mass: 4.0,  shapes: [{ box: [0.05, 0.19, 0, -0.19] }] },
  thigh:    { origin: [0, 0.85],  mass: 8.0,  shapes: [{ box: [0.065, 0.1925, 0, -0.1925] }] },
  pelvis:   { origin: [0, 0.85],  mass: 6.0,  shapes: [{ box: [0.095, 0.08, 0, 0.05] }] },
  torso:    { origin: [0, 0.98],  mass: 12.0, shapes: [{ box: [0.095, 0.165, 0, 0.165] }] },
  head:     { origin: [0, 1.31],  mass: 3.5,  shapes: [{ circle: [0, 0.115, 0.105] }] },
  upperArm: { origin: [0, 1.26],  mass: 2.2,  shapes: [{ box: [0.035, 0.125, 0, -0.125] }] },
  forearm:  { origin: [0, 1.01],  mass: 1.6,  shapes: [{ box: [0.03, 0.11, 0, -0.11] }, { circle: [0, -0.27, 0.042], tag: 'hand' }], friction: 1.1 },
};

// joint name: [bodyA, bodyB, anchor body (whose origin is the pivot), lower, upper]
const JOINTS = {
  ankle:    ['shin', 'foot', 'foot', -0.7, 0.55],
  knee:     ['thigh', 'shin', 'shin', -2.5, 0.02],
  hip:      ['pelvis', 'thigh', 'thigh', -0.65, 2.55],
  waist:    ['pelvis', 'torso', 'torso', -0.6, 0.75],
  neck:     ['torso', 'head', 'head', -0.5, 0.55],
  shoulder: ['torso', 'upperArm', 'upperArm', -0.9, 3.7],
  elbow:    ['upperArm', 'forearm', 'forearm', 0, 2.4],
};

// Parts that are allowed to touch the floor. Anything else touching = a fall.
const SAFE = new Set(['foot', 'hand', 'forearm']);

export const DEFAULT_TUNING = {
  springFloor: true, // assisted "spring floor" mode
  rotKick: 3.5,
  blockUp: 1.8,
  landHold: 1.0,
  landK: 900,
  coreK: 320,
  blockSpin: 8.5,
};

function area(s) {
  if (s.box) return 4 * s.box[0] * s.box[1];
  return Math.PI * s.circle[2] * s.circle[2];
}

export class Ragdoll {
  constructor(opts = {}) {
    this.opts = { ...DEFAULT_TUNING, ...opts };
    this.reset(opts.x ?? 0);
  }

  reset(x = 0) {
    this.world = new World({ gravity: new Vec2(0, -10) });
    this.bodies = {};
    this.joints = {};
    this.contacts = {}; // tag -> number of active ground contacts
    this.time = 0;
    this.kneeMin = 0;
    this.lastPop = -1;
    this.lastBlock = -1;
    this.lastFeet = 0;
    this.torsoTurn = 0;
    this.prevTorsoAngle = 0;
    this.spinDir = 0;
    this.airT = 0;
    this.landT = -1;
    this.handT = 0;
    this.blocked = false;
    this.prevP = false;
    this.pLean = 0;

    const ground = this.world.createBody({ type: 'static' });
    ground.createFixture({ shape: new Box(1000, 1, new Vec2(0, -1)), friction: 1.0 });
    ground.setUserData('ground');
    this.ground = ground;

    for (const [name, def] of Object.entries(LAYOUT)) {
      const body = this.world.createBody({
        type: 'dynamic',
        position: new Vec2(x + def.origin[0], def.origin[1]),
        angularDamping: 0.05,
      });
      const totalArea = def.shapes.reduce((a, s) => a + area(s), 0);
      const density = def.mass / totalArea;
      for (const s of def.shapes) {
        const shape = s.box
          ? new Box(s.box[0], s.box[1], new Vec2(s.box[2], s.box[3]))
          : new Circle(new Vec2(s.circle[0], s.circle[1]), s.circle[2]);
        const fx = body.createFixture({
          shape,
          density,
          friction: def.friction ?? 0.7,
          restitution: 0,
          filterGroupIndex: -1, // never self-collide
        });
        fx.setUserData(s.tag || name);
      }
      this.bodies[name] = body;
    }

    for (const [name, [a, b, at, lo, hi]] of Object.entries(JOINTS)) {
      const o = LAYOUT[at].origin;
      this.joints[name] = this.world.createJoint(new RevoluteJoint({
        enableLimit: true, lowerAngle: lo, upperAngle: hi,
        enableMotor: true, maxMotorTorque: 0, motorSpeed: 0,
      }, this.bodies[a], this.bodies[b], new Vec2(x + o[0], o[1])));
    }

    const touch = (contact, d) => {
      const fa = contact.getFixtureA(), fb = contact.getFixtureB();
      let other = null;
      if (fa.getBody() === ground) other = fb;
      else if (fb.getBody() === ground) other = fa;
      if (!other) return;
      const tag = other.getUserData();
      this.contacts[tag] = Math.max(0, (this.contacts[tag] || 0) + d);
    };
    this.world.on('begin-contact', (c) => touch(c, 1));
    this.world.on('end-contact', (c) => touch(c, -1));
  }

  touching(tag) { return (this.contacts[tag] || 0) > 0; }

  get feetDown() { return this.touching('foot'); }
  get handsDown() { return this.touching('hand') || this.touching('forearm'); }
  get airborne() { return !Object.values(this.contacts).some((n) => n > 0); }

  // Which non-safe part (if any) is touching the floor.
  get crashPart() {
    for (const [tag, n] of Object.entries(this.contacts)) if (n > 0 && !SAFE.has(tag)) return tag;
    return null;
  }

  angle(name) { return this.joints[name].getJointAngle(); }

  drive(name, target, torque, speed = 14, gain = 18) {
    const j = this.joints[name];
    const err = target - j.getJointAngle();
    j.setMaxMotorTorque(torque);
    j.setMotorSpeed(Math.max(-speed, Math.min(speed, gain * err)));
  }

  // keys: { q, w, o, p }
  //   Q  tuck  — hips to chest, chin in, arms to shins
  //   W  arch  — hips open, back arched, arms thrown overhead
  //   O  bend knees / dip
  //   P  snap knees straight, point toes (jump / block)
  control(keys) {
    const { q, w, o, p } = keys;

    if (this.feetDown) this.lastFeet = this.time;
    const grounded = this.time - this.lastFeet < 0.15;
    const knee = this.angle('knee');
    const ta = this.torsoTurn;
    const lean = ta - Math.round(ta / (2 * Math.PI)) * 2 * Math.PI; // + = leaning back
    const upright = grounded && !this.handsDown && Math.abs(lean) < 0.9;
    const assist = this.opts.springFloor ? 1 : 0.6;
    // How far back the gymnast was leaning when the jump (P) started.
    if (p && !this.prevP) this.pLean = lean;
    this.prevP = p;

    // Knees + ankles (O/P)
    if (o && !p) {
      if (grounded && !q) this.drive('knee', -1.5, 140, 3);
      else this.drive('knee', -2.3, 420, 10);
      this.drive('ankle', 0.4, 180, 8);
    } else if (p && !o) {
      this.drive('knee', 0, 280, 14, 30);
      this.drive('ankle', -0.55, 150, 14);
    } else if (o && p) {
      this.drive('knee', -1.0, 500, 12);
      this.drive('ankle', 0, 200, 8);
    } else {
      this.drive('knee', 0, 260, 3.5, 10);
      this.drive('ankle', 0, 180, 6, 10);
    }

    // Hips + spine + arms + head (Q/W)
    if (q && !w) {
      this.drive('hip', 2.35, 520, 13);
      this.drive('waist', -0.45, 420, 10);
      this.drive('shoulder', 1.25, 200, 14);
      this.drive('neck', -0.35, 40, 8);
      this.drive('elbow', 0.6, 40, 10);
    } else if (w && !q && grounded && !p) {
      // On the floor W is a controlled lean-back: stay seated, arms up,
      // let the body tip back over the heels.
      this.drive('hip', Math.max(0, -knee * 0.7) - 0.1, 220, 3);
      this.drive('waist', 0.35, 220, 3);
      this.drive('shoulder', 3.3, 110, 10);
      this.drive('neck', 0.3, 40, 6);
      this.drive('elbow', 0.02, 60, 10);
    } else if (w && !q) {
      this.drive('hip', -0.55, 300, 9);
      this.drive('waist', 0.7, 300, 8);
      this.drive('shoulder', 3.45, 110, 12);
      this.drive('neck', 0.5, 40, 8);
      this.drive('elbow', 0.02, 60, 10);
    } else if (w && q) {
      // Pike: hips folded, arms reaching overhead.
      this.drive('hip', 1.6, 480, 12);
      this.drive('waist', 0, 380, 10);
      this.drive('shoulder', 3.0, 200, 14);
      this.drive('neck', 0, 40, 8);
      this.drive('elbow', 0.02, 60, 10);
    } else {
      // Relaxed. On the floor the hips follow the knees so a dip stays a
      // squat, and lean back/forward is corrected at the hip.
      let hip = 0, hipTq = 230;
      if (upright) {
        hip = Math.max(0, -knee * 0.7) + Math.max(-0.4, Math.min(0.6, lean * 1.2));
        hipTq = 200 + 100 * assist;
      }
      this.drive('hip', hip, hipTq, 8, 14);
      this.drive('waist', 0, 300, 6, 10);
      this.drive('shoulder', o && grounded ? 0.9 : 0.12, 45, 6, 8);
      this.drive('neck', 0, 25, 5);
      this.drive('elbow', 0.25, 15, 5);
    }

    // Balance: with feet planted and body roughly upright, the ankles keep the
    // centre of mass over the feet (except while jumping).
    this.balancing = upright && !p && !w;
    if (this.balancing) {
      const fc = this.bodies.foot.getWorldPoint(new Vec2(0.035, 0));
      const c = this.com();
      const v = this.comVel();
      const err = (c.x - fc.x) + 0.25 * v.x;
      const dip = Math.max(0, -knee) * 0.4;
      this.drive('ankle', Math.max(-0.6, Math.min(0.75, dip - 6 * err)), 110 * assist, 6, 10);
    }

    // Spring floor assist: snapping the knees straight from a dip while the
    // feet are planted gives an extra pop, like a real spring floor.
    {
      // Everything below is scaled down on the expert "gym floor".
      if (grounded) {
        this.kneeMin = Math.min(this.kneeMin, knee);
        if (p && this.kneeMin < -0.7 && knee > -0.35) {
          const depth = Math.min(1, (-this.kneeMin - 0.7) / 1.0);
          // Leaning back (with arms up) before the jump turns it into a
          // long, low dive backwards onto the hands — a back handspring.
          const back = w ? Math.max(0, Math.min(1, (this.pLean - 0.08) * 3.5)) : 0;
          const vy = (0.55 + 0.6 * depth) * (1 - back) * assist;
          const vx = (-1.3 * back - (w ? 0.3 * (1 - back) : 0)) * assist;
          for (const b of [this.bodies.torso, this.bodies.pelvis]) {
            const m = b.getMass();
            b.applyLinearImpulse(new Vec2(vx * m, vy * m), b.getWorldCenter(), true);
          }
          // Throwing the arms back (W) during the jump starts the flip rotating.
          if (w) this.bodies.torso.applyAngularImpulse((this.opts.rotKick * (1 - back) + 4 * back) * assist, true);
          this.popBack = back;
          this.kneeMin = 0;
          this.lastPop = this.time;
        }
      } else {
        this.kneeMin = 0;
      }

      // Sticking the landing: right after touching down from a flip, the
      // floor helps pull the gymnast upright if they are close enough.
      if (this.airborne) this.airT += STEP;
      else if (this.feetDown) {
        if (this.airT > 0.25) this.landT = this.time;
        this.airT = 0;
      }
      if (this.feetDown && !this.handsDown && Math.abs(lean) < 1.25) {
        // Strong right after a landing, gentle "core strength" otherwise.
        const fresh = this.time - this.landT < this.opts.landHold;
        const k = fresh ? this.opts.landK : (w || p ? 0 : this.opts.coreK);
        const d = fresh ? 90 : 45;
        if (k) {
          for (const b of [this.bodies.torso, this.bodies.pelvis]) {
            b.applyTorque((-lean * k - b.getAngularVelocity() * d) * assist, true);
          }
        }
      }

      // Back handspring block: after the hands plant with the body
      // upside-down, snapping the hips down (Q) pops the legs over the top.
      const inverted = Math.abs(lean) > 1.0;
      if (this.handsDown && inverted && !this.feetDown && !this.handT) this.handT = this.time;
      if (this.handT && q && !this.blocked && this.time - this.handT < 0.4) {
        this.blocked = true;
        const dir = this.spinDir || 1;
        const v = this.comVel();
        this.addVelocity(-0.5 * dir, Math.max(0, this.opts.blockUp * assist - v.y));
        const w0 = this.angularMomentum() / this.inertiaAboutCom();
        this.addSpin(dir * Math.max(0, Math.min(9, this.opts.blockSpin * assist - w0 * dir)));
        this.lastBlock = this.time;
      }
      if (this.feetDown) { this.handT = 0; this.blocked = false; }

      // In the air, tucking (Q) helps the gymnast keep turning in whichever
      // direction they took off in.
      if (grounded) this.spinDir = 0;
      else if (!this.spinDir) {
        const L = this.angularMomentum();
        if (Math.abs(L) > 4) this.spinDir = Math.sign(L);
      }
      if (this.airborne && q && this.spinDir && !this.blocked) {
        const t = this.bodies.torso;
        const av = t.getAngularVelocity() * this.spinDir;
        if (av < 11) t.applyTorque(this.spinDir * 140 * assist, true);
      }
    }
  }

  step(keys) {
    this.control(keys);
    this.world.step(STEP, 10, 8);
    this.time += STEP;
    // Box2D may re-normalise body angles by multiples of 2π, so keep our own
    // continuous torso rotation for counting flips.
    const a = this.bodies.torso.getAngle();
    let d = a - this.prevTorsoAngle;
    d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
    this.torsoTurn += d;
    this.prevTorsoAngle = a;
  }

  // Centre of mass of the whole gymnast.
  com() {
    let m = 0, x = 0, y = 0;
    for (const b of Object.values(this.bodies)) {
      const bm = b.getMass(), c = b.getWorldCenter();
      m += bm; x += c.x * bm; y += c.y * bm;
    }
    return { x: x / m, y: y / m };
  }

  inertiaAboutCom() {
    const c = this.com();
    let I = 0;
    for (const b of Object.values(this.bodies)) {
      const m = b.getMass(), lc = b.getLocalCenter(), p = b.getWorldCenter();
      I += b.getInertia() - m * (lc.x * lc.x + lc.y * lc.y) + m * ((p.x - c.x) ** 2 + (p.y - c.y) ** 2);
    }
    return I;
  }

  // Rigidly add velocity / spin (about the centre of mass) to the whole body.
  addVelocity(vx, vy) {
    for (const b of Object.values(this.bodies)) {
      const v = b.getLinearVelocity();
      b.setLinearVelocity(new Vec2(v.x + vx, v.y + vy));
    }
  }

  addSpin(dw) {
    const c = this.com();
    for (const b of Object.values(this.bodies)) {
      const p = b.getWorldCenter(), v = b.getLinearVelocity();
      b.setLinearVelocity(new Vec2(v.x - dw * (p.y - c.y), v.y + dw * (p.x - c.x)));
      b.setAngularVelocity(b.getAngularVelocity() + dw);
    }
  }

  // Whole-body angular momentum about the centre of mass (+ = backwards).
  angularMomentum() {
    const c = this.com(), v = this.comVel();
    let L = 0;
    for (const b of Object.values(this.bodies)) {
      const p = b.getWorldCenter(), bv = b.getLinearVelocity(), m = b.getMass();
      const lc = b.getLocalCenter();
      L += (b.getInertia() - m * (lc.x * lc.x + lc.y * lc.y)) * b.getAngularVelocity();
      L += m * ((p.x - c.x) * (bv.y - v.y) - (p.y - c.y) * (bv.x - v.x));
    }
    return L;
  }

  comVel() {
    let m = 0, x = 0, y = 0;
    for (const b of Object.values(this.bodies)) {
      const bm = b.getMass(), v = b.getLinearVelocity();
      m += bm; x += v.x * bm; y += v.y * bm;
    }
    return { x: x / m, y: y / m };
  }

  pose() {
    const out = {};
    for (const [name, b] of Object.entries(this.bodies)) {
      const p = b.getPosition();
      out[name] = { x: p.x, y: p.y, a: b.getAngle() };
    }
    return out;
  }
}
