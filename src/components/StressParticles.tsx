import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useWalkerStore } from '../store/useWalkerStore';
import { getFirstStageSpecs } from '../geometry/orientation';
import { COLORS } from '../geometry/materials';

const MAX_PARTICLES = 900;

/**
 * Stress / energy flow along first-stage normals into the octahedral cell.
 * Density & speed ∝ chamber pressure.
 */
export function StressParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const pressureGPa = useWalkerStore((s) => s.pressureGPa);
  const temperatureC = useWalkerStore((s) => s.temperatureC);
  const particleBudget = useWalkerStore((s) => s.particleBudget);
  const explosion = useWalkerStore((s) => s.explosion);

  const axes = useMemo(
    () => getFirstStageSpecs().map((s) => s.normal.clone()),
    [],
  );

  const { positions, velocities, seeds, colors } = useMemo(() => {
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const velocities = new Float32Array(MAX_PARTICLES * 3);
    const seeds = new Float32Array(MAX_PARTICLES);
    const colors = new Float32Array(MAX_PARTICLES * 3);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      seeds[i] = Math.random();
      resetParticle(i, positions, velocities, seeds, axes, 1);
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 0.75;
      colors[i * 3 + 2] = 0.2;
    }
    return { positions, velocities, seeds, colors };
  }, [axes]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  useFrame((_, dt) => {
    if (!pointsRef.current) return;

    const pNorm = Math.min(1, pressureGPa / 23);
    const tNorm = Math.min(1, Math.max(0, (temperatureC - 25) / 2000));
    const intensity = Math.max(pNorm, tNorm * 0.45);

    const visibleCount = Math.floor(
      MAX_PARTICLES * particleBudget * (0.08 + intensity * 0.92) * (1 - explosion * 0.85),
    );

    const speed = 0.4 + intensity * 3.2;
    const posAttr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = pointsRef.current.geometry.getAttribute('color') as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const col = colAttr.array as Float32Array;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (i >= visibleCount) {
        pos[i * 3 + 1] = -999;
        continue;
      }
      const ix = i * 3;
      pos[ix] += velocities[ix] * speed * dt;
      pos[ix + 1] += velocities[ix + 1] * speed * dt;
      pos[ix + 2] += velocities[ix + 2] * speed * dt;

      const r = Math.hypot(pos[ix], pos[ix + 1], pos[ix + 2]);
      if (r < 0.12 || r > 4.5) {
        resetParticle(i, pos, velocities, seeds, axes, intensity);
      }

      const heat = Math.min(1, (1 - r / 3.5) * 0.5 + tNorm);
      col[ix] = 1;
      col[ix + 1] = 0.85 - heat * 0.65;
      col[ix + 2] = 0.15 + (1 - heat) * 0.15;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = 0.15 + intensity * 0.75;
    mat.size = 0.035 + intensity * 0.04;
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.04}
        vertexColors
        transparent
        opacity={0.6}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        color={COLORS.stress}
      />
    </points>
  );
}

function resetParticle(
  i: number,
  positions: Float32Array,
  velocities: Float32Array,
  seeds: Float32Array,
  axes: THREE.Vector3[],
  intensity: number,
) {
  const axis = axes[i % axes.length];
  const startR = 1.3 + seeds[i] * 1.6 + (1 - intensity) * 0.4;
  const jitter = (seeds[i] - 0.5) * 0.35;
  const j2 = ((seeds[i] * 7.13) % 1) - 0.5;

  const ortho =
    Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(axis, ortho).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u).normalize();

  const px = axis.x * startR + u.x * jitter + v.x * j2 * 0.4;
  const py = axis.y * startR + u.y * jitter + v.y * j2 * 0.4;
  const pz = axis.z * startR + u.z * jitter + v.z * j2 * 0.4;

  positions[i * 3] = px;
  positions[i * 3 + 1] = py;
  positions[i * 3 + 2] = pz;

  const len = Math.hypot(px, py, pz) || 1;
  velocities[i * 3] = -px / len;
  velocities[i * 3 + 1] = -py / len;
  velocities[i * 3 + 2] = -pz / len;
}
