# Steering Sandbox

**Live site: [ggps4.github.io/steering-sandbox](https://ggps4.github.io/steering-sandbox/)**

FSAE steering and suspension toolkit in the browser. Import your front-corner hardpoints from Fusion 360, and the sandbox solves the linkage through full lock and wheel travel. It reports:

- Ackermann % (with the curve compared against ideal and parallel steer)
- Kingpin inclination, caster, scrub radius and mechanical trail
- Bump steer and camber change per 25 mm of wheel travel
- Tie rod length

Drag the tie-rod ends in the top or front view, or type new coordinates, and compare against your CAD baseline.

## Tire curve fitter

Upload tire test data (slip angle, lateral force and optionally normal load; TTC-style exports work). The page fits the Pacejka Magic Formula (B, C, D, E, Sh, Sv) to each load case and reports peak force, slip at peak, cornering stiffness, peak μ and R². You can copy the coefficients out as CSV.

## Suspension tools

These are pre-filled with the Binghamton Motorsports EV2 2025–26 vehicle parameters (mass, weight distribution, tracks, wheelbase, CG and roll center heights, unsprung masses, motor and brake torque). Every value is editable.

- **Roll center & anti-geometry:** front-view instant center and roll center from the hardpoints, roll center migration through ±30 mm of wheel travel, side-view instant center and anti-dive % (outboard brakes, using the car's front brake share), compared against the sheet's target.
- **Steering ratio & U-joints:** a vector Cardan-joint model of a two-joint column (joint angles, plane offset, yoke phasing) feeding the rack C-factor and the linkage solver. It gives the local and average steering ratio, lock-to-lock turns, and U-joint velocity fluctuation and phase error.
- **Load transfer:** steady-state corner loads for any combined lateral and longitudinal g, split into geometric (roll center), elastic (roll stiffness) and unsprung paths. It also shows LLTD, roll angle and gradient, wheel lift, brake bias against the ideal bias, and torque-limited accel and decel.
- **Steering effort:** static (parked) effort from T = Fz·μ·√(B²/8 + e²), and skidpad effort from (mechanical + pneumatic trail)·Fy, carried to the rim through the ratio model and compared against the team's 5 N·m target and 10 N·m maximum.

## Import from Fusion 360

1. Put a construction point at each hardpoint of one front corner and name it `LBJ`, `UBJ`, `OTR`, `ITR`, `WC`, `CP`. Add `LCA_F`, `LCA_R`, `UCA_F`, `UCA_R` for bump steer.
2. In Fusion: Utilities → Add-Ins → Scripts and Add-Ins → Create → Script (Python). Name it `export_hardpoints`, click Edit, and paste in [`export_hardpoints.py`](export_hardpoints.py).
3. Run it and drop the saved CSV on the site.

The site also accepts hand-written hardpoint CSV/JSON files (see [`sample_hardpoints.csv`](sample_hardpoints.csv)) and Fusion parameter CSVs.

Built by [Benjamin Novofastovsky](https://ggps4.github.io/), Binghamton Formula SAE.
