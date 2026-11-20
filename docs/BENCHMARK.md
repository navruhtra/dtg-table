# DTG Table benchmark

The standing record of how the DTG Table's white and colour files perform. **Every number here is model only**
until a shop prints and measures the targets in TARGETS.md. Every number came out of `benchmark/run.mjs`.

"Best in class" for this tool: the lowest ΔE on the actual shirt per unit of white ink.

## Run it

```bash
npm run setup                 # once: pinned libraries and the Separation Table engine
node benchmark/run.mjs        # table of every case and config, compared with benchmark/baseline.json
npm run benchmark             # the same with --gate: exit 2 when a DTG Table config is worse than the baseline beyond tolerance
node benchmark/run.mjs --n 1  # referee with another white Yule–Nielsen n (sensitivity; not compared)
```

About 25 s on one core.

## The referee

`benchmark/referee.mjs` is fixed. It imports nothing from `src/`, so a change to the tool cannot change how the tool
is judged; its hash is stored in the baseline and a changed referee is reported. It simulates the print:

- White prints as a halftone of full white. The substrate under it is a Yule–Nielsen mix of white ink and garment,
  n = 1.7 ("default, verify": the engine's calibration default for screen ink). The tool's own default model is
  the plain area mix (n = 1). The referee disagrees on purpose: it stresses the tool's assumption.
- The colour file is separated by the RIP for full white (transparent filters), on whatever substrate is there.

Objectives, lower is better:

| Measure | What it is |
|---|---|
| dE_mean, dE_p95 | CIEDE2000, simulated print vs the art over the garment, art pixels |
| white_in2 | white ink as full-coverage square inches at a 12 in print width (multiply by the shop's ml per in² for ml) |
| banding | 99th percentile of the extra lightness step between neighbouring pixels (print vs art, L*) |

## Cases and configs

The 15 synthetic test images in `test-images/` (04–18, from the Separation Table; test-images/SOURCES.md), each on
the garment its case names.

| Config | What it is |
|---|---|
| rip-proxy | Stands in for a RIP default: full white under every opaque pixel, no garment knockout, art as the colour file. A proxy, not Garment Creator 2 or Graphics Lab. |
| table-full | Full white, garment knockout, 1 px choke, art as the colour file. |
| table-reach | Least white that reaches each colour (plain model), compensated colour. |
| reach-n1.7 | The same after a white ramp measured n = 1.7 (what the tool does when a shop imports such a ramp). |

## Baseline (referee v1, n 1.7, 2026-11-18)

The stored referee hash was re-recorded on 2026-11-20 when the referee's import of the engine moved to
`src/vendor/separation-table/` in this repository. Every number is unchanged.

| Config | dE_mean | dE_p95 | white_in2 | banding |
|---|---|---|---|---|
| rip-proxy | 0.660 | 1.695 | 1586.8 | 0.759 |
| table-full | 1.062 | 3.114 | 997.5 | 2.768 |
| table-reach | 2.769 | 7.466 | 517.9 | 0.668 |
| reach-n1.7 | 0.652 | 2.254 | 587.3 | 0.467 |

Sensitivity, referee n = 1 (`--n 1`): rip-proxy 0.660, table-full 1.099, table-reach 0.680, reach-n1.7 2.501
(dE_mean).

What it says:

- The reach rule saves white only when its model matches the printer. With a matched model, reach uses 63–67 % less
  white than the proxy at the same mean ΔE (0.652 vs 0.660 at n 1.7; 0.680 vs 0.660 at n 1). With the wrong model
  either way it is about 2 ΔE worse. So the white ramp (TARGETS.md, A) has to be measured before the reach rule is
  anyone's default. Until a ramp is imported, the safe default is full white.
- Even matched, reach's tail is worse (p95 2.25 vs 1.70).
- table-full uses 37 % less white than the proxy (garment knockout), but its mean ΔE is 0.40 worse and its banding
  higher. The cause is the knockout's soft edge: partial white beside partial colour shows white (a haze). A white
  that falls off faster than the colour in fades is the next thing to try.
- The proxy's near-zero ΔE on art painted on a shirt-colour background is a model artefact: the model says black ink
  over white is the shirt's black. Only white_in2 sees that waste.

## Head-to-head with the printer's own software

The model cannot settle this; scans can. Protocol, per printer (Garment Creator 2, GTX Graphics Lab):

1. The same art (TARGETS.md set plus 4 test images), the same shirts, the same pretreat, the same day.
2. Print A: the art through the RIP at its defaults. Print B: the DTG Table's files (knockout, white per the
   shop's measured ramp, compensated colour where the RIP takes our white).
3. Measure each print with a spectrophotometer at marked points (or scan with a calibrated scanner and target), and
   weigh or read the white ink used (RIP ink estimate, or cartridge weight before and after a run of 10).
4. Report ΔE00 against the art over the garment, and white ml, for A and B.

## Updating the baseline

Only on main after a merge, in its own pull request, with the reason. `--update` writes `benchmark/baseline.json`.
