/* TTC tyre model panel (#ttc). Draws the team reference tyre from the team
 * package using js/ttc_tyre.js, and can hand its pneumatic trail and loaded
 * radius to the steering-effort and vehicle tools. Method and every input:
 * docs/TYRE_MODEL.md. Nothing here runs until a team package is loaded. */
(function () {
'use strict';
const S = window.SS, T = window.BFSAE_TTC; if (!S || !T) return;
const $ = id => document.getElementById(id), PSI = T.PSI, COLS = ['--t1', '--t2', '--t3', '--t4'];
const f0 = v => isFinite(v) ? v.toFixed(0) : '–', f1 = v => isFinite(v) ? v.toFixed(1) : '–', f2 = v => isFinite(v) ? v.toFixed(2) : '–';
let tyre = null;

function staticFront() { const v = S.veh(); return v.m * v.wdf * 9.81 / 2; } // N per front tyre at rest
function model() { return tyre.models[$('ttcBranch').value].coefficients; } // coefficients of the chosen branch
function loadsList() {
  const txt = $('ttcLoads').value.trim(), sf = staticFront();
  if (!txt) return [0.5 * sf, sf, 1.6 * sf].map(Math.round);
  return txt.split(/[,\s]+/).map(Number).filter(v => v > 0).slice(0, 4);
}

function build(pkg) {
  tyre = pkg.tyre;
  const m = tyre.models.pressure.reviewDomain;
  $('ttcBody').innerHTML = `
  <div class="params">
    <label><span class="label">Model branch</span><select id="ttcBranch"><option value="pressure">Pressure branch (experimental, 8–14 psi)</option><option value="nominal">Nominal branch (12 psi fit)</option></select></label>
    <label><span class="label">Pressure (psi)</span><input id="ttcP" type="number" step="0.5" min="6" max="16" value="${tyre.bestPressure_psi}"></label>
    <label><span class="label">Camber (°, − = top in)</span><input id="ttcCam" type="number" step="0.25" value="${tyre.camberAtLimit_deg}"></label>
    <label><span class="label">Loads (N, blank = car)</span><input id="ttcLoads" type="text" placeholder="0.5×, 1×, 1.6× static" style="width:170px"></label>
    <label><span class="label">Slip range (°)</span><input id="ttcSlip" type="number" step="1" min="4" max="20" value="12"></label>
    <button class="btn" id="ttcTrail" type="button" title="Sets Pneumatic trail in Steering effort to |Mz/Fy| at 2° slip, static front load">Use TTC trail in steering effort</button>
    <button class="btn" id="ttcRadius" type="button" title="Sets Loaded tire radius in Vehicle parameters">Use TTC loaded radius</button>
  </div>
  <div class="rc-grid">
    <div><canvas id="ttcChart" aria-label="Lateral force magnitude versus slip angle for several loads"></canvas></div>
    <div><canvas id="ttcPress" aria-label="Peak friction versus inflation pressure"></canvas></div>
  </div>
  <div class="tbl-wrap"><table class="mini" id="ttcTable"></table></div>
  <div class="kv kv-row" id="ttcOut"></div>
  <p class="note"><b>What the numbers mean.</b> Curves are |F<sub>y</sub>| from the fitted model at the chosen pressure and camber, one per load. μ<sub>lab</sub> is peak |F<sub>y</sub>| / F<sub>z</sub> on the TTC belt. μ<sub>road</sub> multiplies it by the project road factor (${tyre.roadGripFactor.toFixed(3)}; ${tyre.roadGripNote}) C<sub>α</sub> is the cornering stiffness at zero slip. Pneumatic trail is |M<sub>z</sub>/F<sub>y</sub>| at 2° slip. Loaded radius = ${tyre.loadedRadius.intercept_mm} mm − F<sub>z</sub>/k(p), with k(p) the TTC vertical rate scaled by pressure.
  <br><b>Pressure chart.</b> Solid: peak μ<sub>lab</sub> at the car's static front load, computed live. Dashed: MATLAB's whole-car lateral capacity (g, road factor applied, load transfer included) from <code>front_steering_envelope</code>; the chosen pressure (${tyre.bestPressure_psi} psi) is its maximum.
  <br><b>Validity.</b> Fitted over F<sub>z</sub> ${m.Fz_N[0]}–${m.Fz_N[1]} N, slip ±${m.slipAngle_deg[1]}°, camber ${m.camber_deg[0]} to ${m.camber_deg[1]}°, ${(m.pressure_kPa[0] / PSI).toFixed(0)}–${(m.pressure_kPa[1] / PSI).toFixed(0)} psi. Values outside are extrapolations and are flagged. The pressure branch is experimental (pressure is partly confounded with test-run history). Signs follow the MATLAB fitter; magnitudes are shown. Details: docs/TYRE_MODEL.md.</p>`;
  ['ttcBranch', 'ttcP', 'ttcCam', 'ttcLoads', 'ttcSlip'].forEach(id => $(id).addEventListener('input', render));
  $('vgrid').addEventListener('input', e => { if (/vp-(m|wdf)$/.test(e.target.id)) render(); }); // static load follows mass and split
  $('ttcTrail').addEventListener('click', () => {
    const c = model(), Fz = staticFront(), r = T.evaluate(c, Fz, 2, +$('ttcCam').value, +$('ttcP').value * PSI);
    $('ptrail').value = (1000 * Math.abs(r.Mz / r.Fy)).toFixed(1);
    $('ptrail').dispatchEvent(new Event('input'));
  });
  $('ttcRadius').addEventListener('click', () => {
    const psi = +$('ttcP').value, R = T.loadedRadius(tyre.loadedRadius, staticFront(), psi);
    S.setParam('rw', R, `TTC loaded radius, static front load, ${psi} psi (team package)`, 'pkg'); S.renderAll();
  });
  render();
}

function selfCheck() { // JS equations vs MATLAB ttc_tire_evaluate outputs stored in the package
  const out = {};
  for (const b of ['pressure', 'nominal']) {
    const V = tyre.testVectors[b], c = tyre.models[b].coefficients; let dF = 0, dM = 0;
    V.Fz_N.forEach((Fz, i) => { const r = T.evaluate(c, Fz, V.slip_deg[i], V.camber_deg[i], V.pressure_kPa[i]);
      dF = Math.max(dF, Math.abs(r.Fy - V.Fy_N[i])); dM = Math.max(dM, Math.abs(r.Mz - V.Mz_Nm[i])); });
    out[b] = { dF, dM, n: V.Fz_N.length };
  }
  return out;
}

function render() {
  if (!tyre) return;
  const c = model(), psi = +$('ttcP').value, kPa = psi * PSI, cam = +$('ttcCam').value, smax = Math.max(4, +$('ttcSlip').value || 12);
  const loads = loadsList(), dom = tyre.models[$('ttcBranch').value].reviewDomain;
  // Fy vs slip
  const series = [], all = [];
  loads.forEach((Fz, i) => {
    const pts = []; for (let a = 0; a <= smax + 1e-9; a += smax / 120) { const F = Math.abs(T.evaluate(c, Fz, a, cam, kPa).Fy); pts.push([a, F]); all.push(F); }
    series.push({ pts, col: S.css(COLS[i]), w: 2.5 });
  });
  const [y0, y1, ys] = S.range([0, ...all], 0.05);
  S.chart($('ttcChart'), { x0: 0, x1: smax, xs: smax > 12 ? 4 : 2, y0: 0, y1, ys, xl: 'slip angle (°)', yl: '|Fy| (N)', series,
    note: `${psi} psi · camber ${cam}° · ${$('ttcBranch').value} branch · loads ${loads.join(', ')} N` });
  // Peak mu vs pressure (live) and MATLAB capacity (package)
  const sf = staticFront(), pp = [], sw = tyre.pressureSweep;
  for (let p = 8; p <= 14 + 1e-9; p += 0.5) pp.push([p, T.peak(c, sf, cam, p * PSI, 15, 0.1).F / sf]);
  const cap = sw.pressure_psi.map((p, i) => [p, sw.lateralCapacity_g[i]]);
  const [q0, q1, qs] = S.range([...pp.map(p => p[1]), ...cap.map(p => p[1])], 0.1);
  S.chart($('ttcPress'), { x0: 8, x1: 14, xs: 1, y0: q0, y1: q1, ys: qs, xl: 'inflation pressure (psi)', yl: 'μ lab (solid) · capacity g (dashed)',
    series: [{ pts: pp, col: S.css('--accent'), w: 2.5 }, { pts: cap, col: S.css('--ideal'), w: 2, dash: [6, 4] },
      { pts: [[tyre.bestPressure_psi, q0], [tyre.bestPressure_psi, q1]], col: S.css('--rule'), w: 1, dash: [2, 4] }],
    note: `MATLAB choice ${tyre.bestPressure_psi} psi → ${tyre.lateralCapacity_g.toFixed(2)} g · μ = peak over 0–15° slip` });
  // Table per load
  const out = (x, r) => x < r[0] - 1e-9 || x > r[1] + 1e-9;
  const rows = loads.map((Fz, i) => {
    const pk = T.peak(c, Fz, cam, kPa, smax, 0.05), r2 = T.evaluate(c, Fz, 2, cam, kPa), Ca = T.corneringStiffness(c, Fz, cam, kPa);
    const R = T.loadedRadius(tyre.loadedRadius, Fz, psi), flags = [];
    if (out(Fz, dom.Fz_N)) flags.push('load'); if (out(cam, dom.camber_deg)) flags.push('camber'); if (out(kPa, dom.pressure_kPa)) flags.push('pressure');
    if (pk.atEdge) flags.push('peak at slip-range edge'); if (pk.slip > dom.slipAngle_deg[1]) flags.push('peak beyond fitted slip');
    return `<tr><td><span class="swatch" style="background:var(${COLS[i]})"></span>${f0(Fz)}</td><td>${f0(pk.F)}</td><td>${f1(pk.slip)}</td><td>${f2(pk.F / Fz)}</td><td>${f2(pk.F / Fz * tyre.roadGripFactor)}</td>`
      + `<td>${f0(Ca)}</td><td>${f1(1000 * Math.abs(r2.Mz / r2.Fy))}</td><td>${f1(R)}</td><td>${f1(T.verticalRate(tyre.loadedRadius, psi))}</td><td class="txt">${flags.length ? '⚠ outside fit: ' + flags.join(', ') : 'within fitted range'}</td></tr>`;
  }).join('');
  $('ttcTable').innerHTML = `<thead><tr><th>F<sub>z</sub> (N)</th><th>Peak |F<sub>y</sub>| (N)</th><th>at slip (°)</th><th>μ lab</th><th>μ road</th><th>C<sub>α</sub> (N/°)</th><th>Pneum. trail (mm)</th><th>Loaded radius (mm)</th><th>Vert. rate (N/mm)</th><th>Range check</th></tr></thead><tbody>${rows}</tbody>`;
  const chk = selfCheck(), ok = chk.pressure.dF < 0.01 && chk.nominal.dF < 0.01 && chk.pressure.dM < 1e-3 && chk.nominal.dM < 1e-3;
  $('ttcOut').innerHTML = S.kv([
    ['Tyre', tyre.name], ['Static front tyre load (from Vehicle)', f0(sf) + ' N'],
    ['Chosen pressure (MATLAB)', `${tyre.bestPressure_psi} psi · ${tyre.lateralCapacity_g.toFixed(2)} g car capacity`],
    ['Check vs MATLAB (' + (chk.pressure.n + chk.nominal.n) + ' points)', `|ΔFy| ≤ ${Math.max(chk.pressure.dF, chk.nominal.dF).toExponential(1)} N · |ΔMz| ≤ ${Math.max(chk.pressure.dM, chk.nominal.dM).toExponential(1)} N·m`, ok ? 'ok' : 'hi']]);
}

window.BFSAE_TTC_PANEL = { setPackage: build, render };
S.listeners.push(() => { if (tyre) render(); });
addEventListener('resize', () => { if (tyre) render(); });
})();
