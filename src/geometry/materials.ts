import * as THREE from 'three';
import type { PhaseState } from '../types/parts';

/** Lab palette from ETH / Voggenreiter / Lille photos. */
export const COLORS = {
  // Red laminated O-frame (ETH 1000 ton)
  frameRed: '#c41e1e',
  frameRedDark: '#8b1515',
  frameRedEdge: '#a01818',
  // Yellow Enerpac-style ram
  hydYellow: '#e6b800',
  hydYellowDark: '#c49a00',
  // Stainless hatbox / module
  stainless: '#c5ccd4',
  stainlessDark: '#8a939e',
  stainlessBright: '#dfe5ec',
  // Platens
  platen: '#6a727c',
  platenDark: '#3d444c',
  // Control cabinet
  cabinet: '#b0b8c0',
  cabinetPanel: '#b0b8c0',
  // First-stage machined steel (Lille / Voggenreiter silver wedges)
  firstStage: '#b8c0c8',
  firstStageFace: '#d0d6dc',
  // WC cubes — near black matte (Voggenreiter photo)
  wcCube: '#15181c',
  wcFace: '#22262c',
  // MgO — reddish ceramic core in product photos
  mgo: '#c8bca8',
  mgoDoped: '#8B4A3A',
  gasket: '#5c4a3a',
  graphite: '#2a2a2e',
  laCrO3: '#5c4030',
  rhenium: '#c8c0b0',
  thermocouple: '#d4a017',
  capsule: '#c0c0c8',
  insulator: '#e8e0d0',
  highlight: '#38bdf8',
  stress: '#fbbf24',
  hot: '#ff5522',
  // Floor / lab
  floor: '#3a3530',
  baseYellow: '#d4a017',
} as const;

export function steelMaterial(opts?: {
  color?: string;
  metalness?: number;
  roughness?: number;
  side?: THREE.Side;
}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: opts?.color ?? COLORS.stainless,
    metalness: opts?.metalness ?? 0.85,
    roughness: opts?.roughness ?? 0.35,
    side: opts?.side ?? THREE.FrontSide,
  });
}

/** Painted industrial steel (red frame) — less metallic. */
export function paintMaterial(color: string, roughness = 0.55): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.25,
    roughness,
  });
}

export function wcMaterial(): THREE.MeshStandardMaterial {
  // Matte WC-Co — avoid high metalness (facet shimmer / mosaic when orbiting)
  return new THREE.MeshStandardMaterial({
    color: COLORS.wcCube,
    metalness: 0.12,
    roughness: 0.62,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
}

export function ceramicMaterial(color: string = COLORS.mgo): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.05,
    roughness: 0.75,
  });
}

export function thermalColor(
  pressureGPa: number,
  temperatureC: number,
  target = new THREE.Color(),
): THREE.Color {
  const pNorm = Math.min(1, pressureGPa / 23);
  const tNorm = Math.min(1, Math.max(0, (temperatureC - 25) / 2000));
  const heat = Math.max(pNorm * 0.3, tNorm);
  if (heat < 0.33) {
    const u = heat / 0.33;
    return target.setRGB(0.2 + u * 0.35, 0.35 + u * 0.35, 0.75 - u * 0.15);
  }
  if (heat < 0.66) {
    const u = (heat - 0.33) / 0.33;
    return target.setRGB(0.55 + u * 0.4, 0.7 + u * 0.15, 0.6 - u * 0.45);
  }
  const u = (heat - 0.66) / 0.34;
  return target.setRGB(1.0, 0.8 - u * 0.5, 0.12);
}

export function sampleColor(
  phase: PhaseState,
  pressureGPa: number,
  temperatureC: number,
): THREE.Color {
  const c = thermalColor(pressureGPa, temperatureC);
  if (phase === 'Diamond') c.lerp(new THREE.Color('#a8d4f0'), 0.5);
  else if (phase === 'Stable' && pressureGPa < 1) c.set(COLORS.graphite);
  return c;
}

export function emissiveFromHeat(pressureGPa: number, temperatureC: number): number {
  const tNorm = Math.min(1, Math.max(0, (temperatureC - 500) / 1500));
  const pNorm = Math.min(1, pressureGPa / 23);
  return Math.min(2.0, tNorm * 1.7 + pNorm * 0.35);
}
