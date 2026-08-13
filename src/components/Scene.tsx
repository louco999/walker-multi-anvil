import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Preload } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { CadModel, CellModel, FullPressModel } from './CadModel'
import { Studio } from './Studio'
import { PostFX } from './PostFX'
import { useWalkerStore } from '../store/useWalkerStore'
import type { PartId } from '../types/parts'

const FOCUS_OFFSETS: Partial<Record<PartId, THREE.Vector3>> = {
  'hydraulic-frame': new THREE.Vector3(0, 0.4, 0),
  'walker-hatbox': new THREE.Vector3(0, 0, 0),
  'first-stage': new THREE.Vector3(0, 0, 0),
  'wc-anvils': new THREE.Vector3(0, 0, 0),
  'octahedron-cell': new THREE.Vector3(0, 0, 0),
  'sample-core': new THREE.Vector3(0, 0, 0),
}

function SimulationTicker() {
  const tick = useWalkerStore((s) => s.tickSimulation)
  useFrame((_, dt) => {
    tick(Math.min(dt, 0.05))
  })
  return null
}

function FocusController() {
  const focusPart = useWalkerStore((s) => s.focusPart)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const target = useRef(new THREE.Vector3(0, 0, 0))

  useEffect(() => {
    if (!focusPart) return
    target.current.copy(FOCUS_OFFSETS[focusPart] ?? new THREE.Vector3(0, 0, 0))
  }, [focusPart])

  useFrame(() => {
    if (!controls) return
    controls.target.lerp(target.current, 0.06)
    controls.update()
  })

  return null
}

/** Soft industrial lighting — full press needs less specular kick. */
function Lights({ mobile, isFull }: { mobile: boolean; isFull: boolean }) {
  const key = isFull ? 1.15 : 1.55
  const fill = isFull ? 0.4 : 0.62
  const front = isFull ? 0.32 : 0.5

  return (
    <>
      <ambientLight intensity={isFull ? 0.58 : 0.48} color="#e4ebf4" />
      <hemisphereLight args={['#e8eef8', '#1a2028', isFull ? 0.62 : 0.55]} />
      <directionalLight
        position={isFull ? [5, 9, 5] : [6, 10, 4]}
        intensity={key}
        color="#fff6ee"
        castShadow={!mobile}
        shadow-mapSize={[mobile ? 512 : 1536, mobile ? 512 : 1536]}
        shadow-camera-far={30}
        shadow-camera-near={0.5}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.00025}
        shadow-normalBias={0.035}
      />
      {/* Cool fill — softer for full press so white columns don't blow out */}
      <directionalLight position={[-6, 4, -3]} intensity={fill} color="#9eb6d0" />
      <directionalLight position={[1, 3, 7]} intensity={front} color="#ffe8d4" />
      <directionalLight position={[0, -5, 2]} intensity={isFull ? 0.14 : 0.22} color="#6b7a8c" />
      {/* Skip hard point light on full press — major glitter source on stainless */}
      {!isFull && (
        <pointLight position={[2, 2, 3]} intensity={0.3} color="#ffffff" distance={12} />
      )}
    </>
  )
}

function Loader() {
  return (
    <Html center>
      <div className="canvas-loader">Loading Walker multi-anvil…</div>
    </Html>
  )
}

export function Scene() {
  const isMobile = useWalkerStore((s) => s.isMobile)
  const viewMode = useWalkerStore((s) => s.viewMode)
  const clearSelection = useWalkerStore((s) => s.setSelectedPart)
  const isFull = viewMode === 'full'
  const isCell = viewMode === 'cell'

  const cam = isFull
    ? {
        position: [2.0, 1.2, 2.15] as [number, number, number],
        minD: 0.85,
        maxD: 6.5,
        targetY: 0.48,
        fov: 30,
      }
    : isCell
      ? {
          position: [1.05, 0.65, 1.15] as [number, number, number],
          minD: 0.3,
          maxD: 3.5,
          targetY: 0,
          fov: 30,
        }
      : {
          position: [2.5, 1.5, 2.7] as [number, number, number],
          minD: 0.9,
          maxD: 9,
          targetY: 0,
          fov: 34,
        }

  return (
    <Canvas
      className="walker-canvas"
      shadows={!isMobile}
      dpr={isMobile ? [1, 1.25] : [1, 1.6]}
      camera={{
        position: cam.position,
        fov: cam.fov,
        near: 0.05,
        far: 80,
      }}
      gl={{
        antialias: true,
        powerPreference: isMobile ? 'low-power' : 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        // Full press: lower exposure so white columns / SS stay matte
        toneMappingExposure: isFull ? 0.95 : 1.1,
        localClippingEnabled: true,
        outputColorSpace: THREE.SRGBColorSpace,
        logarithmicDepthBuffer: true,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color('#0c1018'))
      }}
      onPointerMissed={() => clearSelection(null)}
    >
      <Suspense fallback={<Loader />}>
        <Studio mobile={isMobile} viewMode={viewMode} />
        <Lights mobile={isMobile} isFull={isFull} />
        {isFull ? <FullPressModel /> : isCell ? <CellModel /> : <CadModel />}
        <SimulationTicker />
        <FocusController />
        <PostFX mobile={isMobile} isFull={isFull} />
        <Preload all />
      </Suspense>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        minDistance={cam.minD}
        maxDistance={cam.maxD}
        target={[0, cam.targetY, 0]}
        maxPolarAngle={Math.PI * 0.92}
        autoRotate
        autoRotateSpeed={isFull ? 0.2 : 0.28}
      />
    </Canvas>
  )
}
