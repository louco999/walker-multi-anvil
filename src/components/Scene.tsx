import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { CadModel, CellModel, FullPressModel } from './CadModel';
import { useWalkerStore } from '../store/useWalkerStore';
import type { PartId } from '../types/parts';

const FOCUS_OFFSETS: Partial<Record<PartId, THREE.Vector3>> = {
  'hydraulic-frame': new THREE.Vector3(0, 0.4, 0),
  'walker-hatbox': new THREE.Vector3(0, 0, 0),
  'first-stage': new THREE.Vector3(0, 0, 0),
  'wc-anvils': new THREE.Vector3(0, 0, 0),
  'octahedron-cell': new THREE.Vector3(0, 0, 0),
  'sample-core': new THREE.Vector3(0, 0, 0),
};

function SimulationTicker() {
  const tick = useWalkerStore((s) => s.tickSimulation);
  useFrame((_, dt) => {
    tick(Math.min(dt, 0.05));
  });
  return null;
}

function FocusController() {
  const focusPart = useWalkerStore((s) => s.focusPart);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const target = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (!focusPart) return;
    target.current.copy(FOCUS_OFFSETS[focusPart] ?? new THREE.Vector3(0, 0, 0));
  }, [focusPart]);

  useFrame(() => {
    if (!controls) return;
    controls.target.lerp(target.current, 0.06);
    controls.update();
  });

  return null;
}

function Lights({ mobile }: { mobile: boolean }) {
  return (
    <>
      <ambientLight intensity={0.48} color="#e8eef5" />
      <hemisphereLight args={['#dce6f2', '#1c222c', 0.55]} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1.55}
        color="#fff6ee"
        castShadow={!mobile}
        shadow-mapSize-width={mobile ? 512 : 2048}
        shadow-mapSize-height={mobile ? 512 : 2048}
        shadow-camera-far={30}
        shadow-camera-near={0.5}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.00025}
        shadow-normalBias={0.035}
      />
      {/* cool fill — separates white columns from gray head */}
      <directionalLight position={[-6, 4, -3]} intensity={0.55} color="#9eb6d0" />
      {/* front fill for orange ram / gauges */}
      <directionalLight position={[1, 3, 7]} intensity={0.45} color="#ffe8d4" />
      <directionalLight position={[0, -5, 2]} intensity={0.18} color="#6b7a8c" />
    </>
  );
}

function Loader() {
  return (
    <Html center>
      <div className="canvas-loader">Building Walker module…</div>
    </Html>
  );
}

export function Scene() {
  const isMobile = useWalkerStore((s) => s.isMobile);
  const viewMode = useWalkerStore((s) => s.viewMode);
  const clearSelection = useWalkerStore((s) => s.setSelectedPart);
  const isFull = viewMode === 'full';
  const isCad = viewMode === 'cad';
  const isCell = viewMode === 'cell';

  const cam = isFull
    ? { position: [1.8, 1.1, 2.0] as [number, number, number], fogNear: 3, fogFar: 10, minD: 0.6, maxD: 6, targetY: 0.45 }
    : isCell
      ? { position: [1.1, 0.7, 1.2] as [number, number, number], fogNear: 4, fogFar: 10, minD: 0.25, maxD: 4, targetY: 0 }
      : { position: [2.6, 1.6, 2.8] as [number, number, number], fogNear: 8, fogFar: 18, minD: 0.8, maxD: 10, targetY: 0 };

  return (
    <Canvas
      className="walker-canvas"
      shadows={!isMobile}
      dpr={isMobile ? [1, 1.25] : [1, 2]}
      camera={{
        position: cam.position,
        fov: 34,
        near: 0.05,
        far: 80,
      }}
      gl={{
        antialias: !isMobile,
        powerPreference: isMobile ? 'low-power' : 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.12,
        localClippingEnabled: true,
        outputColorSpace: THREE.SRGBColorSpace,
        // better depth precision for coplanar WC cube faces when orbiting cutaway
        logarithmicDepthBuffer: true,
      }}
      onPointerMissed={() => clearSelection(null)}
    >
      <color attach="background" args={['#1a1e24']} />
      <fog attach="fog" args={['#1a1e24', cam.fogNear, cam.fogFar]} />

      <Suspense fallback={<Loader />}>
        <Lights mobile={isMobile} />
        {isFull ? <FullPressModel /> : isCell ? <CellModel /> : <CadModel />}
        <SimulationTicker />
        <FocusController />
      </Suspense>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={cam.minD}
        maxDistance={cam.maxD}
        target={[0, cam.targetY, 0]}
        maxPolarAngle={Math.PI * 0.92}
      />
    </Canvas>
  );
}
