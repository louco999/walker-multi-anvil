import * as THREE from 'three';

/**
 * Solid first-stage Walker anvil — fills hatbox bore as one of six Voronoi wedges.
 *
 * Local frame (after orientation so +Z = outward face normal):
 *   +Z = thrust (toward hatbox wall / away from module center)
 *   −Z = toward package (flat pad on WC cube face)
 *   X,Y = pad plane
 *
 * Geometry (matches FreeCAD build_walker_module.make_first_stage_set):
 *   - Inner pad: square of half-width ≈ package half-edge
 *   - Outer face: true cylindrical sector of radius outerR (fills module ID)
 *   - Side walls: open toward neighbors so 3 upper + 3 lower nest 严丝合缝
 *     (outer half-angle ≈ 45°+ in pad plane maps to cube-face Voronoi)
 */
export function createSolidFirstStageAnvil(opts: {
  padHalf: number;
  depth: number;
  outerR: number;
  halfH: number;
  /**
   * Half angular width of outer cylindrical arc (rad).
   * For 6 cube-face wedges on a cylinder, neighbors meet near ±π/4 in the
   * face-tangent plane after [111] tilt — use ~0.55–0.65 rad so closed pack
   * reads solid; slight underlap avoids z-fight.
   */
  halfArc: number;
  segments?: number;
  /** Shrink outer arc slightly for kerf between neighbors (scene units). */
  kerf?: number;
}): THREE.BufferGeometry {
  const {
    padHalf: p,
    depth: d,
    outerR,
    halfH: h,
    halfArc: a,
    segments = 28,
    kerf = 0.008,
  } = opts;

  const pos: number[] = [];
  const nrm: number[] = [];

  const tri = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
  ) => {
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1;
    nx /= L; ny /= L; nz /= L;
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
  };

  /**
   * Outer arc on cylinder of radius outerR.
   * Local anvil sits with pad at z=0 and outer near z=d; we place the
   * cylindrical face in the plane of thrust by mapping:
   *   θ along local X, bulge into +Z, so six wedges line the bore when
   *   each is oriented with +Z = face normal.
   *
   * For a true cylinder about the *module* press axis the outer points are
   * not a simple local arc — but after placement with face normal, a wide
   * cylindrical sector of radius outerR centered on the module axis is
   * approximated by: outer points at distance outerR from module center,
   * which in local frame (origin on pad, +Z = n) is:
   *   outer = (outerR * sin θ, y, outerR * cos θ - padDist)
   * with padDist ≈ largeCubeHalf. depth d ≈ outerR*cos0 - padDist.
   */
  const padDist = outerR - d; // distance from module center to pad along normal
  const arc = Math.max(0.35, a - kerf / Math.max(outerR, 1e-3));

  const outerXY = (t: number, y: number): [number, number, number] => {
    // t ∈ [-1,1] → θ ∈ [-arc, arc] in the plane perpendicular to local Y… 
    // Use XZ polar about module center projected into anvil local frame:
    // module center is at (0, 0, -padDist) in local coords.
    const th = t * arc;
    const cx = 0;
    const cz = -padDist;
    const x = cx + outerR * Math.sin(th);
    const z = cz + outerR * Math.cos(th);
    return [x, y, z];
  };

  // Outer cylindrical face (fills hatbox ID)
  for (let i = 0; i < segments; i++) {
    const t0 = -1 + (2 * i) / segments;
    const t1 = -1 + (2 * (i + 1)) / segments;
    const [x0, , z0] = outerXY(t0, 0);
    const [x1, , z1] = outerXY(t1, 0);
    tri(x0, -h, z0, x1, -h, z1, x1, h, z1);
    tri(x0, -h, z0, x1, h, z1, x0, h, z0);
  }

  // Inner flat pad (toward WC package)
  const pb = p * 0.97;
  tri(-pb, -pb, 0, -pb, pb, 0, pb, pb, 0);
  tri(-pb, -pb, 0, pb, pb, 0, pb, -pb, 0);

  // Machined pad bevel (photo: slight step)
  const bevel = Math.min(0.02, p * 0.06);
  const pbb = pb - bevel;
  if (pbb > 0.04) {
    tri(-pbb, -pbb, -bevel, pbb, -pbb, -bevel, pbb, pbb, -bevel);
    tri(-pbb, -pbb, -bevel, pbb, pbb, -bevel, -pbb, pbb, -bevel);
  }

  // Top / bottom faces (y = ±h): connect pad edge to outer arc
  // Pad half-extent along X at y=±h follows Voronoi: grows from pad to outer
  for (const y of [h, -h]) {
    const flip = y > 0 ? 1 : -1;
    for (let i = 0; i < segments; i++) {
      const t0 = -1 + (2 * i) / segments;
      const t1 = -1 + (2 * (i + 1)) / segments;
      const [x0, , z0] = outerXY(t0, 0);
      const [x1, , z1] = outerXY(t1, 0);
      // Inner edge of lid: on pad rectangle, X spans ±pb, Z=0
      const ix0 = pb * t0;
      const ix1 = pb * t1;
      if (flip > 0) {
        tri(ix0, y, 0, x0, y, z0, x1, y, z1);
        tri(ix0, y, 0, x1, y, z1, ix1, y, 0);
      } else {
        tri(ix0, y, 0, x1, y, z1, x0, y, z0);
        tri(ix0, y, 0, ix1, y, 0, x1, y, z1);
      }
    }
  }

  // Side walls (t = ±1): pad corner → outer arc ends — neighbors meet here
  for (const t of [-1, 1] as const) {
    const [xo, , zo] = outerXY(t, 0);
    const xi = pb * t;
    if (t < 0) {
      tri(xi, -h, 0, xo, -h, zo, xo, h, zo);
      tri(xi, -h, 0, xo, h, zo, xi, h, 0);
    } else {
      tri(xi, -h, 0, xi, h, 0, xo, h, zo);
      tri(xi, -h, 0, xo, h, zo, xo, -h, zo);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
