#!/usr/bin/env python3
"""
Pure-Python Walker module mesh (closed size chain, no FreeCAD required).

Physical rules enforced:
1. Size chain closed from wc_edge + TEL + radial depth.
2. First-stage outer face = true cylinder about press Z.
3. First-stage pad coplanar with WC package face (n·r = a).
4. 8 WC cubes face-mate; truncated by TEL plane; full orientation fixed.
5. MgO octahedron mid-radius from TEL (d_cut = TEL/√2).

Exports binary STL. FreeCAD script produces true B-rep STEP when available.
"""

from __future__ import annotations

import math
import os
import struct
from dataclasses import dataclass, field

# Master parameters (mm) — keep in sync with build_walker_module.py
WC_EDGE = 32.0
TEL = 8.0
HATBOX_CLEARANCE = 1.5
HATBOX_WALL = 18.0
HATBOX_HEIGHT = 110.0
FLANGE_EXTRA = 12.0
FLANGE_THICK = 10.0
FURNACE_BORE_R = 4.5
FURNACE_CLEARANCE = 0.15
FIRST_STAGE_RADIAL_DEPTH = 22.0
KERF = 0.3
CYL_SEGS = 48


def kawai_matrix():
    """Rotation matrix: cube [111] → +Z."""
    inv_s3 = 1.0 / math.sqrt(3.0)
    ux, uy, uz = inv_s3, inv_s3, inv_s3
    vx, vy, vz = 0.0, 0.0, 1.0
    ax = uy * vz - uz * vy
    ay = uz * vx - ux * vz
    az = ux * vy - uy * vx
    alen = math.hypot(ax, ay, az)
    if alen < 1e-12:
        return ((1, 0, 0), (0, 1, 0), (0, 0, 1))
    ax, ay, az = ax / alen, ay / alen, az / alen
    c = max(-1.0, min(1.0, ux * vx + uy * vy + uz * vz))
    s = math.sqrt(max(0.0, 1.0 - c * c))
    # K = [a]_x
    K = ((0, -az, ay), (az, 0, -ax), (-ay, ax, 0))
    K2 = matmul(K, K)
    R = [[0.0] * 3 for _ in range(3)]
    for i in range(3):
        for j in range(3):
            R[i][j] = (1 if i == j else 0) + s * K[i][j] + (1 - c) * K2[i][j]
    return tuple(tuple(row) for row in R)


def matmul(A, B):
    return tuple(
        tuple(sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3))
        for i in range(3)
    )


def mul_vec(R, v):
    return (
        R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2],
        R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2],
        R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2],
    )


def derived():
    a = WC_EDGE
    d_cut = TEL / math.sqrt(2.0)
    octa_mid_r = d_cut * (1.0 - FURNACE_CLEARANCE / max(d_cut, 1e-6))
    R = kawai_matrix()
    rmax = 0.0
    for sx in (-1.0, 1.0):
        for sy in (-1.0, 1.0):
            for sz in (-1.0, 1.0):
                w = mul_vec(R, (sx * a, sy * a, sz * a))
                rmax = max(rmax, math.hypot(w[0], w[1]))
    r_inner = rmax + FIRST_STAGE_RADIAL_DEPTH + HATBOX_CLEARANCE
    r_outer = r_inner + HATBOX_WALL
    return {
        "a": a,
        "d_cut": d_cut,
        "octa_mid_r": octa_mid_r,
        "r_pkg_xy": rmax,
        "r_inner": r_inner,
        "r_outer": r_outer,
        "hatbox_h": HATBOX_HEIGHT,
        "R": R,
    }


@dataclass
class Mesh:
    tris: list = field(default_factory=list)

    def extend(self, other: "Mesh"):
        self.tris.extend(other.tris)

    def transform(self, R) -> "Mesh":
        self.tris = [
            (mul_vec(R, a), mul_vec(R, b), mul_vec(R, c)) for a, b, c in self.tris
        ]
        return self

    def translate(self, t) -> "Mesh":
        tx, ty, tz = t
        self.tris = [
            (
                (a[0] + tx, a[1] + ty, a[2] + tz),
                (b[0] + tx, b[1] + ty, b[2] + tz),
                (c[0] + tx, c[1] + ty, c[2] + tz),
            )
            for a, b, c in self.tris
        ]
        return self


def add_quad(tris, a, b, c, d):
    tris.append((a, b, c))
    tris.append((a, c, d))


def cylinder_shell_mesh(r_out, r_in, h, segs=72) -> Mesh:
    tris = []
    z0, z1 = -h / 2, h / 2
    for i in range(segs):
        t0 = 2 * math.pi * i / segs
        t1 = 2 * math.pi * (i + 1) / segs
        c0, s0 = math.cos(t0), math.sin(t0)
        c1, s1 = math.cos(t1), math.sin(t1)
        o00 = (r_out * c0, r_out * s0, z0)
        o10 = (r_out * c1, r_out * s1, z0)
        o01 = (r_out * c0, r_out * s0, z1)
        o11 = (r_out * c1, r_out * s1, z1)
        add_quad(tris, o00, o10, o11, o01)
        i00 = (r_in * c0, r_in * s0, z0)
        i10 = (r_in * c1, r_in * s1, z0)
        i01 = (r_in * c0, r_in * s0, z1)
        i11 = (r_in * c1, r_in * s1, z1)
        add_quad(tris, i00, i01, i11, i10)
        add_quad(tris, o01, o11, i11, i01)
        add_quad(tris, o00, i00, i10, o10)
    return Mesh(tris)


def octahedron_mesh(r) -> Mesh:
    v = [
        (r, 0, 0),
        (-r, 0, 0),
        (0, r, 0),
        (0, -r, 0),
        (0, 0, r),
        (0, 0, -r),
    ]
    faces = [
        (0, 2, 4),
        (0, 4, 3),
        (0, 3, 5),
        (0, 5, 2),
        (1, 4, 2),
        (1, 3, 4),
        (1, 5, 3),
        (1, 2, 5),
    ]
    return Mesh([(v[i], v[j], v[k]) for i, j, k in faces])


def truncated_cube_octant(a, d, sx, sy, sz) -> Mesh:
    """WC cube in octant, origin-corner truncated by sx*x+sy*y+sz*z = d."""
    xs = [0.0, a] if sx > 0 else [-a, 0.0]
    ys = [0.0, a] if sy > 0 else [-a, 0.0]
    zs = [0.0, a] if sz > 0 else [-a, 0.0]
    corners = [(x, y, z) for x in xs for y in ys for z in zs]

    def pval(p):
        return sx * p[0] + sy * p[1] + sz * p[2]

    kept = [p for p in corners if pval(p) >= d - 1e-9]
    intercepts = [(sx * d, 0.0, 0.0), (0.0, sy * d, 0.0), (0.0, 0.0, sz * d)]
    pts = kept + intercepts
    return convex_hull_mesh(pts)


def convex_hull_mesh(points) -> Mesh:
    pts = list(points)
    n = len(pts)
    if n < 4:
        return Mesh([])
    tris = []
    for i in range(n):
        for j in range(i + 1, n):
            for k in range(j + 1, n):
                a, b, c = pts[i], pts[j], pts[k]
                ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
                vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
                nx = uy * vz - uz * vy
                ny = uz * vx - ux * vz
                nz = ux * vy - uy * vx
                ln = math.hypot(nx, ny, nz)
                if ln < 1e-12:
                    continue
                nx, ny, nz = nx / ln, ny / ln, nz / ln
                d0 = nx * a[0] + ny * a[1] + nz * a[2]
                pos = neg = 0
                for p in pts:
                    s = nx * p[0] + ny * p[1] + nz * p[2] - d0
                    if s > 1e-6:
                        pos += 1
                    elif s < -1e-6:
                        neg += 1
                if pos == 0 or neg == 0:
                    cx = sum(p[0] for p in pts) / n
                    cy = sum(p[1] for p in pts) / n
                    cz = sum(p[2] for p in pts) / n
                    if nx * (cx - a[0]) + ny * (cy - a[1]) + nz * (cz - a[2]) > 0:
                        tris.append((a, c, b))
                    else:
                        tris.append((a, b, c))
    return Mesh(tris)


def first_stage_anvil_press_frame(n_press, a, r_inner, h, segs=CYL_SEGS) -> Mesh:
    """
    First-stage solid in PRESS frame:
      - Pad plane: n·r = a  (cube face, rotation preserves n·r)
      - Outer: cylinder x²+y² = r_inner²
      - Side walls: Voronoi vs other face normals approximated by
        ± half-width on the pad tangent plane spanning the face.

    Mesh construction:
      Sample pad square (size ~2a) on plane n·r=a, ray outward in n direction
      until cylinder, build side quads. Outer surface = cylinder patches
      where the pad rays hit.
    """
    nx, ny, nz = n_press
    # Orthonormal basis: n, u, v
    tmp = (0.0, 1.0, 0.0) if abs(nz) < 0.9 else (1.0, 0.0, 0.0)
    ux = ny * tmp[2] - nz * tmp[1]
    uy = nz * tmp[0] - nx * tmp[2]
    uz = nx * tmp[1] - ny * tmp[0]
    ul = math.hypot(ux, uy, uz) or 1.0
    ux, uy, uz = ux / ul, uy / ul, uz / ul
    vx = ny * uz - nz * uy
    vy = nz * ux - nx * uz
    vz = nx * uy - ny * ux

    half = a - KERF * 0.5
    # Sample pad grid
    nu, nv = 8, 8
    # For each pad point p = a*n + s*u + t*v, find outer point on cylinder
    # along direction that stays in the radial plane... 
    # Physical outer is cylinder; material fills from pad to cylinder along
    # directions that keep n·r >= a and inside face Voronoi.
    # Approximate: extrude each pad point along n until outside cylinder,
    # then project outward point onto cylinder along XY radial.
    
    def pad_pt(su, sv):
        return (
            a * nx + su * ux + sv * vx,
            a * ny + su * uy + sv * vy,
            a * nz + su * uz + sv * vz,
        )

    def to_cylinder(p):
        """Move from pad point outward (increasing n·r) until on cylinder."""
        # Parametric: p + λ n, choose λ >= 0 so (x+λ nx)²+(y+λ ny)² = r²
        # and prefer the larger λ (outer).
        px, py, pz = p
        # Quadratic: |p_xy + λ n_xy|² = r²
        A = nx * nx + ny * ny
        B = 2 * (px * nx + py * ny)
        C = px * px + py * py - r_inner * r_inner
        if A < 1e-12:
            # n nearly along Z: extrude in XY radial from pad
            rr = math.hypot(px, py)
            if rr < 1e-9:
                return (r_inner, 0.0, pz)
            s = r_inner / rr
            return (px * s, py * s, pz)
        disc = B * B - 4 * A * C
        if disc < 0:
            # already outside or no hit — project XY to cylinder
            rr = math.hypot(px, py)
            if rr < 1e-9:
                return (r_inner * abs(nx) or r_inner, r_inner * abs(ny), pz)
            s = r_inner / max(rr, 1e-9)
            return (px * s, py * s, pz + max(0.0, (a + 5) * nz))
        sqrt_d = math.sqrt(disc)
        l1 = (-B + sqrt_d) / (2 * A)
        l2 = (-B - sqrt_d) / (2 * A)
        # choose max λ >= 0 that keeps us outside package
        cands = [l for l in (l1, l2) if l >= -1e-6]
        if not cands:
            l = max(l1, l2)
        else:
            l = max(cands)
        return (px + l * nx, py + l * ny, pz + l * nz)

    # Build grid of pad and outer points
    pad_grid = []
    out_grid = []
    for i in range(nu + 1):
        su = -half + 2 * half * i / nu
        row_p, row_o = [], []
        for j in range(nv + 1):
            sv = -half + 2 * half * j / nv
            p = pad_pt(su, sv)
            o = to_cylinder(p)
            row_p.append(p)
            row_o.append(o)
        pad_grid.append(row_p)
        out_grid.append(row_o)

    tris = []
    # Pad face (inward normal -n): reverse winding
    for i in range(nu):
        for j in range(nv):
            p00 = pad_grid[i][j]
            p10 = pad_grid[i + 1][j]
            p11 = pad_grid[i + 1][j + 1]
            p01 = pad_grid[i][j + 1]
            add_quad(tris, p00, p01, p11, p10)

    # Outer cylindrical-ish face
    for i in range(nu):
        for j in range(nv):
            o00 = out_grid[i][j]
            o10 = out_grid[i + 1][j]
            o11 = out_grid[i + 1][j + 1]
            o01 = out_grid[i][j + 1]
            add_quad(tris, o00, o10, o11, o01)

    # Side walls (boundary of pad square)
    def wall(pa, pb, oa, ob):
        add_quad(tris, pa, pb, ob, oa)

    # j=0 edge
    for i in range(nu):
        wall(pad_grid[i][0], pad_grid[i + 1][0], out_grid[i][0], out_grid[i + 1][0])
    # j=nv edge
    for i in range(nu):
        wall(pad_grid[i + 1][nv], pad_grid[i][nv], out_grid[i + 1][nv], out_grid[i][nv])
    # i=0 edge
    for j in range(nv):
        wall(pad_grid[0][j + 1], pad_grid[0][j], out_grid[0][j + 1], out_grid[0][j])
    # i=nu edge
    for j in range(nv):
        wall(pad_grid[nu][j], pad_grid[nu][j + 1], out_grid[nu][j], out_grid[nu][j + 1])

    # Clip height to hatbox
    zlim = h * 0.49
    filtered = []
    for a, b, c in tris:
        cz = (a[2] + b[2] + c[2]) / 3
        if abs(cz) <= zlim + r_inner * 0.5:
            filtered.append((a, b, c))
    return Mesh(filtered)


def write_binary_stl(path: str, meshes: list[tuple[str, Mesh]]):
    tris = []
    for _, m in meshes:
        tris.extend(m.tris)
    with open(path, "wb") as f:
        header = b"WalkerTypeModule pure-python closed-chain"
        f.write(header + b"\0" * (80 - len(header)))
        f.write(struct.pack("<I", len(tris)))
        for a, b, c in tris:
            ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
            vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
            nx = uy * vz - uz * vy
            ny = uz * vx - ux * vz
            nz = ux * vy - uy * vx
            L = math.hypot(nx, ny, nz) or 1.0
            f.write(struct.pack("<3f", nx / L, ny / L, nz / L))
            f.write(struct.pack("<3f", *a))
            f.write(struct.pack("<3f", *b))
            f.write(struct.pack("<3f", *c))
            f.write(struct.pack("<H", 0))
    print(f"Wrote {path}  ({len(tris)} triangles)")


def build():
    D = derived()
    R = D["R"]
    a = D["a"]
    d = D["d_cut"]
    print("=== Pure-Python Walker mesh (mm) ===")
    for k in ("a", "d_cut", "octa_mid_r", "r_pkg_xy", "r_inner", "r_outer"):
        print(f"  {k:16s} = {D[k]:.4f}")

    parts: list[tuple[str, Mesh]] = []

    # 8 WC cubes
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                mesh = truncated_cube_octant(a, d, sx, sy, sz)
                mesh.transform(R)
                signs = f"{'+' if sx > 0 else '-'}{'+' if sy > 0 else '-'}{'+' if sz > 0 else '-'}"
                parts.append((f"WC_{signs}", mesh))

    # 6 first-stage (built directly in press frame — true cylinder)
    face_normals_cube = {
        "+X": (1.0, 0.0, 0.0),
        "-X": (-1.0, 0.0, 0.0),
        "+Y": (0.0, 1.0, 0.0),
        "-Y": (0.0, -1.0, 0.0),
        "+Z": (0.0, 0.0, 1.0),
        "-Z": (0.0, 0.0, -1.0),
    }
    for name, n_c in face_normals_cube.items():
        n_p = mul_vec(R, n_c)
        # normalize
        L = math.hypot(*n_p) or 1.0
        n_p = (n_p[0] / L, n_p[1] / L, n_p[2] / L)
        m = first_stage_anvil_press_frame(
            n_p, a, D["r_inner"], D["hatbox_h"], segs=CYL_SEGS
        )
        parts.append((f"FirstStage_{name}", m))

    # MgO
    octa = octahedron_mesh(D["octa_mid_r"])
    octa.transform(R)
    parts.append(("MgO_Octahedron", octa))

    # Hatbox
    hat = cylinder_shell_mesh(D["r_outer"], D["r_inner"], D["hatbox_h"], segs=72)
    flange = cylinder_shell_mesh(
        D["r_outer"] + FLANGE_EXTRA, D["r_inner"], FLANGE_THICK, segs=72
    )
    flange.translate((0, 0, D["hatbox_h"] / 2 - FLANGE_THICK * 0.3))
    hat.extend(flange)
    parts.append(("Hatbox", hat))

    # Furnace
    furn = cylinder_shell_mesh(
        FURNACE_BORE_R * 0.95,
        FURNACE_BORE_R * 0.65,
        D["octa_mid_r"] * 1.6,
        segs=24,
    )
    parts.append(("FurnaceSample", furn))

    here = os.path.dirname(os.path.abspath(__file__))
    export_dir = os.path.normpath(os.path.join(here, "..", "exports"))
    os.makedirs(export_dir, exist_ok=True)
    out = os.path.join(export_dir, "WalkerTypeModule_pure.stl")
    write_binary_stl(out, parts)

    pdir = os.path.join(export_dir, "parts_stl")
    os.makedirs(pdir, exist_ok=True)
    for name, mesh in parts:
        write_binary_stl(os.path.join(pdir, f"{name}.stl"), [(name, mesh)])

    # Also copy to web public for viewer
    web_public = os.path.normpath(os.path.join(here, "..", "..", "public", "cad"))
    os.makedirs(web_public, exist_ok=True)
    web_stl = os.path.join(web_public, "WalkerTypeModule.stl")
    write_binary_stl(web_stl, parts)

    report = os.path.join(export_dir, "parameters_pure.txt")
    with open(report, "w", encoding="utf-8") as f:
        f.write("Walker pure-python mesh — closed size chain\n")
        f.write("=" * 50 + "\n")
        for k, v in D.items():
            if k == "R":
                continue
            f.write(f"{k} = {v}\n")
        f.write("\nRules:\n")
        f.write("- press axis +Z = cube [111]\n")
        f.write("- d_cut = TEL/sqrt(2); octa_mid_r ≈ d_cut\n")
        f.write("- first-stage outer = cylinder r_inner about +Z\n")
        f.write("- pad plane n·r = a (package face)\n")
    print(f"Parameters: {report}")
    print(f"Web copy:   {web_stl}")
    return D


if __name__ == "__main__":
    build()
