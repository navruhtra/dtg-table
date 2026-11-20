// DTG Table benchmark. Every number is model only until printed targets are measured (TARGETS.md).
//   node benchmark/run.mjs                 table of every case and config, compared with benchmark/baseline.json
//   node benchmark/run.mjs --gate          exit 2 when the tool's configs are worse than the baseline beyond tolerance
//   node benchmark/run.mjs --update        record a new baseline (on main, after merge, in its own PR)
//   node benchmark/run.mjs --n 1           referee with another Yule–Nielsen n for the white (sensitivity only)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { decodePNG } from "../src/vendor/separation-table/cli/platform.mjs";
import { rgb2lab } from "../src/vendor/separation-table/engine.js";
import { buildWhiteLayers } from "../src/white.js";
import { compensateColour } from "../src/layers.js";
import { makeWhiteModel } from "../src/model.js";
import { score, REFEREE } from "./referee.mjs";

const here = p => fileURLToPath(new URL(p, import.meta.url));
const args = process.argv.slice(2), flag = f => args.includes(f), val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const n = +val("--n", REFEREE.n);
const refereeHash = createHash("sha256").update(readFileSync(here("./referee.mjs"))).digest("hex").slice(0, 16);

// The 15 synthetic test images in test-images/ (from the Separation Table), each on the shirt its case names.
const IMAGES = here("../test-images/");
const CASES = JSON.parse(readFileSync(IMAGES + "cases.json", "utf8")).filter(c => existsSync(IMAGES + c.img + ".png"));

// Configs. "rip-proxy" stands in for a RIP's default on dark garments (full white under every opaque pixel, no
// garment knockout, the art as the colour file). It is a proxy, not Garment Creator 2 or Graphics Lab: the real
// head-to-head compares scans of printed shirts (BENCHMARK.md).
const CONFIGS = {
  "rip-proxy": { opts: { rule: "full", knockout: false, chokePx: 1 }, compensate: false },
  "table-full": { opts: { rule: "full", chokePx: 1 }, compensate: false },
  "table-reach": { opts: { rule: "reach", chokePx: 1 }, compensate: true },
  // the same after a white ramp measured n 1.7 (what the tool does once a shop imports a ramp that says so)
  "reach-n1.7": { opts: { rule: "reach", chokePx: 1, model: makeWhiteModel({ n: 1.7 }) }, compensate: true },
};

const rows = [];
for (const c of CASES) {
  const { rgba, W, H } = decodePNG(readFileSync(IMAGES + c.img + ".png")), P = W * H, garmentLab = rgb2lab(...c.garment);
  const lab = new Float32Array(P * 3), alpha = new Uint8Array(P);
  for (let p = 0; p < P; p++) { lab.set(rgb2lab(rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2]), p * 3); alpha[p] = rgba[p * 4 + 3]; }
  for (const [name, cfg] of Object.entries(CONFIGS)) {
    const L = buildWhiteLayers({ lab, alpha, W, H, garmentLab, opts: cfg.opts });
    const colour = cfg.compensate ? compensateColour(rgba, L, garmentLab, cfg.opts.model) : rgba;
    const s = score({ art: rgba, colour, W, H, garmentLab, underbase: L.underbase, highlight: L.highlight, colorAlpha: L.colorAlpha, n });
    rows.push({ case: c.img, config: name, ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, +v.toFixed(3)])) });
  }
}

const KEYS = ["dE_mean", "dE_p95", "white_in2", "banding"];
const summary = Object.fromEntries(Object.keys(CONFIGS).map(cfg => {
  const rs = rows.filter(r => r.config === cfg);
  return [cfg, Object.fromEntries(KEYS.map(k => [k, +(k === "white_in2" ? rs.reduce((s, r) => s + r[k], 0) : rs.reduce((s, r) => s + r[k], 0) / rs.length).toFixed(3)]))];
}));

const pad = (s, w) => String(s).padEnd(w);
console.log(`DTG Table benchmark — model only. Referee v${REFEREE.version} (${refereeHash}), white Yule–Nielsen n ${n}, ${CASES.length} cases, print width ${REFEREE.printWidthIn} in.\n`);
console.log(pad("case", 28) + pad("config", 13) + KEYS.map(k => pad(k, 11)).join(""));
for (const r of rows) console.log(pad(r.case, 28) + pad(r.config, 13) + KEYS.map(k => pad(r[k], 11)).join(""));
console.log("\nSummary (ΔE and banding: mean over cases; white: total in² of full-coverage white)");
for (const [cfg, s] of Object.entries(summary)) console.log(pad(cfg, 13) + KEYS.map(k => pad(`${k} ${s[k]}`, 20)).join(""));

const basePath = here("./baseline.json");
if (flag("--update")) {
  if (n !== REFEREE.n) { console.error("--update records the referee's own n only"); process.exit(1); }
  writeFileSync(basePath, JSON.stringify({ referee: { ...REFEREE, hash: refereeHash }, cases: CASES.length, summary, rows }, null, 1) + "\n");
  console.log("\nbaseline.json written.");
} else if (existsSync(basePath) && n === REFEREE.n) {
  const base = JSON.parse(readFileSync(basePath, "utf8"));
  if (base.referee.hash !== refereeHash) console.log(`\nThe referee changed since the baseline (${base.referee.hash} → ${refereeHash}): numbers are not comparable.`);
  const TOL = { dE_mean: 0.05, dE_p95: 0.1, white_in2: 0.01, banding: 0.1 }; // white: relative
  let worse = 0; console.log("\nAgainst baseline.json:");
  for (const cfg of Object.keys(CONFIGS)) for (const k of KEYS) {
    const b = base.summary[cfg]?.[k], v = summary[cfg][k]; if (b === undefined) continue;
    const bad = k === "white_in2" ? v > b * (1 + TOL[k]) : v > b + TOL[k];
    if (bad && cfg !== "rip-proxy") worse++;
    if (v !== b) console.log(`  ${pad(cfg, 13)}${pad(k, 11)}${b} → ${v}${bad ? "  WORSE" : ""}`);
  }
  console.log(worse ? `\n${worse} measure(s) worse beyond tolerance.` : "\nNothing worse beyond tolerance.");
  if (flag("--gate") && worse) process.exit(2);
}
