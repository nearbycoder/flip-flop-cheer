// Records the README media: a scripted gameplay video (MP4 + GIF) and
// screenshots on desktop and phone.
//
//   npm run build && node tools/capture.mjs
//
// Serves dist/ on a temporary local port (or pass a URL to record elsewhere).
// Uses the game's ?capture mode, which runs on a simulated clock so every
// frame is evenly spaced no matter how slowly the headless browser renders.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { preview } from 'vite';
import { demoPolicy } from './demo.mjs';

let server = null;
let BASE = process.argv[2];
if (!BASE) {
  server = await preview({ preview: { port: 4317, host: '127.0.0.1', strictPort: true }, logLevel: 'warn' });
  BASE = 'http://127.0.0.1:4317';
}
BASE = BASE.replace(/\/$/, '');
const OUT = 'docs/media';
const FRAMES = '/tmp/flipflop-frames';
const DEMO = { lean: 0.4, jump: 0.2, qHold: 0.2, pHold: 0, gap: 2.2, gap2: 0.3 };
const FPS = 30;

mkdirSync(OUT, { recursive: true });
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal'],
});

async function open(ctxOpts, query, prefs) {
  const ctx = await browser.newContext(ctxOpts);
  if (prefs) {
    await ctx.addInitScript((p) => { try { localStorage.setItem('flipflop.v1', JSON.stringify(p)); } catch {} }, prefs);
  }
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${BASE}/${query}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}

const step = (page, keys, n = 1) => page.evaluate(([k, n]) => {
  let s;
  for (let i = 0; i < n; i++) s = window.flipflop_capture.step(k, 1 / 30);
  return s;
}, [keys, n]);

// ---------- 1. gameplay video ----------
{
  const { ctx, page } = await open({ viewport: { width: 1280, height: 720 } }, '?capture', { seenHelp: true });
  await page.waitForFunction(() => window.flipflop_capture);
  const policy = demoPolicy(DEMO);
  let state = { handsDown: false };
  let t = 0, frame = 0, flopAt = null;
  for (;;) {
    const k = policy(t, state);
    if (k === null) break;
    state = await step(page, k);
    if (state.flopped && flopAt === null) flopAt = t;
    await page.screenshot({ path: join(FRAMES, `${String(frame).padStart(4, '0')}.png`) });
    frame++;
    t += 1 / FPS;
    if (flopAt !== null && t - flopAt > 3.2) break;
  }
  console.log(`video: ${frame} frames (${(frame / FPS).toFixed(1)}s)`);
  await ctx.close();

  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(FRAMES, '%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-preset', 'slow', '-movflags', '+faststart', join(OUT, 'demo.mp4')]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(FRAMES, '%04d.png'),
    '-vf', 'fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    '-loop', '0', join(OUT, 'demo.gif')]);
  // a few stills straight from the run
  const still = (sec, name) => copyFileSync(join(FRAMES, `${String(Math.round(sec * FPS)).padStart(4, '0')}.png`), join(OUT, name));
  still(2.05, 'tuck.png');
  still((frame - 1) / FPS, 'flop.png');
  globalThis.__frames = frame;
}

// ---------- 2. gymnast close-ups ----------
async function closeup(name, prefs, cam) {
  const { ctx, page } = await open({ viewport: { width: 1000, height: 1000 } }, '?capture', { seenHelp: true, ...prefs });
  await page.waitForFunction(() => window.flipflop_capture);
  await step(page, '', 45); // let the braids settle
  await page.evaluate((c) => {
    for (const id of ['hud', 'controls']) document.getElementById(id).style.display = 'none';
    const cam = window.flipflop.camera;
    window.flipflop.view.manual = true;
    cam.position.set(...c.pos);
    cam.lookAt(...c.at);
  }, cam);
  await step(page, '', 1);
  await page.screenshot({ path: join(OUT, name) });
  await ctx.close();
}
await closeup('gymnast.png', {}, { pos: [1.15, 1.25, 1.6], at: [0.02, 0.88, 0] });
await closeup('face.png', {}, { pos: [0.5, 1.44, 0.42], at: [0, 1.42, 0] });
await closeup('custom.png', {
  look: { uniform: '#6d1427', trim: '#f4f1ea', letter: 'S', highlight: '#e8c38f', boots: '#b07a4f', hair: '#2a1a10', skin: '#a0673f' },
}, { pos: [1.15, 1.25, 1.6], at: [0.02, 0.88, 0] });

// ---------- 3. phone (portrait) ----------
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
{
  const { ctx, page } = await open(phone, '', null); // first visit -> help sheet
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, 'phone-help.png') });
  await page.click('#help .sheet-foot .primary');
  await page.click('#btnSettings');
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, 'phone-customize.png') });
  await ctx.close();
}
{
  const { ctx, page } = await open(phone, '?capture', { seenHelp: true });
  await page.waitForFunction(() => window.flipflop_capture);
  // dip, jump and freeze mid-tuck with the buttons lit up
  await step(page, '', 30);
  await step(page, 'o', 12);
  await step(page, 'pw', 3);
  await step(page, 'q', 7);
  await page.screenshot({ path: join(OUT, 'phone-play.png') });
  await ctx.close();
}

await browser.close();
if (server) await new Promise((r) => server.httpServer.close(r));
console.log('done ->', OUT);
