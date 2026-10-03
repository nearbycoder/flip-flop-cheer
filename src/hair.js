// Long box braids with honey-blonde ends, simulated as verlet chains so they
// whip around during flips.
import * as THREE from 'three';
import { HEAD_R as SKULL_R, HEAD_Y, FACE_AZ } from './face.js';

const NODES = 12;
const SEG = 0.04;
const HEAD_R = SKULL_R * 1.17; // collision radius incl. hair
const DEG = Math.PI / 180;

function anchorsList() {
  const out = [];
  const add = (lat, az) => out.push([lat * DEG, az * DEG]);
  // angles are relative to the direction the face points
  for (let a = 60; a <= 300; a += 13) add(12, a);
  for (let a = 85; a <= 275; a += 19) add(-12, a);
  for (let a = 70; a <= 290; a += 22) add(34, a);
  for (let a = 120; a <= 240; a += 30) add(58, a);
  add(22, -52); // face-framing braids by the temples
  add(22, 52);
  return out.map(([lat, az]) => [lat, az + FACE_AZ * DEG]);
}

function braidTexture() {
  // A three-strand weave: offset chevrons, tinted per braid by instance colour.
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(0,0,0,0.38)';
  g.lineWidth = 4;
  for (let y = -16; y < 80; y += 21) {
    for (let x = 0; x < 64; x += 21) {
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 10, y + 14, x + 21, y + 10);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function rand(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class Braids {
  constructor(scene, look) {
    this.scene = scene;
    this.anchors = anchorsList().map(([lat, az]) => {
      const d = new THREE.Vector3(Math.cos(lat) * Math.cos(az), Math.sin(lat), Math.cos(lat) * Math.sin(az));
      // roots lie along the scalp, heading back and down
      const back = new THREE.Vector3(-Math.cos(FACE_AZ * DEG), 0, -Math.sin(FACE_AZ * DEG));
      const tan = back.clone().addScaledVector(new THREE.Vector3(0, -1, 0), 0.6);
      tan.addScaledVector(d, -tan.dot(d)).normalize().addScaledVector(d, 0.25).normalize();
      return { local: d.clone().multiplyScalar(SKULL_R * 1.06).add(new THREE.Vector3(0, HEAD_Y, 0)), out: tan };
    });
    const n = this.anchors.length;
    this.pos = new Float32Array(n * NODES * 3);
    this.prev = new Float32Array(n * NODES * 3);
    this.ready = false;

    // Segments are textured cylinders (the braid weave); spheres round
    // off the joints and make fluffy, curly tips.
    const segs = NODES - 1;
    const weave = braidTexture();
    this.segMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1, 1, 1, 8, 1, true),
      new THREE.MeshStandardMaterial({ map: weave, roughness: 0.7 }),
      n * segs,
    );
    this.knotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.75 }), n * NODES);
    for (const m of [this.segMesh, this.knotMesh]) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }

    const dark = new THREE.Color(look.hair), light = new THREE.Color(look.highlight);
    const c = new THREE.Color();
    const colorAt = (b, t) => {
      // dark roots fading to honey-blonde lengths; some braids stay darker
      const mixAmt = 0.15 + 0.85 * rand(b);
      return c.copy(dark).lerp(light, Math.min(1, Math.pow(t, 0.55) * mixAmt + 0.05));
    };
    for (let b = 0; b < n; b++) {
      for (let k = 0; k < segs; k++) this.segMesh.setColorAt(b * segs + k, colorAt(b, (k + 0.5) / segs));
      for (let k = 0; k < NODES; k++) {
        colorAt(b, k / (NODES - 1));
        if (k === NODES - 1) c.lerp(light, 0.4);
        this.knotMesh.setColorAt(b * NODES + k, c);
      }
    }
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.v = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.sc = new THREE.Vector3();
    this.at = new THREE.Vector3();
  }

  dispose() {
    for (const m of [this.segMesh, this.knotMesh]) {
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.map?.dispose();
      m.material.dispose();
    }
  }

  anchorWorld(i, h, out) {
    const a = this.anchors[i].local;
    const c = Math.cos(h.a), s = Math.sin(h.a);
    out[0] = h.x + a.x * c - a.y * s;
    out[1] = h.y + a.x * s + a.y * c;
    out[2] = a.z;
    return out;
  }

  update(dt, head, torso) {
    dt = Math.min(dt, 1 / 30);
    const n = this.anchors.length;
    const P = this.pos, Q = this.prev;
    const A = [0, 0, 0];
    const hc = Math.cos(head.a), hs = Math.sin(head.a);
    const hx = head.x - HEAD_Y * hs, hy = head.y + HEAD_Y * hc;

    if (!this.ready) {
      for (let b = 0; b < n; b++) {
        this.anchorWorld(b, head, A);
        const o = this.anchors[b].out;
        for (let k = 0; k < NODES; k++) {
          const i = (b * NODES + k) * 3;
          P[i] = A[0] + o.x * 0.02 * k; P[i + 1] = A[1] - SEG * k; P[i + 2] = A[2] + o.z * 0.02 * k;
          Q[i] = P[i]; Q[i + 1] = P[i + 1]; Q[i + 2] = P[i + 2];
        }
      }
      this.ready = true;
    }

    const steps = 2;
    const h = dt / steps;
    const g = -9.8 * h * h;
    // Torso capsule (approximate), from waist up to the shoulders.
    const tc = Math.cos(torso.a), ts = Math.sin(torso.a);
    const ax = torso.x - 0.06 * ts, ay = torso.y + 0.06 * tc;
    const bx = torso.x - 0.27 * ts, by = torso.y + 0.27 * tc;

    for (let step = 0; step < steps; step++) {
      for (let b = 0; b < n; b++) {
        this.anchorWorld(b, head, A);
        const o = this.anchors[b].out;
        // world-space outward direction of the root
        const ox = o.x * hc - o.y * hs, oy = o.x * hs + o.y * hc, oz = o.z;
        for (let k = 0; k < NODES; k++) {
          const i = (b * NODES + k) * 3;
          if (k === 0) { P[i] = A[0]; P[i + 1] = A[1]; P[i + 2] = A[2]; Q[i] = A[0]; Q[i + 1] = A[1]; Q[i + 2] = A[2]; continue; }
          const vx = (P[i] - Q[i]) * 0.985, vy = (P[i + 1] - Q[i + 1]) * 0.985, vz = (P[i + 2] - Q[i + 2]) * 0.985;
          Q[i] = P[i]; Q[i + 1] = P[i + 1]; Q[i + 2] = P[i + 2];
          P[i] += vx; P[i + 1] += vy + g; P[i + 2] += vz;
        }
        for (let iter = 0; iter < 3; iter++) {
          for (let k = 1; k < NODES; k++) {
            const i = (b * NODES + k) * 3, j = i - 3;
            let dx = P[i] - P[j], dy = P[i + 1] - P[j + 1], dz = P[i + 2] - P[j + 2];
            const d = Math.hypot(dx, dy, dz) || 1e-6;
            const diff = (d - SEG) / d;
            if (k === 1) { P[i] -= dx * diff; P[i + 1] -= dy * diff; P[i + 2] -= dz * diff; }
            else {
              P[i] -= dx * diff * 0.5; P[i + 1] -= dy * diff * 0.5; P[i + 2] -= dz * diff * 0.5;
              P[j] += dx * diff * 0.5; P[j + 1] += dy * diff * 0.5; P[j + 2] += dz * diff * 0.5;
            }
            // root stiffness: first segments point away from the scalp
            if (k <= 2) {
              const tx = P[j] + ox * SEG, ty = P[j + 1] + oy * SEG, tz = P[j + 2] + oz * SEG;
              const f = k === 1 ? 0.12 : 0;
              P[i] += (tx - P[i]) * f; P[i + 1] += (ty - P[i + 1]) * f; P[i + 2] += (tz - P[i + 2]) * f;
            }
            // collide with head
            dx = P[i] - hx; dy = P[i + 1] - hy; dz = P[i + 2];
            let dd = Math.hypot(dx, dy, dz);
            if (dd < HEAD_R) { const s = HEAD_R / (dd || 1e-6); P[i] = hx + dx * s; P[i + 1] = hy + dy * s; P[i + 2] = dz * s; }
            // collide with torso capsule
            const ex = bx - ax, ey = by - ay;
            let t = ((P[i] - ax) * ex + (P[i + 1] - ay) * ey) / (ex * ex + ey * ey);
            t = Math.max(0, Math.min(1, t));
            const cx = ax + ex * t, cy = ay + ey * t;
            dx = P[i] - cx; dy = P[i + 1] - cy; dz = P[i + 2];
            dd = Math.hypot(dx, dy, dz);
            const R = 0.135;
            if (dd < R) { const s = R / (dd || 1e-6); P[i] = cx + dx * s; P[i + 1] = cy + dy * s; P[i + 2] = dz * s; }
            if (P[i + 1] < 0.015) P[i + 1] = 0.015;
          }
        }
      }
    }

    // Draw
    const segs = NODES - 1;
    for (let b = 0; b < n; b++) {
      for (let k = 0; k < NODES; k++) {
        const i = (b * NODES + k) * 3;
        const t = k / (NODES - 1);
        const r = k === NODES - 1 ? 0.0145 : 0.0112 - 0.002 * t;
        this.m4.makeScale(r, r, r).setPosition(P[i], P[i + 1], P[i + 2]);
        this.knotMesh.setMatrixAt(b * NODES + k, this.m4);
        if (k === NODES - 1) continue;
        const ax = P[i], ay = P[i + 1], az = P[i + 2];
        this.v.set(P[i + 3] - ax, P[i + 4] - ay, P[i + 5] - az);
        const len = this.v.length() || 1e-4;
        this.q.setFromUnitVectors(this.up, this.v.multiplyScalar(1 / len));
        this.at.set(ax + this.v.x * len / 2, ay + this.v.y * len / 2, az + this.v.z * len / 2);
        const rr = 0.0105 - 0.002 * t;
        this.m4.compose(this.at, this.q, this.sc.set(rr, len, rr));
        this.segMesh.setMatrixAt(b * segs + k, this.m4);
      }
    }
    this.segMesh.instanceMatrix.needsUpdate = true;
    this.knotMesh.instanceMatrix.needsUpdate = true;
  }

  reset() { this.ready = false; }
}
