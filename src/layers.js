// @ts-check
// DTG Table: colour and white layers as print-ready pixels, and the files that carry them. Pure functions, no DOM:
// TIFF is written here (uncompressed, with its resolution), PNG gets its resolution chunk (pHYs) added to a PNG the
// caller encoded (canvas in the browser, the Separation Table CLI encoder in Node).
import { lab2lin, lin2s, S2L } from "./vendor/separation-table/engine.js";
import { makeWhiteModel, substrate } from "./model.js";

/** Colour layer: the art's RGB with the knocked-out alpha (straight, not premultiplied). The RIP sees no pixel
    where the garment shows through. */
export function colourLayer(rgba, colorAlpha, P = colorAlpha.length) {
  const out = new Uint8ClampedArray(P * 4);
  for (let p = 0; p < P; p++) { out[p * 4] = rgba[p * 4]; out[p * 4 + 1] = rgba[p * 4 + 1]; out[p * 4 + 2] = rgba[p * 4 + 2]; out[p * 4 + 3] = Math.round(255 * colorAlpha[p]); }
  return out;
}

/** Colour compensated for partial white. The RIP separates the colour file as if it printed on full white, so on a
    substrate s = g + (w − g)·u (u < 1) a colour t would print as t·s/w, darker than meant. Sending t' = t·w/s per
    linear channel (at most 1) prints t wherever t ≤ s, which is what the reach rule guarantees. Only valid when the
    printer uses our white layer (white.supply "file" or "channel"); when the RIP makes its own white, send the art. */
export function compensateColour(rgba, layers, garmentLab, model = makeWhiteModel()) {
  const P = layers.colorAlpha.length, out = new Uint8ClampedArray(P * 4), sub = [0, 0, 0];
  const g = lab2lin(garmentLab[0], garmentLab[1], garmentLab[2]).map(v => Math.max(0, v)), w = model.w;
  for (let p = 0; p < P; p++) {
    const u = Math.min(1, layers.underbase[p] + layers.highlight[p]);
    // Also where no white prints: on a light or coloured garment the RIP still separates for white, so the colour
    // must be lightened by w/g. On black a colour as dark as the shirt becomes near white (no ink), which is right.
    substrate(model, g, u, sub);
    for (let k = 0; k < 3; k++) { const s = sub[k], t = S2L[rgba[p * 4 + k]]; out[p * 4 + k] = Math.round(255 * lin2s(s > 1e-6 ? Math.min(1, t * w[k] / s) : 1)); }
    out[p * 4 + 3] = rgba[p * 4 + 3];
  }
  return out;
}

/** White layer as 8-bit grey. ink "black" (default): 0 = full white ink, 255 = none, the way a spot channel or film
    reads. ink "white": 255 = full white ink. Underbase and highlight are separate layers; `combine` sums them. */
export function whiteLayer(cov, { ink = "black" } = {}) {
  const out = new Uint8Array(cov.length);
  for (let p = 0; p < cov.length; p++) { const v = Math.round(255 * Math.max(0, Math.min(1, cov[p]))); out[p] = ink === "white" ? v : 255 - v; }
  return out;
}
export function combine(a, b) { const o = new Float32Array(a.length); for (let p = 0; p < a.length; p++) o[p] = Math.min(1, a[p] + b[p]); return o; }

/** Uncompressed baseline TIFF, 8 bits per sample. channels 1 (grey, 0 = black) or 4 (RGBA, unassociated alpha).
    Resolution in dots per inch. Returns a Uint8Array. */
export function toTIFF8({ W, H, channels, data, dpi }) {
  if (![1, 3, 4].includes(channels)) throw new Error("channels must be 1, 3 or 4");
  const n = W * H * channels; if (data.length !== n) throw new Error(`data has ${data.length} bytes, expected ${n}`);
  const tags = [];
  const T = (tag, type, count, value) => tags.push({ tag, type, count, value });
  // types: 3 SHORT, 4 LONG, 5 RATIONAL
  T(256, 4, 1, W); T(257, 4, 1, H); T(258, 3, channels, null); T(259, 3, 1, 1); T(262, 3, 1, channels === 1 ? 1 : 2);
  T(273, 4, 1, 0); T(277, 3, 1, channels); T(278, 4, 1, H); T(279, 4, 1, n); T(282, 5, 1, null); T(283, 5, 1, null);
  T(284, 3, 1, 1); T(296, 3, 1, 2); if (channels === 4) T(338, 3, 1, 2);
  const ifdOff = 8, ifdLen = 2 + tags.length * 12 + 4, extra = ifdOff + ifdLen;
  // out-of-line values: BitsPerSample (when > 2 shorts), XResolution, YResolution
  const bpsOff = extra, bpsLen = channels > 2 ? channels * 2 : 0, xOff = bpsOff + bpsLen + (bpsLen % 4 ? 4 - bpsLen % 4 : 0), yOff = xOff + 8, dataOff = yOff + 8;
  const buf = new Uint8Array(dataOff + n), dv = new DataView(buf.buffer);
  buf[0] = 0x49; buf[1] = 0x49; dv.setUint16(2, 42, true); dv.setUint32(4, ifdOff, true); dv.setUint16(ifdOff, tags.length, true);
  tags.forEach((t, i) => {
    const o = ifdOff + 2 + i * 12; dv.setUint16(o, t.tag, true); dv.setUint16(o + 2, t.type, true); dv.setUint32(o + 4, t.count, true);
    if (t.tag === 258) { if (channels > 2) dv.setUint32(o + 8, bpsOff, true); else for (let k = 0; k < channels; k++) dv.setUint16(o + 8 + k * 2, 8, true); }
    else if (t.tag === 273) dv.setUint32(o + 8, dataOff, true);
    else if (t.tag === 282) dv.setUint32(o + 8, xOff, true);
    else if (t.tag === 283) dv.setUint32(o + 8, yOff, true);
    else if (t.type === 3) dv.setUint16(o + 8, t.value, true); else dv.setUint32(o + 8, t.value, true);
  });
  dv.setUint32(ifdOff + 2 + tags.length * 12, 0, true);
  for (let k = 0; k < bpsLen / 2; k++) dv.setUint16(bpsOff + k * 2, 8, true);
  const den = 100, num = Math.round(dpi * den);
  dv.setUint32(xOff, num, true); dv.setUint32(xOff + 4, den, true); dv.setUint32(yOff, num, true); dv.setUint32(yOff + 4, den, true);
  buf.set(data, dataOff);
  return buf;
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/** Insert (or replace) the pHYs chunk of a PNG so the file carries its print resolution. */
export function pngWithDpi(png, dpi) {
  const u = png instanceof Uint8Array ? png : new Uint8Array(png), dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  const ppm = Math.round(dpi / 0.0254), chunk = new Uint8Array(21), cv = new DataView(chunk.buffer);
  cv.setUint32(0, 9); chunk.set([0x70, 0x48, 0x59, 0x73], 4); cv.setUint32(8, ppm); cv.setUint32(12, ppm); chunk[16] = 1;
  cv.setUint32(17, crc32(chunk.subarray(4, 17)));
  const parts = [u.subarray(0, 8)]; let o = 8, placed = false;
  while (o < u.length) {
    const len = dv.getUint32(o), type = String.fromCharCode(u[o + 4], u[o + 5], u[o + 6], u[o + 7]), end = o + 12 + len;
    if (type !== "pHYs") parts.push(u.subarray(o, end));
    if (type === "IHDR" && !placed) { parts.push(chunk); placed = true; }
    o = end;
  }
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let q = 0; for (const p of parts) { out.set(p, q); q += p.length; }
  return out;
}

/** The files a machine profile asks for, as { name, kind, ... } descriptions; the caller encodes them. white.supply
    "none": colour only (the RIP makes white; our white layers go out as a reference). "file": colour plus separate
    grey white files. "channel": a 5-channel TIFF is not written yet (planned); the white goes as separate files. */
export function filePlan(machine, base = "art") {
  const fmt = machine.output.formats.includes("tiff") ? "tiff" : "png", sup = machine.white.supply, layers = machine.dtg.whiteLayers;
  const files = [{ name: `${base}-colour.${fmt}`, kind: "colour", format: fmt }];
  if (machine.inks.includes("W")) for (const l of layers) files.push({ name: `${base}-white-${l}${sup === "none" ? "-reference" : ""}.${fmt}`, kind: l, format: fmt, reference: sup === "none" });
  return files;
}
