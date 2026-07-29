import { useMemo } from 'react';
import { InteractivePart } from '../InteractivePart';
import { paintMaterial, steelMaterial } from '../../geometry/materials';
import { layerExplosion, useWalkerStore } from '../../store/useWalkerStore';

/**
 * Four-column lab press exterior: orange upper ram, stainless table,
 * grey pedestal & control cabinet (product-photo silhouette).
 */
export function HydraulicFrame() {
  const explosion = useWalkerStore((s) => s.explosion);
  const visible = useWalkerStore((s) => s.layerVisible['hydraulic-frame']);
  const e = layerExplosion(explosion, 0);
  const open = e * 0.5;

  const m = useMemo(
    () => ({
      orange: paintMaterial('#e65c00', 0.45),
      orangeDark: paintMaterial('#c44a00', 0.48),
      white: steelMaterial({ color: '#eef0f3', metalness: 0.35, roughness: 0.4 }),
      chrome: steelMaterial({ color: '#b8c0c8', metalness: 0.92, roughness: 0.18 }),
      steel: steelMaterial({ color: '#9aa3ad', metalness: 0.8, roughness: 0.3 }),
      stainless: steelMaterial({ color: '#c5ccd4', metalness: 0.9, roughness: 0.22 }),
      base: paintMaterial('#6a7078', 0.55),
      baseDark: paintMaterial('#4a5058', 0.55),
      cabinet: steelMaterial({ color: '#d8dce0', metalness: 0.35, roughness: 0.5 }),
      black: paintMaterial('#1c1c1c', 0.55),
      red: paintMaterial('#c00', 0.4),
    }),
    [],
  );

  const colXY: [number, number][] = [
    [-1.18, -1.02],
    [1.18, -1.02],
    [-1.18, 1.02],
    [1.18, 1.02],
  ];
  const colR = 0.36;
  const colH = 4.3;
  const colMidY = 0.55;

  if (!visible) return null;

  return (
    <InteractivePart partId="hydraulic-frame">
      {/* Pedestal */}
      <mesh position={[0, -2.15, 0.1]} material={m.base} castShadow receiveShadow>
        <boxGeometry args={[4.9, 0.55, 3.3]} />
      </mesh>
      <mesh position={[0, -2.45, 0.1]} material={m.baseDark} receiveShadow>
        <boxGeometry args={[5.1, 0.2, 3.5]} />
      </mesh>

      {/* Stainless work table */}
      <mesh position={[0, -1.82, 0.35]} material={m.stainless} castShadow receiveShadow>
        <boxGeometry args={[5.5, 0.1, 3.7]} />
      </mesh>
      <mesh position={[0, -1.9, 2.15]} material={m.steel}>
        <boxGeometry args={[5.5, 0.08, 0.12]} />
      </mesh>
      {[-1.65, -0.55, 0.55, 1.65].map((x) =>
        [-0.55, 0.55].map((z) => (
          <mesh key={`${x}${z}`} position={[x, -1.76, z + 0.2]} material={m.baseDark}>
            <cylinderGeometry args={[0.12, 0.12, 0.06, 16]} />
          </mesh>
        )),
      )}

      {/* Four columns */}
      {colXY.map(([x, z], i) => (
        <group key={i} position={[x, colMidY, z]}>
          <mesh material={m.white} castShadow>
            <cylinderGeometry args={[colR, colR, colH, 32]} />
          </mesh>
          <mesh material={m.chrome}>
            <cylinderGeometry args={[0.09, 0.09, colH + 0.2, 12]} />
          </mesh>
          <mesh position={[0, colH / 2 + 0.1, 0]} material={m.steel}>
            <cylinderGeometry args={[0.3, 0.3, 0.18, 8]} />
          </mesh>
          <mesh position={[0, -colH / 2 - 0.08, 0]} material={m.steel}>
            <cylinderGeometry args={[0.3, 0.3, 0.16, 8]} />
          </mesh>
        </group>
      ))}

      {/* Top cross plate */}
      <mesh position={[0, 2.58 + open * 0.28, 0]} material={m.stainless} castShadow>
        <boxGeometry args={[2.95, 0.28, 2.55]} />
      </mesh>

      {/* Orange upper ram */}
      <group position={[0, 3.48 + open * 0.32, 0]}>
        <mesh material={m.orange} castShadow>
          <cylinderGeometry args={[0.95, 1.05, 1.5, 48]} />
        </mesh>
        <mesh position={[0, 0.82, 0]} material={m.orangeDark}>
          <cylinderGeometry args={[1.05, 1.05, 0.16, 48]} />
        </mesh>
        <mesh position={[0, 0.05, 0]} material={m.orangeDark}>
          <cylinderGeometry args={[1.06, 1.06, 0.28, 48]} />
        </mesh>
        <mesh position={[0, 0.05, 1.07]} material={m.black}>
          <boxGeometry args={[0.75, 0.16, 0.02]} />
        </mesh>
        <mesh position={[0, -1.0, 0]} material={m.chrome} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.55, 24]} />
        </mesh>
      </group>

      {/* Upper tooling stack */}
      <group position={[0, 1.18 + open, 0]}>
        <mesh material={m.stainless} castShadow>
          <cylinderGeometry args={[0.75, 0.82, 0.35, 40]} />
        </mesh>
        <mesh position={[0, -0.28, 0]} material={m.steel} castShadow>
          <cylinderGeometry args={[0.7, 0.7, 0.2, 36]} />
        </mesh>
        <mesh position={[0, -0.48, 0]} material={m.stainless} castShadow>
          <cylinderGeometry args={[0.95, 0.95, 0.16, 40]} />
        </mesh>
      </group>

      {/* Lower platen */}
      <group position={[0, -0.78 - open * 0.22, 0]}>
        <mesh material={m.stainless} castShadow receiveShadow>
          <cylinderGeometry args={[0.95, 0.9, 0.16, 40]} />
        </mesh>
        <mesh position={[0, -0.18, 0]} material={m.steel} castShadow receiveShadow>
          <cylinderGeometry args={[1.1, 1.1, 0.2, 40]} />
        </mesh>
      </group>

      {/* Control cabinet */}
      <group position={[3.2, 0.2, 0.4]}>
        <mesh material={m.cabinet} castShadow>
          <boxGeometry args={[0.85, 3.2, 1.0]} />
        </mesh>
        <mesh position={[-0.44, 0.5, 0]} material={m.stainless}>
          <boxGeometry args={[0.03, 2.2, 0.85]} />
        </mesh>
        <mesh position={[-0.47, 1.2, 0.12]} material={m.black}>
          <boxGeometry args={[0.02, 0.28, 0.35]} />
        </mesh>
        <mesh position={[-0.47, 0.7, 0.18]} material={m.red} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[-0.47, 0.25 - i * 0.22, 0.1]} material={m.black}>
            <boxGeometry args={[0.02, 0.1, 0.14]} />
          </mesh>
        ))}
      </group>

      {/* Spare modules on table */}
      <group position={[2.25, -1.2, 1.15]}>
        <mesh material={m.stainless} castShadow>
          <cylinderGeometry args={[0.38, 0.38, 0.55, 28]} />
        </mesh>
        <mesh position={[0, -0.35, 0]} material={m.orange} castShadow>
          <cylinderGeometry args={[0.4, 0.4, 0.2, 28]} />
        </mesh>
        <mesh position={[0, 0.32, 0]} material={m.steel}>
          <cylinderGeometry args={[0.28, 0.28, 0.12, 20]} />
        </mesh>
      </group>
      <group position={[3.0, -1.35, 0.95]}>
        <mesh material={m.stainless} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.35, 24]} />
        </mesh>
      </group>
    </InteractivePart>
  );
}
