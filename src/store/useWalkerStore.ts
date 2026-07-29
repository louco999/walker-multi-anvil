import { create } from 'zustand';
import type { FurnaceType, PartId, PhaseState } from '../types/parts';

export type LayerVisibility = Record<PartId, boolean>;

export type ViewMode = 'full' | 'cad' | 'cell' | 'procedural';

export type CadGroup =
  | 'press_base'
  | 'press_table'
  | 'press_frame'
  | 'press_ram'
  | 'press_platen'
  | 'press_cabinet'
  | 'press_props'
  | 'end_ring'
  | 'hatbox'
  | 'first_stage'
  | 'wc'
  | 'mgo'
  | 'furnace'
  | 'cell_mgo'
  | 'cell_insulator'
  | 'cell_furnace'
  | 'cell_spacer'
  | 'cell_sample'
  | 'cell_electrode'
  | 'cell_tc';

export interface WalkerState {
  explosion: number;
  cutaway: boolean;
  viewMode: ViewMode;
  loadTons: number;
  pressureGPa: number;
  temperatureC: number;
  phaseState: PhaseState;
  furnaceType: FurnaceType;
  simRunning: boolean;
  simProgress: number;
  hoveredPart: PartId | null;
  selectedPart: PartId | null;
  focusPart: PartId | null;
  isMobile: boolean;
  particleBudget: number;
  layerVisible: LayerVisibility;
  cadHiddenGroups: CadGroup[];

  setExplosion: (v: number) => void;
  setCutaway: (v: boolean) => void;
  setViewMode: (m: ViewMode) => void;
  setFurnaceType: (t: FurnaceType) => void;
  setHoveredPart: (id: PartId | null) => void;
  setSelectedPart: (id: PartId | null) => void;
  setFocusPart: (id: PartId | null) => void;
  setIsMobile: (v: boolean) => void;
  setLayerVisible: (id: PartId, v: boolean) => void;
  showAllLayers: () => void;
  toggleCadGroup: (g: CadGroup) => void;
  showAllCadGroups: () => void;
  startPhaseTest: () => void;
  stopPhaseTest: () => void;
  tickSimulation: (dt: number) => void;
  resetSimulation: () => void;
}

export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 3);
}

/** Outer layers leave earlier during explosion. */
export function layerExplosion(explosion: number, layer: number): number {
  const start = layer * 0.07;
  const local = (explosion - start) / Math.max(0.2, 1 - start * 0.45);
  return easeOutCubic(Math.min(1, Math.max(0, local)));
}

function derivePhase(
  p: number,
  tC: number,
  running: boolean,
  furnace: FurnaceType,
): PhaseState {
  // Illustrative graphite → diamond risk region (not a phase diagram)
  if (furnace === 'graphite' && p >= 12 && tC >= 1200) return 'Diamond';
  if (running && (p > 5 || tC > 600)) return 'Transitioning';
  return 'Stable';
}

const ALL_VISIBLE: LayerVisibility = {
  'hydraulic-frame': true,
  'walker-hatbox': true,
  'first-stage': true,
  'wc-anvils': true,
  'octahedron-cell': true,
  'sample-core': true,
};

const TARGET_TONS = 800;
const TARGET_GPA = 23;
const TARGET_C = 2000;

export const useWalkerStore = create<WalkerState>((set, get) => ({
  explosion: 0.0,
  cutaway: false,
  viewMode: 'full',
  loadTons: 0,
  pressureGPa: 0,
  temperatureC: 25,
  phaseState: 'Stable',
  furnaceType: 'graphite',
  simRunning: false,
  simProgress: 0,
  hoveredPart: null,
  selectedPart: null,
  focusPart: null,
  isMobile: false,
  particleBudget: 1,
  layerVisible: { ...ALL_VISIBLE },
  cadHiddenGroups: [],

  setExplosion: (v) => set({ explosion: Math.min(1, Math.max(0, v)) }),
  setCutaway: (v) => set({ cutaway: v }),
  setViewMode: (m) => set({ viewMode: m }),
  toggleCadGroup: (g) =>
    set((s) => ({
      cadHiddenGroups: s.cadHiddenGroups.includes(g)
        ? s.cadHiddenGroups.filter((x) => x !== g)
        : [...s.cadHiddenGroups, g],
    })),
  showAllCadGroups: () => set({ cadHiddenGroups: [] }),
  setFurnaceType: (t) => {
    const { pressureGPa, temperatureC, simRunning } = get();
    set({
      furnaceType: t,
      phaseState: derivePhase(pressureGPa, temperatureC, simRunning, t),
    });
  },
  setHoveredPart: (id) => set({ hoveredPart: id }),
  setSelectedPart: (id) => set({ selectedPart: id }),
  setFocusPart: (id) => set({ focusPart: id }),
  setIsMobile: (v) =>
    set({
      isMobile: v,
      particleBudget: v ? 0.35 : 1,
    }),
  setLayerVisible: (id, v) =>
    set((s) => ({ layerVisible: { ...s.layerVisible, [id]: v } })),
  showAllLayers: () => set({ layerVisible: { ...ALL_VISIBLE } }),

  startPhaseTest: () => {
    if (get().simRunning) return;
    set({
      simRunning: true,
      simProgress: 0,
      loadTons: 5,
      pressureGPa: 0,
      temperatureC: 25,
      phaseState: 'Stable',
    });
  },

  stopPhaseTest: () => set({ simRunning: false }),

  tickSimulation: (dt) => {
    const { simRunning, simProgress, furnaceType } = get();
    if (!simRunning) return;

    const next = Math.min(1, simProgress + dt / 12);
    const loadTons = TARGET_TONS * easeOutCubic(next);
    const pressureGPa = TARGET_GPA * easeOutCubic(next);
    const temperatureC =
      25 + (TARGET_C - 25) * easeOutCubic(Math.max(0, (next - 0.12) / 0.88));
    const phaseState = derivePhase(pressureGPa, temperatureC, true, furnaceType);

    set({
      simProgress: next,
      loadTons,
      pressureGPa,
      temperatureC,
      phaseState,
      simRunning: next < 1,
    });
  },

  resetSimulation: () =>
    set({
      simRunning: false,
      simProgress: 0,
      loadTons: 0,
      pressureGPa: 0,
      temperatureC: 25,
      phaseState: 'Stable',
    }),
}));
