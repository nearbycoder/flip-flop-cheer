// The 3D gymnast. Every mesh is attached to a physics body from ragdoll.js;
// limbs are drawn twice (left/right) at different depths.
import * as THREE from 'three';
import { Braids } from './hair.js';
import { buildHead } from './face.js';
import { CHARACTERS, FIRST_CHARACTER } from './characters.js';

export const DEFAULT_LOOK = CHARACTERS[FIRST_CHARACTER].look;

const LEG_Z = 0.075;
const ARM_Z = 0.165;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  if (f < 1) c.multiplyScalar(f); else c.lerp(new THREE.Color('#ffffff'), f - 1);
  return '#' + c.getHexString();
}

function uniformTexture(look) {
  const [c, g] = canvas(1024, 512);
  g.fillStyle = look.uniform;
  g.fillRect(0, 0, 1024, 512);
  const front = 256; // u = 0.25 faces +x

  if (look.uniformStyle === 'panels') {
    // Solid metallic V-neck insert + gold side panels under the arms.
    const gold = g.createLinearGradient(front - 110, 0, front + 110, 160);
    gold.addColorStop(0, shade(look.trim, 0.8));
    gold.addColorStop(0.45, shade(look.trim, 1.25));
    gold.addColorStop(1, shade(look.trim, 0.85));
    g.fillStyle = gold;
    g.beginPath();
    g.moveTo(front - 112, -4); g.lineTo(front, 165); g.lineTo(front + 112, -4);
    g.closePath(); g.fill();
    g.strokeStyle = look.uniform; g.lineWidth = 10;
    g.beginPath(); g.moveTo(front - 70, -4); g.lineTo(front, 110); g.lineTo(front + 70, -4); g.stroke();
    g.fillStyle = look.uniform;
    g.beginPath(); g.moveTo(front - 66, -4); g.lineTo(front, 104); g.lineTo(front + 66, -4); g.closePath(); g.fill();
    for (const ax of [0, 512, 1024]) {
      const side = g.createLinearGradient(ax - 60, 0, ax + 60, 0);
      side.addColorStop(0, shade(look.trim, 0.85));
      side.addColorStop(0.5, shade(look.trim, 1.2));
      side.addColorStop(1, shade(look.trim, 0.85));
      g.fillStyle = side;
      g.beginPath();
      g.moveTo(ax - 70, 60); g.quadraticCurveTo(ax, 40, ax + 70, 60);
      g.lineTo(ax + 18, 330); g.lineTo(ax - 18, 330);
      g.closePath(); g.fill();
    }
  } else {
    const trimPath = (draw) => {
      // V-neck
      g.beginPath();
      g.moveTo(front - 120, -10);
      g.lineTo(front, 175);
      g.lineTo(front + 120, -10);
      draw();
      // racerback armholes on both sides (u = 0 / 1 and u = 0.5)
      for (const ax of [0, 512, 1024]) {
        g.beginPath();
        g.moveTo(ax - 95, -10);
        g.quadraticCurveTo(ax - 70, 190, ax, 200);
        g.quadraticCurveTo(ax + 70, 190, ax + 95, -10);
        draw();
      }
    };
    g.lineCap = 'butt';
    g.lineJoin = 'miter';
    trimPath(() => { g.strokeStyle = look.trim; g.lineWidth = 46; g.stroke(); });
    trimPath(() => { g.strokeStyle = look.uniform; g.lineWidth = 20; g.stroke(); });
    trimPath(() => { g.strokeStyle = look.trim; g.lineWidth = 6; g.stroke(); });
  }

  // chest letter (panels style gets the embroidered white outline)
  const ly = look.uniformStyle === 'panels' ? 270 : 300;
  g.font = 'bold 150px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  if (look.uniformStyle === 'panels') {
    g.lineWidth = 22; g.strokeStyle = '#ffffff'; g.strokeText(look.letter || '', front, ly);
  }
  g.lineWidth = 10;
  g.strokeStyle = '#000000';
  g.strokeText(look.letter || '', front, ly);
  g.fillStyle = look.trim;
  g.fillText(look.letter || '', front, ly);

  if (look.arrow) {
    // arrow through the letter: fletching low-left, head low-right
    g.save();
    g.translate(front, ly + 70);
    g.rotate(0.55);
    const shaft = (w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(-95, 0); g.lineTo(80, 0); g.stroke(); };
    shaft(14, '#ffffff'); shaft(7, look.trim);
    const headShape = () => { g.beginPath(); g.moveTo(108, 0); g.lineTo(76, -16); g.lineTo(76, 16); g.closePath(); };
    headShape(); g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke(); g.fillStyle = look.trim; g.fill();
    for (const s of [-1, 1]) {
      g.strokeStyle = '#ffffff'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(-95, 0); g.lineTo(-118, s * 18); g.stroke();
      g.beginPath(); g.moveTo(-80, 0); g.lineTo(-103, s * 18); g.stroke();
      g.strokeStyle = look.trim; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-95, 0); g.lineTo(-118, s * 18); g.stroke();
      g.beginPath(); g.moveTo(-80, 0); g.lineTo(-103, s * 18); g.stroke();
    }
    g.restore();
  }
  return tex(c);
}

function skirtTexture(look) {
  const [c, g] = canvas(512, 256);
  g.fillStyle = look.uniform;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = look.trim;
  if (look.uniformStyle === 'panels') {
    // gold side slits (u = 0 and 0.5 are the sides)
    for (const x of [0, 256, 512]) {
      g.beginPath(); g.moveTo(x - 4, 0); g.lineTo(x + 4, 0); g.lineTo(x + 14, 256); g.lineTo(x - 14, 256); g.closePath(); g.fill();
    }
  } else {
    g.fillRect(0, 256 - 34, 512, 26);
    g.fillRect(0, 256 - 72, 512, 18);
  }
  return tex(c);
}

function bootTexture(look) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = look.boots;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = shade(look.boots, 0.82);
  g.lineWidth = 3;
  // western scroll stitching
  for (let k = 0; k < 2; k++) {
    const ox = k * 128 + 64;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(ox, 230 - i * 52);
      g.bezierCurveTo(ox - 50, 200 - i * 52, ox - 40, 150 - i * 52, ox, 170 - i * 52);
      g.bezierCurveTo(ox + 40, 150 - i * 52, ox + 50, 200 - i * 52, ox, 230 - i * 52);
      g.stroke();
    }
  }
  return tex(c);
}

// A limb segment hanging down from its joint: tapered cylinder + end caps.
function limb(len, r1, r2, mat) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 18, 1), mat);
  cyl.position.y = -len / 2;
  g.add(cyl);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r1, 18, 12), mat);
  g.add(cap);
  return g;
}

function bootFootGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.055, 0.0);
  s.lineTo(-0.06, -0.06);
  s.quadraticCurveTo(-0.06, -0.08, -0.04, -0.082);
  s.lineTo(0.12, -0.082);
  s.quadraticCurveTo(0.175, -0.08, 0.19, -0.062); // pointed toe
  s.quadraticCurveTo(0.15, -0.035, 0.07, -0.03);
  s.quadraticCurveTo(0.03, -0.022, 0.035, 0.0);
  s.lineTo(-0.055, 0.0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 10 });
  geo.translate(0, 0, -0.035);
  return geo;
}

function sneakerGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.055, -0.005);
  s.lineTo(-0.062, -0.06);
  s.quadraticCurveTo(-0.062, -0.075, -0.045, -0.075);
  s.lineTo(0.13, -0.075);
  s.quadraticCurveTo(0.175, -0.072, 0.172, -0.045); // round toe
  s.quadraticCurveTo(0.165, -0.025, 0.11, -0.022);
  s.quadraticCurveTo(0.05, -0.012, 0.035, 0.002);
  s.lineTo(-0.055, -0.005);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.074, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.014, bevelSegments: 3, curveSegments: 10 });
  geo.translate(0, 0, -0.037);
  return geo;
}

// Metallic shredded pom-pom: one instanced draw call of radiating strips.
function pomPom(color) {
  const n = 150;
  const geo = new THREE.PlaneGeometry(0.016, 0.13);
  geo.translate(0, 0.065, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff', metalness: 0.55, roughness: 0.28, side: THREE.DoubleSide,
    emissive: new THREE.Color(color).multiplyScalar(0.22),
  });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  const q = new THREE.Quaternion(), tw = new THREE.Quaternion(), m = new THREE.Matrix4();
  const base = new THREE.Color(color), col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    // Fibonacci sphere directions with a little jitter
    const y = 1 - (i + 0.5) * 2 / n, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    dir.set(Math.cos(th) * r + (Math.random() - 0.5) * 0.2, y, Math.sin(th) * r + (Math.random() - 0.5) * 0.2).normalize();
    q.setFromUnitVectors(up, dir);
    tw.setFromAxisAngle(dir, Math.random() * Math.PI);
    q.premultiply(tw);
    const len = 0.75 + Math.random() * 0.45;
    m.compose(new THREE.Vector3(), q, new THREE.Vector3(1, len, 1));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.copy(base).multiplyScalar(0.75 + Math.random() * 0.5));
  }
  mesh.castShadow = false;
  return mesh;
}

export class Gymnast {
  constructor(scene, look = DEFAULT_LOOK) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.groups = {};
    this.look = { ...DEFAULT_LOOK, ...look };
    this.build();
  }

  setLook(look) {
    this.look = { ...DEFAULT_LOOK, ...look };
    this.root.clear();
    this.braids?.dispose();
    this.build();
  }

  build() {
    const L = this.look;
    const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, ...o });
    const skin = std({ color: L.skin, roughness: 0.55 });
    const black = std({ color: L.uniform, roughness: 0.7 });
    const boot = std({ map: bootTexture(L), roughness: 0.45 });
    const bootSolid = std({ color: L.boots, roughness: 0.45 });
    const heel = std({ color: '#a77b4f', roughness: 0.7 });
    const scrunchie = std({ color: '#1a1a1a', roughness: 0.9 });
    const mk = (name) => {
      const g = new THREE.Group();
      this.root.add(g);
      this.groups[name] = g;
      return g;
    };

    // Torso (origin = waist)
    const torso = mk('torso');
    const prof = [[0.088, 0], [0.092, 0.06], [0.099, 0.14], [0.104, 0.21], [0.101, 0.26], [0.084, 0.3], [0.05, 0.322], [0.036, 0.33]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), std({ map: uniformTexture(L), roughness: 0.7 }));
    shell.scale.set(0.95, 1, 1.32);
    torso.add(shell);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.09, 16), skin);
    neck.position.y = 0.33;
    torso.add(neck);
    for (const s of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), skin);
      sh.position.set(0, 0.275, s * (ARM_Z - 0.01));
      torso.add(sh);
    }

    // Head (origin = neck joint)
    const head = mk('head');
    head.add(buildHead(L));

    // Pelvis: briefs (the skirt is a separate group so it can swing)
    const pelvis = mk('pelvis');
    const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.094, 0.1, 0.17, 24), black);
    shorts.scale.z = 1.3;
    shorts.position.y = 0.05;
    pelvis.add(shorts);

    const skirt = mk('skirt');
    const pleated = L.uniformStyle !== 'panels';
    const sg = new THREE.CylinderGeometry(0.096, pleated ? 0.17 : 0.15, pleated ? 0.25 : 0.23, 48, 1, true);
    // pleats: zig-zag the hem
    const pos = sg.attributes.position;
    for (let i = 0; pleated && i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < 0) {
        const a = Math.atan2(pos.getZ(i), pos.getX(i));
        const k = 1 + 0.06 * Math.abs(Math.sin(a * 12));
        pos.setX(i, pos.getX(i) * k);
        pos.setZ(i, pos.getZ(i) * k);
      }
    }
    sg.computeVertexNormals();
    sg.translate(0, pleated ? -0.125 : -0.115, 0);
    const skirtMesh = new THREE.Mesh(sg, std({ map: skirtTexture(L), side: THREE.DoubleSide, roughness: 0.75 }));
    skirtMesh.scale.z = 1.3;
    skirt.add(skirtMesh);

    // Legs
    const thigh = mk('thigh');
    const shin = mk('shin');
    const foot = mk('foot');
    const sneakers = L.shoes === 'sneakers';
    const footGeo = sneakers ? sneakerGeometry() : bootFootGeometry();
    const sock = std({ color: '#fbfbf8', roughness: 0.9 });
    const sole = std({ color: '#d9d6cf', roughness: 0.8 });
    for (const s of [-1, 1]) {
      const z = s * LEG_Z;
      const t = limb(0.385, 0.066, 0.047, skin);
      t.position.z = z;
      thigh.add(t);

      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.047, 16, 12), skin);
      knee.position.z = z;
      shin.add(knee);
      if (sneakers) {
        // bare calf down to an ankle sock
        const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.036, 0.33, 16), skin);
        calf.position.set(0, -0.17, z);
        shin.add(calf);
        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.043, 0.06, 16), sock);
        cuff.position.set(0, -0.35, z);
        shin.add(cuff);
      } else {
        const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.05, 0.07, 16), skin);
        calf.position.set(0, -0.04, z);
        shin.add(calf);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.047, 0.32, 20, 1, true), boot);
        shaft.position.set(0, -0.225, z);
        shin.add(shaft);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.006, 6, 24), bootSolid);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(0, -0.066, z);
        shin.add(rim);
        const inner = new THREE.Mesh(new THREE.CircleGeometry(0.062, 20), std({ color: '#6b6359' }));
        inner.rotation.x = -Math.PI / 2;
        inner.position.set(0, -0.08, z);
        shin.add(inner);
      }

      const f = new THREE.Mesh(footGeo, bootSolid);
      f.position.z = z;
      foot.add(f);
      if (sneakers) {
        const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 10), sock);
        ankle.position.set(-0.005, -0.012, z);
        foot.add(ankle);
        const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.014, 0.092), sole);
        s2.position.set(0.055, -0.085, z);
        foot.add(s2);
        for (let k = 0; k < 4; k++) {
          const lace = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.05), sole);
          lace.position.set(0.03 + k * 0.022, -0.011 - k * 0.0055, z);
          lace.rotation.z = -0.3;
          foot.add(lace);
        }
      } else {
        const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), bootSolid);
        ankle.position.set(0, -0.01, z);
        foot.add(ankle);
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.028, 0.06), heel);
        h.position.set(-0.035, -0.08, z);
        foot.add(h);
      }
    }

    // Arms
    const upper = mk('upperArm');
    const fore = mk('forearm');
    for (const s of [-1, 1]) {
      const z = s * ARM_Z;
      const u = limb(0.25, 0.039, 0.033, skin);
      u.position.z = z;
      upper.add(u);
      const f = limb(0.235, 0.032, 0.026, skin);
      f.position.z = z;
      fore.add(f);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skin);
      hand.scale.set(0.024, 0.05, 0.032);
      hand.position.set(0, -0.27, z);
      fore.add(hand);
      if (L.poms) {
        const pp = pomPom(L.trim);
        pp.position.set(0, -0.29, z + s * 0.02);
        fore.add(pp);
      } else if (s === 1) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.009, 8, 18), scrunchie);
        band.rotation.x = Math.PI / 2;
        band.position.set(0, -0.2, z);
        fore.add(band);
      }
    }

    // Only the big shapes cast shadows; tiny face details would just add
    // draw calls to the shadow pass without changing how it looks.
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingSphere();
      const sc = o.getWorldScale(new THREE.Vector3());
      const r = o.geometry.boundingSphere.radius * Math.max(sc.x, sc.y, sc.z);
      o.castShadow = r > 0.03;
      o.receiveShadow = r > 0.03;
    });

    // Body size: every part scales with the physics body; younger kids get a
    // slightly larger head for their size.
    this.s = L.scale ?? 1;
    this.headScale = 1 + Math.max(0, 1 - this.s) * 0.4;
    for (const [name, g] of Object.entries(this.groups)) {
      g.scale.setScalar(this.s * (name === 'head' ? this.headScale : 1));
    }

    this.braids = new Braids(this.scene, L, this.s * this.headScale);
  }

  // pose: { name: {x, y, a} } from Ragdoll.pose()
  update(pose, hipAngle, dt) {
    for (const [name, g] of Object.entries(this.groups)) {
      const p = pose[name];
      if (!p) continue;
      g.position.set(p.x, p.y, 0);
      g.rotation.set(0, 0, p.a);
    }
    // Skirt hangs from the waist and swings partway toward the thighs.
    const pv = pose.pelvis;
    const sk = this.groups.skirt;
    const c = Math.cos(pv.a), s = Math.sin(pv.a);
    const w = 0.13 * this.s;
    sk.position.set(pv.x - s * w, pv.y + c * w, 0);
    sk.rotation.set(0, 0, pv.a + 0.32 * hipAngle);

    const h = pose.head;
    const torso = pose.torso;
    this.braids.update(dt, h, torso, this.s);
  }

  get position() { return this.groups.pelvis.position; }
}
