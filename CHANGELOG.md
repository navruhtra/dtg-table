# Changelog

What changed in the DTG Table, in plain words, newest first.
Versions follow semantic versioning; the number lives in src/version.js.

## 0.1.0 (2026-11-20)

First public release. It holds every change since the tool's first
code on 2026-11-18, grouped by the day each change was made (Pacific
time).

[Full release notes](releases/0.1.0.md)

### 2026-11-20

- Own repository: the Separation Table engine is downloaded at a
  pinned commit and checked by SHA-256 (`npm run setup`), with
  NOTICE, THIRD-PARTY-NOTICES.md, a release check and CI

### 2026-11-19

- The page uses the Separation Table layout: four steps on the left,
  the workspace in the middle, Advanced Settings on the right, Back /
  Next on a phone, Light / Dark / Device, Shop setup and Help
- Placement guides on the platen (collar offset, centre line, a
  warning past the printable area) and a placement sheet for the
  operator

### 2026-11-18

- The page: drop art, pick a printer and garment, set the white,
  download the files
- Measured ramps (white density on black, colour on white) read from
  a CSV; a fixed benchmark referee and baseline; test targets for a
  shop to print and measure
- Printer and garment presets, colour and white layer files (PNG,
  TIFF), and a garment proof
- Garment-aware white underbase and garment knockout
