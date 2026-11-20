# DTG test targets for a shop

What to print and measure so the DTG Table's numbers stop being "model only". Make the files with:

```bash
node scripts/make-targets.mjs targets/
```

Every file is a PNG at 300 dpi; the largest (B) is 12 × 7.6 in and fits a 14 × 16 in platen. `readings.csv` is the
sheet to fill: one row per patch, `ink,tint,L,a,b`, the same format the Separation Table reads.

## Needed

- A spectrophotometer (D50, 2°; M1 if it has it), or a calibrated scanner with an IT8 target (less accurate).
- Black, white and navy shirts of one blank style; light, standard and heavy pretreat on black.
- Garment Creator 2 or GTX Graphics Lab, whichever the shop runs, at its normal settings. Write down the settings.

## The targets

| File | Print on | What it measures | readings.csv rows |
|---|---|---|---|
| A1-white-ramp-alpha.png | black, standard pretreat | white density 0–100 % when the RIP makes white from the image's transparency | `W,0..100` |
| A2-white-ramp-colour.png + A2-white-ramp-white.png | black | the same through a separate white file, if the RIP takes one (see D) | `W,0..100` (use A2's when it prints) |
| A1 again | black, light and heavy pretreat | pretreat variation | `W@light`, `W@heavy` |
| B-colour-ramps.png | white shirt; then black with full white | how the RIP renders the RGB file's C, M, Y, K, R, G, B ramps | `C,0..100` … `B,0..100` |
| C-compensation-colour.png + C-compensation-white.png | black, white from our file | top row: full white + the art; bottom row: least white + compensated colour. Same colours meant. | `Cfull1..8`, `Creach1..8` |
| D-rip-white-colour.png + D-rip-white-white.png | black | does the RIP use our white? Our white file covers the left half only | none: a photo of the print |

Also measure the bare shirt (`_shirt,0`) once per shirt colour.

## What each answers

- **D first.** If the right half of the grey square prints as bright as the left, the RIP made its own white and
  ignored ours. Then A2 and C cannot print as designed, the reach rule cannot save white on that RIP, and the
  DTG Table's job there is knockout, checks and the proof. This is the question the DTF Table also has.
- **A** gives the white model: the drawdown, the dot gain curve and the Yule–Nielsen n. The benchmark says the
  reach rule only pays off when this is measured (BENCHMARK.md).
- **B** gives how the RIP turns the RGB file into ink, on white and on white underbase.
- **C** is the direct test: if the bottom row matches the top within about 2 ΔE00, the white saving is real on that
  printer.
- Record the white ink used for A1 and C, from the RIP's ink estimate if it gives one, or by weighing: that turns
  white_in2 into ml.

## Send back

`readings.csv` filled in, the RIP and its settings, the shirt blank and pretreat, a photo of D, and the RIP's ink
estimates where it gives them. Importing the CSV in the DTG Table (Ramps) applies it.
