import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { InteractivePart } from '../InteractivePart';
import { createRegularOctahedron } from '../../geometry/truncatedCube';
import { kawaiToWorldQuaternion, SCALE } from '../../geometry/orientation';
import { ceramicMaterial, thermalColor, emissiveFromHeat, COLORS } from '../../geometry/materials';
import { layerExplosion, useWalkerStore } from '../../store/useWalkerStore';

/**
 * MgO pressure medium (reddish ceramic in product photos).
 * Oriented with Kawai [111] → press axis; cylindrical furnace bore along local Y.
 */
export function OctahedronCell() {
  const explosion = useWalkerStore((s) => s.explosion);
  const pressureGPa = useWalkerStore((s) => s.pressureGPa);
  const temperatureC = useWalkerStore((s) => s.temperatureC);
  const visible = useWalkerStore((s) => s.layerVisible['octahedron-cell']);
  const e = layerExplosion(explosion, 4);

  const geo = useMemo(() => createRegularOctahedron(SCALE.octaMidR), []);
  const mat = useMemo(() => ceramicMaterial('#8B4A3A'), []);
  const meshRef = useRef<THREE.Mesh>(null);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const q = useMemo(() => kawaiToWorldQuaternion(), []);
  const s = 1 + e * 0.4;

  useFrame(() => {
    if (!meshRef.current) return;
    const m = meshRef.current.material as THREE.MeshStandardMaterial;
    if (pressureGPa < 0.5 && temperatureC < 100) {
      m.color.set('#8B4A3A');
      m.emissive.set('#000000');
      m.emissiveIntensity = 0;
      return;
    }
    thermalColor(pressureGPa, temperatureC, colorScratch);
    m.color.copy(colorScratch).lerp(new THREE.Color(COLORS.mgo), 0.25);
    m.emissive.copy(colorScratch);
    m.emissiveIntensity = emissiveFromHeat(pressureGPa, temperatureC) * 0.55;
  });

  if (!visible) return null;

  return (
    <InteractivePart partId="octahedron-cell">
      <group position={[0, SCALE.hatboxY, 0]} quaternion={q} scale={s}>
        <mesh ref={meshRef} geometry={geo} material={mat} castShadow receiveShadow />
        {/* Furnace bore */}
        <mesh>
          <cylinderGeometry args={[0.052, 0.052, SCALE.octaMidR * 1.9, 18, 1, true]} />
          <meshStandardMaterial
            color="#2a2018"
            metalness={0.1}
            roughness={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Soft gasket ring hint at equator */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[SCALE.octaMidR * 0.72, 0.012, 6, 24]} />
          <meshStandardMaterial color={COLORS.gasket} metalness={0.05} roughness={0.85} />
        </mesh>
      </group>
    </InteractivePart>
  );
}
