# -*- coding: utf-8 -*-
"""
Voggenreiter mavo press LP 1000-style 4-column press.

Official LP 1000-540/50 (downstroke):
  - Working cylinder bolted to the HEAD PLATE, piston pointing DOWN
  - Orange hydraulic body sits UNDER / into the top cross-head
  - Four white columns tied by a multi-layer top head:
      main beam + upper crown + front brand plate + two pressure gauges
  - SS tooling hangs under the orange ram onto the Walker module
  - Control cabinet BESIDE the press (right of table, not on table)
  - Gray floor pedestal under the table (LP photo A-frame base with pockets)
  - No spare module on the table

Units: mm. Axis +Z up. Front face ≈ −Y (viewer).
"""
from __future__ import annotations

from FreeCAD import Vector
import Part


def cyl(r, h, z0, x=0.0, y=0.0):
    return Part.makeCylinder(r, h, Vector(x, y, z0), Vector(0, 0, 1))


def box(x0, y0, z0, dx, dy, dz):
    return Part.makeBox(dx, dy, dz, Vector(x0, y0, z0))


def build_press_parts(module_r_outer: float = 80.0, module_h: float = 128.0):
    C_BASE = (0.42, 0.44, 0.46)  # light gray head (photo)
    C_BASE_DK = (0.28, 0.30, 0.32)
    C_SS = (0.84, 0.87, 0.90)
    C_SS_MID = (0.68, 0.72, 0.76)
    C_SS_DK = (0.50, 0.54, 0.58)
    C_WHITE = (0.96, 0.97, 0.98)
    C_HEAD = (0.78, 0.80, 0.82)  # main cross-head gray
    C_HEAD_TOP = (0.90, 0.91, 0.92)  # lighter crown
    C_CHROME = (0.80, 0.83, 0.87)
    C_ORANGE = (0.93, 0.40, 0.05)
    C_ORANGE_DK = (0.74, 0.30, 0.03)
    C_CAB = (0.88, 0.90, 0.92)
    C_BLACK = (0.06, 0.06, 0.06)
    C_RED = (0.82, 0.05, 0.05)
    C_GAUGE = (0.55, 0.58, 0.60)

    D = 2.0 * module_r_outer  # module outer diameter (~160 mm for r≈80)
    Hm = module_h

    # --- column layout: taller/slimmer LP-style silhouette ---
    # Old values (too squat / fat): pitch ~1.7D, col_r=0.26D, wide table
    # Real LP-class: slender white columns, tighter around tool module
    col_pitch_x = 1.38 * D
    col_pitch_y = 1.28 * D
    hx, hy = col_pitch_x / 2.0, col_pitch_y / 2.0
    col_r = 0.135 * D  # was 0.26D — columns were nearly fat poles
    col_xy = [(-hx, -hy), (hx, -hy), (-hx, hy), (hx, hy)]

    table_t = 0.14 * D
    table_z = 0.0
    pedestal_h = 0.78 * D  # was 1.20D — pedestal looked too chunky
    foot_h = 0.10 * D
    # floor = bottom of foot under pedestal
    floor_z = table_z - table_t - pedestal_h - foot_h

    # lower platen on table
    lower_h = 0.14 * D
    lower_r = 0.58 * D
    module_bottom_z = table_z + lower_h
    module_top_z = module_bottom_z + Hm
    module_center_z = 0.5 * (module_bottom_z + module_top_z)

    # ----- stack under head (slightly taller daylight) -----
    u_in_r, u_in_h = 0.42 * D, 0.16 * D
    u_ch_r, u_ch_h = 0.36 * D, 0.36 * D
    u_pl_r, u_pl_h = 0.48 * D, 0.11 * D
    z_u0 = module_top_z
    z_u1 = z_u0 + u_in_h
    z_u2 = z_u1 + u_ch_h
    z_tool_top = z_u2 + u_pl_h

    # Orange ram — taller cylinder, smaller radius
    ram_r = 0.38 * D
    ram_h = 0.95 * D
    ram_z0 = z_tool_top - 0.03 * D
    ram_top = ram_z0 + ram_h

    # ========== MULTI-LAYER TOP HEAD ==========
    # Photo: thick gray beam + lighter upper crown + front brand + 2 gauges
    head_h = 0.28 * D  # was 0.38D
    head_overlap = 0.10 * D
    head_z0 = ram_top - head_overlap
    head_top = head_z0 + head_h
    head_margin = 0.14 * D
    head_dx = col_pitch_x + 2 * col_r + head_margin
    head_dy = col_pitch_y + 2 * col_r + head_margin

    # upper crown / instrument housing
    crown_h = 0.20 * D
    crown_dx = head_dx * 0.90
    crown_dy = head_dy * 0.86
    crown_z0 = head_top
    crown_top = crown_z0 + crown_h

    # Columns from near table up through main head
    col_z0 = table_z - table_t - 0.05 * D
    col_top = head_top + 0.02 * D
    col_h = col_top - col_z0

    # Table footprint — tighter to columns (less "fat table")
    tbl_dx = col_pitch_x + 1.05 * D
    tbl_dy = col_pitch_y + 0.72 * D

    parts = []

    # ========== PEDESTAL / 机座 (LP photo: gray A-frame with pockets) ==========
    ped_z0 = table_z - table_t - pedestal_h
    ped = box(
        -tbl_dx * 0.34,
        -tbl_dy * 0.34,
        ped_z0,
        tbl_dx * 0.68,
        tbl_dy * 0.68,
        pedestal_h,
    )
    for sx in (-1.0, 1.0):
        for sy in (-1.0, 1.0):
            pocket = box(
                sx * tbl_dx * 0.12 - 0.14 * D,
                sy * tbl_dy * 0.12 - 0.13 * D,
                ped_z0 + 0.10 * D,
                0.28 * D,
                0.26 * D,
                pedestal_h * 0.72,
            )
            try:
                ped = ped.cut(pocket)
            except Exception:
                pass
    parts.append(("Press_Pedestal", ped, C_BASE, "press_base", 0, (0, 0, 0)))
    foot = box(
        -tbl_dx * 0.38,
        -tbl_dy * 0.38,
        floor_z,
        tbl_dx * 0.76,
        tbl_dy * 0.76,
        foot_h,
    )
    parts.append(("Press_PedestalFoot", foot, C_BASE_DK, "press_base", 0, (0, 0, 0)))

    # ========== TABLE ==========
    tbl = box(-tbl_dx / 2, -tbl_dy / 2, table_z - table_t, tbl_dx, tbl_dy, table_t)
    parts.append(("Press_WorkTable", tbl, C_SS, "press_table", 0, (0, 0, 0)))
    lip = box(
        -tbl_dx / 2 - 0.02 * D,
        -tbl_dy / 2 - 0.02 * D,
        table_z - table_t - 0.04 * D,
        tbl_dx + 0.04 * D,
        tbl_dy + 0.04 * D,
        0.04 * D,
    )
    parts.append(("Press_TableLip", lip, C_SS_MID, "press_table", 0, (0, 0, 0)))
    for xi in (-0.34, -0.12, 0.12, 0.34):
        for yi in (-0.22, 0.22):
            plug = cyl(0.07 * D, 0.022 * D, table_z - 0.015 * D, xi * col_pitch_x, yi * col_pitch_y)
            parts.append(
                (
                    f"Press_Port_{str(xi).replace('-','m').replace('.','p')}_{str(yi).replace('-','m').replace('.','p')}",
                    plug,
                    C_BASE_DK,
                    "press_table",
                    0,
                    (0, 0, 0),
                )
            )

    # ========== 4 COLUMNS ==========
    for i, (cx, cy) in enumerate(col_xy):
        col = cyl(col_r, col_h, col_z0, cx, cy)
        parts.append((f"Press_Column_{i}", col, C_WHITE, "press_frame", 0, (0, 0, 0)))
        nut = cyl(col_r * 0.70, 0.10 * D, col_top - 0.01 * D, cx, cy)
        parts.append((f"Press_ColumnNut_{i}", nut, C_SS_MID, "press_frame", 0, (0, 0, 0)))
        if cy < 0:
            bar = cyl(0.038 * D, 0.48 * col_h, table_z + 0.40 * D, cx, cy - col_r - 0.06 * D)
            parts.append((f"Press_ChromeBar_{i}", bar, C_CHROME, "press_frame", 0, (0, 0, 0)))
            try:
                hdl = Part.makeTorus(0.11 * D, 0.026 * D)
                hdl.rotate(Vector(0, 0, 0), Vector(1, 0, 0), 90)
                hdl.translate(
                    Vector(
                        cx + (0.18 * D if cx > 0 else -0.18 * D),
                        cy - col_r + 0.02 * D,
                        table_z + 1.55 * D,
                    )
                )
                parts.append((f"Press_Handle_{i}", hdl, C_SS_DK, "press_frame", 0, (0, 0, 0)))
            except Exception:
                pass

    # ========== MAIN CROSS-HEAD BEAM ==========
    head = box(-head_dx / 2, -head_dy / 2, head_z0, head_dx, head_dy, head_h)
    head_bore = cyl(ram_r * 0.95, head_h * 0.50 + 2, head_z0 - 1)
    try:
        head = head.cut(head_bore)
    except Exception:
        pass
    parts.append(("Press_TopCrossHead", head, C_HEAD, "press_frame", 0, (0, 0, 0)))
    # underside boss around ram
    boss = cyl(ram_r + 0.10 * D, head_h * 0.30, head_z0 + head_h * 0.15)
    parts.append(("Press_HeadBoss", boss, C_SS_MID, "press_frame", 0, (0, 0, 0)))
    # side ribs
    for sx in (-1.0, 1.0):
        rib = box(
            sx * (hx - 0.06 * D) - 0.05 * D,
            -hy * 0.80,
            head_z0,
            0.10 * D,
            hy * 1.6,
            head_h * 0.90,
        )
        parts.append((f"Press_HeadRib_X{int(sx)}", rib, C_BASE_DK, "press_frame", 0, (0, 0, 0)))

    # ========== UPPER CROWN (instrument housing — was missing) ==========
    crown = box(-crown_dx / 2, -crown_dy / 2, crown_z0, crown_dx, crown_dy, crown_h)
    parts.append(("Press_HeadCrown", crown, C_HEAD_TOP, "press_frame", 0, (0, 0, 0)))
    # slight top bevel strip
    crown_cap = box(
        -crown_dx * 0.48,
        -crown_dy * 0.48,
        crown_top - 0.03 * D,
        crown_dx * 0.96,
        crown_dy * 0.96,
        0.04 * D,
    )
    parts.append(("Press_HeadCrownCap", crown_cap, C_WHITE, "press_frame", 0, (0, 0, 0)))

    # ========== FRONT FACE + BRAND PLATE (photo: "Voggenreiter") ==========
    # front of head = −Y face
    face_t = 0.04 * D
    face_y0 = -head_dy / 2 - face_t
    face = box(-head_dx * 0.42, face_y0, head_z0 + 0.04 * D, head_dx * 0.84, face_t, head_h * 0.85)
    parts.append(("Press_HeadFront", face, C_HEAD_TOP, "press_frame", 0, (0, 0, 0)))
    # dark brand plaque
    brand = box(
        -0.32 * D,
        face_y0 - 0.015 * D,
        head_z0 + head_h * 0.28,
        0.64 * D,
        0.018 * D,
        0.16 * D,
    )
    parts.append(("Press_BrandPlate", brand, C_BLACK, "press_frame", 0, (0, 0, 0)))

    # ========== TWO PRESSURE GAUGES on crown front (photo signature) ==========
    # disks facing −Y, sitting on top front of crown
    gauge_r = 0.11 * D
    gauge_t = 0.05 * D
    gauge_z = crown_z0 + crown_h * 0.55
    gauge_y = -crown_dy / 2 - gauge_t * 0.3
    for gx, tag in ((-0.20 * D, "L"), (0.20 * D, "R")):
        # body as cylinder along −Y (axis = (0,-1,0))
        g = Part.makeCylinder(
            gauge_r,
            gauge_t,
            Vector(gx, gauge_y, gauge_z),
            Vector(0, -1, 0),
        )
        parts.append((f"Press_Gauge_{tag}", g, C_GAUGE, "press_frame", 0, (0, 0, 0)))
        # face glass / dial
        dial = Part.makeCylinder(
            gauge_r * 0.82,
            0.012 * D,
            Vector(gx, gauge_y - gauge_t + 0.005 * D, gauge_z),
            Vector(0, -1, 0),
        )
        parts.append((f"Press_GaugeDial_{tag}", dial, C_WHITE, "press_frame", 0, (0, 0, 0)))
        # center hub
        hub = Part.makeCylinder(
            gauge_r * 0.12,
            0.016 * D,
            Vector(gx, gauge_y - gauge_t - 0.002 * D, gauge_z),
            Vector(0, -1, 0),
        )
        parts.append((f"Press_GaugeHub_{tag}", hub, C_BLACK, "press_frame", 0, (0, 0, 0)))

    # ========== UPPER TOOLING ==========
    parts.append(("Press_UpperInner", cyl(u_in_r, u_in_h, z_u0), C_SS, "press_platen", 0, (0, 0, 0)))
    parts.append(("Press_UpperChrome", cyl(u_ch_r, u_ch_h, z_u1), C_CHROME, "press_platen", 0, (0, 0, 0)))
    parts.append(("Press_UpperPlate", cyl(u_pl_r, u_pl_h, z_u2), C_SS_MID, "press_platen", 0, (0, 0, 0)))

    # ========== ORANGE RAM ==========
    parts.append(("Press_RamBody", cyl(ram_r, ram_h, ram_z0), C_ORANGE, "press_ram", 0, (0, 0, 0)))
    parts.append(
        (
            "Press_RamBand",
            cyl(ram_r + 0.012 * D, 0.12 * D, ram_z0 + ram_h * 0.42),
            C_ORANGE_DK,
            "press_ram",
            0,
            (0, 0, 0),
        )
    )
    parts.append(
        (
            "Press_RamTop",
            cyl(ram_r * 0.92, 0.06 * D, min(ram_top - 0.04 * D, head_top - 0.02 * D)),
            C_ORANGE_DK,
            "press_ram",
            0,
            (0, 0, 0),
        )
    )
    parts.append(
        (
            "Press_RamFlange",
            cyl(ram_r + 0.05 * D, 0.08 * D, ram_z0 - 0.02 * D),
            C_ORANGE_DK,
            "press_ram",
            0,
            (0, 0, 0),
        )
    )
    plate = box(
        -0.18 * D,
        ram_r - 0.012 * D,
        ram_z0 + ram_h * 0.48,
        0.36 * D,
        0.028 * D,
        0.08 * D,
    )
    parts.append(("Press_RamPlate", plate, C_BLACK, "press_ram", 0, (0, 0, 0)))

    # ========== LOWER PLATEN ==========
    parts.append(("Press_LowerPlaten", cyl(lower_r, lower_h * 0.7, table_z), C_SS_MID, "press_platen", 0, (0, 0, 0)))
    parts.append(
        (
            "Press_LowerSeat",
            cyl(module_r_outer + 0.05 * D, lower_h * 0.3, table_z + lower_h * 0.7),
            C_SS,
            "press_platen",
            0,
            (0, 0, 0),
        )
    )

    # ========== CONTROL CABINET — BESIDE press, RIGHT of table edge ==========
    # stands on floor next to pedestal (not on the table surface)
    cab_w = 0.52 * D  # was 0.70D — cabinet looked oversized
    cab_d = 0.72 * D
    cab_h = crown_top - floor_z  # full height from floor to machine top
    # fully outside right table edge
    cab_x0 = tbl_dx / 2 + 0.06 * D
    cab_y0 = -cab_d * 0.28
    cab = box(cab_x0, cab_y0, floor_z, cab_w, cab_d, cab_h)
    parts.append(("Press_Cabinet", cab, C_CAB, "press_cabinet", 0, (0, 0, 0)))
    # door face toward −X (toward press)
    panel = box(
        cab_x0 - 0.02 * D,
        cab_y0 + 0.06 * D,
        floor_z + 0.25 * D,
        0.025 * D,
        cab_d - 0.12 * D,
        cab_h - 0.50 * D,
    )
    parts.append(("Press_CabinetPanel", panel, C_SS, "press_cabinet", 0, (0, 0, 0)))
    screen = box(
        cab_x0 - 0.03 * D,
        cab_y0 + 0.32 * D,
        floor_z + cab_h - 0.85 * D,
        0.02 * D,
        0.30 * D,
        0.22 * D,
    )
    parts.append(("Press_CabinetScreen", screen, C_BLACK, "press_cabinet", 0, (0, 0, 0)))
    estop = Part.makeCylinder(
        0.065 * D,
        0.09 * D,
        Vector(cab_x0 - 0.04 * D, cab_y0 + 0.68 * D, floor_z + cab_h - 1.20 * D),
        Vector(1, 0, 0),
    )
    parts.append(("Press_EStop", estop, C_RED, "press_cabinet", 0, (0, 0, 0)))
    for i in range(5):
        btn = box(
            cab_x0 - 0.03 * D,
            cab_y0 + 0.28 * D,
            floor_z + 0.90 * D - i * 0.15 * D,
            0.02 * D,
            0.13 * D,
            0.09 * D,
        )
        parts.append((f"Press_Button_{i}", btn, C_BLACK, "press_cabinet", 0, (0, 0, 0)))

    meta = {
        "table_z": table_z,
        "floor_z": floor_z,
        "module_bottom_z": module_bottom_z,
        "module_center_z": module_center_z,
        "module_top_z": module_top_z,
        "col_pitch_x": col_pitch_x,
        "col_pitch_y": col_pitch_y,
        "head_z0": head_z0,
        "head_top": head_top,
        "crown_top": crown_top,
        "ram_top": ram_top,
        "ram_r": ram_r,
        "ram_h": ram_h,
        "D": D,
        "total_h": crown_top - floor_z,
    }
    return parts, meta
