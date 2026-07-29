import * as THREE from 'three';

/** Cube [111] body diagonal → press axis +Y (Walker / Kawai convention). */
export function kawaiToWorldQuaternion(): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 1, 1).normalize(),
    new THREE.Vector3(0, 1, 0),
  );
}

/** Six faces of the second-stage cube package (local cube frame). */
export const CUBE_FACE_NORMALS_LOCAL = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

/** Eight corners → WC cube center directions (local cube frame). */
export const CUBE_CORNER_DIRS_LOCAL = [
  new THREE.Vector3(1, 1, 1),
  new THREE.Vector3(1, 1, -1),
  new THREE.Vector3(1, -1, 1),
  new THREE.Vector3(1, -1, -1),
  new THREE.Vector3(-1, 1, 1),
  new THREE.Vector3(-1, 1, -1),
  new THREE.Vector3(-1, -1, 1),
  new THREE.Vector3(-1, -1, -1),
].map((v) => v.clone().normalize());

export interface FirstStageSpec {
  index: number;
  /** World-space face normal (thrust direction, outward from center). */
  normal: THREE.Vector3;
  isUpper: boolean;
  azimuth: number;
}

export function getFirstStageSpecs(): FirstStageSpec[] {
  const q = kawaiToWorldQuaternion();
  return CUBE_FACE_NORMALS_LOCAL.map((nLocal, index) => {
    const normal = nLocal.clone().applyQuaternion(q).normalize();
    return {
      index,
      normal,
      isUpper: normal.y > 0,
      azimuth: Math.atan2(normal.z, normal.x),
    };
  });
}

export function getWcCornerDirsWorld(): THREE.Vector3[] {
  const q = kawaiToWorldQuaternion();
  return CUBE_CORNER_DIRS_LOCAL.map((d) => d.clone().applyQuaternion(q).normalize());
}

/**
 * Visual scale tuned to product-photo silhouette (not a catalog model ID).
 * Units are scene units ≈ relative lab proportions.
 */
export const SCALE = {
  // Walker module (short fat stainless drum)
  hatboxOuterR: 1.08,
  hatboxInnerR: 0.9,
  hatboxH: 1.22,
  hatboxY: 0.12,
  flangeExtra: 0.12,

  // Kawai 8-cube package: large cube half-extent
  largeCubeHalf: 0.34,
  /** Full edge length of one WC cube (= largeCubeHalf). */
  get wcEdge() {
    return this.largeCubeHalf;
  },
  wcTruncation: 0.13,

  // First-stage pad (inner flat face ≈ cube face)
  firstStagePad: 0.62,
  firstStageHalfH: 0.52,

  // MgO octahedron mid-radius (vertex to center along axis)
  octaMidR: 0.16,

  /** Radial depth of first-stage anvil (inner pad → outer arc). */
  get firstStageDepth() {
    return this.hatboxInnerR - this.largeCubeHalf - 0.02;
  },

  /** Distance from module center to WC cube center when closed. */
  get wcClosedDist() {
    return (Math.sqrt(3) / 2) * this.wcEdge;
  },
} as const;
