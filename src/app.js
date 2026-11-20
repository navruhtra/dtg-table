// DTG Table page: the Separation Table's layout and flow (four steps on the left, the workspace in the middle,
// Advanced Settings on the right, Back / Next on phones, bench.css), driving DTG Table's own modules. Runs in the
// browser; the art never leaves it. The work is in the pure modules beside this file.
import { rgb2lab, hex2rgb } from "./vendor/separation-table/engine.js";
import { buildWhiteLayers, chokePixels, garmentClass } from "./white.js";
import { PRESETS, customMachine, machineStore, fitArt } from "./machines.js";
import { GARMENTS, garment as makeGarment, garmentsFor } from "./garments.js";
import { colourLayer, whiteLayer, compensateColour, toTIFF8, pngWithDpi } from "./layers.js";
import { garmentProof } from "./proof.js";
import { readRamps, rampReport } from "./ramps.js";
import { placeArt, placementLines } from "./placement.js";
import { initHelp } from "./help.js";

const $ = id => /** @type {any} */ (document.getElementById(id));
const STEPS = { 1: "Artwork", 2: "Printer / garment", 3: "White", 4: "Files" };
const PREVIEW_MAX = 900;
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tick = () => new Promise(r => setTimeout(r, 30));
const phone = () => window.matchMedia("(max-width: 960px)").matches;
let storage = null; try { storage = window.localStorage; storage.getItem("x"); } catch { storage = null; }
const mem = new Map(), store = machineStore(storage ?? { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) });
const pref = { get: (k, d) => { try { const v = storage && storage.getItem("dtgtable." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { if (storage) storage.setItem("dtgtable." + k, JSON.stringify(v)); } catch { /* storage blocked */ } } };

const S = { machine: PRESETS[0], platen: PRESETS[0].dtg.platens.find(p => p.widthIn === PRESETS[0].media.widthIn)?.name, garment: GARMENTS.find(g => g.id === "black"),
  art: null, preview: null, name: "art", ramps: null, model: null, view: "proof", result: null };
const st = { step: 1, fold: false, advOpen: pref.get("advOpen", false), rOpen: false, written: false, /** @type {string[]} */ urls: [] };
/** Zoom: "fit", or screen pixels for each pixel of the preview; x and y move the zoomed picture. */
const Z = { z: /** @type {"fit" | number} */ ("fit"), x: 0, y: 0 };

/* ───────────── Steps (the Separation Table's step rows) ───────────── */
function stepDone(k) { return k === 1 ? !!S.art : k === 2 ? !!S.art && st.step > 2 : k === 3 ? !!S.result && st.step > 3 : st.written; }
function renderStepRows() {
  for (let k = 1; k <= 4; k++) {
    const open = k === st.step && !st.fold, done = stepDone(k) && !open;
    $(`step${k}Body`).hidden = !open; $(`step${k}Btn`).setAttribute("aria-expanded", String(open));
    $(`step${k}`).classList.toggle("open", open); $(`step${k}`).classList.toggle("done", done);
    $(`step${k}Badge`).textContent = done ? "✓" : String(k);
    $(`sth${k}`).textContent = done ? `${k} ${STEPS[k]}` : STEPS[k];
    $(`step${k}Act`).textContent = open ? "[−]" : "[+]";
  }
  renderSummaries();
}
function setStep(n, scroll = true) {
  st.step = n; st.fold = false; renderStepRows();
  document.querySelectorAll(".sidesec").forEach(/** @param {any} d */ d => { d.hidden = !d.dataset.for.split(" ").includes(String(n)); });
  $("sideTitle").textContent = STEPS[n];
  placeSide(); renderNav();
  if (!scroll) return;
  const el = $(`step${n}`);
  // phones: as the Separation Table, the least scroll that shows the whole step above the Back / Next bar, or its title
  // just under the pinned workspace when the step is taller than the space
  if (phone()) { const doc = el.getBoundingClientRect().top + window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight, navH = $("mNav").getBoundingClientRect().height, pinned = document.body.classList.contains("nopin") ? 0 : $("square").getBoundingClientRect().height;
    const yTop = Math.max(0, Math.floor(doc - pinned - 9)), yFit = Math.max(0, Math.ceil(doc + el.getBoundingClientRect().height - (window.innerHeight - navH) + 9));
    window.scrollTo({ top: Math.min(yFit, yTop, Math.max(0, max)), behavior: "smooth" }); }
  else { const pane = $("paneSteps"); pane.scrollTo({ top: el.offsetTop - pane.offsetTop - 12, behavior: "smooth" }); }
}
[1, 2, 3, 4].forEach(n => $(`step${n}`).querySelector(".sthead").addEventListener("click", e => {
  if (e.target.closest(".q, .hw")) return;
  if (n === st.step && !st.fold) { st.fold = true; renderStepRows(); return; }
  setStep(n);
}));
document.querySelectorAll("[data-next]").forEach(/** @param {any} b */ b => b.addEventListener("click", () => setStep(+b.dataset.next)));

/* Phones: Advanced folds into one row inside the open step; on desktop it is the right column. */
const advTog = document.createElement("button");
advTog.type = "button"; advTog.className = "advtog"; advTog.id = "advTog"; advTog.setAttribute("aria-controls", "paneSide");
function renderAdv() { advTog.setAttribute("aria-expanded", String(st.advOpen)); advTog.innerHTML = `<span>Advanced</span><b aria-hidden="true">${st.advOpen ? "[−]" : "[+]"}</b>`; $("paneSide").classList.toggle("advopen", st.advOpen); }
advTog.addEventListener("click", () => { st.advOpen = !st.advOpen; pref.set("advOpen", st.advOpen); renderAdv(); });
function placeSide() {
  const side = $("paneSide"), body = $(`step${st.step}Body`), v3 = document.querySelector(".v3");
  if (phone()) { const nx = body.querySelector(".next"); if (side.parentElement !== body || (nx && side.nextSibling !== nx)) body.insertBefore(side, nx); if (advTog.nextSibling !== side) body.insertBefore(advTog, side); }
  else { if (side.parentElement !== v3) v3.appendChild(side); advTog.remove(); }
  // the theme switch is one element: in the title row on a phone (in Shop setup when an ADN page has the title row), at
  // the foot of the step column on a desktop
  const seg = $("themeSeg"), home = !phone() ? null : document.body.classList.contains("inheader") ? $("shopPanel").querySelector("section") : $("mShop"), box = home ? home.parentElement : document.querySelector(".stepfoot");
  if (seg.parentElement !== box) box.insertBefore(seg, home);
  renderAdv();
}
window.matchMedia("(max-width: 960px)").addEventListener("change", () => { placeSide(); renderNav(); draw(); });
$("sideClose").addEventListener("click", () => { document.querySelector(".v3").classList.add("noside"); $("sideOpen").hidden = false; });
$("sideOpen").addEventListener("click", () => { document.querySelector(".v3").classList.remove("noside"); $("sideOpen").hidden = true; });
function renderNav() {
  const n = st.step; $("mBack").disabled = n === 1;
  $("mProg").querySelectorAll("i").forEach((b, j) => { b.className = j + 1 === n ? "cur" : stepDone(j + 1) ? "done" : ""; });
  $("mProg").setAttribute("aria-valuenow", String([1, 2, 3, 4].filter(stepDone).length)); $("mProg").setAttribute("aria-label", `Step ${n} of 4`);
  const nx = $("mNext"); nx.textContent = n < 4 ? `Next: ${STEPS[n + 1]} →` : "Make files ↓"; nx.disabled = !S.art && (n === 1 || n === 4);
  if (phone() && nx.scrollWidth > nx.clientWidth + 1) nx.textContent = n < 4 ? "Next →" : "Files ↓";
}
$("mBack").addEventListener("click", () => setStep(Math.max(1, st.step - 1)));
$("mNext").addEventListener("click", () => { if (st.step < 4) setStep(st.step + 1); else $("export").click(); });
new ResizeObserver(() => document.documentElement.style.setProperty("--navh", `${$("mNav").getBoundingClientRect().height}px`)).observe($("mNav"));

const RULE = { full: "Full white", reach: "Least white" };
function renderSummaries() {
  $("step1Sum").textContent = S.art ? `${S.label} · ${S.art.W} × ${S.art.H} px` : "Drop your art in the workspace";
  $("step2Sum").textContent = `${S.machine.name} · ${S.garment.name}`;
  $("step3Sum").textContent = `${RULE[$("rule").value]} · ${Math.round(100 * $("strength").value)} % density`;
  const fs = ["PNG", "TIFF", "placement sheet"].filter((f, i) => $(["fPNG", "fTIF", "fPlace"][i]).checked);
  $("step4Sum").textContent = `${fs.join(" + ") || "No file type chosen"}${$("supply").value === "file" ? " · white file" : ""}`;
}

/* ───────────── Theme (Light, Dark, Device), as the Separation Table ───────────── */
{ const root = document.documentElement, mq = matchMedia("(prefers-color-scheme: dark)"), seg = $("themeSeg");
  const set = t => { root.dataset.theme = t; root.dataset.scheme = t === "device" ? (mq.matches ? "dark" : "light") : t; for (const b of seg.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.v === t)); if (S.result) draw(); };
  seg.addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (b) { pref.set("theme", b.dataset.v); set(b.dataset.v); } });
  mq.addEventListener("change", () => set(root.dataset.theme || "device")); set(root.dataset.theme || "device"); }

/* ───────────── Help and Shop setup ───────────── */
initHelp();
{ const d = $("helpPanel"); $("helpOpen").addEventListener("click", () => { if (!d.open) d.showModal(); $("helpQ").focus(); }); $("helpClose").addEventListener("click", () => d.close());
  d.addEventListener("click", e => { if (e.target === d) d.close(); }); }
{ const d = $("shopPanel");
  $("shopOpen").addEventListener("click", () => { renderMachines(); if (!d.open) d.showModal(); }); $("mShop").addEventListener("click", () => $("shopOpen").click());
  d.addEventListener("click", e => { if (e.target === d) d.close(); });
  document.querySelectorAll("[data-close]").forEach(/** @param {any} b */ b => b.addEventListener("click", () => $(b.dataset.close).close())); }
function renderMachines() {
  const mine = store.list("dtg"), ul = $("machList"); ul.textContent = ""; $("machPill").textContent = `${mine.length} saved`;
  for (const m of mine) { const li = document.createElement("li"); li.innerHTML = `<span><b>${escapeHtml(m.name)}</b> · ${m.media.widthIn} × ${m.media.heightIn} in · ${m.dpi.file} dpi</span><span class="row"><button type="button" data-use="${escapeHtml(m.id)}">Use</button><button type="button" data-forget="${escapeHtml(m.id)}">Forget</button></span>`; ul.append(li); }
  if (!mine.length) { const li = document.createElement("li"); li.textContent = "No saved machines yet."; ul.append(li); }
}
$("machList").addEventListener("click", e => { const t = e.target;
  if (t.dataset.forget) { const cur = $("printer").value === "s:" + t.dataset.forget; store.remove("dtg", t.dataset.forget); printerOptions(cur ? "p:" + PRESETS[0].id : $("printer").value); if (cur) pickPrinter(); renderMachines(); }
  if (t.dataset.use) { $("printer").value = "s:" + t.dataset.use; pickPrinter(); $("shopPanel").close(); setStep(2); } });

/* ───────────── Steppers, and the Advanced marks (Standard or You set) ───────────── */
document.querySelectorAll(".stp").forEach(/** @param {any} b */ b => b.addEventListener("click", () => {
  const i = $(b.dataset.for), v = Math.round(((+i.value || 0) + +b.dataset.d) * 1000) / 1000;
  i.value = String(Math.max(+i.min || -Infinity, Math.min(i.max === "" ? Infinity : +i.max, v))); i.dispatchEvent(new Event("input")); i.dispatchEvent(new Event("change"));
}));
const ADV = { w: ["strength", "choke", "hl"], k: ["ko", "koTol"] };
const getV = id => $(id).type === "checkbox" ? $(id).checked : $(id).value;
const DEF = Object.fromEntries(Object.values(ADV).flat().map(id => [id, getV(id)]));
function renderMarks() {
  $("strengthV").textContent = Math.round(100 * $("strength").value) + " %"; $("chokeV").textContent = (+$("choke").value).toFixed(2); $("koTolV").textContent = $("koTol").value;
  for (const [k, ids] of Object.entries(ADV)) {
    let changed = 0;
    for (const id of ids) { const hand = getV(id) !== DEF[id]; document.querySelector(`[data-pm="${id}"]`).className = hand ? "pm hand" : "pm"; if (hand) changed++; }
    document.querySelector(`[data-sum="${k}"]`).textContent = changed ? `${changed} set` : "Standard";
  }
}
$("whiteDef").addEventListener("click", () => { for (const id of Object.values(ADV).flat()) { const e = $(id); if (e.type === "checkbox") e.checked = DEF[id]; else e.value = DEF[id]; } update(); });

/* ───────────── Step 2: printer ───────────── */
function printerOptions(keep = $("printer").value) {
  const saved = store.list("dtg");
  $("printer").innerHTML = [...PRESETS.map(m => `<option value="p:${m.id}">${m.name}</option>`), `<option value="custom">Custom printer…</option>`,
    ...saved.map(m => `<option value="s:${m.id}">Saved: ${escapeHtml(m.name)}</option>`)].join("");
  if (keep) $("printer").value = keep; if (!$("printer").value) $("printer").value = "p:" + PRESETS[0].id;
}
const FIELD = { "white.supply": "how the RIP takes white", "white.ripMakesWhite": "whether the RIP keeps our white", "dpi.file": "file resolution", "dtg.chokeMm": "choke",
  "media": "default platen", "dtg.platens": "platen list", "dtg.pretreat": "pretreat", "dtg.software": "software" };
const plainField = v => { const m = v.match(/^([\w.]+)(.*)$/); return m && FIELD[m[1]] ? FIELD[m[1]] + m[2] : v; };
function pickPrinter() {
  const v = $("printer").value; $("customBox").hidden = v !== "custom";
  if (v.startsWith("p:")) S.machine = PRESETS.find(m => "p:" + m.id === v);
  else if (v.startsWith("s:")) S.machine = store.list("dtg").find(m => "s:" + m.id === v);
  else S.machine = customMachine({ name: $("cName").value || "Custom printer", widthIn: +$("cW").value, heightIn: +$("cH").value, dpi: +$("cDpi").value, id: "custom-" + Date.now().toString(36) });
  $("platen").innerHTML = S.machine.dtg.platens.map(p => `<option>${escapeHtml(p.name)}</option>`).join("");
  const def = S.machine.dtg.platens.find(p => p.widthIn === S.machine.media.widthIn && p.heightIn === S.machine.media.heightIn); if (def) $("platen").value = def.name;
  S.platen = $("platen").value; $("supply").value = S.machine.white.supply === "none" ? "none" : "file";
  const src = S.machine.sources ?? [], ver = S.machine.verify ?? [];
  $("printerSrc").innerHTML = (src.length ? "Sources: " + src.map(s => `<a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.what.split(";")[0])}</a>`).join("; ") + ". " : "") +
    (ver.length ? "Default, verify: " + ver.map(v => escapeHtml(plainField(v))).join(", ") + "." : "");
  garmentButtons(); update();
}
$("saveMachine").onclick = () => {
  const m = { ...S.machine, white: { ...S.machine.white, supply: $("supply").value, ripMakesWhite: $("supply").value === "none" ? true : null } };
  if (m.preset !== "custom" && !m.id.startsWith("saved-")) m.id = "saved-" + m.id + "-" + Date.now().toString(36);
  try { store.save(m); $("savedNote").textContent = storage ? "Saved in this browser (your ADN account will keep them later)." : "Saved for this visit only (browser storage is off)."; }
  catch (e) { $("savedNote").textContent = String(e.message || e); return; }
  printerOptions("s:" + m.id); renderMachines();
};

/* ───────────── Step 2: garment ───────────── */
const TEE = fill => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3 4 5 1 9.5 4 11.5 5 10.5V21h14V10.5l1 1 3-2L20 5l-4-2c-.6 1.6-2.2 2.6-4 2.6S8.6 4.6 8 3Z" fill="${fill}"/></svg>`;
$("garments").innerHTML = `<label class="chip-other" title="Any other garment colour">${TEE("url(#rainbow)").replace("</svg>", `<defs><linearGradient id="rainbow" x1="0" x2="1"><stop offset="0" stop-color="#e53935"/><stop offset=".33" stop-color="#fdd835"/><stop offset=".66" stop-color="#43a047"/><stop offset="1" stop-color="#1e88e5"/></linearGradient></defs></svg>`)}<span>Other</span><input type="color" id="gCustom" value="#1a1a1c" aria-label="Other garment colour"></label>`;
function garmentButtons() {
  const list = garmentsFor(S.machine), box = $("garments"), other = box.querySelector(".chip-other");
  if (!list.some(g => g.id === S.garment.id) && S.garment.id !== "custom") S.garment = list[0];
  box.querySelectorAll("button").forEach(b => b.remove());
  other.insertAdjacentHTML("beforebegin", list.map(g => `<button type="button" data-g="${g.id}" title="${g.name}" aria-label="${g.name}" aria-pressed="${g.id === S.garment.id}">${TEE(g.hex)}<span>${g.name}</span></button>`).join(""));
  if (S.garment.hex) $("gCustom").value = S.garment.hex;
  $("teeName").textContent = S.garment.name;
  $("gName").textContent = `${S.garment.name}: ${garmentClass(S.garment.lab)} garment${S.garment.measured ? ", measured" : ", estimate"}.`;
}
$("garments").onclick = e => { const b = e.target.closest("button[data-g]"); if (!b) return; S.garment = GARMENTS.find(g => g.id === b.dataset.g); garmentButtons(); update(); };
$("gCustom").oninput = () => { S.garment = makeGarment({ hex: $("gCustom").value }); garmentButtons(); update(); };

/* ───────────── Step 1: art ───────────── */
const busy = t => { $("busyMask").hidden = !t; if (t) $("busyText").textContent = t; };
async function readImage(file) {
  const bmp = await createImageBitmap(file, { premultiplyAlpha: "none", colorSpaceConversion: "default" });
  const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
  return { rgba: x.getImageData(0, 0, c.width, c.height).data, W: c.width, H: c.height };
}
function downscale(a, max) {
  const s = Math.min(1, max / Math.max(a.W, a.H)); if (s === 1) return a;
  const W = Math.max(1, Math.round(a.W * s)), H = Math.max(1, Math.round(a.H * s)), rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const sx = Math.min(a.W - 1, Math.floor(x / s)), sy = Math.min(a.H - 1, Math.floor(y / s)); rgba.set(a.rgba.subarray((sy * a.W + sx) * 4, (sy * a.W + sx) * 4 + 4), (y * W + x) * 4); }
  return { rgba, W, H };
}
/** New art: the file card in step 1, the preview, then step 2, as the Separation Table does. */
function setArt(art, label) {
  S.art = art; S.label = label; S.name = label.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-") || "art"; S.preview = downscale(art, PREVIEW_MAX);
  Z.z = "fit"; Z.x = Z.y = 0; st.written = false; clearLinks(); $("status").textContent = "";
  $("drop").hidden = true; $("fileCard").hidden = false; $("artName").textContent = label; $("artSize").textContent = `${art.W} × ${art.H} px`;
  const t = $("artThumb"), g = t.getContext("2d"), p = S.preview, k = Math.min(144 / p.W, 144 / p.H), c = document.createElement("canvas"); c.width = p.W; c.height = p.H; c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(p.rgba), p.W, p.H), 0, 0);
  g.clearRect(0, 0, 144, 144); g.drawImage(c, (144 - p.W * k) / 2, (144 - p.H * k) / 2, p.W * k, p.H * k);
  $("export").disabled = false; update(); setStep(2);
}
async function openFile(f) {
  if (!f) return; busy(`Reading ${f.name}…`); await tick();
  try { setArt(await readImage(f), f.name); } catch (e) { $("status").textContent = "Could not read that file: " + (e.message || e); if (st.step !== 1) setStep(1); }
  busy(null);
}
$("file").addEventListener("change", e => { openFile(e.target.files[0]); e.target.value = ""; });
const drop = $("drop"), square = $("square");
for (const el of [drop, square]) {
  el.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("on"); });
  el.addEventListener("dragleave", () => drop.classList.remove("on"));
  el.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("on"); openFile([...e.dataTransfer.files].find(f => /image\//.test(f.type))); });
}
for (const el of [drop, $("fileCard")]) el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("file").click(); } });
/** The sample design, drawn here: a red disc with a soft edge, a yellow ring, a white bar and a black bar on a clear
    background, so the white layer, the highlight white and the knockout on a black garment all have something to show. */
function sampleArt() {
  const W = 1800, H = 1800, rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - 900, y - 780), q = (y * W + x) * 4;
    let c = [0, 0, 0, 0];
    if (d < 630) c = [214, 40, 40, Math.round(255 * Math.min(1, (630 - d) / 36))];
    if (Math.abs(d - 450) < 39) c = [250, 204, 21, 255];
    if (x > 270 && x < 1530 && y > 705 && y < 855) c = [255, 255, 255, 255];
    if (x > 270 && x < 1530 && y > 1515 && y < 1665) c = [26, 26, 28, 255];
    rgba[q] = c[0]; rgba[q + 1] = c[1]; rgba[q + 2] = c[2]; rgba[q + 3] = c[3];
  }
  return { rgba, W, H };
}
$("trySample").addEventListener("click", () => setArt(sampleArt(), "Sample design"));
$("dropSample").addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); setArt(sampleArt(), "Sample design"); });

/* ───────────── Shop setup: measured ramps ───────────── */
$("rampsOpen").addEventListener("click", () => $("ramps").click());
$("ramps").onchange = async () => {
  const f = $("ramps").files[0]; if (!f) return;
  try {
    S.ramps = readRamps(await f.text()); const sets = Object.keys(S.ramps.white);
    $("rampSet").innerHTML = sets.map(s => `<option>${escapeHtml(s)}</option>`).join(""); $("rampSetBox").hidden = !sets.length;
    S.model = sets.length ? S.ramps.white[sets[0]].model : null;
    $("rampReport").innerHTML = rampReport(S.ramps).map(l => `<li>${escapeHtml(l)}</li>`).join("");
  } catch (e) { S.ramps = null; S.model = null; $("rampSetBox").hidden = true; $("rampReport").innerHTML = `<li class="bad">${escapeHtml(e.message || e)}</li>`; }
  $("ramps").value = ""; update();
};
$("rampSet").onchange = () => { S.model = S.ramps.white[$("rampSet").value].model; update(); };

/* ───────────── Compute ───────────── */
function opts(dpi) {
  return { rule: $("rule").value, strength: +$("strength").value, chokePx: chokePixels(+$("choke").value, dpi), knockout: $("ko").checked, koTol: +$("koTol").value, highlight: $("hl").checked, ...(S.model && { model: S.model }) };
}
function run(a, dpi) {
  const P = a.W * a.H, lab = new Float32Array(P * 3), alpha = new Uint8Array(P), cache = new Map();
  for (let p = 0; p < P; p++) {
    const r = a.rgba[p * 4], g = a.rgba[p * 4 + 1], b = a.rgba[p * 4 + 2], k = (r << 16) | (g << 8) | b;
    let l = cache.get(k); if (!l) { l = rgb2lab(r, g, b); cache.set(k, l); } lab[p * 3] = l[0]; lab[p * 3 + 1] = l[1]; lab[p * 3 + 2] = l[2]; alpha[p] = a.rgba[p * 4 + 3];
  }
  const o = opts(dpi), L = buildWhiteLayers({ lab, alpha, W: a.W, H: a.H, garmentLab: S.garment.lab, opts: o });
  const compensate = o.rule === "reach" && $("supply").value === "file";
  const colourIn = compensate ? compensateColour(a.rgba, L, S.garment.lab, S.model ?? undefined) : a.rgba;
  return { L, colourIn, compensate, o };
}
function update() {
  renderMarks(); st.written = false; clearLinks();
  const warn = [];
  if ($("rule").value === "reach" && $("supply").value === "none") warn.push("Your RIP makes its own white, so it cannot print less white than it chooses: least white needs a RIP that takes a separate white file. The white files here are a reference.");
  if ($("rule").value === "reach" && !S.model) warn.push("No measured white ramp: least white is model only. In the benchmark a wrong white model costs about 2 ΔE00; import the white ramp first.");
  $("ruleWarn").hidden = !warn.length; $("ruleWarn").textContent = warn.join(" ");
  // the mark: model only until a measured white ramp is imported (Shop setup)
  for (const id of ["drChk", "modelPill", "rampPill"]) $(id).textContent = S.model ? "Measured white" : "Model only";
  $("modelWhy").textContent = S.model ? "ramp imported: the white model is measured." : "until measured ramps are imported.";
  if (!S.preview) { S.result = null; renderStats(null); renderPlacement(); renderFilesNote(); renderStepRows(); renderNav(); return; }
  const fit = fitArt(S.machine, $("platen").value, S.art.W, S.art.H, +$("widthIn").value);
  $("fitNote").textContent = `${S.art.W}×${S.art.H} px → ${fit.widthIn.toFixed(2)}×${fit.heightIn.toFixed(2)} in at ${Math.round(fit.ppi)} ppi on the ${fit.platen} platen (largest ${fit.maxWidthIn.toFixed(2)}×${fit.maxHeightIn.toFixed(2)} in).` + (fit.warnings.length ? " " + fit.warnings.join(". ") + "." : "");
  $("artInfo").textContent = `${fit.widthIn.toFixed(2)} × ${fit.heightIn.toFixed(2)} in · ${Math.round(fit.ppi)} ppi`;
  const a = S.preview, dpi = a.W / +$("widthIn").value, r = run(a, dpi);
  const pr = garmentProof({ rgba: a.rgba, colour: r.colourIn, W: a.W, H: a.H, garmentLab: S.garment.lab, layers: r.L, stride: 2, ...(S.model && { model: S.model }) });
  const platen = S.machine.dtg.platens.find(x => x.name === $("platen").value) ?? S.machine.dtg.platens[0];
  const place = placeArt({ platen, artWidthIn: fit.widthIn, artHeightIn: fit.heightIn, collarIn: +$("collarIn").value || 0, shiftIn: +$("shiftIn").value || 0 });
  S.result = { ...r, pr, a, fit, place }; draw(); renderStats(S.result); renderPlacement(); renderFilesNote(); renderStepRows(); renderNav();
}
for (const id of ["rule", "strength", "choke", "ko", "koTol", "hl", "supply", "widthIn", "platen", "collarIn", "shiftIn"]) $(id).addEventListener(id === "strength" || id === "choke" || id === "koTol" ? "change" : "input", update);
for (const id of ["strength", "choke", "koTol"]) $(id).addEventListener("input", renderMarks);
for (const id of ["cW", "cH", "cDpi", "cName"]) $(id).addEventListener("change", pickPrinter);
$("printer").onchange = pickPrinter;

/* ───────────── Workspace: the views, Fit and zoom ───────────── */
const VIEW = { art: "The art as you gave it.", proof: "The model of the print on the garment.", platen: "The print on the platen, with the operator's guides. Show guides is in step 2.", colour: "The colour layer on the garment.", white: "The white under the colour: white is full white ink.",
  highlight: "The highlight white: white is full white ink.", knockout: "Pink: the areas that print as the bare garment." };
function setView(v) { if ((v === "proof") !== (S.view === "proof")) Z.z = "fit"; S.view = v; for (const b of $("view").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.v === v)); draw(); }
$("view").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (b) setView(b.dataset.v); });
const fitPad = () => 2 * (parseFloat(getComputedStyle($("square")).getPropertyValue("--fitpad")) || 0);
/** Proof with Show guides on: the workspace draws the platen and the guides (drawPlacement) in place of the bare proof. */
const guided = () => S.view === "proof" && $("guides").checked && !!S.result;
// The platen picture is drawn at its shown size, so its labels stay readable: 100% is 96 px for each inch, 36 px of
// the box are margin and the platen's label. The other views are the preview's pixels.
const PLATEN_PPI = 96, zMax = () => guided() ? 2 : 8;
const zFit = () => { const b = $("canvasBox"), m = fitPad(), a = S.preview;
  if (guided()) { const p = S.result.place.platen; return Math.min(1, Math.max(120, b.clientWidth - 42) / (p.w * PLATEN_PPI), Math.max(120, b.clientHeight - 66) / (p.h * PLATEN_PPI)); }
  return Math.min(1, Math.max(200, b.clientWidth - m) / a.W, Math.max(200, b.clientHeight - m) / a.H); }, zClamp = z => Math.max(zFit(), Math.min(zMax(), z));
function draw() {
  const R = S.result, cv = $("view0"); $("zoomBox").hidden = !R; $("sizeBadge").hidden = !R;
  if (!R) { $("square").style.background = ""; return; }
  const { a, L, pr, colourIn, fit } = R, P = a.W * a.H, g = hex2rgb(S.garment.hex || "#1a1a1c");
  $("sizeBadge").textContent = `${fit.widthIn.toFixed(1)} × ${fit.heightIn.toFixed(1)} in`;
  if (guided()) { $("square").style.background = ""; cv.setAttribute("aria-label", placementLines(R.place).join(" ")); place(); return; }
  cv.width = a.W; cv.height = a.H;
  const img = new ImageData(a.W, a.H), d = img.data, mix = (x, y, t, k) => x[k] * (1 - t) + y[k] * t, grd = [40, 40, 40], wht = [255, 255, 255], ko = [230, 60, 160];
  for (let p = 0; p < P; p++) {
    let c;
    if (S.view === "art") { const t = a.rgba[p * 4 + 3] / 255, x = p % a.W, y = (p / a.W) | 0, chk = ((x >> 4) + (y >> 4)) & 1 ? [200, 200, 200] : [238, 238, 238], src = [a.rgba[p * 4], a.rgba[p * 4 + 1], a.rgba[p * 4 + 2]]; c = [0, 1, 2].map(k => mix(chk, src, t, k)); }
    else if (S.view === "proof") c = [pr.rgba[p * 4], pr.rgba[p * 4 + 1], pr.rgba[p * 4 + 2]];
    else if (S.view === "colour") { const t = L.colorAlpha[p], src = [colourIn[p * 4], colourIn[p * 4 + 1], colourIn[p * 4 + 2]]; c = [0, 1, 2].map(k => mix(g, src, t, k)); }
    else { const t = S.view === "white" ? L.underbase[p] : S.view === "highlight" ? L.highlight[p] : L.knockout[p] * a.rgba[p * 4 + 3] / 255; c = [0, 1, 2].map(k => mix(grd, S.view === "knockout" ? ko : wht, t, k)); }
    d[p * 4] = c[0]; d[p * 4 + 1] = c[1]; d[p * 4 + 2] = c[2]; d[p * 4 + 3] = 255;
  }
  cv.getContext("2d").putImageData(img, 0, 0);
  cv.setAttribute("aria-label", `${S.view} view of the art on ${S.garment.name}`);
  // the workspace is on the garment colour where the view shows the garment, as the Separation Table's is
  $("square").style.background = S.view === "proof" || S.view === "colour" ? S.garment.hex || "" : S.view === "art" ? "" : "rgb(40,40,40)";
  place();
}
/** Size and place the picture: Fit, or zoomed and moved. */
function place() {
  if (!S.result) return;
  const cv = $("view0"), a = S.preview, g = guided(), f = zFit(), fit = Z.z === "fit" || Z.z <= f + 1e-9, z = fit ? f : /** @type {number} */ (Z.z), b = $("canvasBox");
  if (fit) { Z.z = "fit"; Z.x = Z.y = 0; }
  // the platen picture is drawn again at each size; the other views are one picture, scaled
  if (g) drawPlacement(cv, S.result, PLATEN_PPI * z, 12, { page: css("--ws"), fg: css("--fg"), guide: css("--fg"), red: css("--red") });
  const cw = g ? cv.width : Math.round(a.W * z), ch = g ? cv.height : Math.round(a.H * z);
  const mx = Math.max(0, (cw - b.clientWidth) / 2 + 45), my = Math.max(0, (ch - b.clientHeight) / 2 + 45);
  Z.x = Math.max(-mx, Math.min(mx, Z.x)); Z.y = Math.max(-my, Math.min(my, Z.y));
  cv.classList.toggle("zoomed", !fit); cv.classList.toggle("platen", g); $("sizeBadge").hidden = g; // the platen picture names the art's size itself
  cv.style.width = `${cw}px`; cv.style.height = `${ch}px`;
  cv.style.transform = fit ? "" : `translate(${Z.x}px,${Z.y}px)`; cv.style.imageRendering = !g && z >= 2 ? "pixelated" : "";
  const sl = $("zoomSlider"), lbl = fit ? "Fit" : `${Math.round(z * 100)}%`;
  sl.min = String(Math.log2(f).toFixed(3)); sl.max = String(Math.log2(zMax())); sl.value = String(Math.log2(z)); $("zoomPct").textContent = lbl;
  $("zStep").setAttribute("aria-label", `Fit. Zoom is ${lbl}.`); $("zStep").setAttribute("aria-pressed", String(fit));
  $("inspWhere").textContent = fit ? VIEW[g ? "platen" : S.view] : g ? `${lbl} of the platen's real size · drag to move` : `${lbl} of the ${a.W} × ${a.H} px view · the files have the art's full resolution · drag to move`;
}
$("zStep").addEventListener("click", () => { Z.z = "fit"; place(); zoomTip(true); });
$("z100").addEventListener("click", () => { Z.z = zClamp(1); place(); zoomTip(true); });
let tipT = 0;
function zoomTip(show = true) { const sl = $("zoomSlider"), tip = $("zoomPct"), f = (+sl.value - +sl.min) / ((+sl.max - +sl.min) || 1), th = 24;
  tip.style.left = `${th / 2 + f * (sl.clientWidth - th)}px`; clearTimeout(tipT); tip.classList.toggle("on", show); if (show) tipT = window.setTimeout(() => tip.classList.remove("on"), 1400); }
$("zoomSlider").addEventListener("input", () => { const sl = $("zoomSlider"), v = +sl.value; Z.z = v <= +sl.min + 0.02 ? "fit" : zClamp(2 ** v); place(); zoomTip(true); });
$("zoomSlider").addEventListener("focus", () => zoomTip(true));
// The slider row reads the pointer itself, as the Separation Table's does (the slider takes no pointer, bench.css), so a
// scroll that starts on it never zooms: a sideways drag moves the zoom, a tap jumps to that spot, an up/down drag only
// scrolls the page (touch-action pan-y). The keyboard still moves the slider.
{ const sl = $("zoomSlider"), row = sl.parentElement;
  let g = null;
  const setAt = x => { const r = sl.getBoundingClientRect(), th = 24, f = Math.max(0, Math.min(1, (x - r.left - th / 2) / Math.max(1, r.width - th)));
    sl.value = String(+sl.min + f * (+sl.max - +sl.min)); sl.dispatchEvent(new Event("input", { bubbles: true })); };
  row.addEventListener("pointerdown", e => {
    if (e.pointerType !== "touch") { if (e.button !== 0) return;
      g = { id: e.pointerId, x: e.clientX, y: e.clientY, top: row.getBoundingClientRect().top, mode: "h" }; row.setPointerCapture(e.pointerId); setAt(e.clientX); return; }
    g = { id: e.pointerId, x: e.clientX, y: e.clientY, top: row.getBoundingClientRect().top, mode: "" }; });
  row.addEventListener("pointermove", e => { if (!g || e.pointerId !== g.id) return; const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.mode && Math.hypot(dx, dy) > 8) { g.mode = Math.abs(dx) > Math.abs(dy) ? "h" : "v"; if (g.mode === "h") row.setPointerCapture(e.pointerId); }
    if (g.mode === "h") setAt(e.clientX); });
  row.addEventListener("pointerup", e => { if (!g || e.pointerId !== g.id) return; if (!g.mode && Math.hypot(e.clientX - g.x, e.clientY - g.y) <= 8 && Math.abs(row.getBoundingClientRect().top - g.top) <= 8) setAt(e.clientX); g = null; });
  row.addEventListener("pointercancel", () => { g = null; }); }
{ const cv = $("view0"); let from = null;
  cv.addEventListener("pointerdown", e => { if (Z.z === "fit") return; from = { x: e.clientX - Z.x, y: e.clientY - Z.y }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => { if (!from) return; Z.x = e.clientX - from.x; Z.y = e.clientY - from.y; place(); });
  for (const ev of ["pointerup", "pointercancel"]) cv.addEventListener(ev, () => { from = null; }); }
{ let t = 0; new ResizeObserver(() => { clearTimeout(t); t = window.setTimeout(place, 150); }).observe($("square")); }

/* ───────────── Placement guides (the workspace in Proof, and the operator sheet; never in the RIP files) ───────────── */
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#2a2a2d";
function proofCanvas(R) {
  const c = document.createElement("canvas"); c.width = R.a.W; c.height = R.a.H;
  const img = new ImageData(R.a.W, R.a.H); img.data.set(R.pr.rgba);
  // the proof is opaque garment colour outside the art; keep only the art's own area
  for (let p = 0; p < R.a.W * R.a.H; p++) img.data[p * 4 + 3] = R.a.rgba[p * 4 + 3];
  c.getContext("2d").putImageData(img, 0, 0); return c;
}
/** Draw the platen, the guides and the art at `ppi` pixels per inch, with `pad` px around (more below for the
    platen's label). Guide lines contrast with the garment; labels sit on solid plates so they read on any shirt. */
function drawPlacement(cv, R, ppi, pad, colours) {
  const p = R.place, fs = Math.max(11, Math.round(ppi * 0.16)), below = fs + 12;
  const W = Math.round(p.platen.w * ppi + 2 * pad), H = Math.round(p.platen.h * ppi + 2 * pad + below);
  cv.width = W; cv.height = H; const x = cv.getContext("2d"), X = v => pad + v * ppi;
  const guide = S.garment.lab[0] > 55 ? "#2a2a2d" : "#ffffff";
  x.fillStyle = colours.page; x.fillRect(0, 0, W, H);
  x.fillStyle = S.garment.hex || "#1a1a1c"; x.fillRect(X(0), X(0), p.platen.w * ppi, p.platen.h * ppi);
  x.drawImage(proofCanvas(R), X(p.art.x), X(p.art.y), p.art.w * ppi, p.art.h * ppi);
  x.lineWidth = 1; x.strokeStyle = colours.fg; x.strokeRect(X(0) + 0.5, X(0) + 0.5, p.platen.w * ppi - 1, p.platen.h * ppi - 1);
  x.setLineDash([6, 6]); x.strokeStyle = guide;
  x.beginPath(); x.moveTo(X(p.centreX) + 0.5, X(0)); x.lineTo(X(p.centreX) + 0.5, X(p.platen.h)); x.stroke();
  x.beginPath(); x.moveTo(X(0), X(p.collarIn) + 0.5); x.lineTo(X(p.platen.w), X(p.collarIn) + 0.5); x.stroke();
  x.setLineDash([]); x.strokeStyle = p.fits ? guide : colours.red; x.lineWidth = 2;
  x.strokeRect(X(p.art.x), X(p.art.y), p.art.w * ppi, p.art.h * ppi);
  x.font = `700 ${fs}px "Helvetica Neue",Helvetica,Arial,sans-serif`; x.textBaseline = "top";
  const f = v => (Math.round(v * 100) / 100).toFixed(2);
  const label = (t, lx, ly, colour = colours.fg) => { const w = x.measureText(t).width + 9; lx = Math.max(0, Math.min(W - w, lx)); x.fillStyle = colours.page; x.fillRect(lx, ly, w, fs + 6); x.fillStyle = colour; x.fillText(t, lx + 4.5, ly + 3); };
  label("COLLAR / TOP EDGE", X(0) + 6, X(0) + 6);
  label(`${f(p.collarIn)} IN BELOW COLLAR`, X(0) + 6, X(p.collarIn) + 6);
  label("CENTRE", X(p.centreX) + 6, X(p.platen.h) - fs - 12);
  label(`ART ${f(p.art.w)} × ${f(p.art.h)} IN`, X(p.art.x) + 6, X(p.art.y + p.art.h) - fs - 12, p.fits ? colours.fg : colours.red);
  label(`${p.platen.name.toUpperCase()} PLATEN ${f(p.platen.w)} × ${f(p.platen.h)} IN`, X(0), X(p.platen.h) + 6);
  return cv;
}
async function placementSheet() {
  const R = S.result, ppi = 100, pad = 60, colours = { page: "#ffffff", fg: "#2a2a2d", guide: "#2a2a2d", red: "#a60315" };
  const plate = drawPlacement(document.createElement("canvas"), R, ppi, pad, colours);
  const lines = [`DTG PLACEMENT — ${S.name}`, `${S.machine.name} · ${S.garment.name}`, ...placementLines(R.place)], lh = 30;
  const c = document.createElement("canvas"); c.width = Math.max(plate.width, 1200); c.height = plate.height + pad + lines.length * lh + pad;
  const x = c.getContext("2d"); x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(plate, 0, 0);
  x.textBaseline = "top";
  lines.forEach((l, i) => { x.font = `${i === 0 ? 700 : 400} 22px "Helvetica Neue",Helvetica,Arial,sans-serif`; x.fillStyle = R.place.warnings.includes(l) ? colours.red : colours.fg; x.fillText(l, pad, plate.height + pad / 2 + i * lh); });
  const blob = await new Promise(r => c.toBlob(r, "image/png")); return pngWithDpi(new Uint8Array(await blob.arrayBuffer()), ppi);
}
/** Step 2: the warning past the printable area, and the operator's lines while the guides show. */
function renderPlacement() {
  const R = S.result, show = $("guides").checked && !!R;
  $("placeBox").hidden = !show; $("placeWarn").hidden = !R || R.place.fits; if (!R) return;
  $("placeWarn").textContent = R.place.warnings.join(" ");
  if (show) $("placeLines").innerHTML = placementLines(R.place).filter(l => !R.place.warnings.includes(l)).map(l => `<li>${escapeHtml(l)}</li>`).join("");
}
$("guides").addEventListener("change", () => { Z.z = "fit"; renderPlacement(); draw(); });

/* ───────────── Proof and numbers (the rating row) ───────────── */
function renderStats(R) {
  const set = (id, v) => { $(id).textContent = v; };
  if (!R) { for (const id of ["drNum", "rMean", "sWhite", "sHl", "sKo", "sDe", "sPpi"]) set(id, "–"); for (const id of ["drFacts", "sDeSub", "sSize"]) set(id, ""); set("mrDe", "No art yet"); set("rModel", "model only"); return; }
  const s = R.L.stats, area = R.fit.widthIn * R.fit.heightIn, w = s.whiteArea / s.pixels * area, h = s.highlightArea / s.pixels * area, how = S.model ? "measured white" : "model only";
  set("drNum", R.pr.stats.meanDE.toFixed(2)); set("rMean", R.pr.stats.meanDE.toFixed(2)); set("rModel", `mean · p95 ${R.pr.stats.p95DE.toFixed(2)} · ${how}`);
  $("drFacts").innerHTML = `<span>ΔE00</span><span>White <b>${w.toFixed(1)} in²</b></span><span><b>${Math.round(R.fit.ppi)}</b> ppi</span>`;
  set("mrDe", `ΔE00 · white ${w.toFixed(1)} in²`);
  set("sWhite", w.toFixed(1) + " in²"); set("sHl", h.toFixed(1) + " in²"); set("sKo", (100 * s.knockedOut / Math.max(1, s.artArea)).toFixed(0) + " %");
  set("sDe", R.pr.stats.meanDE.toFixed(2)); set("sDeSub", `p95 ${R.pr.stats.p95DE.toFixed(2)} · ${how}`);
  set("sPpi", Math.round(R.fit.ppi) + " ppi"); set("sSize", `${R.fit.widthIn.toFixed(2)}×${R.fit.heightIn.toFixed(2)} in`);
}
$("dRate").addEventListener("click", () => { st.rOpen = !st.rOpen; $("rating").classList.toggle("open", st.rOpen); $("dRate").setAttribute("aria-expanded", String(st.rOpen)); $("dRate").querySelector(".mrarr").textContent = st.rOpen ? "▴" : "▾"; });

/* ───────────── Step 4: files ───────────── */
function clearLinks() { for (const u of st.urls) URL.revokeObjectURL(u); st.urls = []; $("links").textContent = ""; $("expStatus").textContent = ""; }
function renderFilesNote() {
  const rip = $("supply").value === "none";
  $("filesNote").textContent = (rip ? "Your RIP makes white from the colour file: load the colour file. The white files are a reference of what this page would print." : "Load the colour file and the white file(s) in your RIP.") +
    (S.result && S.result.compensate ? " The colour file is lightened for the partial white under it, so it only prints right with this page's white file." : "") +
    " Files are made at the art's full resolution and carry their print resolution. The placement sheet is for the operator, not the RIP.";
}
for (const id of ["fPNG", "fTIF", "fPlace"]) $(id).addEventListener("change", () => { clearLinks(); st.written = false; renderStepRows(); renderNav(); });
async function pngBytes(rgba, W, H, dpi) {
  const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").putImageData(new ImageData(rgba, W, H), 0, 0);
  const blob = await new Promise(r => c.toBlob(r, "image/png")); return pngWithDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
}
/** Make the colour file and the white files (the highlight white too, when it is on) in the chosen types, at the art's
    full resolution, and list them as links to save. */
$("export").addEventListener("click", async () => {
  if (!S.art) { setStep(1); return; }
  const formats = [["png", "fPNG"], ["tiff", "fTIF"]].filter(([, id]) => $(id).checked).map(([f]) => f);
  clearLinks(); if (!formats.length && !$("fPlace").checked) { $("expStatus").textContent = "Choose at least one file type."; return; }
  $("export").disabled = true; busy("Making the files…"); $("expStatus").textContent = "Making the files…"; await tick();
  try {
    const a = S.art, dpi = a.W / +$("widthIn").value, r = run(a, dpi), P = a.W * a.H, suffix = $("supply").value === "none" ? "-reference" : "";
    const list = (bytes, name, type, f) => { const url = URL.createObjectURL(new Blob([bytes], { type })), link = document.createElement("a"), li = document.createElement("li");
      link.href = url; link.download = name; link.textContent = `${name} (${(bytes.length / 1e6).toFixed(1)} MB)`; link.dataset.f = f; st.urls.push(url); li.append(link); $("links").append(li); };
    for (const kind of ["colour", "white", ...($("hl").checked ? ["highlight"] : [])]) for (const fmt of formats) {
      busy(`Making the ${kind} ${fmt.toUpperCase()}…`); await tick();
      let bytes;
      if (kind === "colour") { const c = colourLayer(r.colourIn, r.L.colorAlpha, P); bytes = fmt === "tiff" ? toTIFF8({ W: a.W, H: a.H, channels: 4, data: new Uint8Array(c.buffer), dpi }) : await pngBytes(c, a.W, a.H, dpi); }
      else { const g = whiteLayer(kind === "white" ? r.L.underbase : r.L.highlight); if (fmt === "tiff") bytes = toTIFF8({ W: a.W, H: a.H, channels: 1, data: g, dpi }); else { const rgba = new Uint8ClampedArray(P * 4); for (let p = 0; p < P; p++) rgba.set([g[p], g[p], g[p], 255], p * 4); bytes = await pngBytes(rgba, a.W, a.H, dpi); } }
      list(bytes, `${S.name}-${kind}${kind === "colour" ? "" : suffix}.${fmt === "tiff" ? "tif" : "png"}`, fmt === "tiff" ? "image/tiff" : "image/png", `${kind}-${fmt}`);
    }
    // the operator's placement sheet is its own file; the colour and white files carry no guides
    if ($("fPlace").checked) { busy("Making the placement sheet…"); await tick(); list(await placementSheet(), `${S.name}-placement.png`, "image/png", "placement-png"); }
    st.written = true; $("expStatus").textContent = "Done. Save each file, then load them in your printer's software.";
  } catch (err) { $("expStatus").textContent = "Could not make the files: " + (err.message || err); }
  busy(null); $("export").disabled = false; renderStepRows(); renderNav();
});

/* ───────────── The workspace pin, and the page framed in an ADN page (the Separation Table's rules) ─────────────
   Phones: the workspace pins at the top of the screen (bench.css) while the rows and the steps scroll under it.
   Framed in an ADN page (the tool page, the wall), the frame is as tall as the table and the page scrolls, not the
   table. The page's scroll is read instead: y is how far the page has scrolled past the frame's top (under the site
   header and the program header, [data-tool-header]); vh is the height left to see. --pin carries y to the sticky
   offsets in bench.css, so the art pins under the page's headers. */
const frameEl = (() => { try { return window.parent !== window ? window.frameElement : null; } catch { return null; } })();
function parentPin() {
  if (!frameEl) return null;
  try { const P = window.parent, d = P.document, fr = frameEl.getBoundingClientRect();
    const hdr = parseFloat(P.getComputedStyle(d.documentElement).getPropertyValue("--adn-hdr-h")) || 0; let top = hdr, held = hdr;
    d.querySelectorAll("[data-tool-header]").forEach(e => { const r = e.getBoundingClientRect(); if (r.height) { top = Math.max(top, r.bottom); held += r.height; } });
    return { y: Math.max(0, Math.round(top - fr.top)), vh: Math.max(240, P.innerHeight - held) }; } catch { return null; }
}
/** Desktop: the workspace column is as tall as the window (framed in an ADN page: the height under the page's
    headers). Framed in a page that cannot be read there is no height to take: the workspace is a square. */
function deskFit() {
  const pp = parentPin(), h = pp ? pp.vh : window.parent !== window ? 0 : window.innerHeight, r = document.documentElement.style;
  if (h) r.setProperty("--wsh", `${h}px`); else r.removeProperty("--wsh");
}
function syncSq() {
  const r = document.documentElement.style, pp = parentPin(); r.setProperty("--pin", `${pp ? pp.y : 0}px`);
  if (pp) r.setProperty("--pvh", `${pp.vh}px`); // the height in view, for a panel that opens over the table (page.css)
  if (!phone()) { document.body.classList.remove("nopin"); deskFit(); return; }
  // a screen so short (landscape) that the pinned workspace would leave the steps under 160 px: it scrolls away
  const vh = pp ? pp.vh : window.innerHeight, navH = pp ? 0 : $("mNav").getBoundingClientRect().height;
  document.body.classList.toggle("nopin", vh - navH - $("square").getBoundingClientRect().height < 160);
}
window.addEventListener("resize", syncSq); window.addEventListener("scroll", syncSq, { passive: true });
if (frameEl) try { window.parent.document.addEventListener("scroll", syncSq, { passive: true, capture: true }); window.parent.addEventListener("resize", syncSq); } catch { /* other origin */ }
document.querySelectorAll("input[type=number]").forEach(/** @param {any} i */ i => { i.inputMode = "decimal"; });
// Framed in an ADN tool page, the page header has the Help button (?); the table hides its own (bench.css).
if (window.parent !== window) {
  document.body.classList.add("framed");
  window.addEventListener("scroll", () => { if (window.scrollY) window.scrollTo(0, 0); }, { passive: true }); // the page scrolls, not the frame (iOS bounces frames)
  // On the tool's full page (not the wall) the page's program header carries the title and the setup gear.
  try { if (!window.parent.location.pathname.endsWith("/wall")) document.body.classList.add("inheader"); } catch { /* other origin */ }
}

/* ───────────── Start ───────────── */
printerOptions(); pickPrinter(); setStep(1, false); syncSq();
window.dtgReady = true;
