# Steering Sandbox

**Live site: [ggps4.github.io/steering-sandbox](https://ggps4.github.io/steering-sandbox/)**

FSAE steering and suspension toolkit in the browser. Import your front-corner hardpoints from Fusion 360, and the sandbox solves the linkage through full lock and wheel travel. It reports:

- Ackermann % (with the curve compared against ideal and parallel steer)
- Kingpin inclination, caster, scrub radius and mechanical trail
- Bump steer and camber change per 25 mm of wheel travel
- Tie rod length

Drag the tie-rod ends in the top or front view, or type new coordinates, and compare against your CAD baseline.

## Tire curve fitter

Upload tire test data (slip angle, lateral force and optionally normal load; TTC-style exports work). The page fits the Pacejka Magic Formula (B, C, D, E, Sh, Sv) to each load case and reports peak force, slip at peak, cornering stiffness, peak μ and R². You can copy the coefficients out as CSV. This is a quick look at a data file: each load is fitted separately, and camber and pressure are ignored.

## TTC tyre model (team reference)

This is the tyre model the team fitted in MATLAB to TTC Round 9 data for the Hoosier 18.0×6.0-10 R20: one Magic Formula model with load, camber and pressure terms, plus aligning moment and a loaded-radius fit.

- It shows |Fy| curves, peak μ (TTC belt and road-adjusted), cornering stiffness, pneumatic trail, loaded radius and vertical rate.
- It shows peak μ against inflation pressure, next to MATLAB's whole-car lateral capacity. MATLAB chose 11.5 psi.
- It can hand its pneumatic trail to Steering effort and its loaded radius to Vehicle parameters.

The equations are a line-for-line port of the MATLAB code, checked against 216 MATLAB points. The coefficients come from the team package (below), not this repository. See [docs/TYRE_MODEL.md](docs/TYRE_MODEL.md).

## Rocker & coilover

This panel checks the pushrod–rocker–coilover design chosen by the team's MATLAB rocker lab, for both axles.

- **Linkage:** motion ratio and wheel rate over wheel travel.
- **Coilover:** the collar setting that gives the design ride height, thread and preload margins, and usable bump and droop for each spring-seat case.
- **Limits and dynamics:** spring-bind and shock end limits, body and hop damping ratios with the installed damper, and rigid-rocker joint loads for 11 load cases.
- **Roll stiffness:** fed to Load transfer, with a box for anti-roll bar stiffness.

Rocker points can be edited, and everything recomputes. With the package geometry it matches MATLAB (the "Check vs MATLAB" rows). See [docs/ROCKER_COILOVER.md](docs/ROCKER_COILOVER.md).

## Team package

The tyre model, the rocker panel and the 2026 vehicle values come from one file, `bfsae_sandbox_package.json`. It is written in the team's MATLAB project by `sandbox_export` and loaded with **Load team package**. It holds TTC-derived coefficients and CAD hardpoints, so it lives on the team drive and is **never committed here** (`.gitignore` blocks it). The **Team package & data sources** panel shows where every number on the page comes from. See [docs/TEAM_PACKAGE.md](docs/TEAM_PACKAGE.md).

Every input on the page, with its meaning, units, source and how to change it, is listed in [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md).

## Suspension tools

These are pre-filled with the Binghamton Motorsports EV2 2025–26 vehicle parameters (mass, weight distribution, tracks, wheelbase, CG and roll center heights, unsprung masses, motor and brake torque). Every value is editable. A line under each value shows its source, and loading the team package replaces the EV2 values with the 2026 car's.

- **Roll center & anti-geometry:** front-view instant center and roll center from the hardpoints, roll center migration through ±30 mm of wheel travel, side-view instant center and anti-dive % (outboard brakes, using the car's front brake share), compared against the sheet's target.
- **Steering ratio & U-joints:** a vector Cardan-joint model of a two-joint column (joint angles, plane offset, yoke phasing) feeding the rack C-factor and the linkage solver. It gives the local and average steering ratio, lock-to-lock turns, and U-joint velocity fluctuation and phase error.
- **Load transfer:** steady-state corner loads for any combined lateral and longitudinal g, split into geometric (roll center), elastic (roll stiffness) and unsprung paths. It also shows LLTD, roll angle and gradient, wheel lift, brake bias against the ideal bias, and torque-limited accel and decel.
- **Steering effort:** static (parked) effort from T = Fz·μ·√(B²/8 + e²), and skidpad effort from (mechanical + pneumatic trail)·Fy, carried to the rim through the ratio model and compared against the team's 5 N·m target and 10 N·m maximum.

## Import from Fusion 360

1. Put a construction point at each hardpoint of one front corner and name it `LBJ`, `UBJ`, `OTR`, `ITR`, `WC`, `CP`. Add `LCA_F`, `LCA_R`, `UCA_F`, `UCA_R` for bump steer.
2. In Fusion: Utilities → Add-Ins → Scripts and Add-Ins → Create → Script (Python). Name it `export_hardpoints`, click Edit, and paste in [`export_hardpoints.py`](export_hardpoints.py).
3. Run it and drop the saved CSV on the site.

The site also accepts hand-written hardpoint CSV/JSON files (see [`sample_hardpoints.csv`](sample_hardpoints.csv)) and Fusion parameter CSVs.

For the team's Fusion model (+Z forward, +Y up), set **Import: CAD forward axis** to +Z and **up axis** to +Y before importing, or the geometry comes in rotated.

## Code layout

| File | What it does |
|---|---|
| `index.html` | The page, steering solver, tyre fitter, vehicle tools |
| `js/ttc_tyre.js` | TTC Magic Formula equations (port of MATLAB `ttc_tire_equations.m`) |
| `js/ttc_panel.js` | TTC tyre model panel |
| `js/rocker_model.js` | Rocker, coilover, damping and joint-load model (port of the MATLAB rocker lab) |
| `js/rocker_panel.js` | Rocker & coilover panel |
| `js/team_package.js` | Loads the team package and shows data sources |
| `docs/` | Method, data dictionary and package format |

Built by [Benjamin Novofastovsky](https://ggps4.github.io/), Binghamton Formula SAE. TTC tyre model, rocker & coilover panel and team package by Zachary Johnston (rocker/suspension design, MATLAB project).
