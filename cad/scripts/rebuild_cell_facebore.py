# -*- coding: utf-8 -*-
"""
14/8 cell:
  - Face-to-face bore fully packed (sleeve / furnace / plugs fill the hole)
  - TC grooves open on the octahedron SURFACE at two corners
  - Wires sit in those grooves, then go straight down into sample center
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
from FreeCAD import Vector

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))
EXPORT = os.path.join(ROOT, "cad", "exports", "cell_14_8")
WEB = os.path.join(ROOT, "public", "cad", "cell_14_8")

OCTA_EDGE = 14.0
OCTA_CLEAR = 0.06
BORE_R = 2.55  # slightly smaller so walls look solid; stack fills this

# Radial fit inside bore (fill the hole, small clearance only)
SLEEVE_OD = 2.50
SLEEVE_ID = 1.95
FURN_OD_W, FURN_OD_N, FURN_ID = 1.90, 1.60, 1.30

SAMPLE_R = 0.80
SAMPLE_H = 1.50
CAPSULE_OD = 1.18
CAPSULE_ID = 0.95
CAPSULE_H = 1.80

TC_WIRE_R = 0.16
TC_GROOVE_W = 0.50
TC_GROOVE_D = 0.50  # open channel sunk into the face
TC_CORNER_ANGLES = (0.0, 2.0 * math.pi / 3.0)
TC_SAMPLE_OFFSET = 0.20


def tri(a, b, c):
    return Part.Face(Part.makePolygon([a, b, c, a]))


def tube(od, id_, h, z0):
    o = Part.makeCylinder(od, h, Vector(0, 0, z0), Vector(0, 0, 1))
    if 0 < id_ < od:
        o = o.cut(Part.makeCylinder(id_, h + 0.5, Vector(0, 0, z0 - 0.25), Vector(0, 0, 1)))
    return o


def disk(r, h, z0):
    return Part.makeCylinder(r, h, Vector(0, 0, z0), Vector(0, 0, 1))


def make_octa_face_up(mid_r: float) -> Part.Shape:
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
        faces.append(tri(top[i], top[(i + 1) % 3], bot[i]))
        faces.append(tri(bot[i], bot[(i + 1) % 3], top[(i + 1) % 3]))
    solid = Part.makeSolid(Part.makeShell(faces))
    if solid.Volume < 0:
        solid.reverse()
    return solid


def cut_face_bore(octa: Part.Shape, face_h: float, bore_r: float) -> Part.Shape:
    # Bore only through the solid; ends flush with faces (±face_h)
    bore_h = 2 * face_h + 0.15
    bore = Part.makeCylinder(bore_r, bore_h, Vector(0, 0, -bore_h / 2), Vector(0, 0, 1))
    return octa.cut(bore)


def _corner_dirs():
    return [(math.cos(a), math.sin(a)) for a in TC_CORNER_ANGLES]


def cut_tc_surface_grooves(
    octa: Part.Shape,
    mid_r: float,
    bore_r: float,
    face_h: float,
) -> Part.Shape:
    """
    Open channels cut INTO the top face surface along two corner rays.
    Groove starts at the free surface (z = face_h) and sinks to depth TC_GROOVE_D.
    Opens into the central bore so the TC is fully recessed where it meets the face.
    """
    rho = mid_r * math.sqrt(2.0 / 3.0)
    r_in = bore_r - 0.05  # open into the bore wall
    r_out = rho * 0.92  # out to near the corner
    length = r_out - r_in
    out = octa

    for ux, uy in _corner_dirs():
        # Cutter sits slightly ABOVE the face then digs down so the opening is clean
        box = Part.makeBox(
            length,
            TC_GROOVE_W,
            TC_GROOVE_D + 0.15,
            Vector(r_in, -TC_GROOVE_W / 2, face_h - TC_GROOVE_D),
        )
        # slight lift so top of groove is open at the surface
        box.translate(Vector(0, 0, 0.02))
        ang = math.degrees(math.atan2(uy, ux))
        box.rotate(Vector(0, 0, 0), Vector(0, 0, 1), ang)
        try:
            out = out.cut(box)
        except Exception as ex:
            print("  groove fail", ang, ex)

        # cylindrical sink at corner end (where TC first meets the surface)
        corner_sink = Part.makeCylinder(
            TC_GROOVE_W * 0.65,
            TC_GROOVE_D + 0.12,
            Vector(ux * r_out * 0.98, uy * r_out * 0.98, face_h - TC_GROOVE_D - 0.02),
            Vector(0, 0, 1),
        )
        try:
            out = out.cut(corner_sink)
        except Exception:
            pass

        # open into bore
        bore_notch = Part.makeCylinder(
            TC_GROOVE_W * 0.6,
            TC_GROOVE_D + 0.2,
            Vector(ux * (bore_r - 0.15), uy * (bore_r - 0.15), face_h - TC_GROOVE_D - 0.05),
            Vector(0, 0, 1),
        )
        try:
            out = out.cut(bore_notch)
        except Exception:
            pass

    print(
        f"  surface TC grooves @ corners "
        f"{[int(a * 180 / math.pi) for a in TC_CORNER_ANGLES]}° "
        f"open on face z={face_h:.2f}, depth={TC_GROOVE_D}"
    )
    return out


def make_tc_wires(
    mid_r: float,
    bore_r: float,
    face_h: float,
    sample_top_z: float,
    sample_bot_z: float,
) -> Part.Shape:
    """Wires recessed in surface grooves, then straight down into sample center."""
    rho = mid_r * math.sqrt(2.0 / 3.0)
    r_in = bore_r + 0.05
    r_out = rho * 0.90
    length = r_out - r_in
    # wire axis mid-depth in open groove
    z_g = face_h - TC_GROOVE_D * 0.55
    wr = TC_WIRE_R
    insert = min(0.55, max(0.3, (sample_top_z - sample_bot_z) * 0.5))
    z_tip = sample_top_z - insert

    wires = None
    for ux, uy in _corner_dirs():
        horiz = Part.makeCylinder(
            wr, length, Vector(ux * r_in, uy * r_in, z_g), Vector(ux, uy, 0)
        )
        # near center for insert
        x_c, y_c = ux * TC_SAMPLE_OFFSET, uy * TC_SAMPLE_OFFSET
        link_L = max(0.05, r_in - TC_SAMPLE_OFFSET)
        link = Part.makeCylinder(
            wr, link_L, Vector(x_c, y_c, z_g), Vector(ux, uy, 0)
        )
        # straight vertical into sample
        h_v = max(0.35, z_g - z_tip)
        vert = Part.makeCylinder(wr, h_v, Vector(x_c, y_c, z_tip), Vector(0, 0, 1))
        w = horiz.fuse(link).fuse(vert)
        wires = w if wires is None else wires.fuse(w)

    print(
        f"  TC in surface grooves → straight into sample "
        f"(center offset {TC_SAMPLE_OFFSET} mm)"
    )
    return wires


def stepped_furnace(total_h: float) -> Part.Shape:
    """Stepped LaCrO3 heater filling most of the sleeve height."""
    # scale step proportions to total_h
    hw = total_h * 0.28
    nl = total_h - 2 * hw
    if nl < 0.8:
        nl = 0.8
        hw = (total_h - nl) / 2
    z_n0 = -nl / 2
    bot = tube(FURN_OD_W, FURN_ID, hw, z_n0 - hw)
    mid = tube(FURN_OD_N, FURN_ID, nl, z_n0)
    top = tube(FURN_OD_W, FURN_ID, hw, nl / 2)
    return bot.fuse(mid).fuse(top)


def export_stl(shape, path, defl=0.05):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        mesh = MeshPart.meshFromShape(
            Shape=shape, LinearDeflection=defl, AngularDeflection=0.22, Relative=False
        )
        mesh.write(path)
    except Exception:
        shape.exportStl(path)


def main():
    mid_r = (OCTA_EDGE / math.sqrt(2.0)) * (1.0 - OCTA_CLEAR)
    face_h = mid_r / math.sqrt(3.0)
    # stack fills the bore almost face-to-face
    stack_half = face_h - 0.08  # small lip at each face
    stack_h = 2 * stack_half

    print("=== 14/8 cell: filled bore + surface TC grooves ===")
    print(f"face_h={face_h:.3f} stack_h={stack_h:.3f} bore_r={BORE_R}")

    os.makedirs(os.path.join(EXPORT, "parts"), exist_ok=True)
    os.makedirs(os.path.join(EXPORT, "parts_stl"), exist_ok=True)
    doc = App.newDocument("Cell_14_8_Filled")
    parts = []

    # --- Sample / capsule (center) ---
    sample_z0 = -SAMPLE_H / 2
    sample = disk(SAMPLE_R, SAMPLE_H, sample_z0)
    sample_top = sample_z0 + SAMPLE_H
    cap_z0 = -CAPSULE_H / 2
    capsule = tube(CAPSULE_OD, CAPSULE_ID, CAPSULE_H, cap_z0)
    # open top for TC access
    lid = disk(CAPSULE_OD, 0.08, CAPSULE_H / 2 - 0.08).cut(
        Part.makeCylinder(
            CAPSULE_ID * 0.98,
            0.2,
            Vector(0, 0, CAPSULE_H / 2 - 0.12),
            Vector(0, 0, 1),
        )
    )
    capsule = capsule.fuse(lid)

    # --- MgO: full face bore + open surface grooves at two corners ---
    mgo = make_octa_face_up(mid_r)
    mgo = cut_face_bore(mgo, face_h, BORE_R)
    mgo = cut_tc_surface_grooves(mgo, mid_r, BORE_R, face_h)
    print(f"  MgO V={mgo.Volume:.1f} Z={mgo.BoundBox.ZLength:.3f}")
    parts.append(("Cell_MgO_Octahedron", mgo, (0.55, 0.30, 0.22)))

    # --- Pack the hole solidly (sleeve fills almost entire bore height) ---
    sleeve = tube(SLEEVE_OD, SLEEVE_ID, stack_h, -stack_half)
    parts.append(("Cell_ZrO2_Sleeve", sleeve, (0.93, 0.91, 0.87)))

    # End plugs / disks: fill residual space at both faces of the hole
    plug_h = 0.85
    # top plug just under top face, bottom under bottom face
    top_plug_z = stack_half - plug_h
    bot_plug_z = -stack_half
    parts.append(
        ("Cell_ZrO2_Disk_Top", disk(SLEEVE_OD * 0.98, plug_h, top_plug_z), (0.90, 0.88, 0.84))
    )
    parts.append(
        ("Cell_ZrO2_Disk_Bottom", disk(SLEEVE_OD * 0.98, plug_h, bot_plug_z), (0.90, 0.88, 0.84))
    )

    # Furnace fills sleeve ID over the middle span (between plugs)
    furn_h = stack_h - 2 * plug_h - 0.15
    parts.append(("Cell_Furnace_LaCrO3", stepped_furnace(furn_h), (0.22, 0.20, 0.18)))

    # Spacers inside furnace around sample
    sp_h = 0.50
    parts.append(
        ("Cell_Spacer_Top", disk(1.08, sp_h, sample_top + 0.05), (0.78, 0.72, 0.62))
    )
    parts.append(
        (
            "Cell_Spacer_Bottom",
            disk(1.08, sp_h, sample_z0 - sp_h - 0.05),
            (0.78, 0.72, 0.62),
        )
    )

    parts.append(("Cell_Capsule", capsule, (0.75, 0.78, 0.82)))
    parts.append(("Cell_Sample", sample, (0.18, 0.75, 0.35)))

    # Electrodes at both ends of the hole (near faces) — fill remaining face openings
    e_h = 0.40
    e_r = BORE_R * 0.92
    parts.append(
        (
            "Cell_Electrode_Top",
            disk(e_r, e_h, face_h - e_h - 0.02).fuse(
                Part.makeCylinder(
                    0.50, 0.9, Vector(0, 0, face_h - e_h - 0.85), Vector(0, 0, 1)
                )
            ),
            (0.55, 0.50, 0.35),
        )
    )
    parts.append(
        (
            "Cell_Electrode_Bottom",
            disk(e_r, e_h, -face_h + 0.02).fuse(
                Part.makeCylinder(
                    0.50, 0.9, Vector(0, 0, -face_h + e_h), Vector(0, 0, 1)
                )
            ),
            (0.55, 0.50, 0.35),
        )
    )

    # TC: in open surface grooves → straight into sample
    tc = make_tc_wires(mid_r, BORE_R, face_h, sample_top, sample_z0)
    parts.append(("Cell_Thermocouple", tc, (0.92, 0.72, 0.12)))

    for name, shape, rgb in parts:
        obj = doc.addObject("Part::Feature", name)
        obj.Shape = shape
        try:
            if obj.ViewObject:
                obj.ViewObject.ShapeColor = rgb
        except Exception:
            pass
        shape.exportStep(os.path.join(EXPORT, "parts", f"{name}.step"))
        defl = 0.035 if ("MgO" in name or "Thermo" in name or "Sample" in name) else 0.07
        export_stl(shape, os.path.join(EXPORT, "parts_stl", f"{name}.stl"), defl=defl)
        print(f"  + {name:28s} V={shape.Volume:8.2f}")

    doc.recompute()
    fcstd = os.path.join(EXPORT, "Cell_14_8.FCStd")
    doc.saveAs(fcstd)
    print("Saved", fcstd)

    compound = Part.makeCompound([p[1] for p in parts])
    compound.exportStep(os.path.join(EXPORT, "Cell_14_8.step"))
    export_stl(compound, os.path.join(EXPORT, "Cell_14_8.stl"), 0.08)
    mgo.exportStep(os.path.join(EXPORT, "MgO_FaceBore_ONLY.step"))
    export_stl(mgo, os.path.join(EXPORT, "MgO_FaceBore_ONLY.stl"), 0.04)

    if os.path.isdir(WEB):
        shutil.rmtree(WEB)
    shutil.copytree(EXPORT, WEB)

    ver = str(int(time.time()))
    man_parts = []
    for name, shape, rgb in parts:
        if "MgO" in name:
            group, layer = "cell_mgo", 0
        elif "ZrO2" in name:
            group, layer = "cell_insulator", 1
        elif "Furnace" in name:
            group, layer = "cell_furnace", 2
        elif "Spacer" in name:
            group, layer = "cell_spacer", 3
        elif "Sample" in name or "Capsule" in name:
            group, layer = "cell_sample", 3
        elif "Electrode" in name:
            group, layer = "cell_electrode", 3
        else:
            group, layer = "cell_tc", 4
        thrust = (
            [0, 0, 1]
            if "Top" in name
            else [0, 0, -1]
            if "Bottom" in name
            else [0.35, 0.2, 0.25]
            if "Thermo" in name
            else [0, 0, 0]
        )
        man_parts.append(
            {
                "id": name,
                "group": group,
                "layer": layer,
                "thrust": thrust,
                "stl": f"cell_14_8/parts_stl/{name}.stl?v={ver}",
                "color": list(rgb),
                "volume_mm3": float(shape.Volume),
            }
        )
    man = {
        "units": "mm",
        "scale_to_scene": 0.09,
        "version": ver,
        "press_axis": [0, 0, 1],
        "cell": "14/8 filled bore + surface TC grooves at two corners",
        "parameters": {
            "face_h": face_h,
            "stack_h": stack_h,
            "bore_r": BORE_R,
            "sleeve_od": SLEEVE_OD,
            "tc_groove_d": TC_GROOVE_D,
        },
        "parts": man_parts,
    }
    with open(os.path.join(EXPORT, "manifest.json"), "w") as f:
        json.dump(man, f, indent=2)
    with open(os.path.join(ROOT, "public", "cad", "cell_manifest.json"), "w") as f:
        json.dump(man, f, indent=2)

    print("DONE ver=", ver)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
