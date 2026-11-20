// DTG Table: white model and measured ramps. Run: node tests/ramps.mjs
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
if (!existsSync(fileURLToPath(new URL("../src/vendor/separation-table/vendor/quickhull.js", import.meta.url)))) { console.error("Run: npm run setup"); process.exit(2); }
const E = await import("../src/vendor/separation-table/engine.js");
const Mo = await import("../src/model.js");
const { readRamps, rampReport } = await import("../src/ramps.js");
const { whiteNeed } = await import("../src/white.js");

let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const BLACK = E.rgb2lab(26, 26, 28), RED = E.rgb2lab(179, 32, 42), lin = l => E.lab2lin(...l).map(v => Math.max(0, v));

// the plain model against the closed form max over channels of (t − g)/(w − g), on garments darker than the white in
// every channel (where that closed form is exact)
let same = true, tested = 0; const wl = Mo.DEFAULT_MODEL.w;
for (let i = 0; i < 3000; i++) { const t = E.lab2lin(...E.rgb2lab(Math.random() * 255, Math.random() * 255, Math.random() * 255)), gr = lin(E.rgb2lab(Math.random() * 230, Math.random() * 230, Math.random() * 230));
  if (gr.some((v, k) => v >= wl[k])) continue; tested++;
  let cf = 0; for (let k = 0; k < 3; k++) if (t[k] > gr[k]) cf = Math.max(cf, (t[k] - gr[k]) / (wl[k] - gr[k]));
  if (Math.abs(Math.min(1, cf) - Mo.leastWhite(Mo.DEFAULT_MODEL, gr, t)) > 1e-6) same = false; }
ok(same && tested > 1000, `leastWhite on the plain model equals the closed form on garments darker than the white (${tested} pairs)`);
// a vivid shirt brighter than the white ink in blue: more white darkens blue, so blue bounds the white from above
const vivid = lin(E.rgb2lab(205, 80, 254)), tv = E.lab2lin(...E.rgb2lab(49, 193, 254)), uv = Mo.leastWhite(Mo.DEFAULT_MODEL, vivid, tv);
const worstAt = u => { const s = Mo.substrate(Mo.DEFAULT_MODEL, vivid, u); return Math.max(...[0, 1, 2].map(k => tv[k] - s[k])); };
ok(uv > 0 && uv < 1 && [0, 1, uv - 0.05, uv + 0.05].every(u => worstAt(uv) <= worstAt(u) + 1e-9), `vivid shirt: a compromise white (${uv.toFixed(3)}, worst shortfall ${worstAt(uv).toFixed(3)} vs ${worstAt(1).toFixed(3)} at full white)`);
let pr = true; for (let i = 0; i < 2000; i++) { const t = E.rgb2lab(Math.random() * 255, Math.random() * 255, Math.random() * 255), g = E.rgb2lab(Math.random() * 255, Math.random() * 255, Math.random() * 255), v = whiteNeed(t, g); if (!(v >= 0 && v <= 1)) pr = false; }
ok(pr, "white need in 0..1 on any garment (2000 random pairs, vivid shirts included)");

const yn = Mo.makeWhiteModel({ n: 1.8 }), g = lin(BLACK), half = Mo.substrate(yn, g, 0.5), halfPlain = Mo.substrate(Mo.DEFAULT_MODEL, g, 0.5);
ok(half.every((v, k) => v < halfPlain[k]), "Yule–Nielsen n > 1: half white is darker than the plain area mix");
ok(Mo.substrate(yn, g, 1).every((v, k) => Math.abs(v - yn.w[k]) < 1e-9) && Mo.substrate(yn, g, 0).every((v, k) => Math.abs(v - g[k]) < 1e-9), "end points: no white = garment, full white = white ink");
const tRed = E.lab2lin(...E.rgb2lab(200, 40, 40)); ok(Mo.leastWhite(yn, g, tRed) > Mo.leastWhite(Mo.DEFAULT_MODEL, g, tRed), `n 1.8 needs more white for red on black (${Mo.leastWhite(Mo.DEFAULT_MODEL, g, tRed).toFixed(3)} → ${Mo.leastWhite(yn, g, tRed).toFixed(3)})`);
let threw = false; try { Mo.makeWhiteModel({ curve: [0, 1] }); } catch { threw = true; } ok(threw, "a curve without 11 points is refused");

// synthetic ramp from a known model: n 1.8, dot gain (curve = u^0.7)
const truth = Mo.makeWhiteModel({ whiteLab: [93, -0.5, 2], n: 1.8, curve: Array.from({ length: 11 }, (_, i) => Math.pow(i / 10, 0.7)) });
const rowsFor = (ink, m, gar) => Array.from({ length: 11 }, (_, i) => { const l = E.lin2lab(...Mo.substrate(m, lin(gar), i / 10)); return `${ink},${i * 10},${l.map(v => v.toFixed(2)).join(",")}`; });
const csv = ["ink,tint,L,a,b", `_shirt,0,${BLACK.map(v => v.toFixed(2)).join(",")}`, ...rowsFor("W", truth, BLACK).slice(1),
  ...rowsFor("W@heavy", Mo.makeWhiteModel({ whiteLab: [95, 0, 1], n: 1.8, curve: Array.from({ length: 11 }, (_, i) => Math.pow(i / 10, 0.5)) }), BLACK),
  "C,0,95,0,1.5", "C,50,72,-20,-25", "C,100,55,-37,-50"].join("\n");
const r = readRamps(csv);
ok(Object.keys(r.white).sort().join() === "heavy,standard", "two white sets: standard and heavy (pretreat variation)");
const fm = r.white.standard.model;
ok(Math.abs(fm.n - 1.8) <= 0.15, `fitted n ${fm.n} (truth 1.8)`);
ok(Math.abs(fm.whiteLab[0] - 93) < 0.01, "white drawdown from the 100 % patch");
const maxCurveErr = Math.max(...fm.curve.map((v, i) => Math.abs(v - truth.curve[i]))); ok(maxCurveErr < 0.05, `fitted curve within 0.05 of truth (max ${maxCurveErr.toFixed(3)})`);
const errs = []; for (let i = 0; i <= 20; i++) { const u = i / 20, a = E.lin2lab(...Mo.substrate(fm, lin(BLACK), u)), b = E.lin2lab(...Mo.substrate(truth, lin(BLACK), u)); errs.push(E.de2000(...a, ...b)); }
ok(Math.max(...errs) < 1, `fitted model reproduces the ramp within 1 ΔE00 (max ${Math.max(...errs).toFixed(2)})`);
ok(r.white.heavy.model.curve[5] > fm.curve[5], `heavy set: more effective white at 50 % (${r.white.heavy.model.curve[5]} vs ${fm.curve[5]})`);
ok(r.colour && r.colour.inks.C && r.colour.inks.C.curve.length === 11, "colour ramp fitted with the engine's calibration");
ok(Math.abs(whiteNeed(RED, BLACK, { model: fm }) - Mo.leastWhite(fm, lin(BLACK), E.lab2lin(...RED))) < 1e-9, "the white rule uses a measured model when given one");
// transfer: the black-shirt fit applied to a navy shirt stays in 0..1 and needs no more white than on black
const NAVY = E.rgb2lab(31, 42, 68); let tr = true;
for (let i = 0; i < 300; i++) { const t = E.rgb2lab(Math.random() * 255, Math.random() * 255, Math.random() * 255), a = whiteNeed(t, NAVY, { model: fm }), b = whiteNeed(t, BLACK, { model: fm }); if (!(a >= 0 && a <= 1) || a > b + 1e-6) tr = false; }
ok(tr, "black-shirt fit on a navy shirt: needs in 0..1, never more than on black (300 colours)");
ok(rampReport(r).length === 3 && /White standard/.test(rampReport(r)[0]), rampReport(r)[0]);
threw = false; try { readRamps("W,50,60,0,0"); } catch { threw = true; } ok(threw, "a white ramp without its 0 and 100 % patches is refused");

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
