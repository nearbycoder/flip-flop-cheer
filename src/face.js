// The head: a painted skin texture (blush, lids, nostrils, braces smile)
// plus sculpted 3D eyes, brows and nose so the face has real depth.
import * as THREE from 'three';

export const HEAD_R = 0.112;
export const HEAD_Y = 0.118;            // centre of the head above the neck joint
export const HEAD_SCALE = new THREE.Vector3(0.96, 1.05, 0.94);
export const FACE_AZ = 35;              // face turned toward the camera (degrees)

const TW = 2048, TH = 1024, PPD = TW / 360; // texture pixels per degree
const DEG = Math.PI / 180;

// Texture position for a point on the face. a = degrees across the face
// (+ toward the camera side), lat = degrees above the eye line's equator.
function T(a, lat) {
  const u = 0.5 - (FACE_AZ + a) / 360;
  return [u * TW, (90 - lat) / 180 * TH];
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  if (f < 1) c.multiplyScalar(f); else c.lerp(new THREE.Color('#ffffff'), f - 1);
  return '#' + c.getHexString();
}

function mix(a, b, t) {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

// Point + outward normal on the (scaled) head surface, in head-group space.
export function surface(a, lat, out = 0) {
  const az = (FACE_AZ + a) * DEG, la = lat * DEG;
  const d = new THREE.Vector3(Math.cos(la) * Math.cos(az), Math.sin(la), Math.cos(la) * Math.sin(az));
  const p = new THREE.Vector3(d.x * HEAD_R * HEAD_SCALE.x, d.y * HEAD_R * HEAD_SCALE.y + HEAD_Y, d.z * HEAD_R * HEAD_SCALE.z);
  const n = new THREE.Vector3(d.x / HEAD_SCALE.x, d.y / HEAD_SCALE.y, d.z / HEAD_SCALE.z).normalize();
  p.addScaledVector(n, out);
  return { p, n };
}

const Z = new THREE.Vector3(0, 0, 1);
function place(obj, a, lat, out, roll = 0) {
  const { p, n } = surface(a, lat, out);
  obj.position.copy(p);
  obj.quaternion.setFromUnitVectors(Z, n);
  if (roll) obj.rotateZ(roll);
  return obj;
}

function skinTexture(look) {
  const c = document.createElement('canvas');
  c.width = TW; c.height = TH;
  const g = c.getContext('2d');
  const skin = look.skin;
  g.fillStyle = skin;
  g.fillRect(0, 0, TW, TH);

  const ell = (a, lat, rx, ry, fill, rot = 0) => {
    const [x, y] = T(a, lat);
    g.fillStyle = fill;
    g.beginPath(); g.ellipse(x, y, rx * PPD, ry * PPD, rot, 0, Math.PI * 2); g.fill();
  };
  const soft = (a, lat, r, color, alpha) => {
    const [x, y] = T(a, lat);
    const grd = g.createRadialGradient(x, y, 0, x, y, r * PPD);
    const col = new THREE.Color(color);
    const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
    grd.addColorStop(0, `rgba(${rgb},${alpha})`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(x - r * PPD, y - r * PPD, r * 2 * PPD, r * 2 * PPD);
  };

  // gentle contouring: lighter T-zone, warmer cheeks, shadow under the jaw
  soft(0, 6, 22, shade(skin, 1.18), 0.35);
  soft(0, -6, 10, shade(skin, 1.15), 0.3);
  for (const s of [-1, 1]) {
    soft(s * 25, -14, 11, '#e0566a', 0.38);    // blush
    soft(s * 20, -2, 6, shade(skin, 0.8), 0.25); // under-eye depth
  }
  soft(0, -48, 30, shade(skin, 0.7), 0.45);

  for (const s of [-1, 1]) {
    // eye sockets (sit behind the 3D eyes)
    ell(s * 19, 1.5, 9.2, 5.6, shade(skin, 0.62));
    ell(s * 19, 1.5, 8.4, 4.8, '#2a160c');
    // lid crease
    const [x0, y0] = T(s * 19 - s * 9, 5);
    const [x1, y1] = T(s * 19, 9.6);
    const [x2, y2] = T(s * 19 + s * 9, 5.5);
    g.strokeStyle = shade(skin, 0.68);
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x1, y1, x2, y2); g.stroke();
  }

  // nostrils and nose shadow
  soft(0, -12, 6, shade(skin, 0.65), 0.5);
  for (const s of [-1, 1]) ell(s * 3.6, -13.2, 1.6, 1.0, '#3a1d12', s * 0.4);

  // ---- big smile with braces ----
  const L = T(-17.5, -20), R = T(17.5, -20);
  const botMid = T(0, -33);
  const mouth = new Path2D();
  mouth.moveTo(...L);
  mouth.bezierCurveTo(...T(-9, -21.8), ...T(9, -21.8), ...R);
  mouth.bezierCurveTo(...T(13, -30), ...T(6, -33), ...botMid);
  mouth.bezierCurveTo(...T(-6, -33), ...T(-13, -30), ...L);

  // lips
  g.save();
  g.lineJoin = 'round';
  g.strokeStyle = mix(shade(skin, 0.7), '#a4505a', 0.45);
  g.lineWidth = 16;
  g.stroke(mouth);
  g.restore();

  g.save();
  g.clip(mouth);
  g.fillStyle = '#4a1219';
  g.fillRect(0, 0, TW, TH);
  // tongue
  ell(0, -31, 9, 4, '#c0505a');
  // upper teeth
  g.fillStyle = '#fbf8f1';
  g.beginPath();
  g.moveTo(L[0], L[1] - 4);
  g.bezierCurveTo(T(-9, -22)[0], T(-9, -22)[1] - 4, T(9, -22)[0], T(9, -22)[1] - 4, R[0], R[1] - 4);
  g.lineTo(R[0], R[1] + 6 * PPD);
  g.bezierCurveTo(T(9, -27.5)[0], T(9, -27.5)[1], T(-9, -27.5)[0], T(-9, -27.5)[1], L[0], L[1] + 6 * PPD);
  g.closePath();
  g.fill();
  // tooth gaps
  g.strokeStyle = 'rgba(120,110,100,0.45)';
  g.lineWidth = 2;
  for (let i = -5; i <= 5; i++) {
    const [x, y] = T(i * 2.9, -21.5 - (1 - (i / 6) ** 2) * 0.6);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 5.2 * PPD); g.stroke();
  }
  // braces: wire + brackets
  const wire = (dy) => {
    g.beginPath();
    for (let a = -16; a <= 16; a += 1) {
      const [x, y] = T(a, -24.6 - (1 - (a / 17) ** 2) * 1.1 + dy);
      if (a === -16) g.moveTo(x, y); else g.lineTo(x, y);
    }
  };
  g.strokeStyle = '#7f8a95'; g.lineWidth = 5; wire(0); g.stroke();
  g.strokeStyle = '#e6ecf2'; g.lineWidth = 1.6; wire(0.25); g.stroke();
  for (let i = -5; i <= 5; i++) {
    const a = i * 2.9;
    const [x, y] = T(a, -24.6 - (1 - (a / 17) ** 2) * 1.1);
    g.fillStyle = '#9aa5b0';
    g.beginPath(); g.roundRect(x - 0.95 * PPD, y - 0.95 * PPD, 1.9 * PPD, 1.9 * PPD, 3); g.fill();
    g.fillStyle = '#eef3f7';
    g.fillRect(x - 0.6 * PPD, y - 0.6 * PPD, 0.55 * PPD, 0.55 * PPD);
  }
  g.restore();

  // lower lip highlight + smile creases
  const [lx, ly] = T(0, -35.3);
  g.fillStyle = 'rgba(255,220,210,0.25)';
  g.beginPath(); g.ellipse(lx, ly, 6 * PPD, 1.1 * PPD, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = shade(skin, 0.7);
  g.lineWidth = 4;
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    const [x0, y0] = T(s * 20.5, -16);
    const [x1, y1] = T(s * 22, -20);
    const [x2, y2] = T(s * 20.5, -23.5);
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x1, y1, x2, y2); g.stroke();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function irisTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, '#1a0d06');
  grd.addColorStop(0.32, '#2c170b');
  grd.addColorStop(0.36, '#6b3d1e');
  grd.addColorStop(0.8, '#4a2812');
  grd.addColorStop(1, '#1d0f07');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(160,100,50,0.35)';
  g.lineWidth = 2;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    g.beginPath(); g.moveTo(64 + Math.cos(a) * 24, 64 + Math.sin(a) * 24); g.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildHead(look) {
  const head = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ map: skinTexture(look), roughness: 0.48 });
  const skull = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 64, 48), skinMat);
  skull.position.y = HEAD_Y;
  skull.scale.copy(HEAD_SCALE);
  head.add(skull);

  const flat = new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1a0e07', roughness: 0.6 });
  const brow = new THREE.MeshStandardMaterial({ color: shade(look.hair, 0.8), roughness: 0.9 });
  const white = new THREE.MeshStandardMaterial({ color: '#fbf7f0', roughness: 0.25 });
  const irisMat = new THREE.MeshStandardMaterial({ map: irisTexture(), roughness: 0.15 });
  const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });

  // Nose: soft bridge + rounded tip
  const bridge = place(new THREE.Mesh(new THREE.SphereGeometry(0.006, 16, 12), flat), 0, -3.5, -0.0025);
  bridge.scale.set(1, 2.3, 0.9);
  head.add(bridge);
  const tip = place(new THREE.Mesh(new THREE.SphereGeometry(0.0102, 20, 14), flat), 0, -9.5, -0.0042);
  tip.scale.set(1.25, 0.9, 0.85);
  head.add(tip);
  for (const s of [-1, 1]) {
    const wing = place(new THREE.Mesh(new THREE.SphereGeometry(0.0062, 14, 10), flat), s * 4, -11, -0.0025);
    head.add(wing);
  }

  // Cheeks: subtle volume so the smile pushes them up
  for (const s of [-1, 1]) {
    const cheek = place(new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 14), flat), s * 22, -13, -0.019);
    cheek.scale.set(1.2, 0.85, 0.7);
    head.add(cheek);
  }

  // Eyes
  for (const s of [-1, 1]) {
    const eye = place(new THREE.Group(), s * 19, 1.5, -0.0035);
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 24, 16), white);
    sclera.scale.set(1.08, 0.66, 0.55);
    eye.add(sclera);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0082, 28), irisMat);
    iris.position.set(s * 0.0012, -0.0004, 0.0076);
    eye.add(iris);
    const glint = new THREE.Mesh(new THREE.CircleGeometry(0.0019, 12), shine);
    glint.position.set(s * 0.0012 + 0.0028, 0.0026, 0.0081);
    eye.add(glint);
    // upper lid + lashes
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.0152, 0.0021, 8, 28, Math.PI), dark);
    lid.scale.set(1.06, 0.72, 1);
    lid.position.z = 0.0028;
    eye.add(lid);
    for (let k = 0; k < 3; k++) {
      const lash = new THREE.Mesh(new THREE.ConeGeometry(0.0012, 0.0055, 5), dark);
      const ang = (s > 0 ? 0.25 : Math.PI - 0.25) + (s > 0 ? 1 : -1) * k * 0.22;
      lash.position.set(Math.cos(ang) * 0.016, Math.sin(ang) * 0.0115, 0.003);
      lash.rotation.z = ang - Math.PI / 2;
      eye.add(lash);
    }
    // lower lid line
    const low = new THREE.Mesh(new THREE.TorusGeometry(0.0148, 0.0009, 6, 20, Math.PI * 0.8), new THREE.MeshStandardMaterial({ color: shade(look.skin, 0.6) }));
    low.rotation.z = Math.PI + Math.PI * 0.1;
    low.scale.set(1.04, 0.62, 1);
    low.position.z = 0.002;
    eye.add(low);
    head.add(eye);

    // brows: a gentle, happy arch
    const b = place(new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0028, 8, 24, Math.PI * 0.75), brow), s * 19, 11.5, -0.0005, Math.PI * 0.125);
    b.scale.set(1.15, 0.45, 0.6);
    head.add(b);
  }

  // ears
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), flat);
    ear.position.set(-0.008, 0.108, s * 0.103);
    ear.scale.set(0.7, 1.1, 0.5);
    head.add(ear);
  }

  head.add(buildHairCap(look));
  return head;
}

// Hair cap: braid sections pulled back from a natural hairline.
function buildHairCap(look) {
  const c = document.createElement('canvas');
  c.width = TW; c.height = TH;
  const g = c.getContext('2d');
  g.fillStyle = look.hair;
  g.fillRect(0, 0, TW, TH);

  // braid parts: small square sections, each a twisted braid root
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const rowH = 22;
  g.fillStyle = shade(look.hair, 0.7);
  g.fillRect(0, 0, TW, TH);
  for (let row = 0; row * rowH < TH; row++) {
    const y = row * rowH;
    for (let x = (row % 2) * 13; x < TW + 30; x += 26) {
      const hl = rnd() < 0.3;
      g.fillStyle = hl ? mix(look.hair, look.highlight, 0.25 + rnd() * 0.25) : shade(look.hair, 0.95 + rnd() * 0.2);
      g.beginPath(); g.roundRect(x + 2, y + 2, 22, rowH - 4, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + 6, y + 5); g.lineTo(x + 18, y + rowH - 5); g.stroke();
    }
  }

  // cut out the face with a soft rounded hairline
  g.globalCompositeOperation = 'destination-out';
  const p = new Path2D();
  p.moveTo(...T(-47, -90));
  p.lineTo(...T(-47, 8));
  p.bezierCurveTo(...T(-46, 26), ...T(-26, 37), ...T(0, 37));
  p.bezierCurveTo(...T(26, 37), ...T(46, 26), ...T(47, 8));
  p.lineTo(...T(47, -90));
  p.closePath();
  g.fill(p);
  // nape: let the neck show below the braids
  g.fillRect(0, (90 + 22) / 180 * TH, TW, TH);
  g.globalCompositeOperation = 'source-over';

  // baby hairs along the hairline
  g.strokeStyle = shade(look.hair, 0.85);
  g.lineWidth = 2.5;
  g.lineCap = 'round';
  for (let a = -40; a <= 40; a += 2.2) {
    const lat = 37 - (a / 47) ** 2 * 25;
    const [x, y] = T(a, lat);
    g.beginPath();
    g.moveTo(x, y - 6);
    g.quadraticCurveTo(x + 6, y + 4, x - 4, y + 9);
    g.stroke();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(HEAD_R * 1.06, 64, 48),
    new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.5, roughness: 0.75 }),
  );
  cap.position.y = HEAD_Y + 0.003;
  cap.scale.copy(HEAD_SCALE);
  return cap;
}
