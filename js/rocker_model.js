/* Rocker & coilover model — JavaScript port of the FSAE MATLAB rocker lab.
 *
 * Each function names the MATLAB file it reproduces, so a future team can
 * check one against the other. Geometry comes from the team package (written
 * by MATLAB sandbox_export.m); see docs/ROCKER_COILOVER.md for the method and
 * docs/DATA_DICTIONARY.md for every input.
 *
 * Units: mm, N, kg, s, rad unless a name says otherwise. Frame: the page's
 * vehicle frame, +x forward, +y left, +z up (left corner; right = mirror).
 *
 *   solveLinkage   rocker_development_path.m      rocker angle, motion ratio,
 *                                                  shock length over wheel travel
 *   coilover       rocker_development_equilibrium  collar setting at ride height,
 *                                                  spring compression, wheel rate,
 *                                                  usable bump/droop per seat case
 *   damping        rocker_damping_math.m /         equivalent damping, body and
 *                  rocker_damping_review.m         hop damping ratios
 *   loadCases      rocker_load_cases.m            rigid-rocker joint loads
 */
(function () {
'use strict';
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => Math.hypot(a[0], a[1], a[2]), unit = a => mul(a, 1 / (norm(a) || 1));
function rotate(p, origin, a, t) { // Rodrigues rotation of p about the axis a through origin
  const v = sub(p, origin), c = Math.cos(t), s = Math.sin(t);
  return add(origin, add(add(mul(v, c), mul(cross(a, v), s)), mul(a, dot(a, v) * (1 - c))));
}

/* closeCircle (rocker_development_path.m): rotate the rocker pushrod point
 * `base` about axis a through `origin` until it sits `L` from the pushrod's
 * outboard end `target`. Two solutions exist; keep the one nearest the
 * previous angle so the rocker moves continuously through travel. */
function closeCircle(base, origin, a, target, L, previous) {
  const center = add(origin, mul(a, dot(sub(base, origin), a))), u = sub(base, center), v = cross(a, u), d = sub(target, center);
  const A = dot(d, u), B = dot(d, v), amp = Math.hypot(A, B);
  if (!(amp > 1e-8 && norm(u) > 1e-8)) return null; // degenerate circle
  const co = (dot(d, d) + dot(u, u) - L * L) / (2 * amp);
  if (!(Math.abs(co) < 1 - 1e-10)) return null; // pushrod cannot reach: infeasible / tangent
  let best = null;
  for (const r of [Math.atan2(B, A) + Math.acos(co), Math.atan2(B, A) - Math.acos(co)]) {
    const t = previous + Math.atan2(Math.sin(r - previous), Math.cos(r - previous));
    if (best === null || Math.abs(t - previous) < Math.abs(best - previous)) best = t; // (best may be exactly 0)
  }
  return { t: best, point: add(center, add(mul(u, Math.cos(best)), mul(v, Math.sin(best)))) };
}

/* dP/dz of the pushrod's outboard path. MATLAB has this derivative exactly from
 * its 3D suspension model; the package carries only P(z) on a uniform 0.25 mm
 * grid, so use a 5-point central difference (error ~h^4, far below the model's
 * accuracy), 3-point next to the ends and one-sided second order at the ends. */
function gradient3(P, z) {
  const n = z.length, h = (z[n - 1] - z[0]) / (n - 1);
  if (n < 5 || z.some((v, j) => j && Math.abs(v - z[j - 1] - h) > 1e-6)) // non-uniform grid: plain central differences
    return P.map((_, j) => { const i0 = Math.max(0, j - 1), i1 = Math.min(n - 1, j + 1); return mul(sub(P[i1], P[i0]), 1 / (z[i1] - z[i0])); });
  return P.map((_, j) => {
    if (j >= 2 && j <= n - 3) return mul(add(sub(P[j - 2], P[j + 2]), mul(sub(P[j + 1], P[j - 1]), 8)), 1 / (12 * h));
    if (j === 1 || j === n - 2) return mul(sub(P[j + 1], P[j - 1]), 1 / (2 * h));
    const s = j === 0 ? 1 : -1, a = P[j], b = P[j + s], c = P[j + 2 * s]; // one-sided, second order
    return mul(add(add(mul(a, -3), mul(b, 4)), mul(c, -1)), s / (2 * h));
  });
}
function gradient(y, z) {
  const n = z.length;
  return y.map((_, j) => { const i0 = j === 0 ? 0 : j - 1, i1 = j === n - 1 ? n - 1 : j + 1; return (y[i1] - y[i0]) / (z[i1] - z[i0]); });
}

/* solveLinkage — rocker_development_path.m.
 * geo:  pivot, pivotAxis, pushrodRocker (G0), shockRocker (H0), shockChassis (S),
 *       arbRocker (Q0), pushrodOutboardCAD (P0)
 * path: wheelTravelFromCAD_mm (z), pushrodOutboard (P(z)) from the MATLAB 3D model
 * Returns per-z arrays; valid[j] = false where the linkage cannot close, toggles,
 * or the pushrod's virtual lever becomes too small (stop marching past it). */
function solveLinkage(geo, path, minLever) {
  const z = path.wheelTravelFromCAD_mm, P = path.pushrodOutboard, n = z.length, a = unit(geo.pivotAxis), R = geo.pivot;
  const G0 = geo.pushrodRocker, H0 = geo.shockRocker, S = geo.shockChassis, Q0 = geo.arbRocker;
  // Exact dP/dz from MATLAB when the package has it; otherwise differentiate the path.
  const Lrod = norm(sub(G0, geo.pushrodOutboardCAD)), dP = path.pushrodOutboardRate || gradient3(P, z);
  const out = { z, n, a, Lrod, G: new Array(n), H: new Array(n), Q: new Array(n), gamma: new Array(n).fill(NaN),
    mr: new Array(n).fill(NaN), length: new Array(n).fill(NaN), valid: new Array(n).fill(false), stop: ['', ''], P };
  let zero = 0; z.forEach((v, j) => { if (Math.abs(v) < Math.abs(z[zero])) zero = j; });
  [[1, zero], [-1, zero - 1]].forEach(([dir, start], k) => {
    let previous = 0;
    for (let j = start; j >= 0 && j < n; j += dir) {
      const c = closeCircle(G0, R, a, P[j], Lrod, previous);
      if (!c) { out.stop[k] = 'pushrod cannot close the linkage'; break; }
      previous = c.t;
      const G = c.point, H = rotate(H0, R, a, c.t), Q = rotate(Q0, R, a, c.t);
      const u = mul(sub(G, P[j]), 1 / Lrod), den = dot(sub(G, P[j]), cross(a, sub(G, R)));
      if (Math.abs(den) <= 1e-7) { out.stop[k] = 'rocker toggles (pushrod in line with the pivot)'; break; }
      const gp = dot(sub(G, P[j]), dP[j]) / den, hp = mul(cross(a, sub(H, R)), gp), L = norm(sub(H, S));
      if (!(L > 1)) { out.stop[k] = 'zero shock eye distance'; break; }
      if (!(Math.abs(dot(u, dP[j])) > minLever)) { out.stop[k] = 'pushrod virtual lever too small'; break; }
      out.G[j] = G; out.H[j] = H; out.Q[j] = Q; out.gamma[j] = c.t;
      out.mr[j] = -dot(sub(H, S), hp) / L; // shock shortening per mm of wheel bump
      out.length[j] = L; out.valid[j] = true;
    }
  });
  out.ok = out.valid[zero];
  return out;
}

/* coilover — rocker_development_equilibrium.m (seat-offset loop) +
 * rocker_development_ride_compression.m.
 * The rocker lab sets the spring collar so the car sits at the design ride
 * height: k x + gas = W / MR at ride. That fixes the spring compression x(z)
 * everywhere, the wheel force (k x + gas) MR and the wheel rate d(force)/dz.
 * The usable interval is repeated for each seat-setting scenario (+/-1 mm by
 * default: the collar cannot be set more precisely than that). */
function coilover(L, co, lim, massKg, g, springRate) {
  const z = L.z, n = L.n, k = springRate, gas = co.gasForce_N, W = massKg * g, ride = co.rideFromCAD_mm;
  let r = 0; z.forEach((v, j) => { if (Math.abs(v - ride) < Math.abs(z[r] - ride)) r = j; });
  const out = { ride, r, ok: false, reason: '' };
  if (!L.valid[r]) { out.reason = 'Linkage does not close at ride height'; return out; }
  const mrR = L.mr[r], LR = L.length[r];
  if (!(mrR > 0 && mrR < 1)) { out.reason = 'Ride motion ratio outside (0,1)'; return out; }
  const xReq = (W / mrR - gas) / k, freePlusSeat = co.springFreeLength_mm + co.seatFromRockerEye_mm;
  const collar = LR + xReq - freePlusSeat, scen = co.seatScenarios_mm.map(s => collar + s);
  Object.assign(out, { mrRide: mrR, eyeRide: LR, xReq, collar, scen });
  out.preloadAtFullExtension = Math.min(...scen) + freePlusSeat - co.extendedEye_mm;
  out.seatedMargin = out.preloadAtFullExtension - co.minimumPreloadAtFullExtension_mm;
  out.collarMarginFrame = Math.min(...scen) - co.collarBounds_mm[0];
  out.collarMarginRocker = co.collarBounds_mm[1] - Math.max(...scen);
  out.x = L.length.map(l => xReq + LR - l); // spring compression, nominal seat
  out.force = out.x.map((x, j) => (k * x + gas) * L.mr[j]); // wheel-equivalent force
  const good = L.valid, zg = z.filter((_, j) => good[j]);
  const kw = new Array(n).fill(NaN), gIdx = z.map((_, j) => j).filter(j => good[j]);
  const kwg = gradient(gIdx.map(j => out.force[j]), zg); gIdx.forEach((j, i) => { kw[j] = kwg[i]; });
  out.kw = kw; out.kwRide = kw[r];
  // Usable interval per seat scenario (hard limits of the rocker lab)
  const lower = co.compressedEye_mm + co.endReserve_mm, upper = co.extendedEye_mm - co.endReserve_mm;
  out.seat = [];
  for (const s of co.seatScenarios_mm) {
    const xs = out.x.map(x => x + s), f = xs.map((x, j) => (k * x + gas) * L.mr[j]);
    const kws = new Array(n).fill(NaN), kg = gradient(gIdx.map(j => f[j]), zg); gIdx.forEach((j, i) => { kws[j] = kg[i]; });
    let valid = z.map((_, j) => good[j] && xs[j] >= 0 && xs[j] <= co.springCompressionLimit_mm && L.mr[j] > 0 && L.mr[j] < 1
      && kws[j] > 0 && L.length[j] >= lower && L.length[j] <= upper);
    let loaded = null; // root of f(z) = W nearest the ride height (linear between grid points)
    for (let j = 0; j < n - 1; j++) {
      if (valid[j] && valid[j + 1] && (f[j] - W) * (f[j + 1] - W) <= 0) {
        const t = (f[j] === f[j + 1]) ? 0 : (W - f[j]) / (f[j + 1] - f[j]), zr = z[j] + t * (z[j + 1] - z[j]);
        if (loaded === null || Math.abs(zr - ride) < Math.abs(loaded - ride)) loaded = zr;
      }
    }
    const row = { seat: s, ok: false };
    if (loaded === null) { row.reason = 'No stable loaded equilibrium'; out.seat.push(row); continue; }
    let jl = 0; z.forEach((v, j) => { if (Math.abs(v - loaded) < Math.abs(z[jl] - loaded)) jl = j; });
    const j0 = Math.max(0, Math.min(n - 2, z.findIndex(v => v > loaded) - 1));
    const kwLoaded = kws[j0] + (kws[j0 + 1] - kws[j0]) * (loaded - z[j0]) / (z[j0 + 1] - z[j0]);
    const floor = Math.max(lim.minimumWheelRate_N_mm, lim.minimumWheelRateFraction * kwLoaded);
    valid = valid.map((v, j) => v && kws[j] >= floor);
    if (!valid[jl]) { row.reason = 'No usable interval at the loaded position'; out.seat.push(row); continue; }
    let lo = jl, hi = jl; while (lo > 0 && valid[lo - 1]) lo--; while (hi < n - 1 && valid[hi + 1]) hi++;
    const loLim = Math.max(z[lo], loaded - lim.maximumScreenedDroop_mm), hiLim = Math.min(z[hi], loaded + lim.maximumBump_mm);
    lo = z.findIndex(v => v >= loLim - 1e-9); for (let j = n - 1; j >= 0; j--) if (z[j] <= hiLim + 1e-9) { hi = j; break; }
    const eyes = L.length.slice(lo, hi + 1);
    Object.assign(row, { loaded, lo, hi, bump: z[hi] - loaded, droop: loaded - z[lo], floor,
      stroke: Math.max(...eyes) - Math.min(...eyes), maxX: Math.max(...xs.slice(lo, hi + 1)) });
    row.ok = row.bump >= 0 && row.droop >= 0 && row.bump + row.droop >= lim.minimumTotalTravel_mm
      && row.stroke <= lim.damperTotalStroke_mm && row.bump >= lim.minimumBump_mm;
    if (!row.ok) row.reason = 'Usable travel below the lab minimum (bump, total or stroke)';
    out.seat.push(row);
  }
  const done = out.seat.filter(s => s.ok);
  out.ok = done.length === out.seat.length && out.seatedMargin >= -1e-9 && out.collarMarginFrame >= -1e-9 && out.collarMarginRocker >= -1e-9;
  if (!out.ok) out.reason = out.seat.find(s => !s.ok)?.reason || (out.seatedMargin < 0 ? 'Spring unseated at full shock extension: move the collar toward the rocker eye'
    : 'Required collar setting is off the usable thread');
  out.bump = Math.min(...out.seat.map(s => s.ok ? s.bump : NaN)); out.droop = Math.min(...out.seat.map(s => s.ok ? s.droop : NaN));
  const nom = out.seat.find(s => s.seat === 0) || out.seat[0];
  out.nominal = nom;
  // Physical limits walking from ride (rocker_load_cases.m walk()): spring bind /
  // shock bottom-out in bump, shock top-out in droop. No end reserve here.
  const inBump = j => L.valid[j] && L.length[j] >= co.compressedEye_mm && out.x[j] <= co.springCompressionLimit_mm;
  const inDroop = j => L.valid[j] && L.length[j] <= co.extendedEye_mm;
  let jp = r; while (jp + 1 < n && inBump(jp + 1)) jp++;
  let jt = r; while (jt - 1 >= 0 && inDroop(jt - 1)) jt--;
  out.physBump = { j: jp, note: jp + 1 >= n || !L.valid[jp + 1] ? 'saved path ends before the physical limit'
    : out.x[jp + 1] > co.springCompressionLimit_mm ? 'spring bind' : `shock fully compressed (${co.compressedEye_mm.toFixed(1)} mm eye)` };
  out.physDroop = { j: jt, note: jt - 1 < 0 || !L.valid[jt - 1] ? 'saved path ends before the physical limit'
    : `shock fully extended (${co.extendedEye_mm.toFixed(1)} mm eye)` };
  return out;
}

/* Damper force at shaft speed v (m/s, + = compression) from the dyno table.
 * which = 'force_N' (nominal), 'forceLow_N' or 'forceHigh_N' (band). */
function damperForce(D, v, which = 'force_N') {
  const x = D.velocity_m_s, y = D[which], n = x.length;
  if (v <= x[0]) return y[0] + (y[1] - y[0]) * (v - x[0]) / (x[1] - x[0]);
  if (v >= x[n - 1]) return y[n - 1] + (y[n - 1] - y[n - 2]) * (v - x[n - 1]) / (x[n - 1] - x[n - 2]);
  let i = Math.min(n - 2, Math.max(0, Math.floor((v - x[0]) / (x[1] - x[0])))); // uniform grid
  while (i > 0 && x[i] > v) i--; while (i < n - 2 && x[i + 1] < v) i++;
  return y[i] + (y[i + 1] - y[i]) * (v - x[i]) / (x[i + 1] - x[i]);
}

/* Equivalent linear shaft damping (N s/m) at PEAK shaft speed V (m/s):
 * equal energy per harmonic cycle, c = 4/(pi V^2) * int_0^(pi/2) |F(V cos t)| V cos t dt,
 * per direction (rocker_damping_math "coefficients"). Cycle = mean of both. */
function ceq(D, V, which = 'force_N') {
  const N = 720, h = (Math.PI / 2) / N; const c = [0, 0];
  [1, -1].forEach((sg, d) => {
    let s = 0;
    for (let i = 0; i <= N; i++) { const v = V * Math.cos(i * h), f = Math.abs(damperForce(D, sg * v, which)) * v; s += (i === 0 || i === N) ? f / 2 : f; }
    c[d] = 4 / (Math.PI * V * V) * s * h;
  });
  return { compression: c[0], rebound: c[1], cycle: (c[0] + c[1]) / 2 };
}

/* damping — rocker_damping_review.m method (linearised quarter car at ride).
 * c_w = c_eq * MR^2 (wheel damping). Body mode with the tyre in series: the
 * damper sees the suspension share r = kt/(kw+kt) of the body motion, so
 * zeta_body = c_w r^2 / (2 sqrt(k_ride m_s)), k_ride = kw kt/(kw+kt).
 * Hop: zeta_hop = c_w / (2 sqrt((kw+kt) m_u)). kw, kt in N/mm here. */
function damping(D, mr, kwNmm, ktNmm, ms, mu, bodyInS, hopInS) {
  const kw = kwNmm * 1000, kt = ktNmm * 1000, r = kt / (kw + kt), kr = kw * kt / (kw + kt);
  const cb = ceq(D, bodyInS * 0.0254), ch = ceq(D, hopInS * 0.0254), out = { kr: kr / 1000 };
  out.fBody = Math.sqrt(kr / ms) / (2 * Math.PI); out.fHop = Math.sqrt((kw + kt) / mu) / (2 * Math.PI);
  for (const d of ['compression', 'rebound', 'cycle']) {
    const cwb = cb[d] * mr * mr, cwh = ch[d] * mr * mr;
    out['body_' + d] = cwb * r * r / (2 * Math.sqrt(kr * ms));
    out['hop_' + d] = cwh / (2 * Math.sqrt((kw + kt) * mu));
  }
  out.bodySpeedExtrapolated = bodyInS * 0.0254 > D.measuredLimit_m_s + 1e-12;
  out.hopSpeedExtrapolated = hopInS * 0.0254 > D.measuredLimit_m_s + 1e-12;
  return out;
}

/* Rigid, massless, frictionless rocker: moment balance about the pivot axis
 * (rocker_load_cases.m statics). Shock force (+ = compression) acts on the
 * rocker eye along (H-S); pushrod compression C acts on G along (G-P).
 * Returns per-newton-of-shock-force: pushrod force C1, pushrod hole vector fG1,
 * pivot reaction fR1. */
function statics(a, Rp, G, H, up, us) {
  const C1 = -dot(a, cross(sub(H, Rp), us)) / dot(a, cross(sub(G, Rp), up));
  const fG1 = mul(up, C1), fR1 = mul(add(fG1, us), -1);
  return { C1, fG1, fR1 };
}

/* loadCases — rocker_load_cases.m. The same load cases as MATLAB: static ride,
 * usable bump/droop ends, physical limits, damper speeds at the travel ends and
 * a 3 g vertical design case. "Band" = spread over the seat-setting scenarios
 * and the damper dyno band; the envelope uses the band maximum like MATLAB. */
function loadCases(L, C, co, D, ms, g, opts) {
  const a = L.a, Rp = opts.pivot, k = opts.springRate, gas = D.gasForce_N, lim = D.measuredLimit_m_s;
  const seat = [Math.min(...co.seatScenarios_mm), Math.max(...co.seatScenarios_mm)];
  const nom = C.nominal, cases = [];
  const add_ = (name, group, j, v, nG, note) => cases.push({ name, group, j, v, nG, note: note || '' });
  add_('Static ride', 'Static', C.r, 0, NaN);
  add_('Usable bump end', 'Static', nom.hi, 0, NaN);
  add_('Physical bump limit', 'Static', C.physBump.j, 0, NaN, C.physBump.note);
  for (const V of opts.bumpSpeeds) add_(`Bump end + ${V} in/s compression`, 'Damper', nom.hi, V * 0.0254, NaN);
  add_('Usable droop end', 'Static', nom.lo, 0, NaN);
  add_('Physical droop limit', 'Static', C.physDroop.j, 0, NaN, C.physDroop.note);
  for (const V of opts.reboundSpeeds) add_(`Droop end + ${V} in/s rebound`, 'Damper', nom.lo, -V * 0.0254, NaN);
  add_(`${opts.verticalG} g vertical at ride`, 'Design', C.r, 0, opts.verticalG, 'Design convention: shock force = n m_s g / MR');
  return cases.map(c => {
    const j = c.j, G = L.G[j], H = L.H[j], P = L.P[j], mr = L.mr[j];
    const us = unit(sub(H, opts.shockChassis)), up = unit(sub(G, P)), st = statics(a, Rp, G, H, up, us);
    let Fs, band, xs = NaN, fd = 0;
    if (isFinite(c.nG)) { Fs = c.nG * ms * g / mr; band = [Fs, Fs]; }
    else {
      xs = C.x[j]; if (c.note === 'spring bind') xs = co.springCompressionLimit_mm;
      fd = damperForce(D, c.v); Fs = k * xs + gas + fd;
      const xx = seat.map(s => Math.min(Math.max(xs + s, 0), co.springCompressionLimit_mm));
      const cand = []; for (const x of xx) for (const f of [damperForce(D, c.v, 'forceLow_N'), damperForce(D, c.v, 'forceHigh_N'), fd]) cand.push(k * x + gas + f);
      band = [Math.min(...cand), Math.max(...cand)];
    }
    const peak = Math.max(Math.abs(band[0]), Math.abs(band[1]));
    return { ...c, z: L.z[j], fromRide: L.z[j] - C.ride, mr, eye: L.length[j], x: xs, damperForce: fd, shockForce: Fs, band,
      pushrod: st.C1 * Fs, pivot: norm(st.fR1) * Math.abs(Fs), pivotMax: norm(st.fR1) * peak, pushrodHoleMax: norm(st.fG1) * peak,
      shockHoleMax: peak, extrapolated: Math.abs(c.v) > lim + 1e-12, pushrodLow: Math.min(st.C1 * band[0], st.C1 * band[1]),
      pushrodHigh: Math.max(st.C1 * band[0], st.C1 * band[1]) };
  });
}
function envelope(rows) {
  const meas = rows.filter(r => !r.extrapolated && r.group !== 'Design'), mx = (R, f) => Math.max(...R.map(f));
  const arg = f => rows.reduce((b, r) => f(r) > f(b) ? r : b, rows[0]);
  return { measuredPivot: mx(meas, r => r.pivotMax), measuredPushrodHole: mx(meas, r => r.pushrodHoleMax), measuredShockHole: mx(meas, r => r.shockHoleMax),
    pivot: mx(rows, r => r.pivotMax), pivotCase: arg(r => r.pivotMax).name, pushrodHole: mx(rows, r => r.pushrodHoleMax),
    shockHole: mx(rows, r => r.shockHoleMax), pushrodMaxCompression: mx(rows, r => r.pushrodHigh), pushrodMin: Math.min(...rows.map(r => r.pushrodLow)) };
}

/* Rocker plate outline — rocker_development_outline.m. The rocker is a closed,
 * convex plate: the convex hull of 24-sided circles of radius margin/cos(pi/24)
 * (so each joint keeps at least `margin` of material) around the pivot, pushrod,
 * shock and ARB joint centres, in the rocker plane. This is the same outline the
 * rocker lab uses for packaging, collision checks and the CAD export.
 * Returns 3D points at the CAD pose, in order around the plate. */
function planeBasis(a) { // e1 = lateral (+y) in the plane, e2 = upward in the plane
  const yv = [0, 1, 0], d = dot(a, yv), e1 = unit(sub(yv, mul(a, d)));
  let e2 = cross(a, e1); if (e2[2] < 0) e2 = mul(e2, -1);
  return [e1, e2];
}
function hull2(pts) { // Andrew's monotone chain; drops collinear points like MATLAB convhull
  const p = pts.slice().sort((A, B) => A[0] - B[0] || A[1] - B[1]);
  const turn = (o, A, B) => (A[0] - o[0]) * (B[1] - o[1]) - (A[1] - o[1]) * (B[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && turn(lo[lo.length - 2], lo[lo.length - 1], q) <= 1e-12) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length > 1 && turn(up[up.length - 2], up[up.length - 1], q) <= 1e-12) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function outline(geo, margin) {
  const a = unit(geo.pivotAxis), O = geo.pivot, [e1, e2] = planeBasis(a), r = margin / Math.cos(Math.PI / 24), cloud = [];
  for (const c of [geo.pivot, geo.pushrodRocker, geo.shockRocker, geo.arbRocker]) {
    const u = dot(sub(c, O), e1), v = dot(sub(c, O), e2);
    for (let k = 0; k < 24; k++) { const t = k * 2 * Math.PI / 24; cloud.push([u + r * Math.cos(t), v + r * Math.sin(t)]); }
  }
  return hull2(cloud).map(([u, v]) => add(O, add(mul(e1, u), mul(e2, v))));
}
/* The plate at wheel-travel index j: the CAD outline turned by the rocker angle there. */
function outlineAt(L, geo, plate, j) { return plate.map(p => rotate(p, geo.pivot, L.a, L.gamma[j])); }

/* Roll stiffness of one axle (N m/deg): wheel rate and tyre in series, times
 * track^2 / 2, plus any anti-roll bar. The same springs-only formula as the
 * MATLAB steering envelope's lateral-transfer model. */
function rollStiffness(kwNmm, ktNmm, trackMm, arbNmDeg) {
  const kr = kwNmm * ktNmm / (kwNmm + ktNmm) * 1000, t = trackMm / 1000;
  return kr * t * t / 2 * Math.PI / 180 + (arbNmDeg || 0);
}

window.BFSAE_ROCKER_MODEL = { solveLinkage, coilover, damperForce, ceq, damping, loadCases, envelope, rollStiffness, statics, closeCircle,
  outline, outlineAt, planeBasis, rotate };
})();
