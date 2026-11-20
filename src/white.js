// @ts-check
// DTG Table: garment-aware white layers and garment-colour knockout. Pure functions, no DOM.
// The colour maths, the screen-print base rule and the chokes come from the Separation Table engine (imported, not
// copied). Every quality number this module implies is "model only" until printed targets are measured.
import { lab2lin, de2000, baseFraction, adaptiveChoke, softChoke } from "./vendor/separation-table/engine.js";
import { WHITE_INK_LAB, DEFAULT_MODEL, leastWhite, makeWhiteModel } from "./model.js";

/** Default white ink drawdown on a dark garment (CIELAB): the value the engine uses for highlight white in its
    scorers; model only until a shop measures white on black. Defined in model.js. */
export { WHITE_INK_LAB };

const clamp01 = x => x <= 0 ? 0 : x >= 1 ? 1 : x;
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const chroma = lab => Math.hypot(lab[1], lab[2]);

/** A garment is "white" when it is light and nearly neutral. On a white garment the tool prints no white at all:
    every colour the CMYK inks can make is reachable on the bare fabric. */
export function isWhiteGarment(garmentLab, { minL = 88, maxC = 8 } = {}) {
  return garmentLab[0] >= minL && chroma(garmentLab) <= maxC;
}
/** white: no white layer. light: white only where a colour is lighter or brighter than the fabric allows. dark: white
    under most of the art. Used for defaults and reports; the per-pixel amount comes from whiteNeed. */
export function garmentClass(garmentLab) {
  if (isWhiteGarment(garmentLab)) return "white";
  return garmentLab[0] >= 70 ? "light" : "dark";
}

/** The least white (0..1, as area under the colour) a target colour needs on this garment.
    rule "reach" (default): the CMYK inks are transparent and only take light away, so on a substrate with linear
      reflectance s a colour t is reachable only where t ≤ s in every channel. White at fraction w gives
      s = w·white + (1 − w)·garment; the least such w (model.js leastWhite). Colours darker than the fabric in every
      channel need no white (navy on red, black on anything). On a garment brighter than the white ink in a channel
      (a vivid shirt), more white darkens that channel, so it bounds the white from above.
    rule "screen": the screen-print base rule of the engine (lightness plus a chroma boost, baseFraction), ignoring
      the garment colour; for comparison with the Separation Table.
    rule "full": 1 under every colour (the classic RIP default on dark garments).
    With a white model (model.js, e.g. from a measured white ramp), "reach" solves the model instead of the plain mix.
    @param {number[]} tlab @param {number[]} garmentLab
    @param {{ rule?: string, whiteLab?: number[], lo?: number, hi?: number, kC?: number, model?: import("./model.js").WhiteModel }} [opt] */
export function whiteNeed(tlab, garmentLab, { rule = "reach", whiteLab = WHITE_INK_LAB, lo = 20, hi = 75, kC, model } = {}) {
  if (rule === "full") return 1;
  if (rule === "screen") return baseFraction(tlab, 1, { lo, hi, ...(kC !== undefined && { kC }) });
  const g = lab2lin(garmentLab[0], garmentLab[1], garmentLab[2]).map(v => Math.max(0, v)), t = lab2lin(tlab[0], tlab[1], tlab[2]);
  return clamp01(leastWhite(model ?? (whiteLab === WHITE_INK_LAB ? DEFAULT_MODEL : makeWhiteModel({ whiteLab })), g, t));
}

/** Garment-colour knockout: 1 where the art colour is within tol ΔE00 of the garment (the shirt shows through and
    prints as itself, no ink, no white), 0 beyond tol + soft, a smooth ramp between so edges do not step. */
export function knockoutFactor(tlab, garmentLab, { tol = 6, soft = 4 } = {}) {
  const d = de2000(tlab[0], tlab[1], tlab[2], garmentLab[0], garmentLab[1], garmentLab[2]);
  return soft <= 0 ? (d <= tol ? 1 : 0) : 1 - smoothstep(tol, tol + soft, d);
}

/** Choke width in pixels for a choke given in millimetres at the file's resolution. */
export function chokePixels(mm, dpi) { return Math.max(0, Math.round(mm / 25.4 * dpi)); }

/**
 * Build the white layers and the knocked-out colour alpha for one image.
 * @param {{ lab: Float32Array | number[], alpha: Uint8Array | number[] | null, W: number, H: number, garmentLab: number[], opts?: object }} a
 *   lab: CIELAB per pixel (3 per pixel); alpha: 0..255 per pixel, or null for fully opaque art.
 * opts: rule ("reach" | "screen" | "full"), model (a white model, model.js; default the plain mix), strength (white density, 0..1, default 1), whiteLab, minNeed (needs below
 *   this print no white, default 0.02), margin (added to every need that prints, for inks that are not ideal
 *   filters; set it from a measured ramp, default 0), knockout (true), koTol, koSoft, chokePx (default 0), chokeMode ("soft" |
 *   "adaptive"), highlight (true: a second white for near-white art on non-white garments), hlLo, hlHi (L* ramp,
 *   default 80..92), hlMaxC (chroma limit, default 12), hlStrength (default 1), whiteOnWhite (false: force no white on
 *   a white garment).
 * @returns {{ underbase: Float32Array, highlight: Float32Array, colorAlpha: Float32Array, knockout: Float32Array,
 *   stats: { garment: string, pixels: number, artArea: number, whiteArea: number, highlightArea: number, knockedOut: number } }}
 *   All layers are 0..1 per pixel. Areas are sums of coverage in pixels (multiply by the pixel area for ink volume).
 */
export function buildWhiteLayers({ lab, alpha, W, H, garmentLab, opts = {} }) {
  const o = /** @type {any} */ (opts), P = W * H;
  const strength = o.strength ?? 1, minNeed = o.minNeed ?? 0.02, margin = o.margin ?? 0, ko = o.knockout ?? true;
  const cls = garmentClass(garmentLab), noWhite = cls === "white" && !o.whiteOnWhite;
  const hlOn = (o.highlight ?? true) && !noWhite, hlLo = o.hlLo ?? 80, hlHi = o.hlHi ?? 92, hlMaxC = o.hlMaxC ?? 12, hlS = o.hlStrength ?? 1;
  const needOpt = { rule: o.rule ?? "reach", whiteLab: o.whiteLab ?? WHITE_INK_LAB, lo: o.lo, hi: o.hi, kC: o.kC, model: o.model };
  for (const k of ["lo", "hi", "kC", "model"]) if (needOpt[k] === undefined) delete needOpt[k];
  const koOpt = { tol: o.koTol ?? 6, soft: o.koSoft ?? 4 };
  const ub = new Float32Array(P), hl = new Float32Array(P), ca = new Float32Array(P), kf = new Float32Array(P);
  let artArea = 0, knockedOut = 0; const cache = new Map();
  for (let p = 0; p < P; p++) {
    const a = alpha ? alpha[p] / 255 : 1; if (a <= 0) continue;
    const t = [lab[p * 3], lab[p * 3 + 1], lab[p * 3 + 2]];
    // art repeats colours: knockout and need depend on the colour only, so cache them (Lab to 0.01)
    const key = Math.round(t[0] * 100) * 655360000 + Math.round((t[1] + 128) * 100) * 25600 + Math.round((t[2] + 128) * 100);
    let hit = cache.get(key);
    if (!hit) { const kk = ko ? knockoutFactor(t, garmentLab, koOpt) : 0; hit = [kk, noWhite || kk >= 1 ? 0 : whiteNeed(t, garmentLab, needOpt)]; if (cache.size < 1 << 21) cache.set(key, hit); }
    const k = hit[0], c = a * (1 - k);
    kf[p] = k; ca[p] = c; artArea += a; knockedOut += a * k;
    if (noWhite || c <= 0) continue;
    const need = hit[1];
    if (need >= minNeed) ub[p] = c * Math.min(1, need + margin) * strength;
    if (hlOn) hl[p] = c * hlS * smoothstep(hlLo, hlHi, t[0]) * (1 - smoothstep(hlMaxC, hlMaxC + 10, chroma(t)));
  }
  const r = o.chokePx ?? 0;
  const choked = r > 0 ? ((o.chokeMode ?? "soft") === "adaptive" ? adaptiveChoke(ub, W, H, r) : softChoke(ub, W, H, r)) : ub;
  // highlight white sits on top of the underbase and never extends past it, so it takes the same choke
  if (r > 0) for (let p = 0; p < P; p++) hl[p] = Math.min(hl[p], choked[p] > 0 ? 1 : 0);
  let whiteArea = 0, highlightArea = 0; for (let p = 0; p < P; p++) { whiteArea += choked[p]; highlightArea += hl[p]; }
  return { underbase: choked, highlight: hl, colorAlpha: ca, knockout: kf, stats: { garment: cls, pixels: P, artArea, whiteArea, highlightArea, knockedOut } };
}
