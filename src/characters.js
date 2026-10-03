// Playable cheerleaders. Each one is a starting look; players can customise
// any of it, and their changes are saved per character.

// Both girls cheer for Broken Arrow: black shell with a metallic gold V-neck
// and side panels, the gold "B" with an arrow through it, Tigers bows.
const BROKEN_ARROW = {
  uniform: '#121214',
  trim: '#d9b44a',
  uniformStyle: 'panels',
  letter: 'B',
  arrow: true,
  team: 'TIGERS',
};

export const CHARACTERS = {
  amyiah: {
    name: "A'myiah",
    look: {
      ...BROKEN_ARROW,
      skin: '#a0673f',
      hair: '#3a2416',
      highlight: '#d9b27a',
      hairStyle: 'braids',   // long box braids with honey-blonde ends
      shoes: 'boots',        // white western boots
      boots: '#f2eee6',
      bow: false,
      poms: false,
      braces: true,
      scale: 1,              // ~4'11"
    },
  },
  lili: {
    name: 'Lili',
    look: {
      ...BROKEN_ARROW,
      skin: '#c48a63',
      hair: '#2a1a12',
      highlight: '#6a4429',
      hairStyle: 'curls',    // long dark curls, half-up under a big bow
      shoes: 'sneakers',     // white cheer sneakers + socks
      boots: '#f6f6f3',
      bow: true,
      poms: true,
      braces: false,
      scale: 0.82,           // she's seven: ~4'0"
    },
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS);
export const FIRST_CHARACTER = 'amyiah';

// Height in metres for a body scale (scale 1 ≈ 1.5 m).
export const heightOf = (scale) => 1.5 * scale;
export function feetInches(scale) {
  const inches = Math.round(heightOf(scale) / 0.0254);
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}
