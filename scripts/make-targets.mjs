// Write the DTG test targets (TARGETS.md) as print-ready PNG files at 300 dpi, plus a CSV template for the readings.
//   node scripts/make-targets.mjs <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodePNG } from "../src/vendor/separation-table/cli/platform.mjs";
import { rgb2lab } from "../src/vendor/separation-table/engine.js";
import { pngWithDpi, whiteLayer, compensateColour } from "../src/layers.js";
import { buildWhiteLayers } from "../src/white.js";
import { GARMENTS } from "../src/garments.js";

const out = process.argv[2]; if (!out) { console.error("usage: node scripts/make-targets.mjs <out-dir>"); process.exit(2); }
mkdirSync(out, { recursive: true });
const DPI = 300, PATCH = 300, GAP = 30, TINTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const save = (name, rgba, W, H) => writeFileSync(join(out, name), pngWithDpi(encodePNG(rgba, W, H), DPI));
const grey = (cov, W, H) => { const g = whiteLayer(cov), d = new Uint8ClampedArray(W * H * 4); for (let p = 0; p < W * H; p++) d.set([g[p], g[p], g[p], 255], p * 4); return d; };
function strip(n) { const W = n * PATCH + (n - 1) * GAP, H = PATCH; return { W, H, rgba: new Uint8ClampedArray(W * H * 4), cov: new Float32Array(W * H) }; }
const each = (s, i, fn) => { for (let y = 0; y < PATCH; y++) for (let x = 0; x < PATCH; x++) fn((y * s.W + i * (PATCH + GAP) + x)); };
const csv = ["# DTG Table readings. One row per patch: ink,tint,L,a,b (D50, 2°, M1 if you can). Fill L,a,b; keep the rest.", "ink,tint,L,a,b", "_shirt,0,,,"];

// A1. White density ramp on black, the RIP making white from alpha: white RGB at alpha 0..100 %.
{ const s = strip(11); TINTS.forEach((t, i) => each(s, i, p => s.rgba.set([255, 255, 255, Math.round(2.55 * t)], p * 4))); save("A1-white-ramp-alpha.png", s.rgba, s.W, s.H); }
// A2. The same through a separate white file: an empty colour file and a grey white layer 0..100 % (ink = black).
{ const s = strip(11); TINTS.forEach((t, i) => each(s, i, p => { s.cov[p] = t / 100; })); save("A2-white-ramp-colour.png", s.rgba, s.W, s.H); save("A2-white-ramp-white.png", grey(s.cov, s.W, s.H), s.W, s.H); }
for (const t of TINTS) csv.push(`W,${t},,,`);
for (const set of ["light", "heavy"]) for (const t of TINTS) csv.push(`W@${set},${t},,,`);

// B. Colour ramps of the RGB file's primaries, for a white shirt (B1) and for black with full white (B2: opaque art).
const RAMPS = { C: [0, 255, 255], M: [255, 0, 255], Y: [255, 255, 0], K: [0, 0, 0], R: [255, 0, 0], G: [0, 255, 0], B: [0, 0, 255] };
{ const names = Object.keys(RAMPS), W = 11 * PATCH + 10 * GAP, H = names.length * (PATCH + GAP) - GAP, d = new Uint8ClampedArray(W * H * 4);
  names.forEach((n, r) => TINTS.forEach((t, i) => { const c = RAMPS[n].map(v => Math.round(255 - (255 - v) * t / 100));
    for (let y = 0; y < PATCH; y++) for (let x = 0; x < PATCH; x++) d.set([...c, 255], ((r * (PATCH + GAP) + y) * W + i * (PATCH + GAP) + x) * 4); }));
  save("B-colour-ramps.png", d, W, H);
  for (const n of names) for (const t of TINTS) csv.push(`${n},${t},,,`); }

// C. Compensation check on black: 8 colours, top row full white + art, bottom row least white + compensated colour.
{ const black = GARMENTS.find(g => g.id === "black"), cols = [[200, 40, 40], [40, 120, 200], [230, 200, 60], [60, 170, 90], [220, 150, 120], [150, 90, 170], [128, 128, 128], [240, 240, 236]];
  const n = cols.length, W = n * PATCH + (n - 1) * GAP, H = 2 * PATCH + GAP, P = W * H, art = new Uint8ClampedArray(P * 4);
  for (let r = 0; r < 2; r++) cols.forEach((c, i) => { for (let y = 0; y < PATCH; y++) for (let x = 0; x < PATCH; x++) art.set([...c, 255], ((r * (PATCH + GAP) + y) * W + i * (PATCH + GAP) + x) * 4); });
  const lab = new Float32Array(P * 3), alpha = new Uint8Array(P); for (let p = 0; p < P; p++) { lab.set(rgb2lab(art[p * 4], art[p * 4 + 1], art[p * 4 + 2]), p * 3); alpha[p] = art[p * 4 + 3]; }
  const full = buildWhiteLayers({ lab, alpha, W, H, garmentLab: black.lab, opts: { rule: "full", knockout: false, highlight: false } });
  const reach = buildWhiteLayers({ lab, alpha, W, H, garmentLab: black.lab, opts: { rule: "reach", knockout: false, highlight: false } });
  const comp = compensateColour(art, reach, black.lab), colour = new Uint8ClampedArray(art), cov = new Float32Array(P);
  for (let p = 0; p < P; p++) { const bottom = ((p / W) | 0) >= PATCH + GAP; if (bottom) colour.set(comp.subarray(p * 4, p * 4 + 4), p * 4); cov[p] = bottom ? reach.underbase[p] : full.underbase[p]; }
  save("C-compensation-colour.png", colour, W, H); save("C-compensation-white.png", grey(cov, W, H), W, H);
  cols.forEach((c, i) => { csv.push(`Cfull${i + 1},100,,,`); csv.push(`Creach${i + 1},100,,,`); }); }

// D. Does the RIP use our white? A grey square; our white file covers its left half only.
{ const W = 2 * PATCH, H = PATCH, d = new Uint8ClampedArray(W * H * 4), cov = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) { d.set([150, 150, 150, 255], p * 4); cov[p] = (p % W) < PATCH ? 1 : 0; }
  save("D-rip-white-colour.png", d, W, H); save("D-rip-white-white.png", grey(cov, W, H), W, H); }

writeFileSync(join(out, "readings.csv"), csv.join("\n") + "\n");
console.log(`Targets written to ${out}: A1, A2, B, C, D (PNG, 300 dpi) and readings.csv (${csv.length - 3} patches).`);
