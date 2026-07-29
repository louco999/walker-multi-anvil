# -*- coding: utf-8 -*-
"""
Full Walker-type multi-anvil APPARATUS:
  outer 4-column press + Walker module (hatbox, 6+8 anvils) + 14/8 cell.

Exports STEP/STL + web manifest for the complete machine.
"""
from __future__ import annotations

import json
import math
import os
import shutil
import sys
import time
import traceback

import FreeCAD as App
import MeshPart
import Part
from FreeCAD import Rotation, Vector

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPTS)
ROOT = os.path.normpath(os.path.join(SCRIPTS, "..", ".."))
EXPORT = os.path.join(ROOT, "cad", "exports", "full_apparatus")
WEB = os.path.join(ROOT, "public", "cad")

from build_press_frame import build_press_parts  # noqa: E402


def export_stl(shape, path, defl=0.4):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        mesh = MeshPart.meshFromShape(
            Shape=shape, LinearDeflection=defl, AngularDeflection=0.45, Relative=False
        )
        mesh.write(path)
    except Exception:
        try:
            shape.exportStl(path)
        except Exception as ex:
            print("STL fail", path, ex)


def safe_color(obj, rgb):
    try:
        if obj.ViewObject is not None:
            obj.ViewObject.ShapeColor = rgb
    except Exception:
        pass


def kawai_rot():
    return Rotation(Vector(1, 1, 1), Vector(0, 0, 1))


def build_module_and_cell():
    """Build Walker module core + detailed 14/8 cell at origin (module center = 0)."""
    from build_walker_module import (
        derived,
        P,
        make_all_wc,
        make_first_stage_set,
        make_hatbox,
        make_end_ring,
        transform_by_rotation,
    )
    from build_14_8_cell import build_cell_parts, derived_cell

    D = derived(P)
    rot = kawai_rot()
    items = []  # (name, shape, rgb, group, layer, thrust)

    # WC
    for name, sh, signs in make_all_wc(D["a"], D["d_cut"]):
        sh_p = transform_by_rotation(sh, rot)
        sx, sy, sz = signs
        t = rot.multVec(Vector(sx, sy, sz))
        t.normalize()
        items.append((name, sh_p, (0.12, 0.12, 0.14), "wc", 3, (t.x, t.y, t.z)))

    # First stage
    for name, sh, thrust in make_first_stage_set(D):
        items.append((name, sh, (0.78, 0.82, 0.86), "first_stage", 2, thrust))

    # Hatbox + end rings
    items.append(("Hatbox", make_hatbox(D), (0.72, 0.76, 0.80), "hatbox", 1, (0, 0, 0.15)))
    items.append(
        ("EndRing_Top", make_end_ring(D, "top"), (0.55, 0.58, 0.62), "end_ring", 1, (0, 0, 1))
    )
    items.append(
        (
            "EndRing_Bottom",
            make_end_ring(D, "bottom"),
            (0.55, 0.58, 0.62),
            "end_ring",
            1,
            (0, 0, -1),
        )
    )

    # Detailed cell: face-up furnace axis = +Z, then align 8 faces to WC truncations
    from build_14_8_cell import (
        cell_wc_cavity_transform,
        place_cell_in_wc_cavity,
        rotate_thrust_z,
    )

    cell_p = derived_cell(
        {"octa_edge": D["octa_edge"], "octa_clearance": D.get("octa_clearance", 0.06)}
    )
    z_rot, cell_scale = cell_wc_cavity_transform(D["d_cut"], cell_p["face_half_h"], nest=0.02)
    print(
        f"  cell→WC cavity: Z-rot={z_rot:.2f}°  scale={cell_scale:.4f}  "
        f"(8 octa faces // 8 WC truncations, nested in d_cut plane)"
    )
    try:
        for name, shape, rgb, group, layer in build_cell_parts(cell_p):
            shape = place_cell_in_wc_cavity(shape, z_rot, cell_scale)
            if "Top" in name:
                thr = (0, 0, 1)
            elif "Bottom" in name:
                thr = (0, 0, -1)
            elif "Thermo" in name:
                thr = rotate_thrust_z((0.35, 0.2, 0.25), z_rot)
            else:
                thr = (0, 0, 0)
            items.append((name, shape, rgb, group, layer, thr))
    except Exception as ex:
        print("cell build failed:", ex)
        traceback.print_exc()

    return items, D


def main():
    print("=== Full Walker apparatus (press + module + cell) ===")
    os.makedirs(os.path.join(EXPORT, "parts"), exist_ok=True)
    os.makedirs(os.path.join(EXPORT, "parts_stl"), exist_ok=True)

    # 1) Module + cell at origin
    core_items, D = build_module_and_cell()
    r_outer = D["r_outer"]
    # Seat height = hatbox + end rings only (not skewed first-stage BB)
    mod_h = D["hatbox_h"] + 2 * D["end_ring_thick"]
    # Prefer hatbox/end-ring bbox for placement if available
    zmin, zmax = -D["hatbox_h"] / 2 - D["end_ring_thick"], D["hatbox_h"] / 2 + D["end_ring_thick"]
    for name, sh, _, _, _, _ in core_items:
        if name in ("Hatbox", "EndRing_Top", "EndRing_Bottom") or name.startswith("EndRing"):
            bb = sh.BoundBox
            zmin = min(zmin, bb.ZMin)
            zmax = max(zmax, bb.ZMax)
    mod_h = zmax - zmin
    core_center_local = 0.5 * (zmin + zmax)
    print(f"  module r_outer={r_outer:.1f} seat_h={mod_h:.1f} local_z=[{zmin:.1f},{zmax:.1f}]")

    # 2) Press frame sized around module
    press_items, meta = build_press_parts(module_r_outer=r_outer, module_h=mod_h)
    module_bottom_z = meta["module_bottom_z"]
    z_shift = module_bottom_z - zmin
    print(
        f"  place: z_shift={z_shift:.1f}  module bottom on platen z={module_bottom_z:.1f}  "
        f"center→{core_center_local + z_shift:.1f}"
    )

    # 3) Translate core onto lower platen (no floating)
    placed = []
    for name, shape, rgb, group, layer, thrust in core_items:
        sh = shape.copy()
        sh.translate(Vector(0, 0, z_shift))
        # only allow explosion on inner multi-anvil parts, never press frame
        placed.append((name, sh, rgb, group, layer, thrust))

    all_parts = list(press_items) + placed

    doc = App.newDocument("WalkerFullApparatus")
    ver = str(int(time.time()))
    man_parts = []

    for name, shape, rgb, group, layer, thrust in all_parts:
        # sanitize FreeCAD name
        safe = (
            name.replace("+", "p")
            .replace("-", "m")
            .replace(".", "_")
            .replace(" ", "_")
        )
        obj = doc.addObject("Part::Feature", safe)
        obj.Shape = shape
        safe_color(obj, rgb)

        step_path = os.path.join(EXPORT, "parts", f"{safe}.step")
        stl_path = os.path.join(EXPORT, "parts_stl", f"{safe}.stl")
        try:
            shape.exportStep(step_path)
        except Exception as ex:
            print("STEP", safe, ex)

        # coarser mesh for large press parts
        defl = 0.8 if group.startswith("press") else 0.25
        if group.startswith("cell"):
            defl = 0.08
        export_stl(shape, stl_path, defl=defl)

        tx, ty, tz = thrust
        L = math.sqrt(tx * tx + ty * ty + tz * tz) or 1.0
        man_parts.append(
            {
                "id": safe,
                "group": group,
                "layer": layer,
                "thrust": [tx / L, ty / L, tz / L],
                "stl": f"full_apparatus/parts_stl/{safe}.stl?v={ver}",
                "color": list(rgb),
                "volume_mm3": float(shape.Volume),
            }
        )
        print(f"  + {safe:32s} [{group:14s}] V={shape.Volume:12.0f}")

    doc.recompute()
    fcstd = os.path.join(EXPORT, "WalkerFullApparatus.FCStd")
    doc.saveAs(fcstd)

    try:
        compound = Part.makeCompound([p[1] for p in all_parts])
        compound.exportStep(os.path.join(EXPORT, "WalkerFullApparatus.step"))
        export_stl(compound, os.path.join(EXPORT, "WalkerFullApparatus.stl"), defl=1.2)
    except Exception as ex:
        print("assembly export:", ex)

    man = {
        "units": "mm",
        # photo machine ~0.9–1.1 m tall → ~1.6–2.0 scene units
        "scale_to_scene": 0.0018,
        "version": ver,
        "press_axis": [0, 0, 1],
        "cell": "full apparatus: continuous load path, no floating parts",
        "module_bottom_z": module_bottom_z,
        "module_center_z": core_center_local + z_shift,
        "parameters": {
            "r_outer": D["r_outer"],
            "hatbox_h": D["hatbox_h"],
            "module_true_h": mod_h,
            "wc_edge": D["wc_edge"],
            "octa_edge": D["octa_edge"],
            "tel": D["tel"],
            "rod_h": meta.get("rod_h"),
        },
        "parts": man_parts,
    }
    with open(os.path.join(EXPORT, "manifest.json"), "w") as f:
        json.dump(man, f, indent=2)

    # mirror to web
    web_full = os.path.join(WEB, "full_apparatus")
    if os.path.isdir(web_full):
        shutil.rmtree(web_full)
    shutil.copytree(EXPORT, web_full)
    with open(os.path.join(WEB, "full_manifest.json"), "w") as f:
        json.dump(man, f, indent=2)

    print("Saved", fcstd)
    print("Web", web_full)
    print("DONE ver=", ver)
    return man


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
