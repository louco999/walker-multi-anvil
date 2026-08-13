import { useMemo } from 'react';
import * as THREE from 'three';
import { InteractivePart } from '../InteractivePart';
import { createSolidFirstStageAnvil } from '../../geometry/firstStageSolid';
import { getFirstStageSpecs, SCALE } from '../../geometry/orientation';
import { steelMaterial } from '../../geometry/materials';
import { layerExplosion, useWalkerStore } from '../../store/useWalkerStore';

/**
 * Six first-stage steel anvils: 3 upper + 3 lower.
 * Outer faces are cylindrical sectors that tile the hatbox ID wall;
 * side faces meet neighbors (cube-face Voronoi) with only a thin kerf.
 */
export function FirstStageAnvils() {
  const explosion = useWalkerStore((s) => s.explosion);
  const cutaway = useWalkerStore((s) => s.cutaway);
  const visible = useWalkerStore((s) => s.layerVisible['first-stage']);
  const e = layerExplosion(explosion, 2);

  const depth = SCALE.firstStageDepth;
  // Pad half-width ≈ package face half-edge so pads seat on WC faces
  const padHalf = SCALE.largeCubeHalf * 0.98;
  // Tall enough to read as filling the module bore (3+3 nest)
  const halfH = SCALE.hatboxH * 0.42;
  // ~36° half-arc → ~72° full; six wedges + kerf fill the bore
  const halfArc = (72 * Math.PI) / 180 / 2;

  const geo = useMemo(
    () =>
      createSolidFirstStageAnvil({
        padHalf,
        depth,
        outerR: SCALE.hatboxInnerR,
        halfH,
        halfArc,
        segments: 32,
        kerf: 0.01,
      }),
    [padHalf, depth, halfH, halfArc],
  );

  const bodyMat = useMemo(
    () =>
      steelMaterial({
        color: '#c4ccd4',
        metalness: 0.88,
        roughness: 0.22,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const specs = useMemo(() => getFirstStageSpecs(), []);
  const y0 = SCALE.hatboxY;

  // Closed: pad plane at largeCubeHalf along face normal
  const closedOffset = SCALE.largeCubeHalf;

  if (!visible) return null;

  return (
    <InteractivePart partId="first-stage">
      {specs.map((spec) => {
        // Cutaway: hide one upper anvil facing camera-ish
        if (cutaway && spec.isUpper && spec.normal.z > 0.4) return null;

        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          spec.normal,
        );

        // Explode outward along true face normal
        const dist = closedOffset + e * 1.55;
        const pos = spec.normal.clone().multiplyScalar(dist);
        pos.y += y0;

        return (
          <group key={spec.index} position={pos.toArray()} quaternion={q}>
            <mesh geometry={geo} material={bodyMat} castShadow receiveShadow />
          </group>
        );
      })}
    </InteractivePart>
  );
}
