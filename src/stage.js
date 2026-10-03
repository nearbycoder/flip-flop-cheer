// Friday-night-lights stadium: turf, a long blue spring-floor mat, bleachers
// with a crowd that jumps when a skill lands, light towers and goal posts.
import * as THREE from 'three';

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

function textSprite(text, { size = 64, color = '#fff', font = 'bold', width = 256, height = 96 } = {}) {
  const t = canvasTex(width, height, (g, w, h) => {
    g.font = `${font} ${size}px "Arial Black", Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2);
  });
  return t;
}

export function buildStage(scene, look) {
  const stage = { crowd: null, crowdBase: [], cheer: 0 };

  // Sky
  scene.background = canvasTex(4, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#060818');
    grd.addColorStop(0.55, '#16173a');
    grd.addColorStop(0.8, '#3a2a55');
    grd.addColorStop(1, '#6b3d4a');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog('#1a1838', 18, 60);

  // Lights
  scene.add(new THREE.HemisphereLight('#bcc8ff', '#2a3a20', 0.9));
  const key = new THREE.DirectionalLight('#fff4e0', 2.4);
  key.position.set(4, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -2; sc.near = 1; sc.far = 25;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  scene.add(key.target);
  const fill = new THREE.DirectionalLight('#9fb4ff', 0.6);
  fill.position.set(-6, 4, 3);
  scene.add(fill);
  stage.key = key;

  // Turf with mowing stripes and yard lines
  const turf = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 60),
    new THREE.MeshStandardMaterial({
      roughness: 0.95,
      map: canvasTex(512, 64, (g, w, h) => {
        for (let i = 0; i < 8; i++) {
          g.fillStyle = i % 2 ? '#2f6b2c' : '#357a31';
          g.fillRect((i * w) / 8, 0, w / 8, h);
        }
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fillRect(0, 0, 4, h);
      }, [50, 1]),
    }),
  );
  turf.rotation.x = -Math.PI / 2;
  turf.position.set(-80, -0.045, -20);
  turf.receiveShadow = true;
  scene.add(turf);

  // Spring-floor mat (top surface at y = 0, where the physics floor is)
  const MAT_START = 6, MAT_END = -120;
  const matLen = MAT_START - MAT_END;
  const mat = new THREE.Mesh(
    new THREE.BoxGeometry(matLen, 0.045, 2.6),
    new THREE.MeshStandardMaterial({
      roughness: 0.85,
      map: canvasTex(256, 128, (g, w, h) => {
        g.fillStyle = '#2457b8';
        g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(0, 0, 3, h); // panel seam
        g.fillStyle = '#ffffff';
        g.fillRect(0, 6, w, 5);
        g.fillRect(0, h - 11, w, 5);
      }, [matLen / 1.5, 1]),
    }),
  );
  mat.position.set((MAT_START + MAT_END) / 2, -0.0225, 0);
  mat.receiveShadow = true;
  scene.add(mat);

  // Distance markers every 5 m (tumbling goes toward -x)
  for (let d = 5; d <= 115; d += 5) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.34),
      new THREE.MeshBasicMaterial({ map: textSprite(`${d}m`, { size: 60 }), transparent: true, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(-d, 0.002, 1.05);
    scene.add(m);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 2.5), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(-d, 0.001, 0);
    scene.add(line);
  }

  // Bleachers + crowd
  const bleach = new THREE.MeshStandardMaterial({ color: '#8d94a0', metalness: 0.6, roughness: 0.4 });
  const ROWS = 7;
  for (let r = 0; r < ROWS; r++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(160, 0.08, 0.9), bleach);
    step.position.set(-40, 0.45 + r * 0.45, -7 - r * 0.9);
    step.receiveShadow = true;
    scene.add(step);
    const riser = new THREE.Mesh(new THREE.BoxGeometry(160, 0.45, 0.04), new THREE.MeshStandardMaterial({ color: '#3d4350' }));
    riser.position.set(-40, 0.22 + r * 0.45, -6.55 - r * 0.9);
    scene.add(riser);
  }
  const PER_ROW = 150;
  const count = ROWS * PER_ROW;
  const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.17, 0.35, 4, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), count);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.7 }), count);
  const shirtColors = [look.uniform, look.trim, '#f4f1ea', look.trim, '#2b2b2b', '#7a1f2b', '#1f3f7a'];
  const skinColors = ['#f1c7a2', '#d79f76', '#a8693f', '#7a4a2b', '#5a3420', '#e8b48c'];
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  let i = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let k = 0; k < PER_ROW; k++) {
      if (Math.random() < 0.18) continue;
      const x = 30 - k * 1.05 + Math.random() * 0.4;
      const y = 0.49 + r * 0.45 + 0.35;
      const z = -7 - r * 0.9;
      stage.crowdBase.push({ x, y, z, phase: Math.random() * Math.PI * 2, amp: 0.5 + Math.random() * 0.5 });
      m4.makeTranslation(x, y, z);
      body.setMatrixAt(i, m4);
      body.setColorAt(i, col.set(shirtColors[(Math.random() * shirtColors.length) | 0]));
      m4.makeTranslation(x, y + 0.42, z);
      heads.setMatrixAt(i, m4);
      heads.setColorAt(i, col.set(skinColors[(Math.random() * skinColors.length) | 0]));
      i++;
    }
  }
  body.count = heads.count = i;
  scene.add(body, heads);
  stage.crowd = { body, heads };

  // Banner on the bleacher front
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 0.9),
    new THREE.MeshStandardMaterial({
      map: canvasTex(1024, 128, (g, w, h) => {
        g.fillStyle = look.uniform; g.fillRect(0, 0, w, h);
        g.fillStyle = look.trim; g.fillRect(0, 8, w, 8); g.fillRect(0, h - 16, w, 8);
        g.font = 'italic 900 78px "Arial Black", Arial, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = look.trim;
        g.fillText(`GO ${look.letter || ''}! FLIP FLOP CHEER`, w / 2, h / 2 + 4);
      }),
    }),
  );
  banner.position.set(-1, 0.55, -6.5);
  scene.add(banner);

  // Light towers
  const pole = new THREE.MeshStandardMaterial({ color: '#555b66', metalness: 0.5, roughness: 0.5 });
  const lamp = new THREE.MeshBasicMaterial({ color: '#fffbe8' });
  const glowTex = canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,250,225,1)');
    grd.addColorStop(0.3, 'rgba(255,240,200,0.45)');
    grd.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  });
  for (let x = 14; x > -130; x -= 28) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 16, 8), pole);
    p.position.set(x, 8, -16);
    scene.add(p);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), lamp);
      l.position.set(x - 0.9 + b * 0.6, 15.6 + a * 0.5, -15.7);
      scene.add(l);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(7, 5, 1);
    glow.position.set(x, 16.1, -15.5);
    scene.add(glow);
  }

  // Goal posts in the distance
  const yellow = new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.4 });
  const gp = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 8), yellow);
  base.position.y = 1.5;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.6, 8), yellow);
  bar.rotation.x = Math.PI / 2;
  bar.position.y = 3;
  gp.add(base, bar);
  for (const s of [-1, 1]) {
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 8), yellow);
    up.position.set(0, 6, s * 2.8);
    gp.add(up);
  }
  gp.position.set(16, 0, -10);
  scene.add(gp);

  // Sideline props: pom-poms and a football
  const pomColors = [look.trim, look.uniform];
  for (let k = 0; k < 4; k++) {
    const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 2), new THREE.MeshStandardMaterial({ color: pomColors[k % 2], roughness: 0.3, metalness: 0.4, flatShading: true }));
    pom.position.set(2.6 + k * 0.32, 0.12, -1.6 - (k % 2) * 0.2);
    pom.castShadow = true;
    scene.add(pom);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), new THREE.MeshStandardMaterial({ color: '#6b2f1c', roughness: 0.6 }));
  ball.scale.set(1.6, 1, 1);
  ball.position.set(3.4, 0.09, 1.5);
  ball.rotation.y = 0.5;
  ball.castShadow = true;
  const lace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.02), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
  lace.position.set(0, 0.088, 0);
  ball.add(lace);
  scene.add(ball);

  // Autumn tree line beyond the stadium
  const leafColors = ['#8a3b12', '#a5521a', '#6e2a10', '#9c6b1a', '#4a2a14'];
  for (let k = 0; k < 70; k++) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(1.5 + Math.random() * 1.5, 8, 6), new THREE.MeshStandardMaterial({ color: leafColors[k % leafColors.length], roughness: 1 }));
    t.position.set(30 - k * 3.2 + Math.random() * 2, 3 + Math.random() * 2, -26 - Math.random() * 6);
    scene.add(t);
  }

  stage.update = (t, focusX) => {
    key.position.set(focusX + 4, 9, 6);
    key.target.position.set(focusX, 0.6, 0);
    stage.cheer = Math.max(0, stage.cheer - 1 / 60 * 0.7);
    const { body: bm, heads: hm } = stage.crowd;
    const ch = stage.cheer;
    for (let n = 0; n < stage.crowdBase.length; n++) {
      const c = stage.crowdBase[n];
      if (Math.abs(c.x - focusX) > 30) continue;
      const jump = Math.max(0, Math.sin(t * 9 + c.phase)) * 0.25 * ch * c.amp + Math.sin(t * 2 + c.phase) * 0.015;
      m4.makeTranslation(c.x, c.y + jump, c.z);
      bm.setMatrixAt(n, m4);
      m4.makeTranslation(c.x, c.y + 0.42 + jump, c.z);
      hm.setMatrixAt(n, m4);
    }
    bm.instanceMatrix.needsUpdate = true;
    hm.instanceMatrix.needsUpdate = true;
  };

  return stage;
}
