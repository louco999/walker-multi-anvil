import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { InteractivePart } from '../InteractivePart';
import { kawaiToWorldQuaternion, SCALE } from '../../geometry/orientation';
import {
  steelMaterial,
  sampleColor,
  emissiveFromHeat,
  COLORS,
} from '../../geometry/materials';
import { useWalkerStore } from '../../store/useWalkerStore';

/** Furnace tube + sample capsule + Type-C thermocouple (schematic 14/8 cell). */
export function SampleCore() {
  const pressureGPa = useWalkerStore((s) => s.pressureGPa);
  const temperatureC = useWalkerStore((s) => s.temperatureC);
  const phaseState = useWalkerStore((s) => s.phaseState);
  const furnaceType = useWalkerStore((s) => s.furnaceType);
  const visible = useWalkerStore((s) => s.layerVisible['sample-core']);

  const sampleRef = useRef<THREE.Mesh>(null);
  const heaterRef = useRef<THREE.Mesh>(null);
  const q = useMemo(() => kawaiToWorldQuaternion(), []);

  const heaterColor =
    furnaceType === 'graphite'
      ? COLORS.graphite
      : furnaceType === 'LaCrO3'
        ? COLORS.laCrO3
        : COLORS.rhenium;

  const heaterMat = useMemo(() => {
    return steelMaterial({
      color: heaterColor,
      metalness: furnaceType === 'graphite' ? 0.2 : 0.85,
      roughness: furnaceType === 'graphite' ? 0.7 : 0.25,
      side: THREE.DoubleSide,
    });
  }, [heaterColor, furnaceType]);

  const tcMat = useMemo(
    () => steelMaterial({ color: COLORS.thermocouple, metalness: 0.7, roughness: 0.35 }),
    [],
  );
  const capsuleMat = useMemo(
    () => steelMaterial({ color: COLORS.capsule, metalness: 0.9, roughness: 0.2 }),
    [],
  );
  const insulatorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: COLORS.insulator,
        metalness: 0.05,
        roughness: 0.8,
      }),
    [],
  );
  const sampleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: COLORS.graphite,
        metalness: 0.15,
        roughness: 0.55,
      }),
    [],
  );

  useFrame(({ clock }) => {
    const heat = emissiveFromHeat(pressureGPa, temperatureC);
    const col = sampleColor(phaseState, pressureGPa, temperatureC);
    if (heaterRef.current) {
      const m = heaterRef.current.material as THREE.MeshStandardMaterial;
      m.color.set(heaterColor);
      m.emissive.set(COLORS.hot);
      m.emissiveIntensity = 0.08 + heat * 0.85;
      if (temperatureC > 800) m.emissiveIntensity += 0.06 * Math.sin(clock.elapsedTime * 5);
    }
    if (sampleRef.current) {
      const m = sampleRef.current.material as THREE.MeshStandardMaterial;
      m.color.copy(col);
      m.emissive.copy(col);
      m.emissiveIntensity = heat;
      m.metalness = phaseState === 'Diamond' ? 0.55 : 0.15;
      m.roughness = phaseState === 'Diamond' ? 0.12 : 0.55;
    }
  });

  if (!visible) return null;

  return (
    <InteractivePart partId="sample-core">
      <group position={[0, SCALE.hatboxY, 0]} quaternion={q}>
        {/* End plugs / ZrO2 insulator disks */}
        <mesh position={[0, 0.1, 0]} material={insulatorMat}>
          <cylinderGeometry args={[0.052, 0.052, 0.032, 14]} />
        </mesh>
        <mesh position={[0, -0.1, 0]} material={insulatorMat}>
          <cylinderGeometry args={[0.052, 0.052, 0.032, 14]} />
        </mesh>
        {/* Heater tube */}
        <mesh ref={heaterRef} material={heaterMat} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.175, 22, 1, true]} />
        </mesh>
        {/* Metal capsule */}
        <mesh material={capsuleMat} castShadow>
          <cylinderGeometry args={[0.028, 0.028, 0.068, 14]} />
        </mesh>
        {/* Sample */}
        <mesh ref={sampleRef} material={sampleMat} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.045, 12]} />
        </mesh>
        {/* Type-C thermocouple */}
        <mesh position={[0.042, 0.02, 0]} rotation={[0, 0, 0.28]} material={tcMat}>
          <cylinderGeometry args={[0.0045, 0.0045, 0.16, 6]} />
        </mesh>
        <mesh position={[0.042, -0.055, 0]} material={tcMat}>
          <sphereGeometry args={[0.009, 8, 8]} />
        </mesh>
      </group>
      {phaseState === 'Diamond' && (
        <pointLight
          position={[0, SCALE.hatboxY, 0]}
          color="#b8e0ff"
          intensity={1.15}
          distance={1.5}
        />
      )}
    </InteractivePart>
  );
}
