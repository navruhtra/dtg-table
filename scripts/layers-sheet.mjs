// Render one art file's DTG layers side by side, to look at them: art on the garment | colour layer (knocked-out
// alpha) | white underbase | highlight white | knockout | garment proof (model only). White ink shows as white on a
// dark grey ground.
//   node scripts/layers-sheet.mjs <art.png> <garment #rrggbb> <out.png> [rule=reach|screen|full] [chokePx] [compensate=0|1]
import { readFileSync, writeFileSync } from "node:fs";
import { decodePNG, encodePNG } from "../src/vendor/separation-table/cli/platform.mjs";
import { rgb2lab, hex2rgb } from "../src/vendor/separation-table/engine.js";
import { buildWhiteLayers } from "../src/white.js";
import { compensateColour } from "../src/layers.js";
import { garmentProof } from "../src/proof.js";

const [art, hex = "#111111", out = "layers.png", rule = "reach", choke = "0", comp = "0"] = process.argv.slice(2);
if (!art) { console.error("usage: node scripts/layers-sheet.mjs <art.png> <garment #rrggbb> <out.png> [rule] [chokePx] [compensate]"); process.exit(2); }
const { rgba, W, H } = decodePNG(readFileSync(art)), P = W * H, g = hex2rgb(hex), garmentLab = rgb2lab(...g);
const lab = new Float32Array(P * 3), alpha = new Uint8Array(P);
for (let p = 0; p < P; p++) { lab.set(rgb2lab(rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2]), p * 3); alpha[p] = rgba[p * 4 + 3]; }
const r = buildWhiteLayers({ lab, alpha, W, H, garmentLab, opts: { rule, chokePx: +choke } });
const colour = comp === "1" ? compensateColour(rgba, r, garmentLab) : rgba;
const proof = garmentProof({ rgba, colour, W, H, garmentLab, layers: r, stride: 2 });
const panels = 6, gap = 8, SW = W * panels + gap * (panels - 1), sheet = new Uint8ClampedArray(SW * H * 4).fill(255);
const put = (i, x, y, c) => { const q = (y * SW + i * (W + gap) + x) * 4; sheet[q] = c[0]; sheet[q + 1] = c[1]; sheet[q + 2] = c[2]; sheet[q + 3] = 255; };
const mix = (a, b, t) => [0, 1, 2].map(k => a[k] * (1 - t) + b[k] * t), ground = [40, 40, 40], koC = [230, 60, 160];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = y * W + x, c = [rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2]], a = alpha[p] / 255, cc = [colour[p * 4], colour[p * 4 + 1], colour[p * 4 + 2]];
  put(0, x, y, mix(g, c, a));
  put(1, x, y, mix(g, cc, r.colorAlpha[p]));
  put(2, x, y, mix(ground, [255, 255, 255], r.underbase[p]));
  put(3, x, y, mix(ground, [255, 255, 255], r.highlight[p]));
  put(4, x, y, mix(ground, koC, r.knockout[p] * a));
  put(5, x, y, [proof.rgba[p * 4], proof.rgba[p * 4 + 1], proof.rgba[p * 4 + 2]]);
}
writeFileSync(out, encodePNG(sheet, SW, H));
const s = r.stats, pct = v => (100 * v / s.pixels).toFixed(1) + "%", f2 = v => +v.toFixed(2);
console.log(JSON.stringify({ art: art.split("/").pop(), garment: hex, class: s.garment, rule, chokePx: +choke, compensate: comp === "1", white: pct(s.whiteArea), highlight: pct(s.highlightArea), knocked_out: pct(s.knockedOut),
  proof_dE00_model_only: { mean: f2(proof.stats.meanDE), p95: f2(proof.stats.p95DE) } }));
