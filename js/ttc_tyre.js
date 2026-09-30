/* TTC tyre model — team reference tyre for Steering Sandbox.
 *
 * WHAT THIS IS
 *   A line-for-line JavaScript port of the pure-cornering Magic Formula
 *   equations in the FSAE MATLAB project (private/ttc_tire_equations.m, used by
 *   ttc_tire_evaluate.m and ttc_design_evaluate.m). The coefficients were fitted
 *   in MATLAB to TTC Round 9 data for the Hoosier 18.0x6.0-10 R20.
 *
 * WHERE THE NUMBERS COME FROM
 *   No coefficients are stored in this public repository: TTC data-use terms
 *   restrict sharing the data outside member teams. The page gets them from the
 *   team package (bfsae_sandbox_package.json, written by sandbox_export.m) that
 *   you load with "Load team package". See docs/TYRE_MODEL.md.
 *
 * UNITS AND SIGNS
 *   Page inputs: load Fz in N, slip and camber in degrees, pressure in kPa or psi.
 *   Inside the equations (as in MATLAB): slip/camber in rad, pressure in Pa.
 *   Signs follow the MATLAB fitter's "reference" convention (SA, IA, FY, MZ =
 *   minus the raw TTC channels). The page plots magnitudes |Fy|, so the sign
 *   convention only matters when comparing with raw TTC files.
 *
 * TWO BRANCHES (both in the package)
 *   nominal  = the selected pooled fit at the 12 psi test pressure; the
 *              best-validated for force at 12 psi.
 *   pressure = EXPERIMENTAL pooled fit over 8/10/12/14 psi. This is the branch
 *              MATLAB used to choose the inflation pressure. Pressure effects are
 *              partly confounded with run history (only 12 psi was in both runs).
 */
(function () {
'use strict';
const PSI = 6.894757; // kPa per psi
const EPS = Number.EPSILON; // MATLAB eps, used in the same places as the MATLAB code

// Coefficient lookup with the SAME defaults as MATLAB gp_pt(): a missing
// coefficient takes the default written next to it in ttc_tire_equations.m.
function g(c, name, d) { const v = c[name]; return (typeof v === 'number' && isFinite(v)) ? v : d; }
const sgn = x => (x > 0) - (x < 0);

// Fy0' (no camber terms): feeds the aligning moment (MATLAB fy0_prime_pt).
function fy0Prime(c, alpha, Fz, p) {
  const Fnom = g(c, 'FNOMIN', 1110), Pnom = g(c, 'NOMPRES', 83000), F0 = Fnom * g(c, 'LFZO', 1);
  const dfz = (Fz - F0) / F0, dpi = (p - Pnom) / Pnom, Cy = g(c, 'PCY1', 1.5) * g(c, 'LCY', 1);
  const mu = (g(c, 'PDY1', 2) + g(c, 'PDY2', 0) * dfz) * (1 + g(c, 'PPY3', 0) * dpi + g(c, 'PPY4', 0) * dpi * dpi) * g(c, 'LMUY', 1);
  const Dy = mu * Fz;
  const K = g(c, 'PKY1', -20) * F0 * (1 + g(c, 'PPY1', 0) * dpi)
    * Math.sin(g(c, 'PKY4', 2) * Math.atan(Fz / (g(c, 'PKY2', 1) * F0 * (1 + g(c, 'PPY2', 0) * dpi)))) * g(c, 'LKY', 1);
  const By = K / (Cy * Dy + EPS);
  const SV = Fz * (g(c, 'PVY1', 0) + g(c, 'PVY2', 0) * dfz) * g(c, 'LVY', 1) * g(c, 'LMUY', 1);
  const SH = (g(c, 'PHY1', 0) + g(c, 'PHY2', 0) * dfz) * g(c, 'LHY', 1);
  const ay = alpha + SH;
  let E = (g(c, 'PEY1', 0) + g(c, 'PEY2', 0) * dfz) * (1 - g(c, 'PEY3', 0) * sgn(ay)) * g(c, 'LEY', 1); E = Math.min(E, 1);
  return { Fy: Dy * Math.sin(Cy * Math.atan(By * ay - E * (By * ay - Math.atan(By * ay)))) + SV, By, Cy };
}

// Full Fy0 with camber and pressure terms (MATLAB fy0_full_pt). This is Fy.
function fyFull(c, alpha, gamma, Fz, p) {
  const F0 = g(c, 'LFZO', 1) * g(c, 'FNOMIN', 1110), dfz = (Fz - F0) / F0;
  const Pnom = g(c, 'NOMPRES', 83000), dpi = (p - Pnom) / Pnom, LMUY = g(c, 'LMUY', 1);
  const mu = (g(c, 'PDY1', 2) + g(c, 'PDY2', 0) * dfz) * (1 + g(c, 'PPY3', 0) * dpi + g(c, 'PPY4', 0) * dpi * dpi)
    * (1 - g(c, 'PDY3', 0) * gamma * gamma) * LMUY;
  const Dy = mu * Fz, Cy = g(c, 'PCY1', 1.5) * g(c, 'LCY', 1);
  const Kya = g(c, 'PKY1', -20) * F0 * (1 + g(c, 'PPY1', 0) * dpi) * (1 - g(c, 'PKY3', 0) * Math.abs(gamma))
    * Math.sin(g(c, 'PKY4', 2) * Math.atan(Fz / ((g(c, 'PKY2', 1) + g(c, 'PKY5', 0) * gamma * gamma) * F0 * (1 + g(c, 'PPY2', 0) * dpi))))
    * g(c, 'LKY', 1);
  const Kyg = Fz * (g(c, 'PKY6', 0) + g(c, 'PKY7', 0) * dfz) * (1 + g(c, 'PPY5', 0) * dpi) * g(c, 'LKYC', 1);
  const SVyg = Fz * (g(c, 'PVY3', 0) + g(c, 'PVY4', 0) * dfz) * gamma * g(c, 'LKYC', 1) * LMUY;
  const SV = Fz * (g(c, 'PVY1', 0) + g(c, 'PVY2', 0) * dfz) * g(c, 'LVY', 1) * LMUY + SVyg;
  const SH = (g(c, 'PHY1', 0) + g(c, 'PHY2', 0) * dfz) * g(c, 'LHY', 1) + (Kyg * gamma - SVyg) / (Kya + EPS);
  const ay = alpha + SH, By = Kya / (Cy * Dy + EPS);
  const E = (g(c, 'PEY1', 0) + g(c, 'PEY2', 0) * dfz)
    * (1 + g(c, 'PEY5', 0) * gamma * gamma - (g(c, 'PEY3', 0) + g(c, 'PEY4', 0) * gamma) * sgn(ay)) * g(c, 'LEY', 1);
  return Dy * Math.sin(Cy * Math.atan(By * ay - E * (By * ay - Math.atan(By * ay)))) + SV;
}

/* Evaluate one point. Returns Fy (N), Mz (N m), pneumatic trail (m), residual
 * aligning moment (N m). Fz = 0 means no contact: zero force and moment. */
function evaluate(c, Fz, slipDeg, camberDeg, pKPa) {
  // Missing single coefficients take MATLAB's defaults, but an object with none of
  // the core ones is a mistake (e.g. passing the model instead of .coefficients).
  if (!c || !('PDY1' in c) || !('PKY1' in c)) throw new Error('TTC tyre: pass a model\'s .coefficients object (PDY1/PKY1 missing).');
  if (!(Fz > 0)) return { Fy: 0, Mz: 0, trail: NaN, residual: 0 };
  const alpha = slipDeg * Math.PI / 180, gamma = camberDeg * Math.PI / 180, p = 1000 * pKPa;
  const R0 = g(c, 'UNLOADED_RADIUS', 0.229), Fnom = g(c, 'FNOMIN', 1110), Pnom = g(c, 'NOMPRES', 83000);
  const F0 = Fnom * g(c, 'LFZO', 1), dfz = (Fz - F0) / F0, dpi = (p - Pnom) / Pnom;
  const fp = fy0Prime(c, alpha, Fz, p);
  const SHt = g(c, 'QHZ1', 0) + g(c, 'QHZ2', 0) * dfz + (g(c, 'QHZ3', 0) + g(c, 'QHZ4', 0) * dfz) * gamma;
  const at = alpha + SHt;
  const Bt = (g(c, 'QBZ1', 8) + g(c, 'QBZ2', 0) * dfz + g(c, 'QBZ3', 0) * dfz * dfz)
    * (1 + g(c, 'QBZ4', 0) * gamma + g(c, 'QBZ5', 0) * Math.abs(gamma)) * (g(c, 'LKY', 1) / g(c, 'LMUY', 1));
  const Ct = g(c, 'QCZ1', 1.1);
  const Dt0 = Fz * (R0 / F0) * (g(c, 'QDZ1', 0.10) + g(c, 'QDZ2', 0) * dfz) * (1 - g(c, 'PPZ1', 0) * dpi) * g(c, 'LTR', 1);
  const Dt = Dt0 * (1 + g(c, 'QDZ3', 0) * Math.abs(gamma) + g(c, 'QDZ4', 0) * gamma * gamma);
  let Et = (g(c, 'QEZ1', -1.5) + g(c, 'QEZ2', 0) * dfz + g(c, 'QEZ3', 0) * dfz * dfz)
    * (1 + (g(c, 'QEZ4', 0) + g(c, 'QEZ5', 0) * gamma) * (2 / Math.PI) * Math.atan(Bt * Ct * at));
  Et = Math.min(Et, 1);
  const t = Dt * Math.cos(Ct * Math.atan(Bt * at - Et * (Bt * at - Math.atan(Bt * at)))) * Math.cos(alpha);
  const Br = g(c, 'QBZ9', 1) * (g(c, 'LKY', 1) / g(c, 'LMUY', 1)) + g(c, 'QBZ10', 0) * fp.By * fp.Cy;
  const Dr = Fz * R0 * ((g(c, 'QDZ6', 0) + g(c, 'QDZ7', 0) * dfz) * g(c, 'LRES', 1)
    + (g(c, 'QDZ8', 0) + g(c, 'QDZ9', 0) * dfz) * (1 + g(c, 'PPZ2', 0) * dpi) * gamma
    + (g(c, 'QDZ10', 0) + g(c, 'QDZ11', 0) * dfz) * gamma * Math.abs(gamma)) * Math.cos(alpha) * g(c, 'LMUY', 1);
  const Mzr = Dr * Math.cos(Math.atan(Br * alpha));
  return { Fy: fyFull(c, alpha, gamma, Fz, p), Mz: -t * fp.Fy + Mzr, trail: t, residual: Mzr };
}

/* Peak |Fy| over a slip sweep 0..maxSlip (deg). Also returns the slip at the
 * peak, and whether the peak sits at the sweep edge (then it is not a true
 * peak: the model is extrapolating or still rising). */
function peak(c, Fz, camberDeg, pKPa, maxSlip = 15, step = 0.05) {
  let best = { F: 0, slip: 0 };
  for (let a = step; a <= maxSlip + 1e-9; a += step) {
    const F = Math.abs(evaluate(c, Fz, a, camberDeg, pKPa).Fy);
    if (F > best.F) best = { F, slip: a };
  }
  best.atEdge = best.slip > maxSlip - 2 * step;
  return best;
}

/* Cornering stiffness at zero slip (N/deg), central difference over +/-0.1 deg. */
function corneringStiffness(c, Fz, camberDeg, pKPa) {
  return Math.abs(evaluate(c, Fz, 0.1, camberDeg, pKPa).Fy - evaluate(c, Fz, -0.1, camberDeg, pKPa).Fy) / 0.2;
}

/* Loaded radius (mm) = intercept - Fz / k(p), with k(p) = rate at 12 psi times
 * the TTC Round 9 post-test pressure trend (MATLAB uses pchip; same here). */
function pchip(x, y, xq) { // Fritsch-Carlson monotone cubic, as MATLAB pchip for sorted data
  const n = x.length; if (n < 2) return y[0];
  const h = [], d = [];
  for (let i = 0; i < n - 1; i++) { h.push(x[i + 1] - x[i]); d.push((y[i + 1] - y[i]) / h[i]); }
  const m = new Array(n).fill(0);
  if (n === 2) { m[0] = m[1] = d[0]; } else {
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] > 0) { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
    }
    const end = (h0, h1, d0, d1) => { let s = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
      if (sgn(s) !== sgn(d0)) s = 0; else if (sgn(d0) !== sgn(d1) && Math.abs(s) > Math.abs(3 * d0)) s = 3 * d0; return s; };
    m[0] = end(h[0], h[1], d[0], d[1]); m[n - 1] = end(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
  }
  let i = 0; while (i < n - 2 && xq > x[i + 1]) i++;
  const t = (xq - x[i]) / h[i], t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * h[i] * m[i + 1];
}
function verticalRate(v, psi) { return v.rate12psi_N_mm * pchip(v.pressure_psi, v.rateRatioTo12psi, psi); }
function loadedRadius(v, Fz, psi) { return v.intercept_mm - Fz / verticalRate(v, psi); }

window.BFSAE_TTC = { evaluate, peak, corneringStiffness, verticalRate, loadedRadius, pchip, PSI };
})();
