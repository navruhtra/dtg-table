# How DTG Table works

DTG Table prepares print-ready files for direct-to-garment printing: a
colour layer and white layers that the shop loads into its own printer
software. Every step is a pure function with no DOM, in `src/`, so the
page, the tests and the benchmark run the same code.

## White and knockout (`src/white.js`)

| Function | What it does |
|---|---|
| `whiteNeed(colour, garment)` | The least white a colour needs on this garment. Rule `reach` (default): CMYK inks only take light away, so a colour is reachable where it is darker than the substrate in every RGB channel; the white needed is the smallest mix of white ink and fabric that makes it so. Black on any shirt needs none; navy on red needs a little; yellow on black needs full. Rules `screen` (the Separation Table base rule) and `full` (white under everything) are there for comparison. |
| `knockoutFactor(colour, garment)` | 1 where the art colour is within a ΔE00 tolerance of the garment (the shirt prints as itself: no ink, no white), with a smooth ramp at the edge. |
| `isWhiteGarment`, `garmentClass` | White garments get no white layer at all; light and dark garments get white where the colour needs it. |
| `buildWhiteLayers({ lab, alpha, W, H, garmentLab, opts })` | Per-pixel white underbase, highlight white, knocked-out colour alpha and knockout mask, plus areas for the ink estimate. Options: rule, strength (white density), margin, knockout tolerance, choke (soft or adaptive, from the engine), highlight ramp. |
| `chokePixels(mm, dpi)` | Choke width from millimetres. |

## Presets, layers and proof

- `src/machines.js`: printer presets in the machine-profile shape
  shared with the DTF Table (`adn.machine/1`; DTG fields under `dtg`).
  Epson SureColor F2270 and F1070 (Garment Creator 2), Brother GTXpro
  (GTX Graphics Lab), Kornit Atlas MAX Plus, and a custom printer the
  producer fills in. Every preset cites its sources; anything unsourced
  is listed in its `verify` field ("default, verify"). `validateMachine`,
  `platenPixels`, `fitArt` (fits art to a platen, warns below 150 ppi),
  and `machineStore`, which keeps saved machines in the browser,
  grouped by service.
- `src/garments.js`: 18 common blank colours (ADN's estimates, not
  measurements) and custom garments by hex or measured L\*a\*b\*.
- `src/layers.js`: the colour layer (art with the knocked-out alpha),
  white layers as 8-bit grey (spot-channel convention, or inverted),
  `compensateColour` (below), an uncompressed TIFF writer with its
  resolution, and `pngWithDpi` (writes the PNG pHYs chunk). `filePlan`
  lists the files a machine profile asks for.
- `src/proof.js`: `garmentProof`, a forward model of the print on the
  garment, with ΔE00 against the art (model only).
- `src/placement.js`: the art placed on the platen (outline, centre
  line, collar offset, default 3 in, with a warning past the printable
  area), and the operator's placement sheet. Guides never go into the
  RIP files.
- `src/model.js`: the white ink model (Yule–Nielsen n, dot-gain curve,
  drawdown) used by the rule, compensation and proof.
- `src/ramps.js`: reads measured ramps in the Separation Table's
  wedge-CSV format (its `calib.js` fits them): the white density ramp
  on black (with pretreat sets `W@light`, `W@heavy`) and colour ramps
  on white.

## Why compensation

A RIP separates the colour file as if it printed on full white. Under
less white, the colour prints darker. Where the DTG Table sends less
than full white, it sends a colour file lightened to match (t·w/s per
linear channel). Model only, 1 px choke, black shirt
(`scripts/layers-sheet.mjs`):

| Art | White, full | White, reach | Proof ΔE00 mean: full / reach / reach + compensation |
|---|---|---|---|
| 04 hue wheel | 65.9 % | 54.0 % | 0.79 / 5.26 / 0.85 |
| 11 skin | 55.6 % | 20.7 % | 1.55 / 10.19 / 1.58 |
| 13 sky gradient | 63.6 % | 23.2 % | 1.36 / 10.12 / 1.31 |
| 07 pastels (navy shirt) | 36.5 % | 34.1 % | 2.17 / 2.65 / 2.19 |

The proof uses the same transparent-ink model as the reach rule, so
their agreement is built in, not evidence. Real pigment inks scatter,
and a partial white is printed as a halftone of full white, not a
thinner film. The printed white-density and colour ramps decide
whether any of this saving is real. Until then the safe setting is rule
`full` with the art unchanged, which is also what a RIP that makes its
own white does. That is the page's default: least white is offered with
warnings until a ramp is imported and the RIP takes a separate white
file.

The benchmark (BENCHMARK.md) tests this with a referee that does not
share the tool's model: with a matched white model the reach rule uses
63–67 % less white at the RIP proxy's mean ΔE; with a mismatched one it
is about 2 ΔE worse.

## The page

`src/index.html`, `src/app.js`, `src/help.js`, `src/theme.js` and
`src/page.css` use the Separation Table's layout: the page links the
engine's `bench.css` and keeps that page's ids and class names, and
`page.css` holds only what bench.css has no rule for. Four steps on the
left (1 Artwork, 2 Printer / garment, 3 White, 4 Files), the workspace
in the middle (the views Art, Proof, Colour, White, Highlight and
Knockout, and the proof and numbers row with the Model only mark),
Advanced Settings on the right, Back / Next on a phone, Light / Dark /
Device, and Help. Shop setup holds saved machines and the measured
ramps. Step 4 makes the colour and white files as PNG or TIFF at the
art's full resolution, with the print resolution in the file, plus a
placement sheet for the operator.

## The Separation Table engine

The colour maths (CIELAB, CIEDE2000), the screen-print base rule, the
chokes and the wedge-CSV calibration come from the
[Separation Table](https://github.com/navruhtra/separation-table)
engine (MIT, American Dream Network). It is not copied into this
repository: `npm run setup` downloads the files below from its public
repository at the commit pinned in `scripts/vendor-pins.mjs`, into
`src/vendor/separation-table/`, and checks each against
`src/vendor.sha256`.

| File | Used for |
|---|---|
| `engine.js` | `rgb2lab`, `hex2rgb`, `lab2lin`, `lin2lab`, `lin2s`, `S2L`, `de2000`, `baseFraction`, `adaptiveChoke`, `softChoke` |
| `calib.js` | `parseWedgeCSV`, `fitCalibration` (measured ramps) |
| `cli/platform.mjs` | `decodePNG`, `encodePNG`, for the benchmark, the tests and the scripts in Node. It imports `output.js`, `sizes.js` and `version.js`, which are downloaded with it. |
| `vendor/quickhull.js` | Imported by `engine.js`. Built here from quickhull3d 3.1.2 with esbuild, as the Separation Table builds it. |
| `bench.css` | The page's stylesheet. |

`node scripts/release.mjs check --engine <separation-table>/src`
checks that every name above is in a local Separation Table with the
same code as the pinned copy.

## Scripts

```bash
npm run targets    # the test targets into targets/ (docs/TARGETS.md)
node scripts/layers-sheet.mjs art.png "#111111" sheet.png [reach|screen|full] [chokePx]
```

`layers-sheet` draws art on the garment, the colour layer, the white
underbase, the highlight white and the knockout side by side, and
prints the areas.

## Releases

The version lives in `src/version.js`. `node scripts/release.mjs
check` (CI, every pull request) checks that package.json, the top
CHANGELOG entry, `releases/<version>.md` and the README agree.
[RELEASE.md](RELEASE.md) has the steps.
