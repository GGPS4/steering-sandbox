"""
export_hardpoints.py  -  Fusion 360 script for Steering Sandbox
https://ggps4.github.io/steering-sandbox/

Exports named hardpoints from the active design to a CSV that
Steering Sandbox can import (name, x_mm, y_mm, z_mm).

HOW TO NAME YOUR POINTS
  Make a construction point (Construct > Point) at each hardpoint of ONE
  front corner and rename it in the browser tree:
      LBJ    lower ball joint          UBJ    upper ball joint
      OTR    outer tie rod (upright)   ITR    inner tie rod (rack end)
      WC     wheel center              CP     tire contact patch
      LCA_F  lower arm, front inner    LCA_R  lower arm, rear inner   (optional, for bump steer)
      UCA_F  upper arm, front inner    UCA_R  upper arm, rear inner   (optional, for bump steer)
  Longer names like "Lower Ball Joint" or "tie_rod_inner" also work.
  Sketches named "HP_<name>" that contain one point are exported too.

INSTALL
  1. Fusion 360 > Utilities > Add-Ins > Scripts and Add-Ins.
  2. Click Create (or +) > Script, language Python, name it export_hardpoints.
  3. Click Edit, replace the template with this whole file, save.
  4. Run it. Choose where to save the CSV, then drop that CSV on the website.
"""

import adsk.core
import adsk.fusion
import traceback

CM_TO_MM = 10.0


def _collect(design):
    rows = []
    seen = set()

    def add(name, p):
        key = (name, round(p.x, 4), round(p.y, 4), round(p.z, 4))
        if key in seen:
            return
        seen.add(key)
        rows.append((name, p.x * CM_TO_MM, p.y * CM_TO_MM, p.z * CM_TO_MM))

    def sketch_point(sk):
        pts = [sp for sp in sk.sketchPoints
               if not (abs(sp.geometry.x) < 1e-9 and abs(sp.geometry.y) < 1e-9)]
        return pts[0].worldGeometry if len(pts) == 1 else None

    root = design.rootComponent

    # Root component
    for cp in root.constructionPoints:
        add(cp.name, cp.geometry)
    for sk in root.sketches:
        if sk.name.upper().startswith('HP_'):
            p = sketch_point(sk)
            if p:
                add(sk.name[3:], p)

    # Every occurrence, in world (assembly) coordinates
    for occ in root.allOccurrences:
        comp = occ.component
        for cp in comp.constructionPoints:
            add(cp.name, cp.createForAssemblyContext(occ).geometry)
        for sk in comp.sketches:
            if sk.name.upper().startswith('HP_'):
                proxy = sk.createForAssemblyContext(occ)
                p = sketch_point(proxy)
                if p:
                    add(sk.name[3:], p)
    return rows


def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            ui.messageBox('Open a design first, then run export_hardpoints.')
            return

        rows = _collect(design)
        if not rows:
            ui.messageBox('No named construction points found.\n\n'
                          'Create construction points at your hardpoints and name them '
                          'LBJ, UBJ, OTR, ITR, WC, CP (plus LCA_F, LCA_R, UCA_F, UCA_R for bump steer).')
            return

        up = '?'
        try:
            orient = app.preferences.generalPreferences.defaultModelingOrientation
            up = 'Y' if orient == adsk.core.DefaultModelingOrientations.YUpModelingOrientation else 'Z'
        except Exception:
            pass

        dlg = ui.createFileDialog()
        dlg.title = 'Save hardpoints CSV'
        dlg.filter = 'CSV files (*.csv)'
        dlg.initialFilename = (design.rootComponent.name or 'hardpoints') + '_hardpoints.csv'
        if dlg.showSave() != adsk.core.DialogResults.DialogOK:
            return

        with open(dlg.filename, 'w', newline='') as f:
            f.write('# Exported from Fusion 360 by export_hardpoints.py\n')
            f.write('# fusion_up=%s\n' % up)
            f.write('name,x_mm,y_mm,z_mm\n')
            for name, x, y, z in rows:
                safe = name.replace(',', ' ')
                f.write('%s,%.3f,%.3f,%.3f\n' % (safe, x, y, z))

        ui.messageBox('Exported %d points to\n%s\n\nDrop this file on Steering Sandbox.'
                      % (len(rows), dlg.filename))
    except Exception:
        if ui:
            ui.messageBox('export_hardpoints failed:\n{}'.format(traceback.format_exc()))
