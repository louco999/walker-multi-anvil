import { Environment, ContactShadows } from '@react-three/drei'
import { useWalkerStore } from '../store/useWalkerStore'

/**
 * Soft lab ground: only ContactShadows (no solid black disc that occludes the machine).
 */
export function Studio({
  mobile,
  viewMode,
}: {
  mobile: boolean
  viewMode: 'full' | 'cad' | 'cell'
}) {
  const simRunning = useWalkerStore((s) => s.simRunning)
  const temperatureC = useWalkerStore((s) => s.temperatureC)

  // Sit just under the machine footprint for each view
  const floorY =
    viewMode === 'full' ? -0.35 : viewMode === 'cell' ? -0.5 : -0.95
  const shadowScale = viewMode === 'full' ? 3.2 : viewMode === 'cell' ? 1.6 : 2.6
  const hot = simRunning || temperatureC > 400
  const isFull = viewMode === 'full'

  const preset = isFull ? 'apartment' : 'warehouse'
  const envIntensity = isFull ? (hot ? 0.38 : 0.48) : hot ? 0.65 : 0.82

  return (
    <>
      <color attach="background" args={['#0c1018']} />
      <fog
        attach="fog"
        args={[
          '#0c1018',
          isFull ? 5 : viewMode === 'cell' ? 3 : 6,
          isFull ? 16 : viewMode === 'cell' ? 9 : 16,
        ]}
      />

      <Environment preset={preset} environmentIntensity={envIntensity} background={false} />

      {/* Soft contact shadow only — no opaque circular plate */}
      {!mobile && (
        <ContactShadows
          position={[0, floorY, 0]}
          opacity={0.42}
          scale={shadowScale}
          blur={3.2}
          far={isFull ? 5 : 2.5}
          color="#000000"
          frames={1}
        />
      )}
    </>
  )
}
