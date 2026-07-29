# -*- coding: utf-8 -*-
"""
14/8 multi-anvil CELL assembly (inside 8 WC cubes).

Based on standard Kawai / COMPRES-style axial furnace cell
(Hiroshima Kawazoe 14/8 schematic + COMPRES G2 layout):

  MgO octahedron (pressure medium)
    └─ ZrO2 thermal insulator sleeve + end disks
         └─ LaCrO3 (or graphite) furnace tube (optionally stepped)
              └─ MgO spacers
                   └─ metal capsule + sample
  Electrodes at furnace ends
  Type-C thermocouple (axial-ish, junction next to sample)

Coordinate: furnace axis = +Z (press axis after Walker [111] alignment).
Units: mm.

Standalone:
  freecadcmd -c "import runpy; runpy.run_path('cad/scripts/build_14_8_cell.py', run_name='__main__')"

Also imported by build_walker_module.py.
"""

from __future__ import annotations

import json
import math
import os
import sys
import traceback

try:
    import FreeCAD as App
    import MeshPart
    import Part
    from FreeCAD import Vector
except ImportError as e:
    sys.stderr.write(f"Need freecadcmd.\n{e}\n")
    sys.exit(1)


# ---------------------------------------------------------------------------
# 14/8 masters (teaching scale, consistent with octa_edge = 14 mm)
# ---------------------------------------------------------------------------
CELL = {
    # Octahedron pressure medium
    "octa_edge": 14.0,  # mm — defines 14/8 name
    "octa_clearance": 0.06,  # slight shrink vs pure geometry
    # Central hole (drilled through octa along furnace axis)
    "bore_r": 2.6,  # mm, hole radius in MgO
    # ZrO2 thermal insulator (sleeve around furnace)
    "zro2_od": 2.45,
    "zro2_id": 1.95,
    "zro2_len": 6.2,
    # End disks / plugs of ZrO2 or MgO outside furnace ends
    "end_disk_r": 2.35,
    "end_disk_h": 0.9,
    # Furnace — LaCrO3 stepped heater (BGI / Hiroshima style)
    "furnace_od_wide": 1.85,
    "furnace_od_narrow": 1.55,
    "furnace_id": 1.25,
    "furnace_half_wide": 1.4,  # half-length of each wide section
    "furnace_narrow_len": 2.4,  # center narrow (step) length
    # Spacers (MgO / ceramic) above & below capsule
    "spacer_r": 1.15,
    "spacer_h": 0.7,
    # Sample capsule (Pt/Au schematic) + sample
    "capsule_od": 1.1,
    "capsule_id": 0.85,
    "capsule_h": 1.6,
    "sample_r": 0.75,
    "sample_h": 1.2,
    # Electrodes (metal foils / rods contacting anvils)
    "electrode_r": 2.2,
    "electrode_h": 0.45,
    "electrode_stem_r": 0.55,
    "electrode_stem_h": 1.2,
    # Type-C thermocouple
    "tc_wire_r": 0.12,
    "tc_junction_r": 0.22,
    "tc_offset_xy": 0.55,  # radial offset from axis
}


def cell_wc_cavity_transform(d_cut: float, cell_face_half_h: float, nest: float = 0.02):
    """
    Align face-up 14/8 cell with the 8 WC truncation faces (Kawai cavity).

    Cell is built face-up (top/bottom normals ±Z, top triangle at 0°/120°/240°).
    WC cubes are Kawai-rotated ([111]→+Z); their +++ truncation triangle sits at
    ~105°/225°/345°. Rotate cell about +Z so each octa face is parallel to one
    WC cut face, and scale so face planes nest just inside the cavity planes.

    Returns (z_rotation_deg, uniform_scale).
    """
    from FreeCAD import Rotation, Vector

    rot = Rotation(Vector(1, 1, 1), Vector(0, 0, 1))
    angs = []
    for p in (Vector(d_cut, 0, 0), Vector(0, d_cut, 0), Vector(0, 0, d_cut)):
        w = rot.multVec(p)
        angs.append(math.degrees(math.atan2(w.y, w.x)))
    ws = sorted([(a + 360.0) % 360.0 for a in angs])
    cs = [0.0, 120.0, 240.0]
    deltas = [((ws[i] - cs[i] + 180.0) % 360.0) - 180.0 for i in range(3)]
    z_rot = sum(deltas) / 3.0

    # Cavity: plane sx*x+sy*y+sz*z = d_cut → face distance = d_cut/√3
    face_h_cav = d_cut / math.sqrt(3.0)
    if cell_face_half_h < 1e-9:
        scale = 1.0
    else:
        scale = (face_h_cav / cell_face_half_h) * (1.0 - nest)
    return z_rot, scale


def place_cell_in_wc_cavity(shape, z_rot_deg: float, scale: float):
    """Scale about origin then rotate about +Z (mm, FreeCAD shape)."""
    import FreeCAD as App
    from FreeCAD import Vector

    sh = shape.copy()
    if abs(scale - 1.0) > 1e-9:
        m = App.Matrix()
        m.scale(scale, scale, scale)
        sh = sh.transformGeometry(m)
    if abs(z_rot_deg) > 1e-9:
        sh.rotate(Vector(0, 0, 0), Vector(0, 0, 1), z_rot_deg)
    return sh


def rotate_thrust_z(thrust, z_rot_deg: float):
    """Rotate an explosion thrust vector about +Z (same angle as cell)."""
    if abs(z_rot_deg) < 1e-12:
        return thrust
    x, y, z = thrust
    a = math.radians(z_rot_deg)
    c, s = math.cos(a), math.sin(a)
    return (c * x - s * y, s * x + c * y, z)


def derived_cell(c: dict | None = None) -> dict:
    """Merge overrides onto CELL defaults (partial dicts are OK)."""
    base = dict(CELL)
    if c:
        base.update(c)
    c = base
    # Regular octahedron: edge = mid_r * √2  ⇒ mid_r = edge / √2
    # Vertices at (±mid_r,0,0)...; opposite-face distance from center = mid_r/√3
    mid_r = (c["octa_edge"] / math.sqrt(2.0)) * (1.0 - c["octa_clearance"])
    face_half_h = mid_r / math.sqrt(3.0)  # center → face plane (along face normal)
    # Total furnace length
    furn_len = 2 * c["furnace_half_wide"] + c["furnace_narrow_len"]
    half_stack = (
        c["sample_h"] / 2
        + c["spacer_h"]
        + c["furnace_half_wide"] * 0.15
    )
    c.update(
        {
            "octa_mid_r": mid_r,
            "face_half_h": face_half_h,
            "furnace_len": furn_len,
            "half_stack": half_stack,
        }
    )
    return c


def _tri(a, b, c):
    return Part.Face(Part.makePolygon([a, b, c, a]))


def make_octahedron_face_up(mid_r: float) -> Part.Shape:
    """
    Regular octahedron with opposite faces horizontal (normals ±Z).
    Direct construction — do NOT use transformGeometry (unreliable here).
    """
    R = mid_r
    d = R / math.sqrt(3.0)
    rho = R * math.sqrt(2.0 / 3.0)
    top, bot = [], []
    for i in range(3):
        a = i * 2.0 * math.pi / 3.0
        top.append(Vector(rho * math.cos(a), rho * math.sin(a), d))
        b = a + math.pi / 3.0
        bot.append(Vector(rho * math.cos(b), rho * math.sin(b), -d))
    faces = [
        Part.Face(Part.makePolygon([top[0], top[1], top[2], top[0]])),
        Part.Face(Part.makePolygon([bot[0], bot[2], bot[1], bot[0]])),
    ]
    for i in range(3):
        faces.append(_tri(top[i], top[(i + 1) % 3], bot[i]))
        faces.append(_tri(bot[i], bot[(i + 1) % 3], top[(i + 1) % 3]))
    solid = Part.makeSolid(Part.makeShell(faces))
    if solid.Volume < 0:
        solid.reverse()
    return solid


def make_octahedron_face_bore(mid_r: float, bore_r: float) -> Part.Shape:
    """
    Furnace hole drilled **face-to-face**:
    circular opening on opposite triangular faces (not through vertices).
    """
    octa = make_octahedron_face_up(mid_r)
    face_h = mid_r / math.sqrt(3.0)
    bore_h = 2 * face_h + 1.2
    bore = Part.makeCylinder(
        bore_r, bore_h, Vector(0, 0, -bore_h / 2), Vector(0, 0, 1)
    )
    cut = octa.cut(bore)
    print(
        f"  face-bore: face_h={face_h:.3f} Z={cut.BoundBox.ZLength:.3f} "
        f"(want {2 * face_h:.3f}) XY={cut.BoundBox.XLength:.3f}"
    )
    return cut if cut.Volume > 1.0 else octa


def tube(od: float, id_: float, h: float, z0: float) -> Part.Shape:
    """Hollow cylinder axis +Z, bottom at z0."""
    outer = Part.makeCylinder(od, h, Vector(0, 0, z0), Vector(0, 0, 1))
    if id_ > 1e-6 and id_ < od:
        inner = Part.makeCylinder(id_, h + 0.4, Vector(0, 0, z0 - 0.2), Vector(0, 0, 1))
        outer = outer.cut(inner)
    return outer


def disk(r: float, h: float, z0: float) -> Part.Shape:
    return Part.makeCylinder(r, h, Vector(0, 0, z0), Vector(0, 0, 1))


def make_stepped_furnace(c: dict) -> Part.Shape:
    """
    LaCrO3 stepped heater: wide–narrow–wide OD, constant ID.
    Matches BGI / Hiroshima 14/8 style schematic.
    """
    od_w = c["furnace_od_wide"]
    od_n = c["furnace_od_narrow"]
    id_ = c["furnace_id"]
    hw = c["furnace_half_wide"]
    nl = c["furnace_narrow_len"]
    # Centered on z=0
    z_n0 = -nl / 2
    z_bot = z_n0 - hw
    z_top = nl / 2

    bot = tube(od_w, id_, hw, z_bot)
    mid = tube(od_n, id_, nl, z_n0)
    top = tube(od_w, id_, hw, z_top)
    furn = bot.fuse(mid).fuse(top)
    try:
        furn = furn.removeSplitter()
    except Exception:
        pass
    return furn


def cut_tc_grooves(octa: Part.Shape, c: dict) -> Part.Shape:
    """Grooves from two CORNERS of the top triangular face toward the bore."""
    mid_r = c["octa_mid_r"]
    face_h = c["face_half_h"]
    bore_r = c["bore_r"]
    rho = mid_r * math.sqrt(2.0 / 3.0)
    gw, gd = 0.48, 0.45
    r_inner = bore_r + 0.12
    r_outer = rho * 0.90
    length = r_outer - r_inner
    out = octa
    for ang in (0.0, 2.0 * math.pi / 3.0):
        ux, uy = math.cos(ang), math.sin(ang)
        box = Part.makeBox(
            length, gw, gd + 0.05, Vector(r_inner, -gw / 2, face_h - gd)
        )
        box.rotate(Vector(0, 0, 0), Vector(0, 0, 1), math.degrees(ang))
        try:
            out = out.cut(box)
        except Exception:
            pass
    return out


def make_thermocouple(c: dict) -> Part.Shape:
    """
    Two Type-C wires from two face CORNERS, then straight down
    near the sample center (no elbow / bead at sample).
    """
    mid_r = c["octa_mid_r"]
    face_h = c["face_half_h"]
    bore_r = c["bore_r"]
    sample_h = c.get("sample_h", 1.4)
    sample_top = sample_h / 2
    wr = c.get("tc_wire_r", 0.18)
    rho = mid_r * math.sqrt(2.0 / 3.0)
    r_inner = bore_r + 0.12
    r_outer = rho * 0.90
    length = max(0.3, r_outer - r_inner)
    z_g = face_h - 0.22
    insert = min(0.55, max(0.25, sample_h * 0.45))
    z_tip = sample_top - insert
    sample_off = 0.22
    wires = None
    for ang in (0.0, 2.0 * math.pi / 3.0):
        ux, uy = math.cos(ang), math.sin(ang)
        horiz = Part.makeCylinder(
            wr, length, Vector(ux * r_inner, uy * r_inner, z_g), Vector(ux, uy, 0)
        )
        x_c, y_c = ux * sample_off, uy * sample_off
        link_L = max(0.05, r_inner - sample_off)
        link = Part.makeCylinder(
            wr, link_L, Vector(x_c, y_c, z_g), Vector(ux, uy, 0)
        )
        h_vert = max(0.3, z_g - z_tip)
        vert = Part.makeCylinder(wr, h_vert, Vector(x_c, y_c, z_tip), Vector(0, 0, 1))
        w = horiz.fuse(link).fuse(vert)
        wires = w if wires is None else wires.fuse(w)
    return wires


def build_cell_parts(c: dict | None = None) -> list[tuple[str, Part.Shape, tuple, str, int]]:
    """
    Returns list of (name, shape, rgb, group, layer).

    Press frame: furnace axis = +Z = octahedron **face normal**
    (hole opens on opposite triangular faces — NOT through vertices).
    Origin at sample center.
    """
    c = derived_cell(c)
    mid_r = c["octa_mid_r"]
    face_h = c["face_half_h"]
    parts = []

    print(
        f"  octa: mid_r(vertex)={mid_r:.3f}  face_half_h={face_h:.3f}  "
        f"bore on FACES (axis = face normal = +Z)"
    )

    # --- MgO octahedron: face bore + TC grooves on top face ---
    octa = make_octahedron_face_bore(mid_r, c["bore_r"])
    octa = cut_tc_grooves(octa, c)
    parts.append(
        ("Cell_MgO_Octahedron", octa, (0.55, 0.30, 0.22), "cell_mgo", 4)
    )

    # --- ZrO2 sleeve (thermal insulator) ---
    z_sleeve0 = -c["zro2_len"] / 2
    sleeve = tube(c["zro2_od"], c["zro2_id"], c["zro2_len"], z_sleeve0)
    parts.append(
        ("Cell_ZrO2_Sleeve", sleeve, (0.92, 0.90, 0.86), "cell_insulator", 4)
    )

    # End insulator disks (outside furnace, inside MgO bore)
    furn_half = c["furnace_len"] / 2
    disk_h = c["end_disk_h"]
    top_disk_z = furn_half + 0.05
    bot_disk_z = -furn_half - disk_h - 0.05
    # keep disks inside the face-bounded height (±face_h)
    if top_disk_z + disk_h < face_h * 0.98:
        parts.append(
            (
                "Cell_ZrO2_Disk_Top",
                disk(c["end_disk_r"], disk_h, top_disk_z),
                (0.90, 0.88, 0.84),
                "cell_insulator",
                4,
            )
        )
    if bot_disk_z > -face_h * 0.98:
        parts.append(
            (
                "Cell_ZrO2_Disk_Bottom",
                disk(c["end_disk_r"], disk_h, bot_disk_z),
                (0.90, 0.88, 0.84),
                "cell_insulator",
                4,
            )
        )

    # --- Stepped furnace ---
    furn = make_stepped_furnace(c)
    parts.append(
        ("Cell_Furnace_LaCrO3", furn, (0.22, 0.20, 0.18), "cell_furnace", 5)
    )

    # --- Spacers (above & below capsule, inside furnace ID) ---
    cap_h = c["capsule_h"]
    sp_h = c["spacer_h"]
    # sample centered at 0
    sp_top_z = cap_h / 2 + 0.02
    sp_bot_z = -cap_h / 2 - sp_h - 0.02
    parts.append(
        (
            "Cell_Spacer_Top",
            disk(c["spacer_r"], sp_h, sp_top_z),
            (0.78, 0.72, 0.62),
            "cell_spacer",
            5,
        )
    )
    parts.append(
        (
            "Cell_Spacer_Bottom",
            disk(c["spacer_r"], sp_h, sp_bot_z),
            (0.78, 0.72, 0.62),
            "cell_spacer",
            5,
        )
    )

    # --- Capsule + sample ---
    cap_z0 = -cap_h / 2
    capsule = tube(c["capsule_od"], c["capsule_id"], cap_h, cap_z0)
    # thin lid
    lid = disk(c["capsule_od"], 0.12, cap_h / 2 - 0.12)
    capsule = capsule.fuse(lid)
    parts.append(
        ("Cell_Capsule", capsule, (0.72, 0.74, 0.78), "cell_sample", 5)
    )
    sample = disk(c["sample_r"], c["sample_h"], -c["sample_h"] / 2)
    parts.append(
        ("Cell_Sample", sample, (0.25, 0.65, 0.35), "cell_sample", 5)
    )

    # --- Electrodes (top & bottom) ---
    # metal disk near octa surface + stem into insulator
    e_h = c["electrode_h"]
    e_stem = c["electrode_stem_h"]
    # electrodes near the face openings (not beyond face plane)
    e_top_z = furn_half + disk_h + 0.15
    e_bot_z = -furn_half - disk_h - e_h - 0.15
    e_top_z = min(e_top_z, face_h * 0.88)
    e_bot_z = max(e_bot_z, -face_h * 0.88 - e_h)

    def electrode(z_disk: float, up: bool) -> Part.Shape:
        d = disk(c["electrode_r"], e_h, z_disk)
        if up:
            stem = Part.makeCylinder(
                c["electrode_stem_r"],
                e_stem,
                Vector(0, 0, z_disk - e_stem + 0.05),
                Vector(0, 0, 1),
            )
        else:
            stem = Part.makeCylinder(
                c["electrode_stem_r"],
                e_stem,
                Vector(0, 0, z_disk + e_h - 0.05),
                Vector(0, 0, 1),
            )
        return d.fuse(stem)

    parts.append(
        (
            "Cell_Electrode_Top",
            electrode(e_top_z, True),
            (0.55, 0.50, 0.35),
            "cell_electrode",
            5,
        )
    )
    parts.append(
        (
            "Cell_Electrode_Bottom",
            electrode(e_bot_z, False),
            (0.55, 0.50, 0.35),
            "cell_electrode",
            5,
        )
    )

    # --- Thermocouple (in face grooves → sample; no bead) ---
    try:
        tc = make_thermocouple(c)
        parts.append(
            ("Cell_Thermocouple", tc, (0.92, 0.72, 0.12), "cell_tc", 5)
        )
    except Exception as ex:
        print("tc:", ex)

    return parts


def export_stl(shape: Part.Shape, path: str, defl=0.12):
    try:
        mesh = MeshPart.meshFromShape(
            Shape=shape,
            LinearDeflection=defl,
            AngularDeflection=0.4,
            Relative=False,
        )
        mesh.write(path)
        return True
    except Exception:
        try:
            shape.exportStl(path)
            return True
        except Exception as ex:
            print(f"STL fail {path}: {ex}")
            return False


def build_standalone(export_dir: str | None = None):
    """Build cell-only FreeCAD doc + exports for web."""
    c = derived_cell()
    print("=== 14/8 Cell assembly (mm) ===")
    for k in (
        "octa_edge",
        "octa_mid_r",
        "bore_r",
        "furnace_len",
        "furnace_od_wide",
        "furnace_id",
        "capsule_h",
        "sample_h",
    ):
        print(f"  {k:18s} = {c[k]:.4f}")

    if export_dir is None:
        here = os.path.dirname(os.path.abspath(__file__))
        export_dir = os.path.normpath(os.path.join(here, "..", "exports"))
    cell_dir = os.path.join(export_dir, "cell_14_8")
    stl_dir = os.path.join(cell_dir, "parts_stl")
    step_dir = os.path.join(cell_dir, "parts")
    os.makedirs(stl_dir, exist_ok=True)
    os.makedirs(step_dir, exist_ok=True)

    doc = App.newDocument("Cell_14_8")
    parts = build_cell_parts(c)
    manifest_parts = []

    for name, shape, rgb, group, layer in parts:
        obj = doc.addObject("Part::Feature", name)
        obj.Shape = shape
        try:
            if obj.ViewObject is not None:
                obj.ViewObject.ShapeColor = rgb
        except Exception:
            pass
        try:
            shape.exportStep(os.path.join(step_dir, f"{name}.step"))
        except Exception as ex:
            print("STEP", name, ex)
        export_stl(shape, os.path.join(stl_dir, f"{name}.stl"))
        # explosion: along +Z for axial stack (inner more), radial for sleeve
        if "Octahedron" in name:
            thrust = [0.0, 0.0, 0.0]
            exp_layer = 0
        elif "Sleeve" in name or "Disk" in name:
            thrust = [0.0, 0.0, 0.15 if "Top" in name else (-0.15 if "Bottom" in name else 0.0)]
            exp_layer = 1
        elif "Furnace" in name:
            thrust = [0.0, 0.0, 0.0]
            exp_layer = 2
        elif "Spacer_Top" in name or "Electrode_Top" in name:
            thrust = [0.0, 0.0, 1.0]
            exp_layer = 3
        elif "Spacer_Bottom" in name or "Electrode_Bottom" in name:
            thrust = [0.0, 0.0, -1.0]
            exp_layer = 3
        elif "Thermocouple" in name:
            thrust = [0.35, 0.0, 0.85]
            exp_layer = 4
        else:
            thrust = [0.0, 0.0, 0.0]
            exp_layer = 3

        manifest_parts.append(
            {
                "id": name,
                "group": group,
                "layer": exp_layer,
                "thrust": thrust,
                "stl": f"cell_14_8/parts_stl/{name}.stl",
                "step": f"cell_14_8/parts/{name}.step",
                "color": list(rgb),
                "volume_mm3": float(shape.Volume),
            }
        )
        print(f"  + {name:28s} V={shape.Volume:8.2f}")

    doc.recompute()
    fcstd = os.path.join(cell_dir, "Cell_14_8.FCStd")
    doc.saveAs(fcstd)

    try:
        compound = Part.makeCompound([p[1] for p in parts])
        compound.exportStep(os.path.join(cell_dir, "Cell_14_8.step"))
        export_stl(compound, os.path.join(cell_dir, "Cell_14_8.stl"), 0.15)
    except Exception as ex:
        print("compound export:", ex)

    manifest = {
        "units": "mm",
        "scale_to_scene": 0.08,  # cell alone is small — larger display scale
        "press_axis": [0, 0, 1],
        "cell": "14/8 face-bore (hole on opposite triangular faces)",
        "bore_geometry": "face-to-face: furnace axis = octa face normal; opening on faces",
        "parameters": {k: v for k, v in c.items() if isinstance(v, (int, float, str))},
        "parts": manifest_parts,
        "references": [
            "Hiroshima Kawazoe 14/8 octahedron CAD (hole on faces)",
            "COMPRES multi-anvil cell assemblies (Leinenweber et al.)",
        ],
    }
    man_path = os.path.join(cell_dir, "manifest.json")
    with open(man_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    # web mirror
    here = os.path.dirname(os.path.abspath(__file__))
    web = os.path.normpath(os.path.join(here, "..", "..", "public", "cad", "cell_14_8"))
    import shutil

    if os.path.isdir(web):
        shutil.rmtree(web)
    shutil.copytree(cell_dir, web)
    # also write top-level cell manifest pointer
    web_cad = os.path.normpath(os.path.join(here, "..", "..", "public", "cad"))
    with open(os.path.join(web_cad, "cell_manifest.json"), "w", encoding="utf-8") as f:
        # fix stl paths relative to /cad/
        m2 = dict(manifest)
        m2["parts"] = []
        for p in manifest_parts:
            q = dict(p)
            q["stl"] = f"cell_14_8/parts_stl/{p['id']}.stl"
            m2["parts"].append(q)
        json.dump(m2, f, indent=2)

    print(f"\nSaved {fcstd}")
    print(f"Manifest {man_path}")
    print(f"Web {web}")
    return c


def main():
    try:
        build_standalone()
        print("\nOK — 14/8 cell built.")
    except Exception:
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
