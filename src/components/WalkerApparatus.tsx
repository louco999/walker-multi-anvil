import { HydraulicFrame } from './parts/HydraulicFrame';
import { WalkerHatbox } from './parts/WalkerHatbox';
import { FirstStageAnvils } from './parts/FirstStageAnvils';
import { WCAnvils } from './parts/WCAnvils';
import { OctahedronCell } from './parts/OctahedronCell';
import { SampleCore } from './parts/SampleCore';
import { StressParticles } from './StressParticles';

/**
 * Walker-type 6/8 multi-anvil apparatus (procedural).
 * Topology from lab photos: O-frame → hatbox → 3+3 first-stage → 8 WC → MgO → furnace.
 */
export function WalkerApparatus() {
  return (
    <group name="WalkerTypeMultiAnvil">
      <HydraulicFrame />
      <WalkerHatbox />
      <FirstStageAnvils />
      <WCAnvils />
      <OctahedronCell />
      <SampleCore />
      <StressParticles />
    </group>
  );
}
