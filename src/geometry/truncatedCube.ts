import * as THREE from 'three';

/**
 * Cube of edge `size` with the (+,+,+) corner truncated by a plane.
 * Truncation forms one equilateral triangular face of the octahedral cavity.
 */
export function createTruncatedCubeGeometry(
  size = 1,
  truncation = 0.28,
): THREE.BufferGeometry {
  const h = size / 2;
  // Plane x+y+z = cut; larger cut → smaller triangle (less truncation)
  const cut = 3 * h - truncation * Math.sqrt(3);

  const corners: [number, number, number][] = [
    [-h, -h, -h],
    [h, -h, -h],
    [h, h, -h],
    [-h, h, -h],
    [-h, -h, h],
    [h, -h, h],
    [h, h, h],
    [-h, h, h],
  ];

  // Intersections on edges from corner 6 (+++ ) to neighbors 2,5,7
  const p62 = planeEdgeIntersect(corners[6], corners[2], cut);
  const p65 = planeEdgeIntersect(corners[6], corners[5], cut);
  const p67 = planeEdgeIntersect(corners[6], corners[7], cut);

  const verts: THREE.Vector3[] = [];
  const idxMap = new Map<number, number>();
  for (let i = 0; i < 8; i++) {
    if (i === 6) continue;
    idxMap.set(i, verts.length);
    verts.push(new THREE.Vector3(...corners[i]));
  }
  const i62 = verts.length;
  verts.push(p62);
  const i65 = verts.length;
  verts.push(p65);
  const i67 = verts.length;
  verts.push(p67);

  const faces: number[][] = [
    // Outer cube faces (some become pentagons after cut)
    [idxMap.get(0)!, idxMap.get(1)!, idxMap.get(2)!, idxMap.get(3)!],
    [idxMap.get(4)!, idxMap.get(7)!, i67, i65],
    [idxMap.get(0)!, idxMap.get(4)!, idxMap.get(5)!, idxMap.get(1)!],
    [idxMap.get(3)!, idxMap.get(2)!, i62, i67],
    [idxMap.get(0)!, idxMap.get(3)!, idxMap.get(7)!, idxMap.get(4)!],
    [idxMap.get(1)!, idxMap.get(5)!, i65, i62],
    // Truncation triangle (cavity face)
    [i62, i65, i67],
  ];

  return polyhedronToBufferGeometry(verts, faces);
}

function planeEdgeIntersect(
  a: [number, number, number],
  b: [number, number, number],
  cut: number,
): THREE.Vector3 {
  const sa = a[0] + a[1] + a[2];
  const sb = b[0] + b[1] + b[2];
  const t = (cut - sa) / (sb - sa + 1e-12);
  return new THREE.Vector3(
    a[0] + t * (b[0] - a[0]),
    a[1] + t * (b[1] - a[1]),
    a[2] + t * (b[2] - a[2]),
  );
}

function polyhedronToBufferGeometry(
  verts: THREE.Vector3[],
  faces: number[][],
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const face of faces) {
    for (let i = 1; i < face.length - 1; i++) {
      const a = verts[face[0]];
      const b = verts[face[i]];
      const c = verts[face[i + 1]];
      const ab = new THREE.Vector3().subVectors(b, a);
      const ac = new THREE.Vector3().subVectors(c, a);
      const n = new THREE.Vector3().crossVectors(ab, ac).normalize();
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      normals.push(n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.computeBoundingSphere();
  return geo;
}

/** Regular octahedron with mid-radius (vertex along ±X,±Y,±Z at distance r). */
export function createRegularOctahedron(midRadius: number): THREE.BufferGeometry {
  const r = midRadius;
  const vertices = new Float32Array([
    r, 0, 0, -r, 0, 0, 0, r, 0, 0, -r, 0, 0, 0, r, 0, 0, -r,
  ]);
  const indices = [
    0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 4, 2, 1, 3, 4, 1, 5, 3, 1, 2, 5,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Pyrophyllite / gasket strip between WC cubes (thin rectangular bar). */
export function createGasketBar(length: number, width: number, thick: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(length, width, thick);
}
