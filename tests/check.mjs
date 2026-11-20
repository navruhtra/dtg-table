// DTG Table unit and property tests. Run: node tests/check.mjs (needs the engine's vendor files: npm run setup).
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const qh = fileURLToPath(new URL("../src/vendor/separation-table/vendor/quickhull.js", import.meta.url));
if (!existsSync(qh)) { console.error("The Separation Table engine needs its vendor files. Run: npm run setup"); process.exit(2); }
const E = await import("../src/vendor/separation-table/engine.js");
const W8 = await import("../src/white.js");
const { isWhiteGarment, garmentClass, whiteNeed, knockoutFactor, chokePixels, buildWhiteLayers, WHITE_INK_LAB } = W8;

let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const L = (r, g, b) => E.rgb2lab(r, g, b);
const BLACK = L(20, 20, 22), WHITE = L(245, 245, 243), RED = L(170, 25, 35), HEATHER = L(150, 150, 150), YELLOW = L(240, 210, 40), NAVY = L(25, 30, 70);

// garment classes
ok(isWhiteGarment(WHITE) && garmentClass(WHITE) === "white", "white shirt is white");
ok(garmentClass(BLACK) === "dark" && garmentClass(RED) === "dark" && garmentClass(NAVY) === "dark", "black, red, navy shirts are dark");
ok(garmentClass(YELLOW) === "light" && !isWhiteGarment(YELLOW), "yellow shirt is light, not white");
ok(!isWhiteGarment(L(235, 225, 200)), "natural / cream (chroma > 8) is not white");

// reach rule
ok(Math.abs(whiteNeed(WHITE_INK_LAB, BLACK) - 1) < 1e-9, `white ink colour on black needs full white (${whiteNeed(WHITE_INK_LAB, BLACK).toFixed(3)})`);
ok(whiteNeed(L(5, 5, 5), RED) === 0, "black art on a red shirt needs no white");
ok(whiteNeed(NAVY, RED) > 0, `navy on red needs some white: blue channel is above the red fabric (${whiteNeed(NAVY, RED).toFixed(3)})`);
ok(whiteNeed(L(100, 0, 0), RED) === 0 || whiteNeed(L(120, 10, 15), RED) === 0, "a colour darker than the red shirt in every channel needs no white");
ok(whiteNeed(L(30, 40, 200), YELLOW) > 0.3, `blue on yellow needs white (${whiteNeed(L(30, 40, 200), YELLOW).toFixed(3)})`);
ok(whiteNeed(L(200, 30, 30), WHITE) === 0 && whiteNeed(L(240, 240, 238), WHITE) === 0, "every colour is reachable on a white shirt");
ok(whiteNeed(RED, BLACK, { rule: "full" }) === 1, "rule full: 1 under everything");
ok(Math.abs(whiteNeed(RED, BLACK, { rule: "screen" }) - E.baseFraction(RED, 1)) < 1e-12, "rule screen is the engine's base rule");

// property: white need is in 0..1, and a lighter garment never needs more white than a darker grey (same hue)
let mono = true, range = true;
for (let i = 0; i < 2000; i++) {
  const t = L(Math.random() * 255, Math.random() * 255, Math.random() * 255), g1 = 10 + Math.random() * 200, g2 = g1 + Math.random() * (255 - g1);
  const n1 = whiteNeed(t, L(g1, g1, g1)), n2 = whiteNeed(t, L(g2, g2, g2));
  if (!(n1 >= 0 && n1 <= 1)) range = false; if (n2 > n1 + 1e-9) mono = false;
}
ok(range, "white need stays in 0..1 (2000 random colours)"); ok(mono, "lighter grey garment never needs more white (2000 random pairs)");

// knockout
ok(knockoutFactor(BLACK, BLACK) === 1, "garment colour knocks out fully");
ok(knockoutFactor(L(28, 28, 30), BLACK) > 0.9, `near-black on black knocks out (${knockoutFactor(L(28, 28, 30), BLACK).toFixed(3)})`);
ok(knockoutFactor(RED, BLACK) === 0, "red on black does not knock out");
let kmono = true; for (let v = 20, prev = 1; v < 120; v += 2) { const k = knockoutFactor(L(v, v, v + 2), BLACK); if (k > prev + 1e-12) kmono = false; prev = k; }
ok(kmono, "knockout falls off smoothly as the art moves away from the garment");
ok(knockoutFactor(L(60, 60, 62), BLACK, { tol: 6, soft: 0 }) === 0 && knockoutFactor(BLACK, BLACK, { tol: 6, soft: 0 }) === 1, "soft 0 gives a hard knockout");

ok(chokePixels(0.2, 300) === 2 && chokePixels(0, 300) === 0 && chokePixels(0.5, 600) === 12, "choke mm → px");

// layers on a test image: left half black-on-black (knocked out), right half red, a white 3 px line, transparent border
const W = 40, H = 20, P = W * H, lab = new Float32Array(P * 3), alpha = new Uint8Array(P);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = y * W + x; if (x < 2 || x >= W - 2 || y < 2 || y >= H - 2) continue; alpha[p] = 255;
  lab.set(y >= 9 && y <= 11 && x >= 4 && x < 36 ? WHITE_INK_LAB : x < 20 ? BLACK : RED, p * 3);
}
const onBlack = buildWhiteLayers({ lab, alpha, W, H, garmentLab: BLACK });
const at = (arr, x, y) => arr[y * W + x];
ok(at(onBlack.underbase, 8, 5) === 0 && at(onBlack.colorAlpha, 8, 5) === 0, "black art on a black shirt: no ink, no white (knockout)");
ok(at(onBlack.underbase, 30, 5) > 0.3 && at(onBlack.colorAlpha, 30, 5) === 1, `red on black: colour and the least white that reaches it (${at(onBlack.underbase, 30, 5).toFixed(3)})`);
ok(at(onBlack.underbase, 0, 0) === 0 && at(onBlack.colorAlpha, 0, 0) === 0, "transparent pixels print nothing");
ok(at(onBlack.highlight, 10, 10) > 0.9 && at(onBlack.highlight, 30, 5) === 0, "highlight white under the white line only");
ok(Math.abs(onBlack.stats.knockedOut - (18 * 16 - 3 * 16)) < 1, `knocked-out area counted (${onBlack.stats.knockedOut.toFixed(1)} px)`);

const onWhite = buildWhiteLayers({ lab, alpha, W, H, garmentLab: WHITE });
ok(onWhite.stats.whiteArea === 0 && onWhite.stats.highlightArea === 0, "white shirt: no white at all");
ok(at(onWhite.colorAlpha, 8, 5) === 1, "black art on a white shirt prints");
const forced = buildWhiteLayers({ lab, alpha, W, H, garmentLab: WHITE, opts: { whiteOnWhite: true, rule: "full" } });
ok(forced.stats.whiteArea > 0, "whiteOnWhite forces white on a white shirt");

const half = buildWhiteLayers({ lab, alpha, W, H, garmentLab: BLACK, opts: { strength: 0.5 } });
ok(Math.abs(half.stats.whiteArea - onBlack.stats.whiteArea / 2) < 1e-3, "strength scales the white linearly");
const mg = buildWhiteLayers({ lab, alpha, W, H, garmentLab: BLACK, opts: { margin: 0.2 } });
ok(Math.abs(at(mg.underbase, 30, 5) - Math.min(1, at(onBlack.underbase, 30, 5) + 0.2)) < 1e-6 && at(mg.underbase, 8, 5) === 0, "margin adds white where white prints, not under knocked-out art");
const noKo = buildWhiteLayers({ lab, alpha, W, H, garmentLab: BLACK, opts: { knockout: false, rule: "full" } });
ok(at(noKo.underbase, 8, 5) === 1 && at(noKo.colorAlpha, 8, 5) === 1, "knockout off + rule full: white under the black too");

// choke: the red block shrinks by r px on each open side; the 1 px white line keeps its base (adaptive choke)
const ch = buildWhiteLayers({ lab, alpha, W, H, garmentLab: BLACK, opts: { chokePx: 2, chokeMode: "adaptive" } });
ok(at(ch.underbase, 37, 5) === 0 && at(ch.underbase, 35, 5) > 0.3 && at(onBlack.underbase, 37, 5) > 0.3, "choke pulls the base 2 px in from the edge");
ok(ch.stats.whiteArea < onBlack.stats.whiteArea, `choke reduces white (${onBlack.stats.whiteArea.toFixed(1)} → ${ch.stats.whiteArea.toFixed(1)} px)`);
ok(at(ch.underbase, 10, 10) > 0.5, "3 px white line over the knocked-out black keeps a 1 px base under the 2 px adaptive choke");
ok(ch.underbase.every((v, i) => v <= onBlack.underbase[i] + 1e-6), "choke never adds white");
ok(ch.highlight.every((v, i) => v === 0 || ch.underbase[i] > 0), "highlight white never sits outside the choked base");

// property: layers in 0..1, and colour + knockout account for all art
let lay = true;
for (let trial = 0; trial < 20; trial++) {
  const w = 12, h = 9, n = w * h, lb = new Float32Array(n * 3), al = new Uint8Array(n);
  for (let p = 0; p < n; p++) { lb.set(L(Math.random() * 255, Math.random() * 255, Math.random() * 255), p * 3); al[p] = Math.random() < 0.2 ? 0 : Math.floor(Math.random() * 256); }
  const g = L(Math.random() * 255, Math.random() * 255, Math.random() * 255);
  const r = buildWhiteLayers({ lab: lb, alpha: al, W: w, H: h, garmentLab: g, opts: { chokePx: trial % 3 } });
  for (let p = 0; p < n; p++) {
    const a = al[p] / 255;
    if (!(r.underbase[p] >= 0 && r.underbase[p] <= 1 && r.highlight[p] >= 0 && r.highlight[p] <= 1)) lay = false;
    if (Math.abs(r.colorAlpha[p] + a * r.knockout[p] - a) > 1e-6) lay = false;
    if (r.underbase[p] > r.colorAlpha[p] + 1e-6) lay = false; // no white where no colour prints
  }
}
ok(lay, "random images: layers in 0..1, colour + knockout = art alpha, white only under printed colour");

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
