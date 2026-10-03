// Hair simulated as verlet chains so it whips around during flips:
// long box braids with honey-blonde ends, or long loose curls.
import * as THREE from 'three';
import { HEAD_R as SKULL_R, HEAD_Y, FACE_AZ } from './face.js';

const NODES = 12;
const SEG = 0.04;
const HEAD_R = SKULL_R * 1.17; // collision radius incl. hair
const DEG = Math.PI / 180;

function anchorsList(style) {
  const out = [];
  const add = (lat, az) => out.push([lat * DEG, az * DEG]);
  // angles are relative to the direction the face points
  if (style === 'curls') {
    // half-up: the loose curls start low around the back and sides
    for (let a = 66; a <= 294; a += 11) add(6, a);
    for (let a = 90; a <= 270; a += 15) add(-14, a);
    for (let a = 100; a <= 260; a += 20) add(24, a);
    add(10, -54); // curls framing the face
    add(10, 54);
    add(0, -60);
    add(0, 60);
    return out.map(([lat, az]) => [lat, az + FACE_AZ * DEG]);
  }
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

// Loose wavy hair: strands painted onto a ribbon with transparent edges.
function strandTexture(look) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  const dark = new THREE.Color(look.hair), light = new THREE.Color(look.highlight);
  const col = new THREE.Color();
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x0 = 10 + Math.random() * 108;
    const t = Math.random();
    col.copy(dark).lerp(light, t * t * 0.9).multiplyScalar(0.85 + Math.random() * 0.3);
    g.strokeStyle = `#${col.getHexString()}`;
    g.lineWidth = 3 + Math.random() * 5;
    g.globalAlpha = 0.9;
    const ph = Math.random() * Math.PI * 2, amp = 8 + Math.random() * 10;
    const end = 430 + Math.random() * 80;
    g.beginPath();
    for (let y = 0; y <= end; y += 8) {
      const x = x0 + Math.sin(y / 46 + ph) * amp * (0.4 + y / 512);
      if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    // a little ringlet at the end
    g.beginPath();
    g.arc(x0 + Math.sin(end / 46 + ph) * amp, end, 5 + Math.random() * 5, 0, Math.PI * 1.6);
    g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Braids {
  // size: head-relative scale (body scale × head scale)
  constructor(scene, look, size = 1) {
    this.scene = scene;
    this.size = size;
    this.seg = SEG * size;
    this.headR = HEAD_R * size;
    this.curls = look.hairStyle === 'curls';
    this.anchors = anchorsList(look.hairStyle).map(([lat, az]) => {
      const d = new THREE.Vector3(Math.cos(lat) * Math.cos(az), Math.sin(lat), Math.cos(lat) * Math.sin(az));
      // roots lie along the scalp, heading back and down
      const back = new THREE.Vector3(-Math.cos(FACE_AZ * DEG), 0, -Math.sin(FACE_AZ * DEG));
      const tan = back.clone().addScaledVector(new THREE.Vector3(0, -1, 0), 0.6);
      tan.addScaledVector(d, -tan.dot(d)).normalize().addScaledVector(d, 0.25).normalize();
      const side = new THREE.Vector3(0, 1, 0).cross(d).normalize();
      return {
        local: d.clone().multiplyScalar(SKULL_R * 1.06).add(new THREE.Vector3(0, HEAD_Y, 0)).multiplyScalar(size),
        out: tan,
        side,
      };
    });
    const n = this.anchors.length;
    this.pos = new Float32Array(n * NODES * 3);
    this.prev = new Float32Array(n * NODES * 3);
    this.ready = false;
    this.meshes = [];
    if (this.curls) this.buildRibbons(look, n);
    else this.buildBraids(look, n);
  }

  buildRibbons(look, n) {
    // One mesh: a ribbon of hair per lock, rebuilt from the sim each frame.
    const verts = n * NODES * 2;
    const pos = new Float32Array(verts * 3), uv = new Float32Array(verts * 2);
    const idx = [];
    for (let b = 0; b < n; b++) {
      const u0 = (b % 3) / 3; // vary which part of the strand texture each lock uses
      for (let k = 0; k < NODES; k++) {
        const v = (b * NODES + k) * 2;
        uv.set([u0, 1 - k / (NODES - 1), u0 + 0.34, 1 - k / (NODES - 1)], v * 2);
        if (k < NODES - 1) idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const map = strandTexture(look);
    map.wrapS = THREE.RepeatWrapping;
    this.ribbon = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.65,
    }));
    this.ribbon.frustumCulled = false;
    this.scene.add(this.ribbon);
    this.meshes.push(this.ribbon);
  }

  buildBraids(look, n) {
    // Segments are textured cylinders (the braid weave); spheres round
    // off the joints and make fluffy tips.
    const segs = NODES - 1;
    this.segMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1, 1, 1, 8, 1, true),
      new THREE.MeshStandardMaterial({ map: braidTexture(), roughness: 0.7 }),
      n * segs,
    );
    this.knotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.75 }), n * NODES);
    for (const m of [this.segMesh, this.knotMesh]) { m.castShadow = true; m.frustumCulled = false; this.scene.add(m); this.meshes.push(m); }

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
    for (const m of this.meshes) {
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

  update(dt, head, torso, bodyScale = 1) {
    dt = Math.min(dt, 1 / 30);
    const n = this.anchors.length;
    const P = this.pos, Q = this.prev;
    const A = [0, 0, 0];
    const SEGL = this.seg, HR = this.headR, sz = this.size;
    const hc = Math.cos(head.a), hs = Math.sin(head.a);
    const hy0 = HEAD_Y * sz;
    const hx = head.x - hy0 * hs, hy = head.y + hy0 * hc;

    if (!this.ready) {
      for (let b = 0; b < n; b++) {
        this.anchorWorld(b, head, A);
        const o = this.anchors[b].out;
        for (let k = 0; k < NODES; k++) {
          const i = (b * NODES + k) * 3;
          P[i] = A[0] + o.x * 0.02 * sz * k; P[i + 1] = A[1] - SEGL * k; P[i + 2] = A[2] + o.z * 0.02 * sz * k;
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
    const ax = torso.x - 0.06 * bodyScale * ts, ay = torso.y + 0.06 * bodyScale * tc;
    const bx = torso.x - 0.27 * bodyScale * ts, by = torso.y + 0.27 * bodyScale * tc;
    const R = 0.135 * bodyScale;

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
            const diff = (d - SEGL) / d;
            if (k === 1) { P[i] -= dx * diff; P[i + 1] -= dy * diff; P[i + 2] -= dz * diff; }
            else {
              P[i] -= dx * diff * 0.5; P[i + 1] -= dy * diff * 0.5; P[i + 2] -= dz * diff * 0.5;
              P[j] += dx * diff * 0.5; P[j + 1] += dy * diff * 0.5; P[j + 2] += dz * diff * 0.5;
            }
            // root stiffness: first segment follows the scalp
            if (k === 1) {
              const tx = P[j] + ox * SEGL, ty = P[j + 1] + oy * SEGL, tz = P[j + 2] + oz * SEGL;
              P[i] += (tx - P[i]) * 0.12; P[i + 1] += (ty - P[i + 1]) * 0.12; P[i + 2] += (tz - P[i + 2]) * 0.12;
            }
            // collide with head
            dx = P[i] - hx; dy = P[i + 1] - hy; dz = P[i + 2];
            let dd = Math.hypot(dx, dy, dz);
            if (dd < HR) { const s = HR / (dd || 1e-6); P[i] = hx + dx * s; P[i + 1] = hy + dy * s; P[i + 2] = dz * s; }
            // collide with torso capsule
            const ex = bx - ax, ey = by - ay;
            let t = ((P[i] - ax) * ex + (P[i + 1] - ay) * ey) / (ex * ex + ey * ey);
            t = Math.max(0, Math.min(1, t));
            const cx = ax + ex * t, cy = ay + ey * t;
            dx = P[i] - cx; dy = P[i + 1] - cy; dz = P[i + 2];
            dd = Math.hypot(dx, dy, dz);
            if (dd < R) { const s = R / (dd || 1e-6); P[i] = cx + dx * s; P[i + 1] = cy + dy * s; P[i + 2] = dz * s; }
            if (P[i + 1] < 0.015) P[i + 1] = 0.015;
          }
        }
      }
    }

    if (this.curls) this.drawRibbons(head);
    else this.drawBraids();
  }

  drawRibbons(head) {
    const n = this.anchors.length, P = this.pos, sz = this.size;
    const pos = this.ribbon.geometry.attributes.position.array;
    const c = Math.cos(head.a), s = Math.sin(head.a);
    for (let b = 0; b < n; b++) {
      const sd = this.anchors[b].side;
      const sx = sd.x * c - sd.y * s, sy = sd.x * s + sd.y * c, szz = sd.z;
      for (let k = 0; k < NODES; k++) {
        const i = (b * NODES + k) * 3;
        const t = k / (NODES - 1);
        // ribbon widens from the root, waves side to side, narrows at the tip
        const w = (0.018 + 0.03 * Math.sin(Math.PI * (0.15 + 0.75 * t))) * sz;
        const wave = Math.sin(k * 1.25 + b * 1.7) * 0.018 * t * sz;
        const x = P[i] + sx * wave, y = P[i + 1] + sy * wave, z = P[i + 2] + szz * wave;
        const v = (b * NODES + k) * 6;
        pos[v] = x - sx * w; pos[v + 1] = y - sy * w; pos[v + 2] = z - szz * w;
        pos[v + 3] = x + sx * w; pos[v + 4] = y + sy * w; pos[v + 5] = z + szz * w;
      }
    }
    const geo = this.ribbon.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }

  drawBraids() {
    const n = this.anchors.length, P = this.pos, sz = this.size;
    const segs = NODES - 1;
    for (let b = 0; b < n; b++) {
      for (let k = 0; k < NODES; k++) {
        const i = (b * NODES + k) * 3;
        const t = k / (NODES - 1);
        const r = (k === NODES - 1 ? 0.0145 : 0.0112 - 0.002 * t) * sz;
        this.m4.makeScale(r, r, r).setPosition(P[i], P[i + 1], P[i + 2]);
        this.knotMesh.setMatrixAt(b * NODES + k, this.m4);
        if (k === NODES - 1) continue;
        const ax = P[i], ay = P[i + 1], az = P[i + 2];
        this.v.set(P[i + 3] - ax, P[i + 4] - ay, P[i + 5] - az);
        const len = this.v.length() || 1e-4;
        this.q.setFromUnitVectors(this.up, this.v.multiplyScalar(1 / len));
        this.at.set(ax + this.v.x * len / 2, ay + this.v.y * len / 2, az + this.v.z * len / 2);
        const rr = (0.0105 - 0.002 * t) * sz;
        this.m4.compose(this.at, this.q, this.sc.set(rr, len, rr));
        this.segMesh.setMatrixAt(b * segs + k, this.m4);
      }
    }
    this.segMesh.instanceMatrix.needsUpdate = true;
    this.knotMesh.instanceMatrix.needsUpdate = true;
  }

  reset() { this.ready = false; }
}
