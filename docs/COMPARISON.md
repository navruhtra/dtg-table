# How DTG Table compares

DTG Table is a prepress step. It writes the colour and white files the
printer's own software loads (Epson Garment Creator 2, Brother GTX
Graphics Lab, Kornit / ColorGate, CADlink and others). It does not drive
a printer and does not replace a RIP. This page says what was measured
against what, and what was not.

## Measured here (model only)

`benchmark/run.mjs` scores every config with the same fixed referee on
15 synthetic test images (docs/BENCHMARK.md). The referee simulates the
print with a white model the tool does not share.

| Config | What it stands for | dE_mean | white in² |
|---|---|---|---|
| rip-proxy | A RIP default on a dark garment: full white under every opaque pixel, no garment knockout | 0.660 | 1586.8 |
| table-full | DTG Table's default: full white, garment knockout, 1 px choke | 1.062 | 997.5 |
| table-reach | Least white with compensated colour, plain model | 2.769 | 517.9 |
| reach-n1.7 | The same after a measured white ramp that matches the referee | 0.652 | 587.3 |

The rip-proxy is a proxy, not Garment Creator 2 or GTX Graphics Lab.
The numbers say the white saving is real only when the white model is
measured on the printer; with the wrong model the reach rule is about
2 ΔE worse.

## Not measured

- **The printers' own software.** Garment Creator 2, GTX Graphics Lab
  and the others make their own white from the colour file. They are not
  run here. The head-to-head needs printed, measured shirts; the
  protocol is in docs/BENCHMARK.md and the targets in docs/TARGETS.md.
- **Whether a RIP keeps a white file we send.** Target D answers it per
  RIP.

## What DTG Table does that a RIP may not

- Knocks out the garment colour (no ink and no white where the art is
  the shirt's own colour).
- A garment proof with ΔE00 against the art, and white in square
  inches, before printing.
- Imports measured white and colour ramps (CSV) and uses them.
- A placement sheet for the operator.

## What a RIP does that DTG Table does not

- Colour management to the printer's inks, ink limits and print modes.
- Driving the printer.
