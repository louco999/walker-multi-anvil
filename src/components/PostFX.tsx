import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { KernelSize } from 'postprocessing'
import { useWalkerStore } from '../store/useWalkerStore'

/**
 * Calm post stack.
 * Full press: very restrained bloom (large white/SS surfaces would otherwise glitter).
 */
export function PostFX({
  mobile,
  isFull = false,
}: {
  mobile: boolean
  isFull?: boolean
}) {
  const temperatureC = useWalkerStore((s) => s.temperatureC)
  const simRunning = useWalkerStore((s) => s.simRunning)

  if (import.meta.env.VITE_NO_POSTFX === '1') return null

  const hot = simRunning || temperatureC > 600

  // Full press stays matte; cell/module can show a touch more heat bloom
  const intensity = isFull ? 0.22 : hot ? 0.48 : 0.36
  const threshold = isFull ? 0.82 : hot ? 0.65 : 0.74

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        intensity={intensity}
        luminanceThreshold={threshold}
        luminanceSmoothing={0.55}
        mipmapBlur
        kernelSize={mobile || isFull ? KernelSize.SMALL : KernelSize.MEDIUM}
      />
      <Vignette offset={isFull ? 0.22 : 0.26} darkness={isFull ? 0.42 : 0.36} eskil={false} />
    </EffectComposer>
  )
}
