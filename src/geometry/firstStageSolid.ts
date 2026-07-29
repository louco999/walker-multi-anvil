import * as THREE from 'three';

/**
 * Solid first-stage Walker anvil (Lille / Voggenreiter / Hiroshima photos).
 *
 * Local frame:
 *   +Z = outward thrust (toward hatbox wall)
 *   -Z = toward module center (flat pad against WC package face)
 *   Y  = "height" on the pad
 *   X  = tangential
 *
 * Outer face is a cylindrical sector of radius `outerR` so six anvils
 * nest inside the hatbox ID; inner face is a flat square pad.
 */
export function createSolidFirstStageAnvil(opts: {
  padHalf: number;
  depth: number;
  outerR: number;
  halfH: number;
  /** Half angular width of outer arc (rad). ~52–58° for 3+3 look. */
  halfArc: number;
  segments?: number;
}): THREE.BufferGeometry {
  const { padHalf: p, depth: d, outerR, halfH: h, halfArc: a, segments = 20 } = opts;

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
   * Outer arc in local XZ: lie on cylinder of radius outerR whose axis is
   * world-module axis after orientation. Approximate as:
   *   x = outerR * sin(θ),  z_world_radial maps to local z via placement.
   * Here we build outer face at z ≈ d with cylindrical bulge:
   *   x(θ) = R sin θ,  z(θ) = d + (R - R cos θ) simplified for shallow arc.
   */
  const outerHalfW = Math.max(p * 1.08, outerR * Math.sin(a) * 0.95);

  const outerXZ = (t: number): [number, number] => {
    // t ∈ [-1, 1] → θ ∈ [-a, a]
    const th = t * a;
    const x = outerHalfW * (Math.sin(th) / Math.sin(a || 1e-6));
    // Gentle cylindrical bulge outward
    const z = d + (outerR * 0.04) * (1 - Math.cos(th));
    return [x, z];
  };

  // Outer curved face (normal +Z-ish)
  for (let i = 0; i < segments; i++) {
    const t0 = -1 + (2 * i) / segments;
    const t1 = -1 + (2 * (i + 1)) / segments;
    const [x0, z0] = outerXZ(t0);
    const [x1, z1] = outerXZ(t1);
    tri(x0, -h, z0, x1, -h, z1, x1, h, z1);
    tri(x0, -h, z0, x1, h, z1, x0, h, z0);
  }

  // Inner flat pad (normal −Z, toward sample)
  tri(-p, -h, 0, -p, h, 0, p, h, 0);
  tri(-p, -h, 0, p, h, 0, p, -h, 0);

  // Slight bevel ring on pad (photo: machined step)
  const bevel = 0.018;
  const pb = p - bevel;
  if (pb > 0.05) {
    // raised pad face
    tri(-pb, -pb, -bevel, pb, -pb, -bevel, pb, pb, -bevel);
    tri(-pb, -pb, -bevel, pb, pb, -bevel, -pb, pb, -bevel);
  }

  // Top face y = +h
  for (let i = 0; i < segments; i++) {
    const t0 = -1 + (2 * i) / segments;
    const t1 = -1 + (2 * (i + 1)) / segments;
    const [x0, z0] = outerXZ(t0);
    const [x1, z1] = outerXZ(t1);
    const ix0 = -p + ((t0 + 1) / 2) * (2 * p);
    const ix1 = -p + ((t1 + 1) / 2) * (2 * p);
    tri(ix0, h, 0, x0, h, z0, x1, h, z1);
    tri(ix0, h, 0, x1, h, z1, ix1, h, 0);
  }

  // Bottom face y = −h
  for (let i = 0; i < segments; i++) {
    const t0 = -1 + (2 * i) / segments;
    const t1 = -1 + (2 * (i + 1)) / segments;
    const [x0, z0] = outerXZ(t0);
    const [x1, z1] = outerXZ(t1);
    const ix0 = -p + ((t0 + 1) / 2) * (2 * p);
    const ix1 = -p + ((t1 + 1) / 2) * (2 * p);
    tri(ix0, -h, 0, x1, -h, z1, x0, -h, z0);
    tri(ix0, -h, 0, ix1, -h, 0, x1, -h, z1);
  }

  // Radial side walls
  {
    const [xo, zo] = outerXZ(-1);
    tri(-p, -h, 0, xo, -h, zo, xo, h, zo);
    tri(-p, -h, 0, xo, h, zo, -p, h, 0);
  }
  {
    const [xo, zo] = outerXZ(1);
    tri(p, -h, 0, p, h, 0, xo, h, zo);
    tri(p, -h, 0, xo, h, zo, xo, -h, zo);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
