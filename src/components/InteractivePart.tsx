import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PartId } from '../types/parts';
import { useWalkerStore } from '../store/useWalkerStore';
import { COLORS } from '../geometry/materials';

interface InteractivePartProps {
  partId: PartId;
  children: ReactNode;
  /** Optional world-space focus offset for camera. */
  focusPoint?: [number, number, number];
}

/**
 * Wraps a procedural assembly with hover/click picking.
 * Uses raycast on mesh children; highlights with outline-like emissive pulse.
 */
export function InteractivePart({ partId, children }: InteractivePartProps) {
  const group = useRef<THREE.Group>(null);
  const setHovered = useWalkerStore((s) => s.setHoveredPart);
  const setSelected = useWalkerStore((s) => s.setSelectedPart);
  const setFocus = useWalkerStore((s) => s.setFocusPart);
  const hovered = useWalkerStore((s) => s.hoveredPart);
  const selected = useWalkerStore((s) => s.selectedPart);

  const active = hovered === partId || selected === partId;

  useFrame(({ clock }) => {
    if (!group.current) return;
    const pulse = active ? 0.15 + 0.1 * Math.sin(clock.elapsedTime * 4) : 0;
    group.current.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat || !('emissive' in mat)) return;
      if (!mesh.userData._baseEmissive) {
        mesh.userData._baseEmissive = mat.emissive.clone();
        mesh.userData._baseEmissiveIntensity = mat.emissiveIntensity ?? 0;
      }
      if (active) {
        mat.emissive.set(COLORS.highlight);
        mat.emissiveIntensity = (mesh.userData._baseEmissiveIntensity as number) + pulse + 0.25;
      } else {
        mat.emissive.copy(mesh.userData._baseEmissive as THREE.Color);
        mat.emissiveIntensity = mesh.userData._baseEmissiveIntensity as number;
      }
    });
  });

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(partId);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(null);
        document.body.style.cursor = 'default';
      }}
      onClick={(e) => {
        e.stopPropagation();
        setSelected(partId);
        setFocus(partId);
      }}
    >
      {children}
    </group>
  );
}
