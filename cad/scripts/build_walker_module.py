# -*- coding: utf-8 -*-
"""
Walker-type 6/8 multi-anvil MODULE — FreeCAD parametric B-rep.

Closed size chain (mm), press axis +Z = cube [111].

14/8-class teaching scale:
  octa_edge=14, tel=8, wc_edge≈26 (common lab class proportions)

Headless:
  freecadcmd -c "import runpy; runpy.run_path('cad/scripts/build_walker_module.py', run_name='__main__')"
"""

from __future__ import annotations

import json
import math
import os
import sys
import traceback

try:
    import FreeCAD as App
    import Mesh
    import MeshPart
    import Part
    from FreeCAD import Base, Rotation, Vector
except ImportError as e:
    sys.stderr.write(f"Run with freecadcmd, not system python.\n{e}\n")
    sys.exit(1)


# ===========================================================================
# Masters — 14/8 class
# ===========================================================================
P = {
    "wc_edge": 26.0,  # mm, second-stage cube edge
    "tel": 8.0,  # mm, WC truncation edge length
    "octa_edge": 14.0,  # mm, MgO octahedron edge (14/8 naming)
    "first_stage_radial_depth": 20.0,
    "hatbox_clearance": 1.2,
    "hatbox_wall": 16.0,
    "hatbox_height": 100.0,
    "flange_extra": 10.0,
    "flange_thick": 9.0,
    "end_ring_thick": 14.0,  # axial support rings (load path)
    "end_ring_inner_scale": 0.55,  # ID relative to r_inner
    "first_stage_kerf": 0.25,
    "furnace_bore_r": 3.5,
    "octa_clearance": 0.08,  # shrink vs geometric cavity
    "doc_name": "WalkerTypeModule_14_8",
}


def kawai_rotation() -> Rotation:
    return Rotation(Vector(1, 1, 1), Vector(0, 0, 1))


def max_xy_radius_of_cube_after_kawai(a: float) -> float:
    q = kawai_rotation()
    rmax = 0.0
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                w = q.multVec(Vector(sx * a, sy * a, sz * a))
                rmax = max(rmax, math.hypot(w.x, w.y))
    return rmax


def derived(p: dict) -> dict:
    a = p["wc_edge"]
    d_cut = p["tel"] / math.sqrt(2.0)
    # Regular octahedron: edge = mid_radius * √2  ⇒  mid_r = edge/√2
    octa_mid_r = (p["octa_edge"] / math.sqrt(2.0)) * (1.0 - p["octa_clearance"])
    r_pkg = max_xy_radius_of_cube_after_kawai(a)
    r_inner = r_pkg + p["first_stage_radial_depth"] + p["hatbox_clearance"]
    r_outer = r_inner + p["hatbox_wall"]
    return {
        **p,
        "a": a,
        "d_cut": d_cut,
        "octa_mid_r": octa_mid_r,
        "r_pkg_xy": r_pkg,
        "r_inner": r_inner,
        "r_outer": r_outer,
        "hatbox_h": p["hatbox_height"],
    }


def transform_by_rotation(shape: Part.Shape, rot: Rotation) -> Part.Shape:
    return shape.copy().transformGeometry(rot.toMatrix())


# ---------------------------------------------------------------------------
# Solids
# ---------------------------------------------------------------------------
def _tetrahedron(v0, v1, v2, v3) -> Part.Shape:
    faces = []
    for a, b, c in ((v0, v1, v2), (v0, v1, v3), (v0, v2, v3), (v1, v2, v3)):
        faces.append(Part.Face(Part.makePolygon([a, b, c, a])))
    solid = Part.makeSolid(Part.makeShell(faces))
    if solid.Volume < 0:
        solid.reverse()
    return solid


def make_wc_cube(a: float, d_cut: float, sx: int, sy: int, sz: int) -> Part.Shape:
    x0 = 0.0 if sx > 0 else -a
    y0 = 0.0 if sy > 0 else -a
    z0 = 0.0 if sz > 0 else -a
    box = Part.makeBox(a, a, a, Vector(x0, y0, z0))
    tet = _tetrahedron(
        Vector(0, 0, 0),
        Vector(sx * d_cut, 0, 0),
        Vector(0, sy * d_cut, 0),
        Vector(0, 0, sz * d_cut),
    )
    cut = box.cut(tet)
    try:
        cut = cut.removeSplitter()
    except Exception:
        pass
    return cut


def make_all_wc(a: float, d_cut: float):
    out = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                tag = f"{'p' if sx > 0 else 'm'}{'p' if sy > 0 else 'm'}{'p' if sz > 0 else 'm'}"
                out.append((f"WC_{tag}", make_wc_cube(a, d_cut, sx, sy, sz), (sx, sy, sz)))
    return out


def _tri(a, b, c):
    return Part.Face(Part.makePolygon([a, b, c, a]))


def make_octahedron(mid_r: float) -> Part.Shape:
    r = mid_r
    px, mx = Vector(r, 0, 0), Vector(-r, 0, 0)
    py, my = Vector(0, r, 0), Vector(0, -r, 0)
    pz, mz = Vector(0, 0, r), Vector(0, 0, -r)

    def pyramid(apex, ring):
        faces = [Part.Face(Part.makePolygon(ring + [ring[0]]))]
        for i in range(len(ring)):
            faces.append(_tri(apex, ring[i], ring[(i + 1) % len(ring)]))
        s = Part.makeSolid(Part.makeShell(faces))
        if s.Volume < 0:
            s.reverse()
        return s

    ring = [px, py, mx, my]
    solid = pyramid(pz, ring).fuse(pyramid(mz, list(reversed(ring))))
    try:
        solid = solid.removeSplitter()
    except Exception:
        pass
    return solid


def cut_halfspace_keep_positive(shape: Part.Shape, normal: Vector, offset: float) -> Part.Shape:
    n = Vector(normal)
    if n.Length < 1e-12:
        return shape
    n.normalize()
    # Keep cutter only moderately larger than the module — huge boxes leave sliver BBs
    L = 280.0
    center = n * (offset - L / 2.0)
    box = Part.makeBox(L, L, L, Vector(-L / 2, -L / 2, -L / 2))
    box.Placement = Base.Placement(center, Rotation(Vector(0, 0, 1), n))
    box = box.transformGeometry(box.Placement.toMatrix())
    box.Placement = Base.Placement()
    try:
        return shape.cut(box)
    except Exception:
        return shape


def make_press_cylinder(r: float, h: float) -> Part.Shape:
    return Part.makeCylinder(r, h, Vector(0, 0, -h / 2), Vector(0, 0, 1))


def make_first_stage_set(D: dict):
    """
    6 first-stage anvils: package-face prism ∩ hatbox cylinder.

    Uses prism∩cylinder only (no half-space boolean). Half-space cuts left
    degenerate vertices hundreds of mm away and made the web assembly look
    like the module was floating.
    """
    a = D["a"]
    r_inner = D["r_inner"]
    h = D["hatbox_h"] * 0.90
    kerf = D["first_stage_kerf"]
    rot = kawai_rotation()
    master = make_press_cylinder(r_inner, h)

    faces_c = {
        "pX": Vector(1, 0, 0),
        "mX": Vector(-1, 0, 0),
        "pY": Vector(0, 1, 0),
        "mY": Vector(0, -1, 0),
        "pZ": Vector(0, 0, 1),
        "mZ": Vector(0, 0, -1),
    }
    results = []
    # Prism extends from package face outward past cylinder
    depth = r_inner + a + 5.0
    pad = a - kerf * 0.5

    for name, n_c in faces_c.items():
        if abs(n_c.x) > 0.5:
            sign = 1 if n_c.x > 0 else -1
            x0 = a if sign > 0 else -a - depth
            box = Part.makeBox(depth, 2 * pad, 2 * pad, Vector(x0, -pad, -pad))
        elif abs(n_c.y) > 0.5:
            sign = 1 if n_c.y > 0 else -1
            y0 = a if sign > 0 else -a - depth
            box = Part.makeBox(2 * pad, depth, 2 * pad, Vector(-pad, y0, -pad))
        else:
            sign = 1 if n_c.z > 0 else -1
            z0 = a if sign > 0 else -a - depth
            box = Part.makeBox(2 * pad, 2 * pad, depth, Vector(-pad, -pad, z0))

        box = transform_by_rotation(box, rot)
        piece = master.common(box)
        # Force inside hatbox height (rotated prisms otherwise stick out ±100mm)
        zcap = Part.makeBox(
            r_inner * 4, r_inner * 4, h, Vector(-r_inner * 2, -r_inner * 2, -h / 2)
        )
        try:
            piece = piece.common(zcap)
        except Exception:
            pass
        sols = sorted(piece.Solids, key=lambda s: s.Volume, reverse=True)
        if not sols or sols[0].Volume < 10:
            print(f"  warn: empty first-stage {name}")
            continue
        piece = sols[0]
        n = rot.multVec(n_c)
        n.normalize()
        results.append((f"FirstStage_{name}", piece, (n.x, n.y, n.z)))
    return results


def make_hatbox(D: dict) -> Part.Shape:
    ri, ro, h = D["r_inner"], D["r_outer"], D["hatbox_h"]
    fe, ft = D["flange_extra"], D["flange_thick"]
    outer = Part.makeCylinder(ro, h, Vector(0, 0, -h / 2), Vector(0, 0, 1))
    inner = Part.makeCylinder(ri, h + 4, Vector(0, 0, -h / 2 - 2), Vector(0, 0, 1))
    shell = outer.cut(inner)
    fl_o = Part.makeCylinder(ro + fe, ft, Vector(0, 0, h / 2 - ft * 0.25), Vector(0, 0, 1))
    fl_i = Part.makeCylinder(ri, ft + 2, Vector(0, 0, h / 2 - ft * 0.25 - 1), Vector(0, 0, 1))
    hat = shell.fuse(fl_o.cut(fl_i))
    try:
        hat = hat.removeSplitter()
    except Exception:
        pass
    return hat


def make_end_ring(D: dict, side: str) -> Part.Shape:
    """Axial support ring: converts uniaxial platen load into module."""
    ri = D["r_inner"] * D["end_ring_inner_scale"]
    ro = D["r_outer"] + D["flange_extra"] * 0.35
    t = D["end_ring_thick"]
    h = D["hatbox_h"]
    z0 = h / 2 if side == "top" else -h / 2 - t
    if side == "top":
        z0 = h / 2
    else:
        z0 = -h / 2 - t
    outer = Part.makeCylinder(ro, t, Vector(0, 0, z0), Vector(0, 0, 1))
    inner = Part.makeCylinder(ri, t + 2, Vector(0, 0, z0 - 1), Vector(0, 0, 1))
    ring = outer.cut(inner)
    # boss that seats on first-stage upper/lower set
    boss_r = D["r_inner"] * 0.92
    boss_h = t * 0.35
    if side == "top":
        boss = Part.makeCylinder(boss_r, boss_h, Vector(0, 0, z0 - boss_h * 0.2), Vector(0, 0, 1))
        boss_i = Part.makeCylinder(ri * 1.05, boss_h + 2, Vector(0, 0, z0 - boss_h * 0.2 - 1), Vector(0, 0, 1))
        ring = ring.fuse(boss.cut(boss_i))
    else:
        boss = Part.makeCylinder(boss_r, boss_h, Vector(0, 0, z0 + t - boss_h * 0.8), Vector(0, 0, 1))
        boss_i = Part.makeCylinder(ri * 1.05, boss_h + 2, Vector(0, 0, z0 + t - boss_h * 0.8 - 1), Vector(0, 0, 1))
        ring = ring.fuse(boss.cut(boss_i))
    try:
        ring = ring.removeSplitter()
    except Exception:
        pass
    return ring


def make_furnace(D: dict) -> Part.Shape:
    r = min(D["furnace_bore_r"], D["octa_mid_r"] * 0.5)
    h = D["octa_mid_r"] * 1.7
    tube = Part.makeCylinder(r, h, Vector(0, 0, -h / 2), Vector(0, 0, 1))
    bore = Part.makeCylinder(r * 0.72, h + 1, Vector(0, 0, -h / 2 - 0.5), Vector(0, 0, 1))
    sample = Part.makeCylinder(r * 0.5, h * 0.32, Vector(0, 0, -h * 0.16), Vector(0, 0, 1))
    return tube.cut(bore).fuse(sample)


# ---------------------------------------------------------------------------
# Document / export
# ---------------------------------------------------------------------------
COLORS = {
    "WC": (0.12, 0.12, 0.14),
    "FirstStage": (0.78, 0.82, 0.86),
    "Hatbox": (0.72, 0.76, 0.80),
    "EndRing": (0.55, 0.58, 0.62),
    "MgO": (0.55, 0.30, 0.22),
    "Furnace": (0.25, 0.25, 0.28),
}


def safe_color(obj, rgb):
    try:
        if obj.ViewObject is not None:
            obj.ViewObject.ShapeColor = rgb
    except Exception:
        pass


def export_part_stl(shape: Part.Shape, path: str, linear_deflection=0.35):
    """Mesh a shape and write binary STL."""
    try:
        mesh = MeshPart.meshFromShape(
            Shape=shape,
            LinearDeflection=linear_deflection,
            AngularDeflection=0.5,
            Relative=False,
        )
        mesh.write(path)
        return True
    except Exception as ex:
        # fallback
        try:
            shape.exportStl(path)
            return True
        except Exception as ex2:
            print(f"  STL fail {path}: {ex} / {ex2}")
            return False


def build(export_dir: str | None = None) -> dict:
    D = derived(P)
    print("=== Walker 14/8-class module (mm) ===")
    for k in (
        "wc_edge",
        "tel",
        "octa_edge",
        "d_cut",
        "octa_mid_r",
        "a",
        "r_pkg_xy",
        "r_inner",
        "r_outer",
        "hatbox_h",
        "end_ring_thick",
    ):
        print(f"  {k:22s} = {D[k]:.4f}")

    if export_dir is None:
        here = os.path.dirname(os.path.abspath(__file__))
        export_dir = os.path.normpath(os.path.join(here, "..", "exports"))
    parts_dir = os.path.join(export_dir, "parts")
    stl_dir = os.path.join(export_dir, "parts_stl")
    os.makedirs(parts_dir, exist_ok=True)
    os.makedirs(stl_dir, exist_ok=True)

    doc = App.newDocument(D["doc_name"])
    rot = kawai_rotation()
    manifest = {
        "units": "mm",
        "scale_to_scene": 0.012,
        "press_axis": [0, 0, 1],
        "cell": "14/8 detailed (MgO+ZrO2+LaCrO3 stepped+capsule+TC)",
        "parameters": {k: v for k, v in D.items() if isinstance(v, (int, float, str))},
        "parts": [],
    }

    def add(name: str, shape: Part.Shape, color, thrust, layer: int, group: str):
        obj = doc.addObject("Part::Feature", name)
        obj.Shape = shape
        safe_color(obj, color)
        # normalize thrust
        tx, ty, tz = thrust
        L = math.sqrt(tx * tx + ty * ty + tz * tz) or 1.0
        thrust_n = [tx / L, ty / L, tz / L]
        step_path = os.path.join(parts_dir, f"{name}.step")
        stl_path = os.path.join(stl_dir, f"{name}.stl")
        try:
            shape.exportStep(step_path)
        except Exception as ex:
            print(f"  STEP fail {name}: {ex}")
        export_part_stl(shape, stl_path)
        manifest["parts"].append(
            {
                "id": name,
                "group": group,
                "layer": layer,
                "thrust": thrust_n,
                "stl": f"parts_stl/{name}.stl",
                "step": f"parts/{name}.step",
                "color": list(color),
                "volume_mm3": float(shape.Volume),
            }
        )
        print(f"  + {name:20s}  V={shape.Volume:10.1f}  thrust={thrust_n}")
        return obj

    # WC
    for name, sh, signs in make_all_wc(D["a"], D["d_cut"]):
        sh_p = transform_by_rotation(sh, rot)
        sx, sy, sz = signs
        t = rot.multVec(Vector(sx, sy, sz))
        t.normalize()
        add(name, sh_p, COLORS["WC"], (t.x, t.y, t.z), 3, "wc")

    # First stage
    for name, sh, thrust in make_first_stage_set(D):
        add(name, sh, COLORS["FirstStage"], thrust, 2, "first_stage")

    # --- Detailed 14/8 cell inside WC cavity ---
    # Face-up cell (furnace // +Z), then Z-rotate + scale so each octa face
    # is parallel to one WC truncation face and nested in the cavity.
    try:
        _scripts = os.path.dirname(os.path.abspath(__file__))
        if _scripts not in sys.path:
            sys.path.insert(0, _scripts)
        from build_14_8_cell import (
            build_cell_parts,
            derived_cell,
            cell_wc_cavity_transform,
            place_cell_in_wc_cavity,
            rotate_thrust_z,
        )

        cell_p = derived_cell(
            {
                "octa_edge": D["octa_edge"],
                "octa_clearance": D.get("octa_clearance", 0.06),
            }
        )
        z_rot, cell_scale = cell_wc_cavity_transform(
            D["d_cut"], cell_p["face_half_h"], nest=0.02
        )
        print(
            f"  cell octa_mid_r={cell_p['octa_mid_r']:.3f}  module={D['octa_mid_r']:.3f}"
        )
        print(
            f"  cell→WC: Z-rot={z_rot:.2f}° scale={cell_scale:.4f} "
            f"(8 faces // 8 WC truncations)"
        )
        for name, shape, rgb, group, layer in build_cell_parts(cell_p):
            shape = place_cell_in_wc_cavity(shape, z_rot, cell_scale)
            if "Top" in name:
                thrust = (0.0, 0.0, 1.0)
            elif "Bottom" in name:
                thrust = (0.0, 0.0, -1.0)
            elif "Thermocouple" in name:
                thrust = rotate_thrust_z((0.4, 0.0, 0.9), z_rot)
            elif "Octahedron" in name:
                thrust = (0.0, 0.0, 0.0)
            else:
                thrust = (0.0, 0.0, 0.0)
            add(name, shape, rgb, thrust, layer, group)
    except Exception as ex:
        print("detailed cell failed, fallback simple MgO:", ex)
        traceback.print_exc()
        # Vertex-up octa + Kawai → face normals already // WC truncations
        octa = make_octahedron(D["d_cut"] * (1.0 - D.get("octa_clearance", 0.08)))
        octa_p = transform_by_rotation(octa, rot)
        bore_r = min(D["furnace_bore_r"], D["d_cut"] * 0.45)
        h_bore = D["d_cut"] * 3.0
        bore = Part.makeCylinder(
            bore_r, h_bore, Vector(0, 0, -h_bore / 2), Vector(0, 0, 1)
        )
        try:
            cut = octa_p.cut(bore)
            if cut.Volume > 1e-3:
                octa_p = cut
        except Exception:
            pass
        add("MgO_Octahedron", octa_p, COLORS["MgO"], (0, 0, 0), 4, "mgo")
        try:
            add("FurnaceSample", make_furnace(D), COLORS["Furnace"], (0, 0, 0), 5, "furnace")
        except Exception as ex2:
            print("furnace:", ex2)

    # Hatbox
    add("Hatbox", make_hatbox(D), COLORS["Hatbox"], (0, 0, 0.15), 1, "hatbox")

    # End rings (load path)
    add("EndRing_Top", make_end_ring(D, "top"), COLORS["EndRing"], (0, 0, 1), 0, "end_ring")
    add("EndRing_Bottom", make_end_ring(D, "bottom"), COLORS["EndRing"], (0, 0, -1), 0, "end_ring")

    doc.recompute()

    # WC interference
    try:
        wc = [o.Shape for o in doc.Objects if o.Name.startswith("WC_")]
        if len(wc) == 8:
            fused = wc[0]
            for s in wc[1:]:
                fused = fused.fuse(s)
            overlap = sum(s.Volume for s in wc) - fused.Volume
            print(f"\nWC overlap volume (want ~0): {overlap:.3f} mm³")
            manifest["wc_overlap_mm3"] = float(overlap)
    except Exception as ex:
        print("interference check:", ex)

    # Save assembly
    fcstd = os.path.join(export_dir, "WalkerTypeModule.FCStd")
    doc.saveAs(fcstd)
    try:
        compound = Part.makeCompound(
            [o.Shape for o in doc.Objects if hasattr(o, "Shape") and not o.Shape.isNull()]
        )
        compound.exportStep(os.path.join(export_dir, "WalkerTypeModule.step"))
        export_part_stl(compound, os.path.join(export_dir, "WalkerTypeModule.stl"), 0.5)
    except Exception as ex:
        print("assembly export:", ex)

    # Manifest
    man_path = os.path.join(export_dir, "manifest.json")
    with open(man_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nManifest: {man_path}")
    print(f"Document: {fcstd}")

    # Mirror to web public
    here = os.path.dirname(os.path.abspath(__file__))
    web = os.path.normpath(os.path.join(here, "..", "..", "public", "cad"))
    os.makedirs(web, exist_ok=True)
    import shutil

    for src_name in ("WalkerTypeModule.stl", "manifest.json"):
        src = os.path.join(export_dir, src_name)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(web, src_name))
    web_parts = os.path.join(web, "parts_stl")
    if os.path.isdir(web_parts):
        shutil.rmtree(web_parts)
    shutil.copytree(stl_dir, web_parts)
    print(f"Web public: {web}")

    # parameters.txt
    with open(os.path.join(export_dir, "parameters.txt"), "w", encoding="utf-8") as f:
        f.write("Walker 14/8-class module — closed size chain\n")
        f.write("press +Z = cube [111]\n")
        f.write("first-stage outer = true cylinder about +Z\n")
        f.write("end rings = uniaxial load path into 3+3 anvils\n\n")
        for k, v in sorted(D.items()):
            if isinstance(v, (int, float, str)):
                f.write(f"{k} = {v}\n")

    return D


def main():
    try:
        build()
        print("\nOK")
    except Exception:
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
