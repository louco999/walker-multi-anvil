import { useWalkerStore } from '../store/useWalkerStore';

export function ExplosionSlider() {
  const explosion = useWalkerStore((s) => s.explosion);
  const setExplosion = useWalkerStore((s) => s.setExplosion);

  return (
    <div className="explosion-slider">
      <div className="slider-labels">
        <span>Assembled</span>
        <span className="slider-pct">{(explosion * 100).toFixed(0)}%</span>
        <span>Exploded</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={explosion * 100}
        onChange={(e) => setExplosion(Number(e.target.value) / 100)}
        aria-label="Explosion view"
      />
      <div className="preset-row">
        <button type="button" className="btn tiny" onClick={() => setExplosion(0)}>
          0%
        </button>
        <button type="button" className="btn tiny" onClick={() => setExplosion(0.35)}>
          35%
        </button>
        <button type="button" className="btn tiny" onClick={() => setExplosion(0.7)}>
          70%
        </button>
        <button type="button" className="btn tiny" onClick={() => setExplosion(1)}>
          100%
        </button>
      </div>
    </div>
  );
}
