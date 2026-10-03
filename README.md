# Flip Flop Cheer

A QWOP-style cheer tumbling game built with [Three.js](https://threejs.org) and
[planck.js](https://piqnt.com/planck.js/) (Box2D) physics. You control the
gymnast's hips, arms and legs one key at a time — land back handsprings and
back tucks on your feet, or **FLOP!**

## Controls

| Key | Move | What it does |
| --- | --- | --- |
| **Q** | Tuck | knees to chest, arms to shins |
| **W** | Arch | arms overhead, open hips, lean back |
| **O** | Bend | dip / sit back |
| **P** | Jump | snap legs straight, point toes |

- **Phone / tablet:** big on-screen buttons — slide a thumb between Q↔W or O↔P.
- **Controller:** LB/X = Q · LT/Y = W · RB/A = O · RT/B = P · Start = restart · Back = help
  (sticks work too: left stick up/down = W/Q, right stick up/down = P/O).
- **Keyboard:** Q W O P · R or Space = restart · H = help.

### Skills

- **Back Tuck:** hold O to dip → P+W together to jump → switch to Q to tuck → let go to land.
- **Back Handspring:** hold O, add W and lean back ~½ s → P+W to jump onto your hands →
  tap Q the moment your hands touch → let go to land.
- Chain skills quickly for combo multipliers; stand still to **stick it** and bank the combo.

Two floors: **Spring floor** (assisted, the default) and **Gym floor** (expert).
The gymnast's look (skin, hair, highlights, uniform, trim, boots, jersey letter)
can be customised from the ⚙ menu.

## Development

```bash
npm install
npm run dev      # http://localhost:5173 (also reachable from phones on your Wi-Fi)
npm run build    # production build in dist/
```

`tools/` holds headless Node scripts used to tune the physics, e.g.
`node tools/search.mjs soft tuck` grid-searches key timings and reports how
many land a back tuck.

## Code map

- `src/ragdoll.js` — 2D ragdoll, joint motors, spring-floor assists
- `src/skills.js` — skill recognition, combos, scoring, falls
- `src/character.js`, `src/face.js`, `src/hair.js` — the 3D gymnast, face and verlet braids
- `src/stage.js` — stadium, mat, crowd
- `src/input.js` — keyboard, multi-touch and gamepad input
- `src/main.js` — game loop, camera, UI
