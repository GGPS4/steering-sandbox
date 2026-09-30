/* Rocker & coilover panel (#rocker). Uses js/rocker_model.js on the pair in
 * the team package. Rocker points are editable; everything recomputes live.
 * The MATLAB curves stored in the package are drawn dashed as a check.
 * Method, equations and every input: docs/ROCKER_COILOVER.md. */
(function () {
'use strict';
const S = window.SS, M = window.BFSAE_ROCKER_MODEL; if (!S || !M) return;
const $ = id => document.getElementById(id);
const f0 = v => isFinite(v) ? v.toFixed(0) : '–', f1 = v => isFinite(v) ? v.toFixed(1) : '–', f2 = v => isFinite(v) ? v.toFixed(2) : '–', f3 = v => isFinite(v) ? v.toFixed(3) : '–';
const LBF_IN = 0.175126835; // N/mm per lbf/in
const POINTS = [ // editable rocker-side points [key, label, what it is]
  ['pivot', 'Rocker pivot', 'Centre of the pivot bore, in the rocker plane. The pivot axis direction is fixed by the frame mount.'],
  ['pushrodRocker', 'Pushrod on rocker', 'Pushrod rod-end centre on the rocker (input lever).'],
  ['shockRocker', 'Shock on rocker', 'Shock rocker-end eye centre (output lever).'],
  ['shockChassis', 'Shock on chassis', 'Shock frame-end eye centre.'],
  ['arbRocker', 'ARB link on rocker', 'Anti-roll-bar drop-link ball on the rocker (drawn only; ARB loads are in MATLAB).']];
let pkg = null, geo = [], base = [], k = [], res = [];

function build(p) {
  pkg = p; geo = p.axles.map(a => JSON.parse(JSON.stringify(a.geometry))); base = p.axles.map(a => JSON.parse(JSON.stringify(a.geometry)));
  k = p.axles.map(a => a.coilover.springRate_N_mm);
  const kt = p.damper.tyreRateBand_N_mm[1];
  $('rkBody').innerHTML = `
  <div class="params">
    <label><span class="label">Axle</span><select id="rkAxle">${p.axles.map((a, i) => `<option value="${i}">${a.name[0].toUpperCase() + a.name.slice(1)} · candidate ${a.candidate}</option>`).join('')}</select></label>
    <label title="Coil spring rate. Both axles use 185 lbf/in springs in the 2026 package."><span class="label">Spring rate (lbf/in)</span><input id="rkK" type="number" step="5" value="${(k[0] / LBF_IN).toFixed(0)}"></label>
    <label title="Tyre vertical stiffness in series with the suspension. 113.8 N/mm = TTC fit at 12 psi (the MATLAB damping review value); the TTC panel shows it at other pressures."><span class="label">Tyre rate (N/mm)</span><input id="rkKt" type="number" step="1" value="${kt.toFixed(1)}"></label>
    <label title="Peak shaft speed representing body motion (rocker_damping_review default 2 in/s)."><span class="label">Body shaft speed (in/s)</span><input id="rkVb" type="number" step="0.5" value="${p.damper.bodySpeed_in_s}"></label>
    <label title="Peak shaft speed representing wheel hop (default 10 in/s, the end of the measured dyno data)."><span class="label">Hop shaft speed (in/s)</span><input id="rkVh" type="number" step="1" value="${p.damper.hopSpeed_in_s}"></label>
    <label title="Front anti-roll bar roll stiffness. UNKNOWN for the 2026 car (shaft stiffness not measured): 0 = springs only."><span class="label">Front ARB (N·m/°)</span><input id="rkArbF" type="number" step="10" value="0"></label>
    <label title="Rear anti-roll bar roll stiffness. UNKNOWN: 0 = springs only."><span class="label">Rear ARB (N·m/°)</span><input id="rkArbR" type="number" step="10" value="0"></label>
    <label class="chk" title="Writes Total roll stiffness and Front roll stiffness share in Vehicle parameters, used by Load transfer and Steering effort."><input type="checkbox" id="rkFeed" checked> Feed roll stiffness to Load transfer</label>
    <button class="btn" id="rkReset" type="button">Reset rocker points</button>
  </div>
  <div class="rc-grid">
    <div><canvas id="rkMR" aria-label="Motion ratio versus wheel travel"></canvas></div>
    <div><canvas id="rkKw" aria-label="Wheel rate versus wheel travel"></canvas></div>
  </div>
  <div class="rc-grid" style="border-top:1px solid var(--rule)">
    <div><canvas id="rkDraw" aria-label="Rocker, pushrod and shock drawn in the rocker plane at ride, bump end and droop end"></canvas></div>
    <div class="kv" id="rkOut"></div>
  </div>
  <div class="tbl-wrap" style="border-top:1px solid var(--ink)"><table id="rkPts"></table></div>
  <div class="tbl-wrap" style="border-top:1px solid var(--rule)"><table class="mini" id="rkLoads"></table></div>
  <div class="kv kv-row" id="rkCheck"></div>
  <p class="note"><b>Method</b> (same as the MATLAB rocker lab; docs/ROCKER_COILOVER.md). The pushrod's outboard end follows the path exported from the MATLAB 3D suspension model. The rocker turns about its pivot axis to keep the pushrod length, which sets the shock length. <b>Motion ratio</b> = shock shortening per mm of wheel bump. The collar is set so the car sits at the design ride height: spring force + gas force = corner weight / MR. That fixes the spring compression everywhere, and the <b>wheel rate</b> is the slope of (spring + gas force) × MR over wheel travel.
  <br><b>Usable travel</b> ends at spring bind, at the shock eye limits minus a ${pkg.axles[0].coilover.endReserve_mm} mm reserve, where the wheel rate falls below the lab floor, or at the lab's travel caps. It is repeated for each seat-setting case (${pkg.axles[0].coilover.seatScenarios_mm.join(' / ')} mm) and the smallest is reported. <b>Damping</b>: equivalent linear damping at the chosen peak shaft speed (equal energy per cycle), times MR², in a quarter car with the tyre in series. <b>Joint loads</b>: rigid, massless, frictionless rocker in moment balance about the pivot axis. Shock force = spring + gas + damper, with the band covering seat cases and the dyno band. Above 10 in/s the damper force is extrapolated.
  <br><b>Not included:</b> part strength, bearing life, compliance, the ARB (unknown stiffness; enter it above), and any change to the A-arms. The pushrod path is fixed, so changing arm points needs a new MATLAB export.</p>`;
  ['rkK', 'rkKt', 'rkVb', 'rkVh', 'rkArbF', 'rkArbR', 'rkFeed'].forEach(id => $(id).addEventListener('input', () => { if (id === 'rkK') k[+$('rkAxle').value] = +$('rkK').value * LBF_IN; render(); }));
  $('rkAxle').addEventListener('change', () => { $('rkK').value = (k[+$('rkAxle').value] / LBF_IN).toFixed(0); buildPoints(); render(); });
  $('rkReset').addEventListener('click', () => { geo = base.map(g => JSON.parse(JSON.stringify(g))); buildPoints(); render(); });
  $('vgrid').addEventListener('input', e => { if (/vp-(tf|tr|m|wdf)$/.test(e.target.id)) render(); });
  buildPoints(); render();
}

function buildPoints() {
  const i = +$('rkAxle').value, g = geo[i], b = base[i];
  const row = ([key, label, help]) => `<tr title="${help}"><td class="key">${label}<span>${help.split('.')[0]}</span></td>` + [0, 1, 2].map(d => `<td class="bl">${b[key][d].toFixed(1)}</td>`).join('')
    + [0, 1, 2].map(d => `<td><input type="number" step="0.5" data-k="${key}" data-d="${d}" value="${g[key][d].toFixed(1)}" aria-label="${label} ${'xyz'[d]}"></td>`).join('') + '</tr>';
  const fixed = [['pushrodOutboardCAD', 'Pushrod outboard (CAD)', 'On the lower arm; moves with the suspension along the exported path. Fixed here.']]
    .map(([key, label, help]) => `<tr title="${help}"><td class="key">${label}<span>fixed by the suspension</span></td>` + [0, 1, 2].map(d => `<td class="bl">${b[key][d].toFixed(1)}</td>`).join('') + '<td class="miss" colspan="3">edit arm points in MATLAB, then re-export</td></tr>').join('');
  $('rkPts').innerHTML = `<thead><tr><th>Rocker point (mm)</th><th>Package X</th><th>Y</th><th>Z</th><th>Current X</th><th>Y</th><th>Z</th></tr></thead><tbody>${POINTS.map(row).join('')}${fixed}</tbody>`;
  $('rkPts').querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => {
    const v = parseFloat(inp.value); if (!isFinite(v)) return;
    geo[i][inp.dataset.k][+inp.dataset.d] = v; inp.classList.toggle('changed', Math.abs(v - base[i][inp.dataset.k][+inp.dataset.d]) > 0.05); render();
  }));
}

function solve(i, ktNmm) {
  const A = pkg.axles[i], g = geo[i], ms = A.sprungCornerMass_kg, mu = A.unsprungCornerMass_kg;
  const L = M.solveLinkage(g, A.path, A.labLimits.minimumPushrodVirtualLever);
  const r = { A, L, ms, mu };
  if (!L.ok) { r.error = 'The linkage does not close at the CAD pose: ' + (L.stop.find(s => s) || ''); return r; }
  r.C = M.coilover(L, A.coilover, A.labLimits, ms, pkg.gravity, k[i]);
  if (!isFinite(r.C.kwRide)) { r.error = r.C.reason; return r; }
  r.D = M.damping(pkg.damper, r.C.mrRide, r.C.kwRide, ktNmm, ms, mu, +$('rkVb').value || 2, +$('rkVh').value || 10);
  if (r.C.nominal && r.C.nominal.ok) {
    r.rows = M.loadCases(L, r.C, A.coilover, pkg.damper, ms, pkg.gravity, { pivot: g.pivot, shockChassis: g.shockChassis, springRate: k[i],
      bumpSpeeds: [10, 20, 30], reboundSpeeds: [10, 20], verticalG: 3 });
    r.env = M.envelope(r.rows);
  }
  return r;
}

function render() {
  if (!pkg) return;
  const i = +$('rkAxle').value, kt = +$('rkKt').value || 113.8;
  res = pkg.axles.map((_, a) => solve(a, kt));
  const r = res[i], A = r.A;
  feedRoll(kt);
  if (r.error) { $('rkOut').innerHTML = `<p class="hint" style="color:var(--warn)">${r.error}</p>`; ['rkMR', 'rkKw', 'rkDraw'].forEach(id => S.prep($(id))); $('rkLoads').innerHTML = ''; $('rkCheck').innerHTML = ''; return; }
  const L = r.L, C = r.C, ride = C.ride, idx = L.z.map((_, j) => j).filter(j => L.valid[j]);
  const nom = C.nominal, acc = S.css('--accent'), basec = S.css('--base'), warn = S.css('--warn'), rule = S.css('--rule'), ideal = S.css('--ideal');
  const X = j => L.z[j] - ride, lines = [];
  const vline = (x, col, y0, y1) => ({ pts: [[x, y0], [x, y1]], col, w: 1, dash: [2, 4] });
  // Motion ratio chart
  const mrJS = idx.map(j => [X(j), L.mr[j]]), mrML = A.path.wheelTravelFromCAD_mm.map((z, j) => [z - ride, A.matlab.motionRatio[j]]);
  const [m0, m1, ms_] = S.range([...mrJS.map(p => p[1]), ...mrML.map(p => p[1])], 0.1);
  const xr = [-45, 45];
  if (nom && nom.ok) lines.push(vline(X(nom.lo), ideal, m0, m1), vline(X(nom.hi), ideal, m0, m1));
  lines.push(vline(X(C.physBump.j), warn, m0, m1), vline(X(C.physDroop.j), warn, m0, m1));
  S.chart($('rkMR'), { x0: xr[0], x1: xr[1], xs: 15, y0: m0, y1: m1, ys: ms_, xl: 'wheel travel from ride (mm, + = bump)', yl: 'motion ratio (shock / wheel)',
    series: [...lines, { pts: mrML, col: basec, w: 1.5, dash: [5, 3] }, { pts: mrJS, col: acc, w: 2.5 }],
    note: 'solid = this page · dashed = MATLAB · green = usable ends · orange = physical limits' });
  // Wheel rate chart
  const kwP = idx.filter(j => isFinite(C.kw[j])).map(j => [X(j), C.kw[j]]), floor = nom && nom.floor;
  const [w0, w1, ws] = S.range([0, ...kwP.map(p => p[1])], 0.08);
  S.chart($('rkKw'), { x0: xr[0], x1: xr[1], xs: 15, y0: Math.max(0, w0), y1: w1, ys: ws, xl: 'wheel travel from ride (mm, + = bump)', yl: 'wheel rate (N/mm)',
    series: [floor ? { pts: [[xr[0], floor], [xr[1], floor]], col: rule, w: 1, dash: [4, 3] } : {}, { pts: kwP, col: acc, w: 2.5 }],
    note: `k = ${(k[i] / LBF_IN).toFixed(0)} lbf/in · gas ${pkg.damper.gasForce_N.toFixed(1)} N · dashed = lab rate floor` });
  draw(r);
  // Results
  const D = r.D, gb = pkg.damper.guidanceBody, gh = pkg.damper.guidanceHop, cls = (v, g) => v >= g[0] && v <= g[1] ? 'ok' : 'mid';
  const mrU = nom && nom.ok ? L.mr.slice(nom.lo, nom.hi + 1) : [];
  const t = S.veh(), track = i === 0 ? t.tf : t.tr, arb = +$(i === 0 ? 'rkArbF' : 'rkArbR').value || 0;
  $('rkOut').innerHTML = S.kv([
    ['Ride motion ratio', f3(C.mrRide) + (mrU.length ? ` (usable ${f3(Math.min(...mrU))}–${f3(Math.max(...mrU))})` : '')],
    ['Wheel rate at ride', f2(C.kwRide) + ' N/mm'],
    ['Ride rate with tyre / body frequency', `${f2(D.kr)} N/mm · ${f2(D.fBody)} Hz`],
    ['Hop frequency', f1(D.fHop) + ' Hz'],
    ['Collar spring face from frame eye', f1(C.collar) + ' mm', C.collarMarginFrame >= 0 && C.collarMarginRocker >= 0 ? 'ok' : 'hi'],
    ['Thread margin frame / rocker side', `${f1(C.collarMarginFrame)} / ${f1(C.collarMarginRocker)} mm`, Math.min(C.collarMarginFrame, C.collarMarginRocker) >= 0 ? 'ok' : 'hi'],
    ['Spring preload at full extension', f1(C.preloadAtFullExtension) + ' mm', C.seatedMargin >= 0 ? 'ok' : 'hi'],
    ['Usable bump / droop (worst seat case)', `${f1(C.bump)} / ${f1(C.droop)} mm`, C.ok ? 'ok' : 'hi'],
    ['Physical bump limit', `${f1(X(C.physBump.j))} mm · ${C.physBump.note}`],
    ['Physical droop limit', `${f1(X(C.physDroop.j))} mm · ${C.physDroop.note}`],
    ['Body damping ζ comp / reb / cycle', `${f2(D.body_compression)} / ${f2(D.body_rebound)} / ${f2(D.body_cycle)}`, cls(D.body_cycle, gb)],
    ['Hop damping ζ cycle', f2(D.hop_cycle) + (D.hopSpeedExtrapolated ? ' (damper extrapolated)' : ''), cls(D.hop_cycle, gh)],
    ['Axle roll stiffness (springs + tyre' + (arb ? ' + ARB' : '') + ')', f0(M.rollStiffness(C.kwRide, kt, track * 1000, arb)) + ' N·m/°'],
    ['Status', C.ok ? 'passes the rocker-lab travel and collar checks' : C.reason, C.ok ? 'ok' : 'hi']]) +
    `<p class="hint" style="margin:6px 0 0">ζ guidance: body ${gb[0]}–${gb[1]}, hop ${gh[0]}–${gh[1]} (amber = outside). Damper: ${pkg.damper.name}.</p>`;
  loadsTable(r); check(r, i);
}

function feedRoll(kt) {
  if (!$('rkFeed').checked || res.some(r => r.error)) return;
  const t = S.veh(), Kf = M.rollStiffness(res[0].C.kwRide, kt, t.tf * 1000, +$('rkArbF').value || 0), Kr = M.rollStiffness(res[1].C.kwRide, kt, t.tr * 1000, +$('rkArbR').value || 0);
  const arb = (+$('rkArbF').value || 0) + (+$('rkArbR').value || 0) ? ' + ARB' : ' (no ARB)';
  S.setParam('ktot', Kf + Kr, `Rocker panel: pair springs + tyre${arb}`, 'pkg'); S.setParam('kfrac', Kf / (Kf + Kr), `Rocker panel: front / total${arb}`, 'pkg');
  S.renderAll();
}

function draw(r) {
  const cv = $('rkDraw'), [c, w, h] = S.prep(cv), L = r.L, C = r.C, g = geo[+$('rkAxle').value];
  const a = L.a, yv = [0, 1, 0], u1 = (() => { const d = a[0] * yv[0] + a[1] * yv[1] + a[2] * yv[2]; const v = [yv[0] - d * a[0], yv[1] - d * a[1], yv[2] - d * a[2]]; const n = Math.hypot(...v); return v.map(x => x / n); })();
  let u2 = [a[1] * u1[2] - a[2] * u1[1], a[2] * u1[0] - a[0] * u1[2], a[0] * u1[1] - a[1] * u1[0]]; if (u2[2] < 0) u2 = u2.map(x => -x);
  const O = g.pivot, pr = p => [(p[0] - O[0]) * u1[0] + (p[1] - O[1]) * u1[1] + (p[2] - O[2]) * u1[2], (p[0] - O[0]) * u2[0] + (p[1] - O[1]) * u2[1] + (p[2] - O[2]) * u2[2]];
  const poses = [[C.r, S.css('--accent'), 2.5, null, 'ride']];
  if (C.nominal && C.nominal.ok) poses.push([C.nominal.hi, S.css('--ideal'), 1.5, [5, 3], 'bump end'], [C.nominal.lo, S.css('--warn'), 1.5, [5, 3], 'droop end']);
  const pts = [pr(g.shockChassis), [0, 0]]; poses.forEach(([j]) => { pts.push(pr(L.G[j]), pr(L.H[j]), pr(L.Q[j])); });
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = 30;
  const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad, s = Math.min((w - 20) / (x1 - x0), (h - 30) / (y1 - y0));
  const T = p => [10 + (p[0] - x0) * s, h - 20 - (p[1] - y0) * s];
  const ink = S.css('--ink'), ink2 = S.css('--ink-2');
  poses.forEach(([j, col, lw, dash, label]) => {
    const G = T(pr(L.G[j])), H = T(pr(L.H[j])), Q = T(pr(L.Q[j])), O2 = T([0, 0]), P = pr(L.P[j]), Sx = T(pr(g.shockChassis));
    c.save(); c.globalAlpha = .12; c.fillStyle = col; c.beginPath(); c.moveTo(...O2); c.lineTo(...G); c.lineTo(...H); c.lineTo(...Q); c.closePath(); c.fill(); c.restore();
    S.ln(c, O2, G, col, lw, dash); S.ln(c, G, H, col, lw, dash); S.ln(c, H, Q, col, lw, dash); S.ln(c, Q, O2, col, lw, dash);
    S.ln(c, H, Sx, col, lw * 0.8, [2, 3]); // shock
    const dir = [P[0] - pr(L.G[j])[0], P[1] - pr(L.G[j])[1]], n = Math.hypot(...dir) || 1, Pe = T([pr(L.G[j])[0] + dir[0] / n * 60, pr(L.G[j])[1] + dir[1] / n * 60]);
    S.ln(c, G, Pe, col, lw * 0.8, [1, 3]); // pushrod direction (first 60 mm)
    S.dt(c, G, 3.5, col); S.dt(c, H, 3.5, col); S.dt(c, Q, 2.5, col);
  });
  S.dt(c, T([0, 0]), 5, S.css('--sheet'), ink); S.dt(c, T(pr(g.shockChassis)), 5, S.css('--sheet'), ink);
  S.tx(c, 'pivot', T([0, 0])[0] + 8, T([0, 0])[1] - 8, ink2); S.tx(c, 'shock chassis eye', T(pr(g.shockChassis))[0] + 8, T(pr(g.shockChassis))[1] - 8, ink2);
  S.tx(c, 'Rocker plane · ride solid · usable bump/droop ends dashed', 10, 14, ink2);
  S.tx(c, '→ outboard (+y)   ↑ up', 10, h - 4, ink2);
}

function loadsTable(r) {
  if (!r.rows) { $('rkLoads').innerHTML = '<tbody><tr><td class="txt">Joint loads need a usable travel interval at the nominal seat setting.</td></tr></tbody>'; return; }
  const E = r.env;
  $('rkLoads').innerHTML = `<thead><tr><th>Load case</th><th>From ride (mm)</th><th>MR</th><th>Shock force (N)</th><th>Band (N)</th><th>Pushrod (N, + = comp.)</th><th>Pivot max (N)</th><th>Pushrod hole max (N)</th><th>Shock hole max (N)</th><th>Note</th></tr></thead><tbody>`
    + r.rows.map(q => `<tr><td class="txt">${q.name}</td><td>${f1(q.fromRide)}</td><td>${f3(q.mr)}</td><td>${f0(q.shockForce)}</td><td>${f0(q.band[0])}…${f0(q.band[1])}</td><td>${f0(q.pushrod)}</td><td>${f0(q.pivotMax)}</td><td>${f0(q.pushrodHoleMax)}</td><td>${f0(q.shockHoleMax)}</td><td class="txt">${q.extrapolated ? 'damper extrapolated beyond 10 in/s' : ''}${q.note ? (q.extrapolated ? '; ' : '') + q.note : ''}</td></tr>`).join('')
    + `<tr><td class="txt"><b>Envelope</b></td><td colspan="5" class="txt">all cases · measured damper range only: pivot ${f0(E.measuredPivot)} N, pushrod hole ${f0(E.measuredPushrodHole)} N, shock hole ${f0(E.measuredShockHole)} N</td><td><b>${f0(E.pivot)}</b></td><td><b>${f0(E.pushrodHole)}</b></td><td><b>${f0(E.shockHole)}</b></td><td class="txt">pivot governed by ${E.pivotCase}; pushrod ${f0(E.pushrodMin)}…${f0(E.pushrodMaxCompression)} N</td></tr></tbody>`;
}

function check(r, i) { // this page vs MATLAB (only meaningful for unedited geometry and spring)
  const A = r.A, R = A.matlabResults, edited = JSON.stringify(geo[i]) !== JSON.stringify(base[i]) || Math.abs(k[i] - A.coilover.springRate_N_mm) > 1e-9;
  if (edited) { $('rkCheck').innerHTML = S.kv([['Check vs MATLAB', 'geometry or spring edited: MATLAB reference no longer applies', 'mid']]); return; }
  const L = r.L; let dMR = 0, dL = 0;
  A.path.wheelTravelFromCAD_mm.forEach((_, j) => { if (L.valid[j]) { dMR = Math.max(dMR, Math.abs(L.mr[j] - A.matlab.motionRatio[j])); dL = Math.max(dL, Math.abs(L.length[j] - A.matlab.shockEye_mm[j])); } });
  const ktM = pkg.damper.tyreRateBand_N_mm[1], Dm = M.damping(pkg.damper, r.C.mrRide, r.C.kwRide, ktM, r.ms, r.mu, pkg.damper.bodySpeed_in_s, pkg.damper.hopSpeed_in_s);
  const rows = [['Motion ratio / shock length', `max |Δ| ${dMR.toExponential(1)} / ${dL.toExponential(1)} mm`, dMR < 1e-4 && dL < 1e-3 ? 'ok' : 'hi'],
    ['Wheel rate at ride', `${f3(r.C.kwRide)} vs MATLAB ${f3(R.wheelRateAtRide_N_mm)} N/mm`, Math.abs(r.C.kwRide - R.wheelRateAtRide_N_mm) < 0.01 ? 'ok' : 'hi'],
    ['Bump / droop', `${f2(r.C.bump)} / ${f2(r.C.droop)} vs MATLAB ${f2(R.bump_mm)} / ${f2(R.droop_mm)} mm`, Math.abs(r.C.bump - R.bump_mm) < 0.3 && Math.abs(r.C.droop - R.droop_mm) < 0.3 ? 'ok' : 'hi']];
  if (R.damping) rows.push(['Body / hop ζ cycle (kt ' + ktM.toFixed(1) + ')', `${f3(Dm.body_cycle)} / ${f3(Dm.hop_cycle)} vs MATLAB ${f3(R.damping.BodyZetaCycle)} / ${f3(R.damping.HopZetaCycle)}`,
    Math.abs(Dm.body_cycle - R.damping.BodyZetaCycle) < 0.005 && Math.abs(Dm.hop_cycle - R.damping.HopZetaCycle) < 0.005 ? 'ok' : 'hi']);
  if (R.loads && r.env) rows.push(['Pivot max force', `${f0(r.env.pivot)} vs MATLAB ${f0(R.loads.MaxPivotForce_N)} N`, Math.abs(r.env.pivot - R.loads.MaxPivotForce_N) / R.loads.MaxPivotForce_N < 0.01 ? 'ok' : 'hi'],
    ['Pushrod / shock hole max', `${f0(r.env.pushrodHole)} / ${f0(r.env.shockHole)} vs MATLAB ${f0(R.loads.MaxPushrodHoleForce_N)} / ${f0(R.loads.MaxShockHoleForce_N)} N`,
      Math.abs(r.env.pushrodHole - R.loads.MaxPushrodHoleForce_N) / R.loads.MaxPushrodHoleForce_N < 0.01 ? 'ok' : 'hi']);
  $('rkCheck').innerHTML = S.kv(rows.map(([a, b, c]) => ['Check vs MATLAB: ' + a, b, c]));
}

window.BFSAE_ROCKER_PANEL = { setPackage: build, render, get results() { return res; } };
addEventListener('resize', () => { if (pkg) render(); });
})();
