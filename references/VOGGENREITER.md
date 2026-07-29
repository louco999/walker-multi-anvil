# Learning notes — Max Voggenreiter GmbH (official)

Source: https://www.voggenreiter-gmbh.de

## Product architecture

| Layer | Product name | Role |
|-------|----------------|------|
| Press | **mavo press LP / LPR / LPO…** | Uniaxial hydraulic press (load frame + ram) |
| Tool | **Walker-type Modul** | Removable multi-anvil tool sitting between platens |
| Sample | Kawai 6/8 cell | 6 first-stage steel anvils + 8 WC cubes + MgO octahedron |

Walker-type is a **tool (Werkzeug)**, not the whole machine. Official claim:
- Up to **25 GPa**, **2500 °C** in sample (red region in product fig.)
- Modern load capacity up to **10 MN** (Bayreuth 8 MN → LMU/Voggenreiter 10 MN, 1999 design still used)
- Tool mass class ~**2.5 t** (stated for related large multi-anvil tools)

## Press models relevant to Walker

### mavo press LP 1000-540/50 (canonical 4-column)
- **10 MN** multi-anvil press **with Walker-type module**
- **Säulenbauweise** = four prestressed columns (better access)
- **Oberkolbenpresse**: working cylinder bolted to **top plate**, rod points **down**
- Stroke **50 mm**
- Max oil **700 bar** → 10 MN
- Siemens S7 + RS-232, servo high-pressure control
- Product look: **orange MAVOPRESS upper cylinder**, white columns, stainless table, grey cabinet

### mavo press LPR 1000-400/50
- Same 10 MN / Walker-compatible
- **Rahmenbauweise** = closed frame (lighter, cheaper, less access)

### mavo press LPO 2000-1000/200
- 20 MN, 200 mm stroke, 4 columns + tool shuttle

### mavo press LPQ6-2400-100
- **Not Walker**: 6 independent rams act **directly** on cubic sample (no Walker friction path)

## Walker-type Modul visual (official photos)

1. Short fat **stainless cylindrical vessel** (hatbox) with cooling ports
2. **Six massive silver first-stage wedges** fill the cylinder (outer cylindrical, inner flat)
3. **Eight black WC cubes** pack into one cube; truncations form octahedral cavity
4. **Small red MgO octahedron** in the cavity (product photo fig. 2 red zone)
5. Top view: hexagonal arrangement of anvils around the cube package

## History (from Voggenreiter copy)
- Walker 1990, Cambridge — defined the tool for large sample volume / moderate cost
- 1998 Bayreuth BGI — improved tool to 8 MN
- 1999 LMU + Voggenreiter — 10 MN design still used today
