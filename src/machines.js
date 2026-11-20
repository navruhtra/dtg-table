// @ts-check
// DTG Table: printer presets and machine profiles. Pure data and pure functions, no DOM.
//
// Shape: the machine profile shared with the DTF Table ("adn.machine/1"), with the DTG-only
// fields under a `dtg` key so a DTF reader ignores them. `media.kind` is "platen"; `media.widthIn` × `media.heightIn`
// is the default platen's printable area, and `dtg.platens` lists every platen.
//
// Every value has a source or is listed in `verify` ("default, verify": a sensible default nobody has checked against
// the maker's documentation or a real machine). Sources were read 2026-11-18.

/** @typedef {{ name: string, widthIn: number, heightIn: number, marginIn?: number }} Platen */
/** @typedef {{ schema: string, id: string, service: string, name: string, maker: string, model: string, preset: string,
 *   media: { kind: string, widthIn: number, heightIn: number }, dpi: { native: number[], file: number },
 *   inks: string[], white: { supply: string, channelName?: string, invert?: boolean, ripMakesWhite: boolean | null },
 *   mirror: boolean, output: { formats: string[], maxFileMB: number | null }, notes: string, updatedAt: string,
 *   dtg: { software: string[], platens: Platen[], whiteLayers: string[], chokeMm: number, pretreat: string,
 *     colourSpace: string },
 *   sources?: { url: string, what: string }[], verify?: string[] }} Machine */

export const SCHEMA = "adn.machine/1";
const EPSON_F2270 = "https://epson.com/faq/SPT_SCF2270SE~faq-0000dae-scf2270";
const EPSON_F2270_GUIDE = "https://files.support.epson.com/docid/cpd6/cpd63670/source/pro_graphics/source/specifications/reference/scf2270/spex_printer_scf2270.html";
const EPSON_F1070_AREA = "https://files.support.epson.com/docid/cpd6/cpd64429/source/pro_graphics/source/printing_computer/reference/scf1070/printable_area_scf1070.html";
const EPSON_F1070_SPEC = "https://files.support.epson.com/docid/cpd6/cpd64429/source/pro_graphics/source/specifications/reference/scf1070/spex_printer_scf1070.html";
const EPSON_GC2_DATA = "https://files.support.epson.com/docid/cpd6/cpd63670/source/pro_graphics/source/printing_computer/reference/creating_and_transmitting_data.html";
const BROTHER_GTXPRO = "https://garmentprinter.global.brother/en-ap/products/all-dtg/dtg/gtx-423";
const KORNIT_ATLAS_MAX_PLUS = "https://www.kornit.com/wp-content/uploads/2022/07/Atlas_MAX_PLUS_Brochure_11_2.pdf";

// Fields every preset leaves unverified: how each RIP treats a white layer we send, and the choke and file DPI we
// default to. The DTF Table asks the same RIP question.
const COMMON_VERIFY = ["white.supply", "white.ripMakesWhite", "dpi.file", "dtg.chokeMm"];

/** @param {Partial<Machine> & { id: string, name: string, maker: string, model: string, platens: Platen[] }} p @returns {Machine} */
function preset(p) {
  const d = p.platens.find(x => x.name === (p.media?.["default"] ?? "")) ?? p.platens[0];
  return {
    schema: SCHEMA, id: p.id, service: "dtg", name: p.name, maker: p.maker, model: p.model, preset: p.id,
    media: { kind: "platen", widthIn: d.widthIn, heightIn: d.heightIn },
    dpi: p.dpi ?? { native: [1200], file: 300 },
    inks: p.inks ?? ["C", "M", "Y", "K", "W"],
    white: p.white ?? { supply: "none", ripMakesWhite: true },
    mirror: false,
    output: p.output ?? { formats: ["png", "tiff"], maxFileMB: null },
    notes: p.notes ?? "", updatedAt: "2026-11-18T00:00:00Z",
    dtg: { software: [], whiteLayers: ["underbase", "highlight"], chokeMm: 0.2, pretreat: "required for white", colourSpace: "sRGB", ...p.dtg, platens: p.platens },
    sources: p.sources ?? [], verify: [...COMMON_VERIFY, ...(p.verify ?? [])],
  };
}

/** Presets for the named platforms. Platen areas are the maker's printable areas, in inches as published. */
export const PRESETS = Object.freeze([
  preset({
    id: "epson-f2270", name: "Epson SureColor F2270", maker: "Epson", model: "SureColor F2270",
    dpi: { native: [1200], file: 300 },
    platens: [
      { name: "Large", widthIn: 16, heightIn: 20 }, { name: "Medium", widthIn: 14, heightIn: 16 },
      { name: "Small", widthIn: 10, heightIn: 12 }, { name: "Extra small", widthIn: 7, heightIn: 8 },
      { name: "Sleeve", widthIn: 4, heightIn: 4 },
    ],
    media: /** @type {any} */ ({ default: "Medium" }),
    output: { formats: ["tiff", "png"], maxFileMB: null },
    dtg: /** @type {any} */ ({ software: ["Garment Creator 2"] }),
    notes: "DTG and DTF hybrid. Garment Creator 2 prints TIFF, JPEG, PNG and BMP; Epson recommends sRGB.",
    sources: [
      { url: EPSON_F2270, what: "printable area of each platen (L 16×20, M 14×16, S 10×12, XS 7×8, sleeve 4×4 in)" },
      { url: EPSON_F2270_GUIDE, what: "resolution 1200 × 1200 dpi maximum; white ink mode 4 white channels" },
      { url: EPSON_GC2_DATA, what: "Garment Creator 2 file formats; sRGB recommended" },
    ],
    verify: ["media (Medium is our choice)"],
  }),
  preset({
    id: "epson-f1070", name: "Epson SureColor F1070", maker: "Epson", model: "SureColor F1070",
    dpi: { native: [2400, 1200], file: 300 },
    platens: [{ name: "Small", widthIn: 10, heightIn: 12 }, { name: "Extra small", widthIn: 7, heightIn: 8 }, { name: "Sleeve", widthIn: 4, heightIn: 4 }],
    output: { formats: ["tiff", "png"], maxFileMB: null },
    dtg: /** @type {any} */ ({ software: ["Garment Creator 2"] }),
    notes: "DTG and DTF hybrid, small format. Garment Creator 2 (same file guidance as the F2270 guide).",
    sources: [
      { url: EPSON_F1070_AREA, what: "printable area: Small 10×12, Extra small 7×8, Sleeve 4×4 in" },
      { url: EPSON_F1070_SPEC, what: "resolution 2400 × 1200 dpi maximum; white ink mode 2 white channels" },
      { url: EPSON_GC2_DATA, what: "Garment Creator 2 file formats (F2270 guide; F1070 guide has the same page)" },
    ],
  }),
  preset({
    id: "brother-gtxpro", name: "Brother GTXpro (GTX-423)", maker: "Brother", model: "GTXpro GTX-423",
    dpi: { native: [1200], file: 300 },
    platens: [
      { name: "Adult (included)", widthIn: 14, heightIn: 16 }, { name: "Maximum", widthIn: 16, heightIn: 21 },
      { name: "Youth", widthIn: 10, heightIn: 12 }, { name: "Baby", widthIn: 7, heightIn: 8 },
      { name: "Oversized", widthIn: 16, heightIn: 18 }, { name: "Sleeve", widthIn: 4.25, heightIn: 15 },
    ],
    dtg: /** @type {any} */ ({ software: ["GTX Graphics Lab"] }),
    notes: "Also the GTXpro Bulk. White prints as underbase and highlight (Brother).",
    sources: [
      { url: BROTHER_GTXPRO, what: "maximum print size 16×21 in; included platen 14×16 in; 1200 × 1200 dpi; C, M, Y, K, W; underbase and highlight white" },
    ],
    verify: ["dtg.platens (Youth, Baby, Oversized, Sleeve and Maximum as a platen: not on the Brother spec page read; Brother says to ask a DTG specialist)"],
  }),
  preset({
    id: "kornit-atlas-max-plus", name: "Kornit Atlas MAX Plus", maker: "Kornit", model: "Atlas MAX Plus",
    dpi: { native: [1200], file: 300 },
    inks: ["C", "M", "Y", "K", "R", "G", "W"],
    platens: [{ name: "Super Grand pallet", widthIn: 23.6, heightIn: 35.4 }],
    dtg: /** @type {any} */ ({ software: ["Kornit K-FLOW RIP", "ColorGate", "CADlink"], pretreat: "inline (Kornit)" }),
    notes: "Industrial. Kornit recommends its K-FLOW RIP; ColorGate and CADlink are used with older Kornit models.",
    sources: [
      { url: KORNIT_ATLAS_MAX_PLUS, what: "max print area 60×90 cm (23.6×35.4 in) with the Super Grand pallet; up to 1,200 dpi; CMYKRG + W; recommended RIP K-FLOW" },
    ],
    verify: ["dtg.pretreat", "dtg.software (ColorGate, CADlink)", "dtg.platens (other pallet sizes)"],
  }),
]);

/** A custom printer: the producer enters what the machine can do. Missing values get the defaults, listed in verify. */
export function customMachine({ name = "Custom printer", maker = "", model = "", widthIn, heightIn, dpi = 300, nativeDpi = [], inks = ["C", "M", "Y", "K", "W"],
  whiteSupply = "none", whiteLayers = ["underbase", "highlight"], chokeMm = 0.2, software = [], formats = ["png", "tiff"], id = "custom" } = /** @type {any} */ ({})) {
  if (!(widthIn > 0 && heightIn > 0)) throw new Error("A custom printer needs the platen print area (width and height, inches).");
  return preset({ id, name, maker, model, platens: [{ name: "Platen", widthIn, heightIn }], dpi: { native: nativeDpi.length ? nativeDpi : [dpi], file: dpi }, inks,
    white: { supply: whiteSupply, ripMakesWhite: whiteSupply === "none" ? true : null }, output: { formats, maxFileMB: null },
    dtg: /** @type {any} */ ({ software, whiteLayers, chokeMm }), notes: "Entered by the producer." });
}

/** Problems with a machine profile, as plain sentences (empty when it is usable). */
export function validateMachine(m) {
  const e = [];
  if (!m || m.schema !== SCHEMA) e.push(`schema must be ${SCHEMA}`);
  if (!m) return e;
  if (!["screen", "dtf", "dtg", "embroidery"].includes(m.service)) e.push("service must be screen, dtf, dtg or embroidery");
  if (!m.name) e.push("name is empty");
  if (m.service === "dtg") {
    if (m.media?.kind !== "platen") e.push("a DTG machine prints on a platen (media.kind platen)");
    const ps = m.dtg?.platens ?? [];
    if (!ps.length) e.push("no platen");
    for (const p of ps) if (!(p.widthIn > 0 && p.heightIn > 0)) e.push(`platen ${p.name || "?"} has no print area`);
    if (!(m.dpi?.file >= 72 && m.dpi.file <= 2400)) e.push("file resolution must be 72–2400 dpi");
    if (!["none", "file", "channel"].includes(m.white?.supply)) e.push("white.supply must be none, file or channel");
    if (m.inks?.includes("W") === false && m.white?.supply !== "none") e.push("white layers asked for, but the machine has no white ink");
  }
  return e;
}

/** Printable area of a platen in pixels at the file resolution. */
export function platenPixels(m, platenName, dpi = m.dpi.file) {
  const p = (m.dtg.platens.find(x => x.name === platenName) ?? m.dtg.platens[0]);
  return { platen: p.name, W: Math.round(p.widthIn * dpi), H: Math.round(p.heightIn * dpi), dpi };
}

/** How art of W×H px fits a platen: the largest print size that fits, and the art's resolution at that size and at a
    wanted width. Warns below 150 ppi (default, verify: a common floor for DTG art, not a maker figure). */
export function fitArt(m, platenName, W, H, wantWidthIn = null) {
  const p = m.dtg.platens.find(x => x.name === platenName) ?? m.dtg.platens[0];
  const s = Math.min(p.widthIn / W, p.heightIn / H), maxW = W * s, maxH = H * s;
  const widthIn = wantWidthIn ?? maxW, heightIn = widthIn * H / W, ppi = W / widthIn;
  const warnings = [];
  if (widthIn > p.widthIn + 1e-9 || heightIn > p.heightIn + 1e-9) warnings.push(`${widthIn.toFixed(2)}×${heightIn.toFixed(2)} in does not fit the ${p.name} platen (${p.widthIn}×${p.heightIn} in)`);
  if (ppi < 150) warnings.push(`Art is ${Math.round(ppi)} ppi at ${widthIn.toFixed(2)} in wide; 150 ppi or more is safer`);
  return { platen: p.name, maxWidthIn: maxW, maxHeightIn: maxH, widthIn, heightIn, ppi, warnings };
}

/** Saved machines, grouped by service. The ADN account will store these server-side; until then this stand-in keeps
    them in any Storage-like object (localStorage in the browser, a Map wrapper in tests). */
const KEY = "adn.machines.v1";
export function machineStore(storage) {
  const read = () => { try { const v = JSON.parse(storage.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
  const write = v => { try { storage.setItem(KEY, JSON.stringify(v)); } catch { /* storage full or blocked: keep working without it */ } };
  return {
    list: service => (read()[service] ?? []),
    save(m) { const errs = validateMachine(m); if (errs.length) throw new Error(errs.join("; ")); const all = read(), arr = all[m.service] ?? []; const i = arr.findIndex(x => x.id === m.id);
      const v = { ...m, updatedAt: new Date().toISOString() }; if (i >= 0) arr[i] = v; else arr.push(v); all[m.service] = arr; write(all); return v; },
    remove(service, id) { const all = read(); all[service] = (all[service] ?? []).filter(x => x.id !== id); write(all); },
  };
}
