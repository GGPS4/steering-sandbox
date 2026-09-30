# Team package

The team package is one JSON file, `bfsae_sandbox_package.json`, that carries the
2026 car's data from the team's MATLAB project into this page. It is **not stored in
this repository**. Keep it on the team drive and load it with **Load team package**
(top right), or drop it onto the page.

Without a package, the page shows the sample car, the EV2 2025–26 sheet values and
the synthetic sample tyre. The TTC tyre model and Rocker & coilover panels stay empty.

## Why it is not in the repository

- It contains Magic Formula coefficients fitted to **FSAE TTC data**. The TTC
  data-use terms restrict sharing the data outside member teams, and fitted
  coefficients are derived from it.
- It contains the car's CAD hardpoints.

`.gitignore` blocks `*_package.json`, so a package cannot be committed by accident.
The equations and page code are public; only the numbers stay private.

## Making a new package (MATLAB)

In the FSAE MATLAB project folder:

```matlab
P = sandbox_export();                % rank-1 pair of the confirmed rocker_lab run
P = sandbox_export(3);               % the 3rd-ranked pair
P = sandbox_export("P-F...-R...");   % a specific PairID (from pairs.csv)
```

It writes three files to `output/sandbox_package/`:

| File | What it is |
|---|---|
| `bfsae_sandbox_package.json` | The package. Load this on the page. |
| `package_values.csv` | Every exported value with unit, source, status and how to change it. |
| `package_summary.html` | The same, readable, with assumptions and limits. |

The exporter reads saved results only and takes a few seconds. It needs:

- a finished `rocker_lab` run (`output/rocker_lab_v3/results.mat`),
- `front_steering_envelope` results (tyre pressure, loaded radius, roll data),
- optionally `rocker_damping_review` and `rocker_load_cases` outputs. When these are
  present, the page shows MATLAB's damping and load results next to its own.

Re-export whenever any of those are re-run.

## Coordinate frame

Everything in the package uses this page's frame: millimetres, **+x forward, +y
left, +z up**, left-side corner. The right side is a mirror image (y → −y).

- **Origin:** z = 0 is the road under the front tyre at static load. That is the
  front wheel-centre height minus the loaded radius at the chosen pressure.
- **From the MATLAB model frame** (+X left, +Y rear, +Z up): x = −Y, y = X, z = Z − ground.
  `frame.groundZ_model_mm` in the package records the ground height used.
- **Fusion 360** (+X left, +Y up, +Z forward) maps to x = Z, y = X, z = Y − ground.

## What is inside

| Field | Contents | Used by |
|---|---|---|
| `points`, `wheelbase`, `rack_travel` | Front-left steering hardpoints (LBJ, UBJ, OTR, ITR, WC, CP, LCA_F/R, UCA_F/R). Rack travel = usable lock. | Steering geometry, roll centre, anti-dive |
| `pointNotes` | Where the points came from, how CP was placed, what the rack travel means. | Data sources panel |
| `vehicle[]` | Vehicle parameters keyed like the page's inputs (`m`, `wdf`, `L`, `tf`, `tr`, `h`, `zrf`, `zrr`, `muf`, `mur`, `kfrac`, `ktot`, `rw`). Each has `value`, `unit`, `source`, `status`, `adjust`. | Vehicle parameters, all tools |
| `axles[]` (front, rear) | Rocker geometry, the pushrod's outboard path over wheel travel and its exact derivative, coilover datums, rocker-lab limits, and MATLAB reference curves and results. | Rocker & coilover |
| `damper` | Platinum 4 split-valving force–velocity table (nominal and band), gas force, measured limit, damping guidance, tyre-rate band. | Rocker & coilover |
| `rockerHoles` | Hole diameters for bearing load per mm of plate. | Reference |
| `tyre` | TTC model coefficients (pressure and nominal branches), review domain, loaded-radius model, road factor, MATLAB pressure sweep and chosen pressure, and test vectors. | TTC tyre model, Steering effort, Vehicle |
| `steering` | MATLAB caster, KPI, trail, scrub, usable lock, over-centre and rack stop. | Data sources check |
| `source`, `created`, `privacy`, `frame` | Where each part came from and when. | Data sources panel |

`formatVersion` is 1. If the format changes, bump it in `sandbox_export.m` and in
`js/team_package.js`.

## Checks built into the page

The page recomputes everything and compares it with MATLAB.

- **TTC tyre model:** reproduces 216 MATLAB `ttc_tire_evaluate` points
  (`tyre.testVectors`) to within 1e-6 N.
- **Rocker & coilover:** with unedited geometry and spring, it matches MATLAB's
  motion ratio, shock length, wheel rate, usable travel, damping ratios and joint-load
  envelope. These appear as "Check vs MATLAB" rows.

A red check means the page and MATLAB disagree. Find out why before trusting either.
