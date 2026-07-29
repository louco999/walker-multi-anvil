import { useWalkerStore, type CadGroup } from '../store/useWalkerStore';
import { ExplosionSlider } from './ExplosionSlider';
import { PartCard } from './PartCard';
import type { FurnaceType } from '../types/parts';

const FULL_GROUPS: { id: CadGroup; label: string }[] = [
  { id: 'press_base', label: '机座' },
  { id: 'press_table', label: '不锈钢工作台' },
  { id: 'press_frame', label: '四柱机架' },
  { id: 'press_ram', label: '橙色上油缸' },
  { id: 'press_platen', label: '上下压盘' },
  { id: 'press_cabinet', label: '控制柜' },
  { id: 'press_props', label: '台面附件' },
  { id: 'end_ring', label: '模块端面环' },
  { id: 'hatbox', label: 'Walker 外壳' },
  { id: 'first_stage', label: '一级钢砧 ×6' },
  { id: 'wc', label: 'WC 立方 ×8' },
  { id: 'cell_mgo', label: 'MgO 八面体' },
  { id: 'cell_insulator', label: 'ZrO₂ 绝缘' },
  { id: 'cell_furnace', label: '加热炉' },
  { id: 'cell_sample', label: '样品 + 胶囊' },
  { id: 'cell_tc', label: '热电偶' },
];

const CAD_GROUPS: { id: CadGroup; label: string }[] = [
  { id: 'end_ring', label: '端面支承环' },
  { id: 'hatbox', label: 'Walker 外壳' },
  { id: 'first_stage', label: '一级钢砧 ×6' },
  { id: 'wc', label: 'WC 立方 ×8' },
  { id: 'cell_mgo', label: 'MgO 八面体' },
  { id: 'cell_insulator', label: 'ZrO₂ 热绝缘' },
  { id: 'cell_furnace', label: 'LaCrO₃ 阶梯炉' },
  { id: 'cell_spacer', label: '垫片 Spacer' },
  { id: 'cell_sample', label: '胶囊 + 样品' },
  { id: 'cell_electrode', label: '电极' },
  { id: 'cell_tc', label: '热电偶' },
];

const CELL_GROUPS: { id: CadGroup; label: string }[] = [
  { id: 'cell_mgo', label: 'MgO 八面体传压介质' },
  { id: 'cell_insulator', label: 'ZrO₂ 热绝缘套/端盘' },
  { id: 'cell_furnace', label: 'LaCrO₃ 阶梯加热炉' },
  { id: 'cell_spacer', label: '上下 Spacer' },
  { id: 'cell_sample', label: '金属胶囊 + 样品' },
  { id: 'cell_electrode', label: '上下电极' },
  { id: 'cell_tc', label: 'Type-C 热电偶' },
];

function Gauge({
  label,
  value,
  unit,
  max,
  accent,
  digits = 1,
}: {
  label: string;
  value: number;
  unit: string;
  max: number;
  accent: string;
  digits?: number;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="gauge">
      <div className="gauge-head">
        <span className="gauge-label">{label}</span>
        <span className="gauge-value" style={{ color: accent }}>
          {value.toFixed(digits)}
          <small>{unit}</small>
        </span>
      </div>
      <div className="gauge-track">
        <div className="gauge-fill" style={{ width: `${pct}%`, background: accent }} />
      </div>
    </div>
  );
}

function phaseClass(phase: string): string {
  if (phase === 'Diamond') return 'phase diamond';
  if (phase === 'Transitioning') return 'phase transitioning';
  return 'phase stable';
}

export function Dashboard() {
  const loadTons = useWalkerStore((s) => s.loadTons);
  const pressureGPa = useWalkerStore((s) => s.pressureGPa);
  const temperatureC = useWalkerStore((s) => s.temperatureC);
  const phaseState = useWalkerStore((s) => s.phaseState);
  const furnaceType = useWalkerStore((s) => s.furnaceType);
  const setFurnaceType = useWalkerStore((s) => s.setFurnaceType);
  const cutaway = useWalkerStore((s) => s.cutaway);
  const setCutaway = useWalkerStore((s) => s.setCutaway);
  const viewMode = useWalkerStore((s) => s.viewMode);
  const setViewMode = useWalkerStore((s) => s.setViewMode);
  const cadHiddenGroups = useWalkerStore((s) => s.cadHiddenGroups);
  const toggleCadGroup = useWalkerStore((s) => s.toggleCadGroup);
  const showAllCadGroups = useWalkerStore((s) => s.showAllCadGroups);
  const simRunning = useWalkerStore((s) => s.simRunning);
  const simProgress = useWalkerStore((s) => s.simProgress);
  const startPhaseTest = useWalkerStore((s) => s.startPhaseTest);
  const resetSimulation = useWalkerStore((s) => s.resetSimulation);

  return (
    <>
      <header className="hud-header">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <h1>Walker-type Multi-Anvil</h1>
            <p>
              {viewMode === 'full'
                ? '四柱压机 + Walker 模块 + 14/8 cell'
                : viewMode === 'cell'
                  ? '14/8 Cell 详图 · MgO / ZrO₂ / 炉 / 样品 / TC'
                  : 'Walker 模块核心（无外机架）'}
            </p>
          </div>
        </div>
        <div className={`phase-pill ${phaseClass(phaseState)}`}>
          <span className="phase-dot" />
          {phaseState === 'Stable' && 'Stable'}
          {phaseState === 'Transitioning' && 'Transitioning…'}
          {phaseState === 'Diamond' && 'Diamond risk'}
        </div>
      </header>

      <aside className="hud-panel left">
        <h2>Telemetry</h2>
        <Gauge label="Load" value={loadTons} unit=" ton" max={1000} accent="#38bdf8" digits={0} />
        <Gauge label="Pressure" value={pressureGPa} unit=" GPa" max={25} accent="#fbbf24" digits={2} />
        <Gauge label="Temp" value={temperatureC} unit=" °C" max={2500} accent="#f87171" digits={0} />

        <div className="sim-block">
          <h3>High-P–T Run</h3>
          <p className="sim-desc">示意加压升温；中心热色随 P–T 变化（非真实相图）。</p>
          <label className="field-label">Furnace</label>
          <div className="sim-actions" style={{ marginBottom: '0.65rem' }}>
            {(['graphite', 'LaCrO3', 'rhenium'] as FurnaceType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`btn tiny ${furnaceType === t ? 'primary' : 'ghost'}`}
                onClick={() => setFurnaceType(t)}
              >
                {t === 'LaCrO3' ? 'LaCrO₃' : t === 'rhenium' ? 'Re' : 'Graphite'}
              </button>
            ))}
          </div>
          <div className="sim-actions">
            <button
              type="button"
              className="btn primary"
              disabled={simRunning}
              onClick={startPhaseTest}
            >
              {simRunning ? `Running… ${(simProgress * 100).toFixed(0)}%` : 'Start'}
            </button>
            <button type="button" className="btn ghost" onClick={resetSimulation}>
              Reset
            </button>
          </div>
          {simRunning && (
            <div className="sim-progress">
              <div style={{ width: `${simProgress * 100}%` }} />
            </div>
          )}
        </div>
      </aside>

      <aside className="hud-panel right">
        <h2>View</h2>
        <div className="sim-actions" style={{ marginBottom: '0.75rem' }}>
          <button
            type="button"
            className={`btn tiny ${viewMode === 'full' ? 'primary' : 'ghost'}`}
            onClick={() => setViewMode('full')}
          >
            Full press
          </button>
          <button
            type="button"
            className={`btn tiny ${viewMode === 'cad' ? 'primary' : 'ghost'}`}
            onClick={() => setViewMode('cad')}
          >
            Module
          </button>
          <button
            type="button"
            className={`btn tiny ${viewMode === 'cell' ? 'primary' : 'ghost'}`}
            onClick={() => setViewMode('cell')}
          >
            14/8 Cell
          </button>
        </div>
        <p className="panel-hint">
          {viewMode === 'full'
            ? 'Voggenreiter 风格四柱压机 + Walker 工具模块 + 14/8 cell（教学尺度）。'
            : viewMode === 'cell'
              ? 'Kawai 14/8：加热体内部堆栈随 T 变色（中间热、两端冷）；外壳 MgO/ZrO₂ 不变。'
              : '仅 Walker 模块：端面环 → hatbox → 6 砧 → 8 WC → cell。'}
        </p>
        <ExplosionSlider />
        <label className="cutaway-row">
          <input
            type="checkbox"
            checked={cutaway}
            onChange={(ev) => setCutaway(ev.target.checked)}
          />
          <span>半剖 Cutaway</span>
        </label>

        {(viewMode === 'full' || viewMode === 'cad' || viewMode === 'cell') && (
          <div className="layer-block">
            <div className="layer-head">
              <h3>
                {viewMode === 'full'
                  ? 'Press layers'
                  : viewMode === 'cell'
                    ? 'Cell parts'
                    : 'Module layers'}
              </h3>
              <button type="button" className="btn tiny ghost" onClick={showAllCadGroups}>
                All
              </button>
            </div>
            {(viewMode === 'full'
              ? FULL_GROUPS
              : viewMode === 'cell'
                ? CELL_GROUPS
                : CAD_GROUPS
            ).map(({ id, label }) => (
              <label key={id} className="layer-row">
                <input
                  type="checkbox"
                  checked={!cadHiddenGroups.includes(id)}
                  onChange={() => toggleCadGroup(id)}
                />
                <span className="layer-name">{label}</span>
              </label>
            ))}
          </div>
        )}

        <div className="legend">
          {viewMode === 'full' ? (
            <>
              <div>
                <i style={{ background: '#e65c00' }} /> 上油缸 / 四柱
              </div>
              <div>
                <i style={{ background: '#c8d0d8' }} /> Walker 模块
              </div>
              <div>
                <i style={{ background: '#15181c' }} /> WC 立方砧
              </div>
              <div>
                <i style={{ background: '#8B4A3A' }} /> 14/8 cell
              </div>
            </>
          ) : viewMode === 'cell' ? (
            <>
              <div>
                <i style={{ background: '#ff6a1a' }} /> 加热堆栈中段（热）
              </div>
              <div>
                <i style={{ background: '#5c3020' }} /> 加热堆栈两端（较冷）
              </div>
              <div>
                <i style={{ background: '#8B4A3A' }} /> MgO（外壳，不加热着色）
              </div>
              <div>
                <i style={{ background: '#e8e4dc' }} /> ZrO₂（绝缘，不加热着色）
              </div>
            </>
          ) : (
            <>
              <div>
                <i style={{ background: '#8a9098' }} /> 端面环 + hatbox + 砧
              </div>
              <div>
                <i style={{ background: '#15181c' }} /> 8× WC
              </div>
              <div>
                <i style={{ background: '#8B4A3A' }} /> 14/8 cell 堆栈
              </div>
            </>
          )}
        </div>
        <p className="panel-hint tip">
          {viewMode === 'full'
            ? 'Start 实验时顶梁双表随 P–T 转动 · 爆炸看压机→模块→cell'
            : viewMode === 'cell'
              ? '升温：炉内堆栈热度图 · 中间热两端冷 · 爆炸拆层'
              : '模块核心 · 半剖看 WC 与 cell'}
        </p>
      </aside>

      <PartCard />

      <footer className="hud-footer">
        <span>
          {viewMode === 'full'
            ? 'Full press · LP-style + Walker + 14/8'
            : viewMode === 'cell'
              ? '14/8 cell · face-bore + heat map'
              : 'Walker module · FreeCAD'}
        </span>
        <span>教学示意，非工程图纸</span>
      </footer>
    </>
  );
}
