# Data dictionary

This file lists every value the page uses: what it means, its unit, its default and
where the default came from, and how to change or measure it.

**Status words used here and on the page:**

| Status | Meaning |
|---|---|
| **measured** | Measured on the parts or the car |
| **CAD** | Read from the Fusion model |
| **TTC fit** | From the tyre model fitted to TTC data |
| **computed** | Derived from other values |
| **user-confirmed** | Stated by the responsible team member |
| **EV2 sheet** | Last year's (2025–26 electric car) vehicle-dynamics sheet |
| **ASSUMED / PROVISIONAL** | A placeholder. Replace it when you can. |

The vehicle frame is millimetres, **+x forward, +y left (outboard), +z up**, with
z = 0 on the road (TEAM_PACKAGE.md). One front-left corner is modelled; the right side
is its mirror image.

---

## 1. Steering hardpoints (Hardpoints panel, steering geometry)

The sample car is synthetic. The team package loads the 2026 CAD points (MATLAB
`front_suspension_inputs.m`; tie rod verified 29 Sep 2026).

| Name | Point | Notes |
|---|---|---|
| LBJ | Lower ball joint centre | With UBJ, defines the kingpin axis |
| UBJ | Upper ball joint centre | |
| OTR | Outer tie-rod joint (on the upright) | Steering arm = kingpin axis → OTR |
| ITR | Inner tie-rod joint (rack end) | Moves with the rack along y |
| WC | Wheel centre | |
| CP | Tyre contact patch | Package: directly below WC by the loaded radius (218.2 mm at 11.5 psi) |
| LCA_F, LCA_R | Lower arm front and rear chassis pivots | Needed for bump steer, roll centre and anti-dive |
| UCA_F, UCA_R | Upper arm front and rear chassis pivots | |

**To change them:** edit or drag them on the page (the baseline is kept for comparison), or export from Fusion with
`export_hardpoints.py`. Set **Import: CAD forward axis** to +Z and **up axis** to +Y
for the team's Fusion model, whose forward direction is +Z.

| Input | Unit | Default | Source / notes |
|---|---|---|---|
| Wheelbase | mm | 1550 (sample); 1544.5 (package) | CAD wheel centres. Used for the Ackermann ideal. |
| Rack travel ± | mm | 30 (sample); 29.37 (package) | Package: **usable lock**, where the tie-rod/steering-arm angle falls to 15°. The inner wheel goes over-centre at 31.9 mm; the rack stops are at 46.23 mm. |
| Rack slider | % of rack travel | – | Display only. |
| Import axes, units | – | +X / +Z, auto | Only for reading CSV files. The team package needs none. |

## 2. Vehicle parameters (Vehicle panel)

The line under each box shows the source of the value on screen. **Reset to EV2
values** restores the old sheet; loading the package sets the 2026 values.

| Key | Parameter | Unit | EV2 sheet | 2026 package | Package source and status | Effect / how to change |
|---|---|---|---|---|---|---|
| m | Total mass (car + driver) | kg | 328 | 328.0 | Rocker-lab corner masses ×2 (measured/estimated) | All loads. Weigh the car with driver; update `sprungMass_kg` / `unsprungMass_kg` in MATLAB `rocker_development_inputs.m`. |
| wdf | Front weight fraction | – | 0.45 | 0.45 | user-confirmed 45/55 | Front/rear load split. Corner-weigh the car. |
| L | Wheelbase | mm | 1554.2 | 1544.5 | CAD wheel centres | Longitudinal transfer, Ackermann ideal. |
| tf | Front track | mm | 1330 | 1339.3 | CAD wheel-centre track | Front lateral transfer, front roll stiffness. |
| tr | Rear track | mm | 1330 | 1345.4 | CAD wheel-centre track | Rear lateral transfer. |
| h | CG height | mm | 343 | 343 | **PROVISIONAL**: last year's car | All load transfer. Measure it (tilt test) or take it from CAD with the driver; update `cgHeight_mm` in `front_steering_envelope_inputs.m`. |
| zrf | Front roll centre | mm | 70.7 | 45.0 | CAD front hardpoints at static load | Geometric share of front transfer. The page also computes it from the hardpoints (tick box); both give 45.0 mm for 2026. |
| zrr | Rear roll centre | mm | 81.3 | 57.7 | CAD rear hardpoints | Geometric share of rear transfer. |
| muf, mur | Unsprung mass per axle | kg | 18.14, 22.675 | 18.14, 22.675 | estimated (same as EV2) | Unsprung transfer, hop frequency. Weigh the corner assemblies. |
| kfrac | Front roll stiffness share | – | 0.45 | ≈0.45 | computed by the rocker panel (springs + tyre, no ARB) | Handling balance (LLTD). Add ARB stiffness in the rocker panel. |
| ktot | Total roll stiffness | N·m/° | 1138 (2020 code) | ≈490 | computed by the rocker panel, springs only | Roll angle, elastic transfer. The ARB is unknown. With springs only, roll is about 1.7°/g. |
| rw | Loaded tyre radius | mm | 229 (the unloaded radius) | 218.2 | TTC fit, static front load, 11.5 psi | Unsprung transfer, wheel torque to force. **Use TTC loaded radius** in the TTC panel. |
| tm | Combined motor torque | N·m | 650 | – | EV2 electric car; **not the 2026 engine** | Accel limit only. Replace it with engine torque × gearing at the wheels. |
| tb, tbf | Brake torque (all), front | N·m | 1700, 1020 | – | EV2 sheet | Decel limit, brake bias, anti-dive. |
| adT | Anti-dive target | % | 85 | – | EV2 target | Display only. The achieved anti-dive comes from the arm pivots; 2026 CAD pivots are level and parallel, which gives 0%. |

To change an EV2 default in the page itself, edit the `EV2` list in `index.html`
(key, label, value, unit, source line, hover help).

## 3. Steering ratio & U-joints (sandbox defaults, not measured)

| Input | Unit | Default | Meaning |
|---|---|---|---|
| Rack C-factor | mm/rev | 90 | Rack travel per pinion revolution. From the rack datasheet. |
| U-joint 1, 2 angle | ° | 18, 18 | Bend angle at each joint. Measure it in CAD. Equal angles with in-phase yokes cancel the fluctuation. |
| Joint plane angle | ° | 0 | Angle between the two joints' bend planes. |
| Yoke phasing | ° | 0 | Rotation of the middle shaft's yokes. |
| Steering wheel Ø | mm | 260 | For rim force. |

## 4. Load transfer and steering effort

| Input | Unit | Default | Meaning / source |
|---|---|---|---|
| Lateral accel | g | 1.5 | Steady state; + = left turn. MATLAB's 2026 capacity is 1.49 g (road factor applied). |
| Longitudinal accel | g | 0 | − = braking. |
| Tire tread width | mm | 190 | Static-effort contact width B. Measure the contact patch. |
| Static μ (parked) | – | 0.9 | Dry parking friction for static effort. |
| Pneumatic trail | mm | 20 | Trail behind the contact centre. **Use TTC trail in steering effort** sets \|M<sub>z</sub>/F<sub>y</sub>\| at 2° slip from the TTC model (26.2 mm for 2026). |
| Skidpad path radius | m | 9.1 | FSAE skidpad centreline radius (about 9.125 m). |
| System friction | N·m at wheel | 0.5 | Rack, joint and bearing friction. Estimate it. |

## 5. TTC tyre model panel (TYRE_MODEL.md)

| Input | Unit | Default | Meaning |
|---|---|---|---|
| Model branch | – | pressure | Pressure = experimental 8–14 psi fit; nominal = 12 psi fit. |
| Pressure | psi | 11.5 | MATLAB's choice (maximum whole-car lateral capacity). |
| Camber | ° | −1 | Representative loaded-wheel camber (ASSUMED, as in MATLAB). |
| Loads | N | 0.5×, 1×, 1.6× static front | Blank = from Vehicle mass and split. |
| Slip range | ° | 12 | Plot range. The fitted range is ±12°. |

Fixed package values (`tyre`):

| Value | Status | Notes |
|---|---|---|
| Road factor 0.667 | ASSUMED | Project lab-to-road factor, not measured on this car |
| Loaded radius 224.7 mm − F<sub>z</sub>/k(p), k = 113.8 N/mm at 12 psi | TTC fit | Pressure ratios 0.804 / 0.919 / 1 / 1.066 at 8 / 10 / 12 / 14 psi (TTC Round 9 post-test rates) |
| Pressure sweep | computed | MATLAB whole-car capacity from 8 to 14 psi |

## 6. Rocker & coilover panel (ROCKER_COILOVER.md)

Editable inputs are described in ROCKER_COILOVER.md. Fixed package values
(`axles[]`), 2026 pair P-F21094100025-R101461:

| Value | Front | Rear | Unit | Source / status |
|---|---|---|---|---|
| Sprung corner mass | 64.73 | 78.86 | kg | `rocker_development_inputs` (measured/estimated) |
| Unsprung corner mass | 9.07 | 11.34 | kg | same |
| Ride height from CAD | 0 | −10 | mm wheel travel | Rocker-lab design choice per axle |
| Spring | 185 lbf/in (32.40 N/mm), free 127 mm, compression limit 50.8 mm | same | | Spring datasheet (listed travel 2.0 in) |
| Shock eye, extended / compressed | 266.7 / 193.6 | same | mm | Extended measured on all four shocks. Compressed = max(76.2 mm stroke spec, CAD body contact); not independently measured. |
| Eye end reserve | 2 | 2 | mm | Rocker-lab usable-travel margin (ASSUMED) |
| Shaft spring seat from rocker eye | 43.0 | 43.0 | mm | Measured in Fusion (28 Sep 2026) |
| Collar thickness | 10.2 | 10.2 | mm | Measured |
| Usable thread (spring face from frame eye) | 65.2–128.1 | same | mm | CAD thread 50.0–150.6 mm with **user-arbitrary** +5/−22.5 mm margins, collar fully on the thread |
| Minimum preload at full extension | 1.5 | 1.5 | mm | Spring must stay seated (design margin) |
| Seat-setting cases | −1, 0, +1 | same | mm | Collar setting uncertainty (ASSUMED) |
| Gas force | 16.9 | 16.9 | N | 20 psi factory charge × 12.5 mm rod area |
| Lab caps: max bump / max droop | 38.1 / 38.1 | same | mm | `rocker_lab_inputs` |
| Minimum bump / total travel | 20 / 50 | same | mm | `rocker_lab_inputs` quality limits |
| Wheel-rate floor | max(2 N/mm, 0.5 × ride rate) | same | | `rocker_lab_inputs` quality limits |
| Damper total stroke | 76.2 | same | mm | Shock specification |
| Damper | Platinum 4, split valving 5-3 | same | | Digitized dyno sheet (MATLAB `data/damper`). + velocity = compression. Measured to 10 in/s, extrapolated beyond with a band. |
| Damping guidance | body 0.5–0.8, hop 0.2–0.5 | | ζ | Common design guidance, not a rule |
| Tyre-rate band | 85.4 / 113.8 / 142.3 | | N/mm | TTC vertical rate ±25% (MATLAB damping review) |
| Hole diameters (pivot / pushrod / shock / ARB) | 12 / 9.53 / 7.94 / 9.53 | | mm | For bearing load per mm of plate (`rocker_lab_inputs`); drawn at true size |
| Plate edge margin | 10 | 10 | mm | Minimum material around each joint centre; sets the closed convex plate outline (`rocker_development_inputs` `layout.outlineMargin_mm`) |

**To change any of these,** edit the MATLAB input named in the source column, re-run
the MATLAB step that uses it (`rocker_lab`, `front_steering_envelope`, damping or
loads), then `sandbox_export`, and load the new package.
