import { useMemo } from 'react';
import * as THREE from 'three';
import { InteractivePart } from '../InteractivePart';
import { createSolidFirstStageAnvil } from '../../geometry/firstStageSolid';
import { getFirstStageSpecs, SCALE } from '../../geometry/orientation';
import { steelMaterial } from '../../geometry/materials';
import { layerExplosion, useWalkerStore } from '../../store/useWalkerStore';

/**
 * Six first-stage steel anvils: 3 upper + 3 lower.
 * Each presses one face of the WC cube package; outer arc fits hatbox ID.
 */
export function FirstStageAnvils() {
  const explosion = useWalkerStore((s) => s.explosion);
  const cutaway = useWalkerStore((s) => s.cutaway);
  const visible = useWalkerStore((s) => s.layerVisible['first-stage']);
  const e = layerExplosion(explosion, 2);

  const depth = SCALE.firstStageDepth;
  const padHalf = SCALE.firstStagePad / 2;
  const halfH = SCALE.firstStageHalfH;
  const halfArc = (56 * Math.PI) / 180 / 2;

  const geo = useMemo(
    () =>
      createSolidFirstStageAnvil({
        padHalf,
        depth,
        outerR: SCALE.hatboxInnerR,
        halfH,
        halfArc,
        segments: 22,
      }),
    [padHalf, depth, halfH, halfArc],
  );

  const bodyMat = useMemo(
    () => steelMaterial({ color: '#c4ccd4', metalness: 0.94, roughness: 0.14 }),
    [],
  );
  const faceMat = useMemo(
    () => steelMaterial({ color: '#dce3ea', metalness: 0.9, roughness: 0.12 }),
    [],
  );

  const specs = useMemo(() => getFirstStageSpecs(), []);
  const y0 = SCALE.hatboxY;

  // Closed: pad sits on cube face → anvil local origin (pad plane) at largeCubeHalf along normal
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

        // Bright machined pad slightly proud of inner face
        const padPos = spec.normal.clone().multiplyScalar(closedOffset - 0.012 + e * 1.55);
        padPos.y += y0;
        const padSize = SCALE.largeCubeHalf * 1.72;

        return (
          <group key={spec.index}>
            <group position={pos.toArray()} quaternion={q}>
              <mesh geometry={geo} material={bodyMat} castShadow receiveShadow />
            </group>
            <mesh position={padPos.toArray()} quaternion={q} material={faceMat} castShadow>
              <boxGeometry args={[padSize, padSize, 0.022]} />
            </mesh>
          </group>
        );
      })}
    </InteractivePart>
  );
}
