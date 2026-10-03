import * as THREE from 'three';
import { Ragdoll, STEP } from './ragdoll.js';
import { SkillTracker } from './skills.js';
import { Gymnast, DEFAULT_LOOK } from './character.js';
import { buildStage } from './stage.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';

// ---------- persistence ----------
const STORE = 'flipflop.v1';
function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch { /* private mode etc. */ }
}
const prefs = { mode: 'spring', look: { ...DEFAULT_LOOK }, best: { spring: 0, gym: 0 }, muted: false, seenHelp: false, ...load() };
prefs.look = { ...DEFAULT_LOOK, ...prefs.look };

// ---------- renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

let stage, gymnast;
function buildWorld() {
  scene.clear();
  stage = buildStage(scene, prefs.look);
  gymnast = new Gymnast(scene, prefs.look);
}
buildWorld();

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- game state ----------
const input = new Input();
const sfx = new Sfx();
sfx.muted = prefs.muted;

const $ = (id) => document.getElementById(id);
const ui = {
  score: $('score'), best: $('best'), dist: $('dist'), toast: $('toast'), combo: $('combo'),
  flop: $('flop'), help: $('help'), settings: $('settings'), padBadge: $('padBadge'),
  keys: [...document.querySelectorAll('.key')],
};

let ragdoll, tracker;
let flopped = false, flopAt = 0, banked = 0;
let lastPop = -1, lastBlock = -1, lastLand = -1;

function newRun() {
  ragdoll = new Ragdoll({ springFloor: prefs.mode === 'spring' });
  tracker = new SkillTracker(onEvent);
  tracker.reset(ragdoll);
  gymnast.braids.reset();
  flopped = false;
  banked = 0;
  lastPop = lastBlock = lastLand = -1;
  ui.flop.hidden = true;
  ui.combo.classList.remove('on');
  ui.toast.innerHTML = '';
  camX = 0;
  updateHud();
}

function updateHud() {
  ui.score.textContent = (tracker?.score ?? 0) + (tracker?.comboPoints ?? 0);
  ui.best.textContent = prefs.best[prefs.mode] || 0;
  ui.dist.textContent = `${(tracker?.distance ?? 0).toFixed(1)}m`;
}

function toast(html, cls = '') {
  const el = document.createElement('div');
  el.className = `pop ${cls}`;
  el.innerHTML = html;
  ui.toast.replaceChildren(el);
}

const PART_NAMES = {
  head: 'Head first into the mat!', torso: 'Landed on your back!', pelvis: 'Sat down on the landing!',
  thigh: 'Knees hit the mat!', shin: 'Knees hit the mat!', upperArm: 'Crumpled onto your shoulders!',
};

function onEvent(type, d) {
  if (type === 'skill') {
    toast(`${d.name}!<small>+${d.points}${d.mult > 1 ? ` · combo ×${d.mult}` : ''}</small>`);
    ui.combo.innerHTML = d.combo.map((n) => `<b>${n}</b>`).join(' ➜ ');
    ui.combo.classList.toggle('on', d.combo.length > 1);
    stage.cheer = Math.min(1.6, stage.cheer + 0.8 + 0.3 * d.mult);
    sfx.cheer(d.mult > 1 || /Double|Layout/.test(d.name));
    input.rumble(0.4, 120);
  } else if (type === 'bank') {
    if (d.stuck) toast(`Stuck it!<small>+50 · combo banked</small>`, 'stuck');
    setTimeout(() => ui.combo.classList.remove('on'), 900);
  } else if (type === 'flop') {
    flopped = true;
    flopAt = performance.now();
    sfx.flop();
    input.rumble(1, 350);
    const best = prefs.best[prefs.mode] || 0;
    const isBest = d.score > best;
    if (isBest) { prefs.best[prefs.mode] = d.score; save(); }
    $('flopWhy').textContent = PART_NAMES[d.part] || 'Wipeout!';
    $('runScore').textContent = d.score;
    $('runSkills').textContent = d.skills;
    $('runDist').textContent = `${d.distance.toFixed(1)}m`;
    $('newBest').hidden = !isBest || d.score === 0;
    setTimeout(() => { if (flopped) ui.flop.hidden = false; }, 1100);
  }
  updateHud();
}

// ---------- UI wiring ----------
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
input.bindTouch(document.getElementById('controls'));
input.on((type, v) => {
  if (type === 'pad') {
    ui.padBadge.hidden = !v;
    if (v) toast('🎮 Controller connected<small>LB/X Q · LT/Y W · RB/A O · RT/B P</small>', 'stuck');
  }
});

function openPanel(el) { el.hidden = false; }
function closePanels() {
  ui.help.hidden = true;
  ui.settings.hidden = true;
  if (!prefs.seenHelp) { prefs.seenHelp = true; save(); }
}
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closePanels));
for (const ov of [ui.help, ui.settings]) ov.addEventListener('pointerdown', (e) => { if (e.target === ov) closePanels(); });
$('btnHelp').addEventListener('click', () => openPanel(ui.help));
$('btnSettings').addEventListener('click', () => { syncSettings(); openPanel(ui.settings); });
$('btnAgain').addEventListener('click', newRun);
$('btnRestart').addEventListener('click', newRun);
$('btnRestart').addEventListener('pointerdown', (e) => e.stopPropagation());
ui.flop.addEventListener('pointerdown', (e) => { if (e.target === ui.flop) newRun(); });

const soundBtn = $('btnSound');
const syncSound = () => { soundBtn.textContent = prefs.muted ? '🔇' : '🔊'; };
syncSound();
soundBtn.addEventListener('click', () => {
  prefs.muted = !prefs.muted; sfx.muted = prefs.muted; save(); syncSound();
});

// Audio needs a user gesture.
const unlock = () => sfx.unlock();
addEventListener('pointerdown', unlock);
addEventListener('keydown', unlock);

const LOOK_FIELDS = { optSkin: 'skin', optHair: 'hair', optHighlight: 'highlight', optUniform: 'uniform', optTrim: 'trim', optBoots: 'boots' };
function syncSettings() {
  $('optMode').value = prefs.mode;
  $('optLetter').value = prefs.look.letter;
  for (const [id, k] of Object.entries(LOOK_FIELDS)) $(id).value = prefs.look[k];
}
let rebuildTimer = 0;
function lookChanged() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => { save(); buildWorld(); newRun(); }, 150);
}
$('optMode').addEventListener('change', (e) => { prefs.mode = e.target.value; save(); newRun(); });
$('optLetter').addEventListener('input', (e) => { prefs.look.letter = e.target.value.toUpperCase(); lookChanged(); });
for (const [id, k] of Object.entries(LOOK_FIELDS)) $(id).addEventListener('input', (e) => { prefs.look[k] = e.target.value; lookChanged(); });
$('btnResetLook').addEventListener('click', () => { prefs.look = { ...DEFAULT_LOOK }; syncSettings(); lookChanged(); });

// ---------- main loop ----------
let camX = 0, camY = 0.85;
const view = { zoom: 1, manual: false };
let acc = 0;
let last = performance.now();
const clock0 = last;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  const keys = input.update();
  for (const a of input.takeActions()) {
    const panelOpen = !ui.help.hidden || !ui.settings.hidden;
    if (a === 'help') { if (ui.help.hidden) openPanel(ui.help); else closePanels(); }
    else if (a === 'close') closePanels();
    else if (a === 'restart') { if (!panelOpen) newRun(); }
    else if (a === 'go') {
      if (panelOpen) closePanels();
      else if (flopped && now - flopAt > 500) newRun();
    }
  }
  for (const b of ui.keys) b.classList.toggle('on', keys[b.dataset.key]);

  const paused = !ui.help.hidden || !ui.settings.hidden;
  if (!paused) {
    acc += dt;
    while (acc >= STEP) {
      ragdoll.step(keys);
      tracker.update(ragdoll, keys);
      acc -= STEP;
    }
  } else {
    acc = 0;
  }

  // sound cues from the physics
  if (ragdoll.lastPop !== lastPop) { lastPop = ragdoll.lastPop; if (lastPop > 0) sfx.whoosh(); }
  if (ragdoll.lastBlock !== lastBlock) { lastBlock = ragdoll.lastBlock; if (lastBlock > 0) sfx.whoosh(); }
  if (ragdoll.landT !== lastLand) { lastLand = ragdoll.landT; if (lastLand > 0) sfx.thump(); }

  if (tracker.score !== banked || Math.random() < 0.1) { banked = tracker.score; updateHud(); }

  gymnast.update(ragdoll.pose(), ragdoll.angle('hip'), paused ? 0 : dt);

  // camera: follow the centre of mass, from slightly in front of her
  const c = ragdoll.com();
  const portrait = camera.aspect < 1;
  const k = 1 - Math.exp(-dt * 4);
  camX += (c.x - 0.25 - camX) * k;
  camY += (0.8 + Math.max(0, c.y - 1.0) * 0.6 - camY) * k;
  const dist = (portrait ? 3.9 / Math.max(0.45, camera.aspect) : 4.0) * view.zoom;
  if (!view.manual) {
    camera.position.set(camX + dist * 0.33, camY + (portrait ? 0.9 : 0.45), dist);
    camera.lookAt(camX, camY + (portrait ? 0.15 : 0), 0);
  }

  stage.update((now - clock0) / 1000, camX);
  renderer.render(scene, camera);
}

newRun();
if (!prefs.seenHelp) openPanel(ui.help);
requestAnimationFrame(frame);

// Handy for debugging in the console.
window.flipflop = { get ragdoll() { return ragdoll; }, get tracker() { return tracker; }, input, newRun, view, camera };
