import { PART_CATALOG } from '../types/parts';
import { useWalkerStore } from '../store/useWalkerStore';

export function PartCard() {
  const selected = useWalkerStore((s) => s.selectedPart);
  const setSelected = useWalkerStore((s) => s.setSelectedPart);
  const setFocus = useWalkerStore((s) => s.setFocusPart);

  if (!selected) return null;
  const info = PART_CATALOG[selected];

  return (
    <div className="part-card" role="dialog" aria-label={info.name}>
      <button
        type="button"
        className="part-card-close"
        onClick={() => {
          setSelected(null);
          setFocus(null);
        }}
        aria-label="Close"
      >
        ×
      </button>
      <div className="part-card-layer">Layer {info.layer} · Outer → Inner</div>
      <h3>{info.name}</h3>
      <p className="part-card-zh">{info.nameZh}</p>
      <dl>
        <div>
          <dt>Material</dt>
          <dd>{info.material}</dd>
        </div>
        <div>
          <dt>Max Pressure</dt>
          <dd>{info.maxPressure}</dd>
        </div>
        <div>
          <dt>Max Temperature</dt>
          <dd>{info.maxTemp}</dd>
        </div>
        <div>
          <dt>Function</dt>
          <dd>{info.function}</dd>
        </div>
      </dl>
    </div>
  );
}
