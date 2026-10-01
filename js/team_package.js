/* Team package loader (#package panel). Reads bfsae_sandbox_package.json
 * (written in MATLAB by sandbox_export.m; kept on the team drive, NOT in this
 * public repository), then:
 *   1. loads the front-left hardpoints into the steering solver,
 *   2. replaces EV2 sheet vehicle values with the 2026 car's, marking each source,
 *   3. starts the TTC tyre model and the rocker & coilover panels,
 *   4. lists where every number on the page comes from.
 * The package format is described in docs/TEAM_PACKAGE.md. */
(function () {
'use strict';
const S = window.SS; if (!S) return;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = v => typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(1) : +v.toPrecision(4)) : esc(v);
let pkg = null, fileName = '';

function load(p, name) {
  if (!p || p.format !== 'bfsae-sandbox-package') throw new Error('Not a team package (format field missing).');
  if (p.formatVersion !== 1) console.warn('Team package formatVersion', p.formatVersion, '- this page was written for version 1.');
  pkg = p; fileName = name || 'team package';
  // 1. Steering hardpoints: the package is already in this page's frame (+x fwd, +y left, +z up, mm).
  $('axF').value = '+X'; $('axU').value = '+Z'; $('units').value = 'mm';
  S.loadText(JSON.stringify({ points: { ...p.points, rack_travel: p.rack_travel }, wheelbase: p.wheelbase }), fileName);
  $('travel').value = p.rack_travel; $('travel').dispatchEvent(new Event('input')); // his loader rounds; keep 29.37 exactly
  // 2. Vehicle values with their sources (PROVISIONAL values are marked orange)
  p.vehicle.forEach(v => S.setParam(v.key, v.value, `${v.source} [${v.status}]`, /PROVISIONAL|ASSUMED/i.test(v.status) ? 'warn' : 'pkg'));
  // 3. Tyre and rocker panels (the rocker panel then feeds roll stiffness)
  if (window.BFSAE_TTC_PANEL) window.BFSAE_TTC_PANEL.setPackage(p);
  if (window.BFSAE_ROCKER_PANEL) window.BFSAE_ROCKER_PANEL.setPackage(p);
  S.renderAll();
  renderSources();
  $('status').classList.remove('err');
  $('status').innerHTML = `<b>${esc(fileName)}</b>: team package for pair ${esc(p.source.pairID)} (rank ${p.source.pairRank}), created ${esc(p.created)}. Front-left hardpoints, 2026 vehicle values, the TTC tyre model and both rockers are loaded. Sources: <a href="#package">Team package &amp; data sources</a>.`;
}

function renderSources() {
  const p = pkg, ev2 = Object.fromEntries(S.EV2.map(e => [e[0], e])), cur = k => parseFloat($('vp-' + k).value);
  const vrows = p.vehicle.map(v => `<tr><td class="txt">${esc(v.label)}</td><td>${ev2[v.key] ? num(ev2[v.key][2]) : '–'}</td><td>${num(v.value)}</td><td>${num(cur(v.key))}</td><td>${esc(v.unit)}</td><td class="txt">${esc(v.source)}</td><td class="txt">${esc(v.status)}</td><td class="txt">${esc(v.adjust)}</td></tr>`).join('');
  const notPkg = S.EV2.filter(e => !p.vehicle.some(v => v.key === e[0]))
    .map(e => `<tr><td class="txt">${esc(e[1])}</td><td>${num(e[2])}</td><td>–</td><td>${num(cur(e[0]))}</td><td>${esc(e[3])}</td><td class="txt">${esc(e[4])}</td><td class="txt">not modelled in MATLAB</td><td class="txt">${esc(e[5])} Update it in the EV2 list in index.html (see docs/DATA_DICTIONARY.md).</td></tr>`).join('');
  const g = S.geometry(S.cur), st = p.steering;
  const cmp = [['Caster (°)', g.caster, st.caster_deg], ['Kingpin inclination (°)', g.kpi, st.kpi_deg], ['Mechanical trail (mm)', g.trail, st.trail_mm], ['Scrub radius (mm)', g.scrub, st.scrub_mm], ['Tie rod length (mm)', g.tie, NaN]];
  $('pkgBody').innerHTML = `
  <div class="kv kv-row">${S.kv([
    ['Package file', esc(fileName)], ['Created', esc(p.created) + ' by ' + esc(p.generator)], ['Car', esc(p.car)],
    ['Rocker pair', `${esc(p.source.pairID)} (rank ${p.source.pairRank})`], ['Front / rear rocker', `${p.source.frontCandidate} / ${p.source.rearCandidate}`],
    ['Frame', esc(p.frame.axes) + '; ' + esc(p.frame.origin)]])}</div>
  <p class="note"><b>Privacy.</b> ${esc(p.privacy)} Keep the JSON on the team drive, not in this repository (.gitignore blocks *_package.json).</p>
  <div class="tbl-wrap" style="border-top:1px solid var(--ink)"><table class="mini"><thead><tr><th>Vehicle parameter</th><th>EV2 sheet</th><th>Team package</th><th>On page now</th><th>Unit</th><th>Source</th><th>Status</th><th>How to change it</th></tr></thead><tbody>${vrows}${notPkg}</tbody></table></div>
  <p class="note">"On page now" can differ from the package when you type a new value, when the rocker panel feeds roll stiffness, or when the TTC panel sets the loaded radius. <b>Reset to EV2 values</b> (Vehicle panel) returns to the old sheet. Reload the package to return to the 2026 values.</p>
  <div class="tbl-wrap" style="border-top:1px solid var(--rule)"><table class="mini"><thead><tr><th>Steering check (CAD pose, centred rack)</th><th>This page</th><th>MATLAB front_steering_envelope</th></tr></thead><tbody>
    ${cmp.map(([n, a, b]) => `<tr><td class="txt">${n}</td><td>${isFinite(a) ? a.toFixed(2) : '–'}</td><td>${isFinite(b) ? b.toFixed(2) : '–'}</td></tr>`).join('')}
    <tr><td class="txt">Usable lock / linkage over-centre / rack stop (mm)</td><td>rack travel box: ${esc($('travel').value)}</td><td>${st.practicalLock_mm.toFixed(2)} / ${st.linkageLock_mm.toFixed(2)} / ${st.rackStop_mm.toFixed(2)}</td></tr></tbody></table></div>
  <p class="note">${esc(p.pointNotes.source)}. Contact patch: ${esc(p.pointNotes.CP)}. Rack travel: ${esc(p.pointNotes.rack_travel)} ${esc(p.vehicleNotes)}</p>`;
}

$('pkgFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { try { load(JSON.parse(t), f.name); } catch (err) { $('status').classList.add('err'); $('status').innerHTML = `Could not load <b>${esc(f.name)}</b> as a team package: ${esc(err.message)}`; } });
  e.target.value = '';
});
window.BFSAE_PACKAGE = { load, get package() { return pkg; } };
S.listeners.push(() => { if (pkg) renderSources(); });
})();
