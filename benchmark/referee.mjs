// DTG Table benchmark referee. FIXED: do not change this file to make a result look better. A change here changes
// every number; record a new baseline in its own PR and say why. It imports nothing from ../src, so a change to the
// tool cannot change how the tool is judged. It uses the engine's colour maths only (sRGB, CIELAB, CIEDE2000).
//
// The print it simulates (model only until printed targets are measured):
//   - white prints as a halftone of full white; under it the substrate is a Yule–Nielsen mix (n = 1.7 by default,
//     the engine's calibration default for screen ink, "default, verify" for DTG white) of white ink and garment.
//     The tool's own default model is the plain mix (n = 1): the referee's n stresses that assumption on purpose;
//   - highlight white adds to the underbase's area, up to full;
//   - the colour file c is separated by the RIP for full white: transparent filters c / w, applied to whatever
//     substrate is there, mixed with the bare substrate by the colour alpha.
// Objectives (lower is better):
//   dE_mean, dE_p95   CIEDE2000 between the simulated print and the art over the garment (art pixels only)
//   white_in2         white ink as full-coverage square inches, at a print width of PRINT_WIDTH_IN
//   banding           99th percentile of the extra lightness step between neighbouring pixels: how much more the
//                     print jumps than the art does (L* units), over art pixels
import { S2L, lab2lin, lin2lab, de2000 } from "../src/vendor/separation-table/engine.js";

export const REFEREE = { version: 1, n: 1.7, whiteLab: [96, 0, 1.5], printWidthIn: 12 };

export function score({ art, colour, W, H, garmentLab, underbase, highlight, colorAlpha, n = REFEREE.n, whiteLab = REFEREE.whiteLab, printWidthIn = REFEREE.printWidthIn }) {
  const P = W * H, g = lab2lin(...garmentLab).map(v => Math.max(0, v)), w = lab2lin(...whiteLab).map(v => Math.max(1e-6, v));
  const gn = g.map(v => Math.pow(v, 1 / n)), wn = w.map(v => Math.pow(v, 1 / n));
  const Lp = new Float32Array(P), La = new Float32Array(P), des = [];
  let white = 0;
  for (let p = 0; p < P; p++) {
    const a = art[p * 4 + 3] / 255, u = Math.min(1, underbase[p] + highlight[p]), c = colorAlpha[p]; white += u;
    const pr = [0, 0, 0], tg = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const s = Math.pow(u * wn[k] + (1 - u) * gn[k], n), f = Math.min(1, S2L[colour[p * 4 + k]] / w[k]);
      pr[k] = c * s * f + (1 - c) * s; tg[k] = a * S2L[art[p * 4 + k]] + (1 - a) * g[k];
    }
    const lp = lin2lab(...pr), lt = lin2lab(...tg); Lp[p] = lp[0]; La[p] = lt[0];
    if (a > 0) des.push(de2000(...lp, ...lt));
  }
  const band = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x; if (art[p * 4 + 3] === 0) continue;
    if (x + 1 < W && art[(p + 1) * 4 + 3] > 0) band.push(Math.max(0, Math.abs(Lp[p + 1] - Lp[p]) - Math.abs(La[p + 1] - La[p])));
    if (y + 1 < H && art[(p + W) * 4 + 3] > 0) band.push(Math.max(0, Math.abs(Lp[p + W] - Lp[p]) - Math.abs(La[p + W] - La[p])));
  }
  const q = (arr, f) => { if (!arr.length) return 0; arr.sort((x, y) => x - y); return arr[Math.min(arr.length - 1, Math.floor(f * arr.length))]; };
  const mean = des.length ? des.reduce((s, v) => s + v, 0) / des.length : 0, areaIn2 = printWidthIn * printWidthIn * H / W;
  return { dE_mean: mean, dE_p95: q(des, 0.95), white_in2: white / P * areaIn2, banding: q(band, 0.99) };
}
