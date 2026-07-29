import { useMemo } from 'react';
import * as THREE from 'three';
import { InteractivePart } from '../InteractivePart';
import { createTruncatedCubeGeometry } from '../../geometry/truncatedCube';
import { getWcCornerDirsWorld, SCALE } from '../../geometry/orientation';
import { wcMaterial, ceramicMaterial, COLORS } from '../../geometry/materials';
import { layerExplosion, useWalkerStore } from '../../store/useWalkerStore';

/** Eight WC second-stage cubes → octahedral cavity (Kawai cell). */
export function WCAnvils() {
  const explosion = useWalkerStore((s) => s.explosion);
  const cutaway = useWalkerStore((s) => s.cutaway);
  const visible = useWalkerStore((s) => s.layerVisible['wc-anvils']);
  const e = layerExplosion(explosion, 3);

  const edge = SCALE.wcEdge;
  const geo = useMemo(
    () => createTruncatedCubeGeometry(edge, SCALE.wcTruncation),
    [edge],
  );
  const mat = useMemo(() => wcMaterial(), []);
  const gasketMat = useMemo(() => ceramicMaterial(COLORS.gasket), []);
  const corners = useMemo(() => getWcCornerDirsWorld(), []);
  const y0 = SCALE.hatboxY;
  const closedDist = SCALE.wcClosedDist;

  function orientCube(dir: THREE.Vector3): THREE.Euler {
    // Truncated corner (+++) points toward package center (−dir)
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 1, 1).normalize(),
      dir.clone().negate(),
    );
    return new THREE.Euler().setFromQuaternion(q);
  }

  if (!visible) return null;

  return (
    <InteractivePart partId="wc-anvils">
      <group position={[0, y0, 0]}>
        {corners.map((dir, i) => {
          if (cutaway && dir.z > 0.45 && dir.y > 0.05) return null;

          const pos = dir.clone().multiplyScalar(closedDist + e * 1.35);
          return (
            <group key={i} position={pos.toArray()} rotation={orientCube(dir)}>
              {/* no receiveShadow: shadow acne on dark WC looks mosaic when orbiting */}
              <mesh geometry={geo} material={mat} castShadow receiveShadow={false} />
              {/* Subtle truncation-face highlight (cavity triangle) */}
              <mesh position={[0.02, 0.02, 0.02]} material={gasketMat}>
                <sphereGeometry args={[0.012, 6, 6]} />
              </mesh>
            </group>
          );
        })}
      </group>
    </InteractivePart>
  );
}
