import * as THREE from 'three';
import { Ragdoll, STEP } from './ragdoll.js';
import { SkillTracker } from './skills.js';
import { Gymnast } from './character.js';
import { CHARACTERS, FIRST_CHARACTER, feetInches } from './characters.js';
import { buildStage } from './stage.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { Quality, TIERS } from './quality.js';

// ---------- persistence ----------
const STORE = 'flipflop.v1';
function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch { /* private mode etc. */ }
}
const prefs = { gfx: 'auto', mode: 'spring', character: FIRST_CHARACTER, looks: {}, best: {}, muted: false, seenHelp: false, ...load() };
// Older saves stored a full single look (not just the changes), which would
// pin the old uniform; drop it and keep only the best scores.
delete prefs.look;
for (const m of ['spring', 'gym']) {
  if (typeof prefs.best[m] === 'number') { prefs.best[`${FIRST_CHARACTER}:${m}`] = prefs.best[m]; delete prefs.best[m]; }
}
if (!CHARACTERS[prefs.character]) prefs.character = FIRST_CHARACTER;

// The current character's look: their preset plus any saved customisation.
const look = () => ({ ...CHARACTERS[prefs.character].look, ...prefs.looks[prefs.character] });
const charName = () => CHARACTERS[prefs.character].name;
const bestKey = () => `${prefs.character}:${prefs.mode}`;

// ---------- renderer / scene ----------
const canvas = document.getElementById('game');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
// MSAA is costly on high-DPI phones and barely visible there.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

let stage, gymnast;
let tierNow = null;
function disposeScene() {
  scene.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) { m.map?.dispose(); m.dispose(); }
  });
  if (scene.background?.isTexture) scene.background.dispose();
  scene.clear();
}
function buildWorld() {
  disposeScene();
  const L = look();
  stage = buildStage(scene, L);
  gymnast = new Gymnast(scene, L);
  if (tierNow) { stage.setShadowSize(tierNow.shadows || 512); stage.key.castShadow = tierNow.shadows > 0; }
}
buildWorld();

function applyTier(t) {
  tierNow = t;
  renderer.setPixelRatio(Math.min(t.pixelRatio, devicePixelRatio));
  stage.setShadowSize(t.shadows || 512);
  stage.key.castShadow = t.shadows > 0;
  resize();
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
const quality = new Quality(applyTier, { start: isTouch ? 1 : 0, mode: 'auto' });
quality.setMode(prefs.gfx);

// ---------- capture mode (scripted, frame-by-frame recording) ----------
// ?capture runs the game on a simulated clock driven by flipflop.capture.step()
// so a headless browser can record perfectly smooth footage.
const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
let simNow = 0;
const simTimers = [];
function later(fn, ms) {
  if (CAPTURE) simTimers.push({ at: simNow + ms, fn });
  else setTimeout(fn, ms);
}

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
let flopped = false, flopAt = 0;
let lastPop = -1, lastBlock = -1, lastLand = -1;

function newRun() {
  ragdoll = new Ragdoll({ springFloor: prefs.mode === 'spring', scale: look().scale ?? 1 });
  tracker = new SkillTracker(onEvent);
  tracker.reset(ragdoll);
  gymnast.braids.reset();
  flopped = false;
  lastPop = lastBlock = lastLand = -1;
  ui.flop.hidden = true;
  ui.combo.classList.remove('on');
  ui.toast.innerHTML = '';
  camX = 0;
  updateHud();
}

const hudCache = {};
function setText(el, v) {
  if (hudCache[el.id] !== v) { hudCache[el.id] = v; el.textContent = v; }
}
function updateHud() {
  setText(ui.score, String((tracker?.score ?? 0) + (tracker?.comboPoints ?? 0)));
  setText(ui.best, String(prefs.best[bestKey()] || 0));
  setText(ui.dist, `${(tracker?.distance ?? 0).toFixed(1)}m`);
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
    later(() => ui.combo.classList.remove('on'), 900);
  } else if (type === 'flop') {
    flopped = true;
    flopAt = performance.now();
    sfx.flop();
    input.rumble(1, 350);
    const best = prefs.best[bestKey()] || 0;
    const isBest = d.score > best;
    if (isBest) { prefs.best[bestKey()] = d.score; save(); }
    $('flopWhy').textContent = `${charName()} — ${PART_NAMES[d.part] || 'Wipeout!'}`;
    $('runScore').textContent = d.score;
    $('runSkills').textContent = d.skills;
    $('runDist').textContent = `${d.distance.toFixed(1)}m`;
    $('newBest').hidden = !isBest || d.score === 0;
    later(() => { if (flopped) ui.flop.hidden = false; }, 1100);
  }
  updateHud();
}

// ---------- UI wiring ----------
if (isTouch) document.body.classList.add('touch');
input.bindTouch(document.getElementById('controls'));
input.on((type, v) => {
  if (type === 'pad') {
    ui.padBadge.hidden = !v;
    if (v) showTab('pad');
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

// Help tabs: phone / controller / keyboard, preselected for this device.
const tabs = [...document.querySelectorAll('[data-tab]')];
function showTab(name) {
  for (const t of tabs) t.setAttribute('aria-selected', String(t.dataset.tab === name));
  for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== name;
}
for (const t of tabs) t.addEventListener('click', () => showTab(t.dataset.tab));
showTab(isTouch ? 'phone' : 'kb');
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
const LOOK_SELECTS = { optHairStyle: 'hairStyle', optUniformStyle: 'uniformStyle', optShoes: 'shoes' };
const LOOK_TOGGLES = { optBow: 'bow', optPoms: 'poms', optBraces: 'braces' };
const setLook = (k, v) => { prefs.looks[prefs.character] = { ...prefs.looks[prefs.character], [k]: v }; lookChanged(); };

function syncCharacter() {
  for (const b of document.querySelectorAll('[data-char]')) b.setAttribute('aria-pressed', String(b.dataset.char === prefs.character));
  $('charName').textContent = charName();
  const L = look();
  $('btnChar').style.setProperty('--c-uniform', L.uniform);
  $('btnChar').style.setProperty('--c-trim', L.trim);
  $('setTitle').textContent = `Customize ${charName()}`;
}
function syncSettings() {
  const L = look();
  $('optMode').value = prefs.mode;
  $('optGfx').value = prefs.gfx;
  $('optLetter').value = L.letter;
  $('optTeam').value = L.team;
  for (const [id, k] of Object.entries(LOOK_FIELDS)) $(id).value = L[k];
  for (const [id, k] of Object.entries(LOOK_SELECTS)) $(id).value = L[k];
  for (const [id, k] of Object.entries(LOOK_TOGGLES)) $(id).checked = !!L[k];
  $('optHeight').value = L.scale ?? 1;
  $('heightLabel').textContent = feetInches(L.scale ?? 1);
  syncCharacter();
}
let rebuildTimer = 0;
function lookChanged() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => { save(); buildWorld(); newRun(); }, 150);
}
function pickCharacter(id) {
  if (!CHARACTERS[id] || id === prefs.character) return;
  prefs.character = id;
  save();
  syncSettings();
  buildWorld();
  newRun();
}
for (const b of document.querySelectorAll('[data-char]')) b.addEventListener('click', () => pickCharacter(b.dataset.char));
// Character cards show each cheerleader's colours.
for (const card of document.querySelectorAll('[data-char]')) {
  const L = { ...CHARACTERS[card.dataset.char].look };
  card.style.setProperty('--c-uniform', L.uniform);
  card.style.setProperty('--c-trim', L.trim);
  card.style.setProperty('--c-skin', L.skin);
  card.style.setProperty('--c-hair', L.hair);
}
$('btnChar').addEventListener('click', () => { syncSettings(); openPanel(ui.settings); });
$('optMode').addEventListener('change', (e) => { prefs.mode = e.target.value; save(); newRun(); });
$('optGfx').addEventListener('change', (e) => { prefs.gfx = e.target.value; save(); quality.setMode(prefs.gfx); });
$('optLetter').addEventListener('input', (e) => setLook('letter', e.target.value.toUpperCase()));
$('optTeam').addEventListener('input', (e) => setLook('team', e.target.value.toUpperCase()));
for (const [id, k] of Object.entries(LOOK_FIELDS)) $(id).addEventListener('input', (e) => setLook(k, e.target.value));
for (const [id, k] of Object.entries(LOOK_SELECTS)) $(id).addEventListener('change', (e) => setLook(k, e.target.value));
for (const [id, k] of Object.entries(LOOK_TOGGLES)) $(id).addEventListener('change', (e) => setLook(k, e.target.checked));
$('optHeight').addEventListener('input', (e) => {
  $('heightLabel').textContent = feetInches(+e.target.value);
  setLook('scale', +e.target.value);
});
$('btnResetLook').addEventListener('click', () => { delete prefs.looks[prefs.character]; syncSettings(); lookChanged(); });
syncCharacter();

// ---------- FPS meter (F key or ?fps) ----------
let fpsEl = null, fpsShown = 0;
function toggleFps() {
  if (fpsEl) { fpsEl.remove(); fpsEl = null; return; }
  fpsEl = document.createElement('div');
  fpsEl.id = 'fps';
  document.body.append(fpsEl);
}
if (params.has('fps')) toggleFps();
addEventListener('keydown', (e) => { if (e.code === 'KeyF' && !(e.target instanceof HTMLInputElement)) toggleFps(); });

// ---------- main loop ----------
let camX = 0, camY = 0.85;
const view = { zoom: 1, manual: false };
let acc = 0;
let last = CAPTURE ? 0 : performance.now();
const clock0 = last;

function frame(now) {
  if (!CAPTURE) requestAnimationFrame(frame);
  const rawMs = now - last;
  const dt = Math.min(0.1, rawMs / 1000);
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
  for (const b of ui.keys) {
    const on = keys[b.dataset.key];
    if (b._on !== on) { b._on = on; b.classList.toggle('on', on); }
  }

  const paused = !ui.help.hidden || !ui.settings.hidden;
  if (!paused) {
    acc += dt;
    // Never run more than 6 physics steps in one frame: on a slow frame the
    // game briefly runs in slow motion instead of spiralling into more lag.
    let steps = 0;
    // Capture mode runs an exact number of steps per frame (deterministic).
    if (CAPTURE) { acc = 0; for (let n = Math.round(dt / STEP); n > 0; n--) { ragdoll.step(keys); tracker.update(ragdoll, keys); } }
    while (acc >= STEP && steps < 6) {
      ragdoll.step(keys);
      tracker.update(ragdoll, keys);
      acc -= STEP;
      steps++;
    }
    if (steps === 6) acc = Math.min(acc, STEP);
  } else {
    acc = 0;
  }

  // sound cues from the physics
  if (ragdoll.lastPop !== lastPop) { lastPop = ragdoll.lastPop; if (lastPop > 0) sfx.whoosh(); }
  if (ragdoll.lastBlock !== lastBlock) { lastBlock = ragdoll.lastBlock; if (lastBlock > 0) sfx.whoosh(); }
  if (ragdoll.landT !== lastLand) { lastLand = ragdoll.landT; if (lastLand > 0) sfx.thump(); }

  updateHud();

  gymnast.update(ragdoll.pose(), ragdoll.angle('hip'), paused ? 0 : dt);

  // camera: follow the centre of mass, from slightly in front of her
  const c = ragdoll.com();
  const portrait = camera.aspect < 1;
  const k = 1 - Math.exp(-dt * (portrait ? 6 : 4));
  camX += (c.x - 0.25 - camX) * k;
  camY += (0.8 + Math.max(0, c.y - 1.0) * 0.6 - camY) * k;
  // Portrait phones get a wider lens so tumbling stays in frame without
  // shrinking her down to a speck.
  const fov = portrait ? 38 + 22 * Math.min(1, (1 - camera.aspect) / 0.5) : 38;
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const dist = (portrait ? 3.4 + 1.6 * camera.aspect : 4.0) * view.zoom;
  if (!view.manual) {
    camera.position.set(camX + dist * 0.33, camY + (portrait ? 0.6 : 0.45), dist);
    camera.lookAt(camX, camY + (portrait ? 0.1 : 0), 0);
  }

  stage.update((now - clock0) / 1000, camX, dt);
  renderer.render(scene, camera);

  if (!CAPTURE) quality.frame(rawMs);
  if (fpsEl && now - fpsShown > 500) {
    fpsShown = now;
    fpsEl.textContent = `${quality.fps} fps · ${TIERS[quality.tier].name}`;
  }
}

newRun();
if (CAPTURE) {
  prefs.seenHelp = true;
  quality.setMode('high');
  const anims = new Map();
  window.flipflop_capture = {
    // Advance the game by dt seconds with the given keys ("qwop" subset).
    step(keys, dt = 1 / 30) {
      input.override = keys;
      simNow += dt * 1000;
      for (let i = simTimers.length - 1; i >= 0; i--) {
        if (simTimers[i].at <= simNow) { const t = simTimers.splice(i, 1)[0]; t.fn(); }
      }
      frame(simNow);
      // drive CSS animations from the simulated clock too
      for (const a of document.getAnimations()) {
        if (!anims.has(a)) anims.set(a, simNow);
        a.pause();
        a.currentTime = simNow - anims.get(a);
      }
      return { handsDown: ragdoll.handsDown, feetDown: ragdoll.feetDown, flopped };
    },
  };
} else {
  if (!prefs.seenHelp) openPanel(ui.help);
  requestAnimationFrame(frame);
}

// Handy for debugging in the console.
window.flipflop = { get ragdoll() { return ragdoll; }, get tracker() { return tracker; }, input, newRun, view, camera, quality, renderer, pickCharacter };
