// @ts-check
// DTG Table: garment proof. A forward model of the print, model only until measured ramps replace it:
//   - the white layers lighten the garment toward the white ink's drawdown by the white model (model.js), at
//     u = min(1, underbase + highlight);
//   - the CMYK inks are transparent filters: the RIP separates the colour file c for full white, so the filter is
//     c / w per channel (at most 1), and on any substrate the result is substrate × filter;
//   - colour alpha mixes the inked and bare substrate by area.
// The intended look is the art over the garment by its alpha. ΔE00 between the two is the model's error: gamut
// limits (art lighter than the white ink), white the rule left out, and the knockout tolerance. It is not a
// measurement: with no ink ramp the model is the same one the white rule assumes.
import { lab2lin, lin2lab, lin2s, S2L, de2000 } from "./vendor/separation-table/engine.js";
import { makeWhiteModel, substrate } from "./model.js";

/**
 * rgba: the art (the intended look). colour: the colour file sent to the printer (default: the art itself).
 * @param {{ rgba: Uint8ClampedArray | Uint8Array | number[], colour?: Uint8ClampedArray | Uint8Array | number[], W: number, H: number, garmentLab: number[], layers: { underbase: Float32Array,
 *   highlight: Float32Array, colorAlpha: Float32Array }, model?: import("./model.js").WhiteModel, stride?: number }} a
 * @returns {{ rgba: Uint8ClampedArray, stats: { meanDE: number, p95DE: number, maxDE: number, pixels: number } }}
 */
export function garmentProof({ rgba, colour = rgba, W, H, garmentLab, layers, model = makeWhiteModel(), stride = 1 }) {
  const P = W * H, g = lab2lin(garmentLab[0], garmentLab[1], garmentLab[2]).map(v => Math.max(0, v)), w = model.w;
  const out = new Uint8ClampedArray(P * 4), des = [];
  const s = [0, 0, 0], pr = [0, 0, 0], tg = [0, 0, 0];
  for (let p = 0; p < P; p++) {
    const t = [S2L[rgba[p * 4]], S2L[rgba[p * 4 + 1]], S2L[rgba[p * 4 + 2]]], a = rgba[p * 4 + 3] / 255, tc = [S2L[colour[p * 4]], S2L[colour[p * 4 + 1]], S2L[colour[p * 4 + 2]]];
    const u = Math.min(1, layers.underbase[p] + layers.highlight[p]), c = layers.colorAlpha[p];
    substrate(model, g, u, s);
    for (let k = 0; k < 3; k++) {
      const f = Math.min(1, tc[k] / w[k]);
      pr[k] = c * s[k] * f + (1 - c) * s[k];
      tg[k] = a * t[k] + (1 - a) * g[k];
      out[p * 4 + k] = Math.round(255 * lin2s(pr[k]));
    }
    out[p * 4 + 3] = 255;
    const y = (p / W) | 0, x = p - y * W;
    if (a > 0 && x % stride === 0 && y % stride === 0) { const l1 = lin2lab(pr[0], pr[1], pr[2]), l2 = lin2lab(tg[0], tg[1], tg[2]); des.push(de2000(l1[0], l1[1], l1[2], l2[0], l2[1], l2[2])); }
  }
  des.sort((x, y) => x - y);
  const n = des.length, mean = n ? des.reduce((q, v) => q + v, 0) / n : 0;
  return { rgba: out, stats: { meanDE: mean, p95DE: n ? des[Math.min(n - 1, Math.floor(0.95 * n))] : 0, maxDE: n ? des[n - 1] : 0, pixels: n } };
}
