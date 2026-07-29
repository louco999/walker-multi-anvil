# -*- coding: utf-8 -*-
import math
import os
import sys

import MeshPart
from FreeCAD import Vector

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPTS)

from build_14_8_cell import (  # noqa: E402
    build_cell_parts,
    cell_wc_cavity_transform,
    derived_cell,
    place_cell_in_wc_cavity,
)
from build_walker_module import derived, P, kawai_rotation  # noqa: E402


def main():
    D = derived(P)
    cell_p = derived_cell(
        {"octa_edge": D["octa_edge"], "octa_clearance": D.get("octa_clearance", 0.06)}
    )
    z_rot, sc = cell_wc_cavity_transform(D["d_cut"], cell_p["face_half_h"], 0.02)
    print(f"z_rot={z_rot:.3f} scale={sc:.4f}")

    mgo = None
    for name, sh, rgb, g, l in build_cell_parts(cell_p):
        if "Octahedron" in name:
            mgo = place_cell_in_wc_cavity(sh, z_rot, sc)
            break
    assert mgo is not None

    rot = kawai_rotation()
    plane_d = D["d_cut"] / math.sqrt(3.0)
    mesh = MeshPart.meshFromShape(
        Shape=mgo, LinearDeflection=0.2, AngularDeflection=0.4, Relative=False
    )
    verts = mesh.Topology[0]

    for signs in ((1, 1, 1), (1, 1, -1), (1, -1, 1), (-1, 1, 1)):
        n = rot.multVec(Vector(float(signs[0]), float(signs[1]), float(signs[2])))
        n.normalize()
        mx = max(n.x * v.x + n.y * v.y + n.z * v.z for v in verts)
        print(
            f"  WC{signs} face gap={plane_d - mx:.4f} mm  (max proj={mx:.4f}, plane={plane_d:.4f})"
        )

    bb = mgo.BoundBox
    print(f"cell BB Z=[{bb.ZMin:.3f},{bb.ZMax:.3f}] half≈{(bb.ZMax - bb.ZMin) / 2:.3f}")
    print("OK alignment probe")


if __name__ == "__main__":
    main()
