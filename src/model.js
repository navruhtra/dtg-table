// @ts-check
// DTG Table: the white ink model, shared by the white rule, colour compensation and the proof.
// White printed at nominal coverage u lightens the garment toward the white ink's drawdown. The mix is Yule–Nielsen
// (the same form the Separation Table's calibration fits): s = (a·w^(1/n) + (1 − a)·g^(1/n))^n per linear RGB
// channel, where a = curve(u) is the effective area (dot gain) and n the Yule–Nielsen factor. With n = 1 and no curve
// this is the plain area mix the first DTG module assumed. A measured white ramp (ramps.js) sets n, the curve and w.
import { lab2lin } from "./vendor/separation-table/engine.js";

export const WHITE_INK_LAB = /** @type {[number, number, number]} */ ([96, 0, 1.5]);
const TINTS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

/** @typedef {{ whiteLab: number[], w: number[], n: number, curve: number[] | null, source: string }} WhiteModel */

/** @param {{ whiteLab?: number[], n?: number, curve?: number[] | null, source?: string }} [o] @returns {WhiteModel} */
export function makeWhiteModel({ whiteLab = WHITE_INK_LAB, n = 1, curve = null, source = "default (model only)" } = {}) {
  if (curve && curve.length !== 11) throw new Error("the white curve has 11 points (0, 10, … 100 %)");
  if (!(n >= 1 && n <= 4)) throw new Error("Yule–Nielsen n must be 1–4");
  return { whiteLab: [...whiteLab], w: lab2lin(whiteLab[0], whiteLab[1], whiteLab[2]).map(v => Math.max(1e-6, v)), n, curve: curve ? [...curve] : null, source };
}
export const DEFAULT_MODEL = makeWhiteModel();

/** Effective area of white at nominal coverage u (0..1), from the measured curve (piecewise linear). */
export function effArea(m, u) {
  if (u <= 0) return 0; if (u >= 1) return m.curve ? m.curve[10] : 1; if (!m.curve) return u;
  const i = Math.min(9, Math.floor(u * 10)), t = (u - TINTS[i]) / 0.1; return m.curve[i] + (m.curve[i + 1] - m.curve[i]) * t;
}
/** Linear RGB of the substrate (garment g, linear RGB) under white at nominal coverage u. */
export function substrate(m, g, u, out = [0, 0, 0]) {
  const a = effArea(m, u), n = m.n;
  for (let k = 0; k < 3; k++) {
    const gk = Math.max(0, g[k]), wk = m.w[k];
    out[k] = n === 1 ? gk + (wk - gk) * a : Math.pow(a * Math.pow(wk, 1 / n) + (1 - a) * Math.pow(gk, 1 / n), n);
  }
  return out;
}
/** Least nominal white coverage u that makes target t (linear RGB) reachable on garment g with transparent inks:
    substrate(u) ≥ t in every channel. Each channel's substrate is monotone in u: rising where the white is lighter
    than the garment (a lower bound on u), falling where the garment is lighter than the white in that channel (a vivid
    shirt: an upper bound). The answer is the least u inside every bound; when the bounds conflict (or even full
    white is not enough), the u with the smallest worst shortfall. */
export function leastWhite(m, g, t) {
  const s0 = substrate(m, g, 0), s1 = substrate(m, g, 1), sv = [0, 0, 0];
  let lo = 0, hi = 1;
  for (let k = 0; k < 3; k++) {
    const ok0 = t[k] <= s0[k] + 1e-9, ok1 = t[k] <= s1[k] + 1e-9;
    if (ok0 && ok1) continue;
    if (!ok0 && !ok1) { lo = 2; break; } // unreachable in this channel at any u
    // the crossing point u* where substrate_k(u*) = t_k: closed form for the plain model, bisection otherwise
    let a = 0, b = 1;
    if (m.n === 1 && !m.curve) { const gk = Math.max(0, g[k]), x = (t[k] - gk) / (m.w[k] - gk); a = b = Math.min(1, Math.max(0, x)); }
    else for (let i = 0; i < 40; i++) { const mid = (a + b) / 2, v = substrate(m, g, mid, sv)[k]; if ((v >= t[k]) === ok1) b = mid; else a = mid; }
    if (ok1) lo = Math.max(lo, b); else hi = Math.min(hi, a);
  }
  if (lo <= hi) return lo;
  // conflict: minimise the worst shortfall (max of one rising and one falling function: unimodal)
  const worst = u => { substrate(m, g, u, sv); let w = 0; for (let k = 0; k < 3; k++) w = Math.max(w, t[k] - sv[k]); return w; };
  let a = 0, b = 1; for (let i = 0; i < 60; i++) { const x1 = a + (b - a) / 3, x2 = b - (b - a) / 3; if (worst(x1) <= worst(x2)) b = x2; else a = x1; }
  return (a + b) / 2;
}
