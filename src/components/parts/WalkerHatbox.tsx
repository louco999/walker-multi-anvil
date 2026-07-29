import { useMemo } from 'react';
import * as THREE from 'three';
import { InteractivePart } from '../InteractivePart';
import { steelMaterial } from '../../geometry/materials';
import { SCALE } from '../../geometry/orientation';
import { layerExplosion, useWalkerStore } from '../../store/useWalkerStore';

/** Short fat stainless Walker module drum with top flange (product-photo look). */
export function WalkerHatbox() {
  const explosion = useWalkerStore((s) => s.explosion);
  const cutaway = useWalkerStore((s) => s.cutaway);
  const visible = useWalkerStore((s) => s.layerVisible['walker-hatbox']);
  const e = layerExplosion(explosion, 1);

  const body = useMemo(
    () =>
      steelMaterial({
        color: '#c8d0d8',
        metalness: 0.92,
        roughness: 0.18,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const dark = useMemo(
    () =>
      steelMaterial({
        color: '#8a939e',
        metalness: 0.88,
        roughness: 0.28,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const bolt = useMemo(
    () => steelMaterial({ color: '#6a727c', metalness: 0.9, roughness: 0.25 }),
    [],
  );

  const { hatboxOuterR: ro, hatboxInnerR: ri, hatboxH: h, hatboxY, flangeExtra } = SCALE;
  const scaleXZ = 1 + e * 0.55;
  const lift = e * 0.22;
  // Cutaway / explosion: open a sector so internals are visible
  const theta = cutaway || e > 0.1 ? Math.PI * 1.35 : Math.PI * 2;
  const start = -theta * 0.1;

  if (!visible) return null;

  const boltCount = 12;
  const flangeR = ro + flangeExtra;

  return (
    <InteractivePart partId="walker-hatbox">
      <group position={[0, hatboxY + lift, 0]} scale={[scaleXZ, 1, scaleXZ]}>
        {/* Outer wall */}
        <mesh material={body} castShadow receiveShadow>
          <cylinderGeometry args={[ro, ro, h, 64, 1, true, start, theta]} />
        </mesh>
        {/* Inner wall */}
        <mesh material={dark} castShadow>
          <cylinderGeometry args={[ri, ri, h * 0.98, 64, 1, true, start, theta]} />
        </mesh>

        {/* Top flange ring */}
        <mesh position={[0, h / 2 + 0.03, 0]} material={body} castShadow>
          <cylinderGeometry
            args={[flangeR, flangeR, 0.1, 48, 1, false, start, theta]}
          />
        </mesh>
        {/* Flange step */}
        <mesh position={[0, h / 2 - 0.04, 0]} material={dark} castShadow>
          <cylinderGeometry
            args={[ro + 0.04, ro + 0.04, 0.06, 48, 1, false, start, theta]}
          />
        </mesh>

        {/* Bottom ring */}
        <mesh position={[0, -h / 2 - 0.03, 0]} material={dark} castShadow>
          <cylinderGeometry
            args={[ro + 0.03, ro + 0.03, 0.09, 48, 1, false, start, theta]}
          />
        </mesh>

        {/* Flange bolts */}
        {Array.from({ length: boltCount }, (_, i) => {
          const ang = (i / boltCount) * Math.PI * 2;
          // Skip bolts in cutaway gap
          const local = ((ang - start) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          if (local > theta * 0.92) return null;
          const br = (ro + flangeR) / 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(ang) * br, h / 2 + 0.09, Math.sin(ang) * br]}
              material={bolt}
              castShadow
            >
              <cylinderGeometry args={[0.035, 0.035, 0.06, 8]} />
            </mesh>
          );
        })}

        {/* Cooling / fluid ports on outer wall */}
        {[0.45, 1.7, 2.95].map((a, i) => {
          if (a > theta * 0.95) return null;
          const ang = start + a;
          return (
            <group
              key={i}
              position={[Math.cos(ang) * (ro + 0.07), -0.05 + (i % 2) * 0.15, Math.sin(ang) * (ro + 0.07)]}
              rotation={[0, -ang + Math.PI / 2, 0]}
            >
              <mesh material={dark} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.045, 0.05, 0.14, 12]} />
              </mesh>
              <mesh position={[0.09, 0, 0]} material={bolt} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.055, 0.055, 0.04, 12]} />
              </mesh>
            </group>
          );
        })}
      </group>
    </InteractivePart>
  );
}
