# Rocker & coilover panel

The panel checks a pushrod–rocker–coilover design on the page. It is a JavaScript
port of the FSAE MATLAB rocker lab, and every function in `js/rocker_model.js` names
the MATLAB file it copies. It needs the team package (see TEAM_PACKAGE.md).

The **search** for rocker designs (about 76,000 candidates, run on parallel workers)
stays in MATLAB (`rocker_lab`). This panel **evaluates** the chosen design and lets
you edit its rocker points.

## Inputs

| Input | Unit | Default (2026 package) | Meaning / how to change |
|---|---|---|---|
| Axle | – | front / rear candidate of the pair | Which rocker to show. Both are always computed, for roll stiffness. |
| Rocker points | mm | from `rocker_lab` | Pivot, pushrod on rocker, shock on rocker, shock on chassis, ARB link on rocker. Edit them in the table. **Reset rocker points** restores the package. |
| Pushrod outboard (CAD) | mm | fixed | On the lower arm; moves with the suspension. To change arm or pushrod pickups, change them in MATLAB and re-export. |
| Spring rate | lbf/in | 185 | Coil spring rate (both axles use 185 lbf/in = 32.40 N/mm in 2026). Changing it re-solves the collar setting. |
| Tyre rate | N/mm | 113.8 | Tyre vertical stiffness at 12 psi (TTC fit; MATLAB damping review value). The TTC panel gives it at other pressures. |
| Body / hop shaft speed | in/s | 2 / 10 | Peak damper shaft speed that represents body motion and wheel hop. The damper is digressive, so its equivalent damping depends on speed. |
| Front / rear ARB | N·m/° | 0 | Anti-roll bar roll stiffness. **Unknown for 2026** (shaft stiffness not measured). 0 = springs only, the most roll. |
| Feed roll stiffness to Load transfer | – | on | Writes **Total roll stiffness** and **Front roll stiffness share** in Vehicle parameters. Untick to type your own. |

Fixed inputs come from the package (`axles[].coilover`, `labLimits`, `damper`). They
are listed in DATA_DICTIONARY.md with their sources.

## Method

1. **Linkage** (`solveLinkage` ← `rocker_development_path.m`)
   - The pushrod's outboard end follows the path exported from the MATLAB 3D
     suspension model (`axles[].path`), on a 0.25 mm wheel-travel grid.
   - At each step the rocker turns about its pivot axis until the pushrod has its
     CAD length. Of the two solutions, the one nearest the previous step is kept,
     marching outward from the CAD pose.
   - The march stops if the pushrod cannot reach, the rocker toggles (pushrod in line
     with the pivot), or the pushrod's virtual lever falls below the lab minimum.
   - **Motion ratio** = shock shortening per mm of wheel bump, from the exact path
     derivative: MR = −(H−S)·(dH/dz)/|H−S|.
2. **Coilover at ride height** (`coilover` ← `rocker_development_equilibrium.m`)
   - The collar is set so the car sits at the design ride height:
     k·x + F_gas = W_corner / MR_ride.
   - That fixes the spring compression everywhere: x(z) = x_ride + L_ride − L(z).
   - Collar (spring face from frame eye) = L_ride + x_ride − (free length + shaft
     seat from rocker eye). It must stay on the usable thread for every seat case,
     with at least the minimum spring preload at full shock extension.
   - Wheel force = (k·x + F_gas)·MR. **Wheel rate** = d(wheel force)/dz, so it
     includes the change of MR with travel.
3. **Usable travel**, for each seat-setting case (−1, 0, +1 mm: the collar cannot be
   set more precisely than that). It ends at the first of:
   - spring bind (spring compression limit),
   - shock eye length outside [compressed + 2 mm, extended − 2 mm],
   - MR outside (0, 1),
   - wheel rate below the lab floor: max(minimum rate, fraction × ride rate),
   - the lab caps on bump and droop.

   It passes if bump ≥ the minimum bump, bump + droop ≥ the minimum total, and the
   shock stroke used ≤ its total stroke. The panel reports the worst seat case.
4. **Physical limits** (`rocker_load_cases.m`) walk from ride height to spring bind or
   shock bottom-out in bump, and to shock top-out in droop, without the 2 mm reserve.
5. **Damping** (`damping` ← `rocker_damping_math.m`, `rocker_damping_review.m`)
   - Equivalent linear shaft damping at peak shaft speed V, equal energy per cycle:
     c = 4/(πV²)·∫₀^{π/2} |F(V cos t)|·V cos t dt, for compression and rebound. The
     cycle value is their mean.
   - Wheel damping c_w = c·MR².
   - Body: ζ = c_w·r²/(2√(k_ride·m_s)), with r = k_t/(k_w+k_t) and k_ride =
     k_w·k_t/(k_w+k_t) (tyre in series).
   - Hop: ζ = c_w/(2√((k_w+k_t)·m_u)).
   - Guidance bands (body 0.5–0.8, hop 0.2–0.5) colour the values amber when outside.
6. **Joint loads** (`loadCases` ← `rocker_load_cases.m`)
   - A rigid, massless, frictionless rocker in moment balance about the pivot axis.
   - Shock force (+ = compression) = spring + gas + damper, acting on the rocker eye
     along (H−S). The pushrod force acts along the pushrod.
   - Cases: static ride; usable bump and droop ends; physical limits; bump end + 10,
     20, 30 in/s compression; droop end + 10, 20 in/s rebound; 3 g vertical at ride
     (shock force = 3·m_s·g/MR).
   - "Band" covers the seat cases and the dyno band. The envelope takes the band
     maximum. "Measured range" excludes extrapolated damper speeds (> 10 in/s) and the
     design case.
7. **Roll stiffness** (`rollStiffness`): per axle, k_ride·track²/2 (springs and tyre
   in series) + ARB, in N·m/°. This is the same springs-only model as the MATLAB
   steering envelope.

## Check against MATLAB

With the package geometry and spring unchanged, the "Check vs MATLAB" rows compare
the page with MATLAB. At the time of writing (pair P-F21094100025-R101461), both axles
matched:

| Quantity | Match |
|---|---|
| Motion ratio | within 5e-9 |
| Shock length | within 5e-7 mm |
| Wheel rate at ride | to 0.001 N/mm |
| Bump / droop | exact |
| Body / hop ζ | within 0.001 |
| Pivot / pushrod-hole / shock-hole max force | to 1 N |

After you edit geometry or the spring, the check reads "MATLAB reference no longer
applies". That is expected.

## Limits

- **Kinematics only:** no part strength, bearing life, compliance, friction or inertia.
- **ARB not included** unless you enter its roll stiffness. ARB link loads are in
  MATLAB (`rocker_load_cases`, `arb_unit_loads.csv`).
- **Fixed pushrod path:** changing A-arm or pushrod pickups needs a new MATLAB export.
- **Damper data:** Platinum 4 dyno sheet, measured only to 10 in/s. Faster cases are
  linear extrapolations with a band.
- **Seat cases (±1 mm) and the 2 mm eye reserve** are rocker-lab design margins, not
  measured tolerances.
