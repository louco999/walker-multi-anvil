# Walker-type Module — FreeCAD CAD (14/8-class)

## Build

```bash
./cad/scripts/run_build.sh
# or
/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd -c \
  "import runpy; runpy.run_path('cad/scripts/build_walker_module.py', run_name='__main__')"
```

## Outputs (`cad/exports/`)

| File | Description |
|------|-------------|
| `WalkerTypeModule.FCStd` | FreeCAD document |
| `WalkerTypeModule.step` | Full assembly STEP |
| `WalkerTypeModule.stl` | Full mesh |
| `parts/*.step` | Per-part STEP |
| `parts_stl/*.stl` | Per-part mesh (web explosion) |
| `manifest.json` | Part list + thrust vectors for web |
| `parameters.txt` | Resolved size chain |

Copied to `public/cad/` for the Vite app.

## Size chain (masters)

| Param | Default | Role |
|-------|---------|------|
| `octa_edge` | 14 mm | MgO edge → 14/8 name |
| `tel` | 8 mm | WC truncation edge |
| `wc_edge` | 26 mm | Second-stage cube |
| `first_stage_radial_depth` | 20 mm | Steel behind pad |
| `hatbox_*` | … | Housing |
| `end_ring_*` | … | Uniaxial load rings |

Rules:

- Press **+Z** = cube **[111]**
- First-stage outer = **true cylinder** about +Z
- Pad plane `n·r = a`
- WC face-mate; overlap checked ≈ 0
- MgO mid-radius from `octa_edge/√2`
- End rings close uniaxial → 3+3 load path

## Web

Default view loads multi-part STL + explosion along `manifest` thrust vectors.
