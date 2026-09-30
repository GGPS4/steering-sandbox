# Tyre models on this page

The page has two tyre tools. They answer different questions.

| | **Tire curve fitter** (quick fit) | **TTC tyre model** (team reference) |
|---|---|---|
| Purpose | Look at a new data file quickly | Design numbers for the 2026 car |
| Model | Simple Magic Formula (B, C, D, E, S<sub>h</sub>, S<sub>v</sub>), fitted separately per load | One Magic Formula (MF6.1-style) model with load, camber and pressure terms, plus aligning moment |
| Fitted where | In the browser, Nelder–Mead on your file | In MATLAB, on TTC Round 9 data (Hoosier 18.0×6.0-10 R20, tyres 7–11), with held-out validation |
| Camber, pressure | Ignored: hold them constant in the file | Modelled |
| Aligning moment, trail | No | Yes |
| Data | Your upload, or a synthetic sample | Team package (not in this repository) |

Use the quick fitter to look at data. Use the TTC model for decisions.

## TTC model: equations

`js/ttc_tyre.js` is a line-for-line port of the MATLAB `private/ttc_tire_equations.m`
(called by `ttc_tire_evaluate.m` and `ttc_design_evaluate.m`). With the same
coefficients it reproduces MATLAB to 1e-6 N. The page checks this against 216 stored
test points every time it draws.

Lateral force, for load F<sub>z</sub>, slip α and camber γ (rad) and pressure p (Pa).
Starting from:

- dfz = (F<sub>z</sub> − F<sub>0</sub>)/F<sub>0</sub>, with F<sub>0</sub> = FNOMIN (1110 N)
- dp = (p − NOMPRES)/NOMPRES, with NOMPRES = 82.7 kPa (12 psi)

the terms are:

- **Friction:** μ = (PDY1 + PDY2·dfz)·(1 + PPY3·dp + PPY4·dp²)·(1 − PDY3·γ²), and D = μ·F<sub>z</sub>
- **Cornering stiffness:** K<sub>α</sub> = PKY1·F<sub>0</sub>·(1 + PPY1·dp)·(1 − PKY3·|γ|)·sin(PKY4·atan(F<sub>z</sub> / ((PKY2 + PKY5·γ²)·F<sub>0</sub>·(1 + PPY2·dp))))
- **Camber stiffness:** K<sub>γ</sub> = F<sub>z</sub>·(PKY6 + PKY7·dfz)·(1 + PPY5·dp)
- **Shape and curvature:** C = PCY1 and B = K<sub>α</sub>/(C·D). E = (PEY1 + PEY2·dfz)·(1 + PEY5·γ² − (PEY3 + PEY4·γ)·sign(α<sub>y</sub>))
- **Shifts:** S<sub>H</sub> and S<sub>V</sub> from PHY1–2, PVY1–4 and the camber terms
- **Result:** F<sub>y</sub> = D·sin(C·atan(B·α<sub>y</sub> − E·(B·α<sub>y</sub> − atan(B·α<sub>y</sub>)))) + S<sub>V</sub>, with α<sub>y</sub> = α + S<sub>H</sub>

Aligning moment: M<sub>z</sub> = −t·F<sub>y0</sub>' + M<sub>zr</sub>.

- The pneumatic trail t uses the QBZ, QCZ, QDZ, QEZ and QHZ terms, with pressure term PPZ1.
- The residual moment M<sub>zr</sub> uses QDZ6–QDZ11, with pressure term PPZ2.

Coefficients missing from a file take the MATLAB defaults written in the code. The
L-scaling factors (LMUY, LKY, …) are 1. See the code comments for each term.

**Signs.** The fitter uses TTC's "reference" convention: SA, IA, FY and MZ are minus
the raw TTC channels. The page plots |F<sub>y</sub>| and uses |M<sub>z</sub>/F<sub>y</sub>|
for trail, so signs only matter when you compare with raw TTC files.

## Two branches

- **Nominal:** the selected pooled fit at the 12 psi test pressure. It is the
  best-validated for force at 12 psi. Nested cross-validation RMSE is about 54–56 N
  on held-out runs (see MATLAB `ttc_design_README.md`).
- **Pressure (EXPERIMENTAL):** a pooled fit over 8/10/12/14 psi with four pressure
  coefficients (PPY1–PPY4).
  - Held-out pressure levels: about 55 N RMSE at 10 psi and 52 N at 12 psi. At
    8 psi (an extrapolation test) it is 77 N.
  - Only 12 psi was tested in both runs, so pressure effects are partly confounded
    with run history.
  - MATLAB used this branch to choose the inflation pressure.

## Inflation pressure (why 11.5 psi)

MATLAB `front_steering_envelope` swept 8–14 psi in 0.5 psi steps. At each pressure
it found the **whole-car lateral capacity**:

- lateral load transfer from the CG height, roll centres and springs-only roll
  stiffness, iterated to consistency;
- peak |F<sub>y</sub>| of each tyre at −1° camber over 0–15° slip;
- × the **road factor 2/3**.

The best was **11.5 psi, 1.49 g**. The curve is flat from about 11 to 12.5 psi, so
anything in that band is equivalent within the model.

The dashed line on the pressure chart is that MATLAB result. The solid line is a
simpler live view: one tyre at the car's static front load, peak μ on the TTC belt.

## Loaded radius and vertical rate

Loaded radius = 224.7 mm − F<sub>z</sub>/k(p).

- k(p) is 113.8 N/mm at 12 psi, scaled by the pressure trend of the TTC Round 9
  post-test vertical rates (monotone pchip interpolation, as in MATLAB).
- **Use TTC loaded radius** writes it to Vehicle parameters, at the static front
  load and the chosen pressure.

## Values the page takes from the model

| Button | What it sets | How |
|---|---|---|
| Use TTC trail in steering effort | Steering effort → Pneumatic trail | \|M<sub>z</sub>/F<sub>y</sub>\| at 2° slip, static front load, chosen pressure and camber (the linear region) |
| Use TTC loaded radius | Vehicle → Loaded tire radius | As above |

## Validity (review domain of the fit)

| Input | Fitted range |
|---|---|
| Load | 222–1112 N |
| Slip | ±12° |
| Camber | −4° to 0° |
| Pressure | 8–14 psi (55–97 kPa) |
| Speed | 40 kph (belt tests at 25 mph) |

- The table flags any value outside these ranges.
- With −1° camber the modelled force is still rising at 12–15° slip, so "peak" values
  sit at the sweep edge and are flagged. That is a limit of the data, not a true peak.
- μ on the TTC belt (about 2.6 at the static load) is much higher than on a road. The
  **road factor 2/3** is a project assumption, not measured on this car.
- Zero load returns zero force; loads below 222 N are extrapolated.

## Updating the model

Coefficients are refitted in MATLAB (`ttc_design_build`, see `ttc_design_README.md`
in the MATLAB project). Then re-run `front_steering_envelope` and `sandbox_export`,
and load the new package here. Nothing in this repository changes.

The quick fitter needs no MATLAB: upload a CSV with SA, FY and (optionally) FZ
columns.
