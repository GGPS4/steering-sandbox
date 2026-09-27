# Steering Sandbox

**Live site: [ggps4.github.io/steering-sandbox](https://ggps4.github.io/steering-sandbox/)**

FSAE steering kinematics in the browser. Import your front-corner hardpoints from Fusion 360, and the sandbox solves the linkage through full lock and wheel travel. It reports:

- Ackermann % (with the curve compared against ideal and parallel steer)
- Kingpin inclination, caster, scrub radius and mechanical trail
- Bump steer and camber change per 25 mm of wheel travel
- Tie rod length

Drag the tie-rod ends in the top or front view, or type new coordinates, and compare against your CAD baseline.

## Tire curve fitter

Upload tire test data (slip angle, lateral force and optionally normal load; TTC-style exports work). The page fits the Pacejka Magic Formula (B, C, D, E, Sh, Sv) to each load case and reports peak force, slip at peak, cornering stiffness, peak μ and R². You can copy the coefficients out as CSV.

## Import from Fusion 360

1. Put a construction point at each hardpoint of one front corner and name it `LBJ`, `UBJ`, `OTR`, `ITR`, `WC`, `CP`. Add `LCA_F`, `LCA_R`, `UCA_F`, `UCA_R` for bump steer.
2. In Fusion: Utilities → Add-Ins → Scripts and Add-Ins → Create → Script (Python). Name it `export_hardpoints`, click Edit, and paste in [`export_hardpoints.py`](export_hardpoints.py).
3. Run it and drop the saved CSV on the site.

The site also accepts hand-written hardpoint CSV/JSON files (see [`sample_hardpoints.csv`](sample_hardpoints.csv)) and Fusion parameter CSVs.

Built by [Benjamin Novofastovsky](https://ggps4.github.io/), Binghamton Formula SAE.
