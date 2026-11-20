// DTG Table: machine presets, garments, layer files and the garment proof. Run: node tests/presets.mjs
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
if (!existsSync(fileURLToPath(new URL("../src/vendor/separation-table/vendor/quickhull.js", import.meta.url)))) { console.error("Run: npm run setup"); process.exit(2); }
const E = await import("../src/vendor/separation-table/engine.js");
const { encodePNG, decodePNG } = await import("../src/vendor/separation-table/cli/platform.mjs");
const M = await import("../src/machines.js");
const G = await import("../src/garments.js");
const Ly = await import("../src/layers.js");
const { garmentProof } = await import("../src/proof.js");
const { buildWhiteLayers, garmentClass } = await import("../src/white.js");

let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };

// presets
for (const m of M.PRESETS) {
  const errs = M.validateMachine(m);
  ok(!errs.length, `${m.name}: valid profile${errs.length ? " — " + errs.join("; ") : ""}`);
  ok(m.sources.length > 0 && m.sources.every(s => /^https:\/\//.test(s.url)), `${m.name}: every preset cites a source`);
  ok(m.verify.includes("white.supply") && m.verify.includes("white.ripMakesWhite"), `${m.name}: RIP white handling marked default, verify`);
  ok(JSON.parse(JSON.stringify(m)).dtg.platens.length === m.dtg.platens.length, `${m.name}: survives JSON`);
}
const f2270 = M.PRESETS.find(m => m.id === "epson-f2270");
ok(f2270.media.widthIn === 14 && f2270.media.heightIn === 16 && f2270.dtg.platens.length === 5, "F2270: default platen Medium 14×16, five platens");
ok(M.PRESETS.find(m => m.id === "epson-f1070").dtg.platens.every(p => p.widthIn <= 10), "F1070: no platen wider than 10 in (Small is its largest)");
const px = M.platenPixels(f2270, "Large"); ok(px.W === 4800 && px.H === 6000, `F2270 Large at 300 dpi = ${px.W}×${px.H} px`);

// custom machine
const cu = M.customMachine({ name: "Shop printer", widthIn: 15, heightIn: 18, dpi: 360 });
ok(!M.validateMachine(cu).length && cu.dpi.file === 360 && cu.media.widthIn === 15, "custom printer from the producer's numbers is valid");
let threw = false; try { M.customMachine({ name: "x" }); } catch { threw = true; } ok(threw, "custom printer without a print area is refused");
ok(M.validateMachine({ ...cu, inks: ["C", "M", "Y", "K"], white: { supply: "file", ripMakesWhite: null } }).some(e => /no white ink/.test(e)), "white layers on a machine with no white ink is an error");
ok(M.validateMachine({ ...cu, dtg: { ...cu.dtg, platens: [] } }).some(e => /no platen/.test(e)), "a machine with no platen is an error");

// fit
const fit = M.fitArt(f2270, "Medium", 3000, 3000); ok(Math.abs(fit.maxWidthIn - 14) < 1e-9 && !fit.warnings.length, `3000 px square fits Medium at 14 in, ${fit.ppi.toFixed(0)} ppi`);
ok(M.fitArt(f2270, "Medium", 1000, 1000, 14).warnings.some(w => /ppi/.test(w)), "low resolution warns");
ok(M.fitArt(f2270, "Small", 3000, 3000, 12).warnings.some(w => /does not fit/.test(w)), "art wider than the platen warns");

// store (Storage-like stand-in)
const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
const st = M.machineStore(storage);
st.save(f2270); st.save(cu); st.save({ ...cu, name: "Renamed" });
ok(st.list("dtg").length === 2 && st.list("dtg").find(x => x.id === "custom").name === "Renamed", "store: save, update in place, grouped by service");
ok(st.list("dtf").length === 0, "store: other services are separate");
st.remove("dtg", "custom"); ok(st.list("dtg").length === 1, "store: remove");
mem.set("adn.machines.v1", "not json"); ok(Array.isArray(st.list("dtg")) && st.list("dtg").length === 0, "store: corrupt storage reads as empty");

// garments
ok(G.GARMENTS.length === 18 && G.GARMENTS.every(g => !g.measured && g.lab.length === 3), "18 garment estimates, none marked measured");
const noW = G.garmentsFor({ inks: ["C", "M", "Y", "K"] }); ok(noW.length > 0 && noW.every(g => garmentClass(g.lab) !== "dark") && !noW.some(g => g.id === "black"), `a machine without white lists only white and light garments (${noW.length})`);
ok(G.garmentsFor(f2270).length === 18, "a machine with white lists every garment");
ok(G.garment({ lab: [20, 0, 0] }).measured && G.garment({ hex: "#112233" }).lab.length === 3, "custom garment from L*a*b* or hex");

// layers and files
const W = 30, H = 20, P = W * H, rgba = new Uint8ClampedArray(P * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = y * W + x, c = x < 10 ? [26, 26, 28] : x < 20 ? [200, 40, 40] : [250, 250, 248]; rgba.set([...c, y < 2 ? 0 : 255], p * 4); }
const lab = new Float32Array(P * 3), alpha = new Uint8Array(P); for (let p = 0; p < P; p++) { lab.set(E.rgb2lab(rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2]), p * 3); alpha[p] = rgba[p * 4 + 3]; }
const black = G.GARMENTS.find(g => g.id === "black");
const lay = buildWhiteLayers({ lab, alpha, W, H, garmentLab: black.lab });
const col = Ly.colourLayer(rgba, lay.colorAlpha);
ok(col[(5 * W + 5) * 4 + 3] === 0 && col[(5 * W + 15) * 4 + 3] === 255 && col[(5 * W + 15) * 4] === 200, "colour layer: black-on-black knocked out to alpha 0, red kept");
const wl = Ly.whiteLayer(lay.underbase), wlw = Ly.whiteLayer(lay.underbase, { ink: "white" });
ok(wl[5 * W + 25] === 0 && wlw[5 * W + 25] === 255 && wl[5 * W + 5] === 255, "white layer: ink black = 0, ink white = 255, no white = paper");

const tif = Ly.toTIFF8({ W, H, channels: 1, data: wl, dpi: 300 }), dv = new DataView(tif.buffer);
const ifd = dv.getUint32(4, true), nTags = dv.getUint16(ifd, true), tagsSeen = [];
let xres = 0, offs = 0; for (let i = 0; i < nTags; i++) { const o = ifd + 2 + i * 12, t = dv.getUint16(o, true); tagsSeen.push(t); if (t === 282) { const r = dv.getUint32(o + 8, true); xres = dv.getUint32(r, true) / dv.getUint32(r + 4, true); } if (t === 273) offs = dv.getUint32(o + 8, true); }
ok(tif[0] === 0x49 && dv.getUint16(2, true) === 42 && tagsSeen.every((t, i) => !i || t > tagsSeen[i - 1]), "TIFF: little-endian header, tags in ascending order");
ok(xres === 300 && tif.length === offs + P && tif[offs + 5 * W + 25] === 0, "TIFF: 300 dpi, pixel data where StripOffsets says");
const tif4 = Ly.toTIFF8({ W, H, channels: 4, data: col, dpi: 300 }); ok(tif4.length > P * 4, "TIFF RGBA written");
const png = Ly.pngWithDpi(encodePNG(col, W, H), 300), png2 = Ly.pngWithDpi(png, 600);
const findPhys = b => { let o = 8; while (o < b.length) { const len = new DataView(b.buffer, b.byteOffset).getUint32(o), t = String.fromCharCode(...b.subarray(o + 4, o + 8)); if (t === "pHYs") return new DataView(b.buffer, b.byteOffset).getUint32(o + 8); o += 12 + len; } return 0; };
ok(Math.abs(findPhys(png) * 0.0254 - 300) < 0.01 && Math.abs(findPhys(png2) * 0.0254 - 600) < 0.01, "PNG: pHYs carries 300 dpi, and replacing it gives 600");
const back = decodePNG(Buffer.from(png2)); ok(back.W === W && back.rgba[(5 * W + 15) * 4] === 200 && back.rgba[(5 * W + 5) * 4 + 3] === 0, "PNG with pHYs still decodes to the same pixels");
ok(Ly.crc32(new TextEncoder().encode("123456789")) === 0xcbf43926, "CRC-32 check value");
const plan = Ly.filePlan(f2270, "job"); ok(plan[0].name === "job-colour.tiff" && plan.slice(1).every(f => f.reference), "file plan: RIP makes white → white layers go as reference files");
ok(Ly.filePlan({ ...cu, white: { supply: "file", ripMakesWhite: false } }).slice(1).every(f => !f.reference), "file plan: white supply file → white layers are production files");

// proof and compensation (model only)
const pr = garmentProof({ rgba, W, H, garmentLab: black.lab, layers: lay });
const comp = Ly.compensateColour(rgba, lay, black.lab), pr2 = garmentProof({ rgba, colour: comp, W, H, garmentLab: black.lab, layers: lay });
ok(pr2.stats.meanDE < pr.stats.meanDE, `compensated colour lowers proof ΔE00 under partial white: mean ${pr.stats.meanDE.toFixed(2)} → ${pr2.stats.meanDE.toFixed(2)}, p95 ${pr.stats.p95DE.toFixed(2)} → ${pr2.stats.p95DE.toFixed(2)}`);
ok(pr2.stats.p95DE < 2, `compensated proof within 2 ΔE00 at p95 (${pr2.stats.p95DE.toFixed(2)})`);
const full = buildWhiteLayers({ lab, alpha, W, H, garmentLab: black.lab, opts: { rule: "full" } }), prF = garmentProof({ rgba, W, H, garmentLab: black.lab, layers: full });
ok(prF.stats.meanDE <= pr2.stats.meanDE + 0.5, `full white with the plain art: mean ${prF.stats.meanDE.toFixed(2)}, white ${full.stats.whiteArea.toFixed(0)} px vs reach ${lay.stats.whiteArea.toFixed(0)} px`);
const wht = G.GARMENTS.find(g => g.id === "white"), lw = buildWhiteLayers({ lab, alpha, W, H, garmentLab: wht.lab }), pw = garmentProof({ rgba, W, H, garmentLab: wht.lab, layers: lw });
ok(pw.stats.p95DE < 2, `white shirt, no white ink: proof p95 ${pw.stats.p95DE.toFixed(2)} ΔE00`);
ok([0, 1, 2].every(k => Math.abs(pr.rgba[(0 * W + 5) * 4 + k] - E.hex2rgb(black.hex)[k]) <= 1), "proof shows the bare garment where the art is transparent");

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
