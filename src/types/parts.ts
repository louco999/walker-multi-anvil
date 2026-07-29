export type PartId =
  | 'hydraulic-frame'
  | 'walker-hatbox'
  | 'first-stage'
  | 'wc-anvils'
  | 'octahedron-cell'
  | 'sample-core';

export type PhaseState = 'Stable' | 'Transitioning' | 'Diamond';
export type FurnaceType = 'graphite' | 'LaCrO3' | 'rhenium';

export interface PartInfo {
  id: PartId;
  name: string;
  nameZh: string;
  material: string;
  maxPressure: string;
  maxTemp: string;
  function: string;
  layer: number;
}

export const PART_CATALOG: Record<PartId, PartInfo> = {
  'hydraulic-frame': {
    id: 'hydraulic-frame',
    name: 'Press Frame & Ram',
    nameZh: '液压机架与上油缸',
    material: '钢立柱 + 上置液压缸 + 不锈钢工作台',
    maxPressure: '实验室级千吨量级（示意）',
    maxTemp: '室温（传力路径）',
    function: '单轴液压加载；四柱机架；上油缸压向中间 Walker 模块。',
    layer: 0,
  },
  'walker-hatbox': {
    id: 'walker-hatbox',
    name: 'Walker Module Housing',
    nameZh: 'Walker 模块外壳',
    material: '不锈钢厚壁圆筒',
    maxPressure: '约束一级砧',
    maxTemp: '外壳常温级',
    function: '可拆卸圆柱工具模块，内部装 6 个一级砧与 Kawai 单元。',
    layer: 1,
  },
  'first-stage': {
    id: 'first-stage',
    name: 'First-Stage Anvils (×6)',
    nameZh: '一级钢砧 ×6',
    material: '硬化工具钢（银亮机加面）',
    maxPressure: '传至二级 WC 立方面',
    maxTemp: '间歇高温',
    function: '3 上 + 3 下扇形砧，把轴向压力转为对 8 立方体外表面的压缩。',
    layer: 2,
  },
  'wc-anvils': {
    id: 'wc-anvils',
    name: 'WC Cubes (×8)',
    nameZh: '碳化钨立方砧 ×8',
    material: 'WC-Co 碳化钨',
    maxPressure: '截角面多 GPa',
    maxTemp: '垫块隔热后仍高',
    function: '8 个截角立方体围成八面体空腔（Kawai 二级）。',
    layer: 3,
  },
  'octahedron-cell': {
    id: 'octahedron-cell',
    name: 'MgO Octahedron',
    nameZh: 'MgO 八面体传压介质',
    material: 'MgO 陶瓷（可掺杂）',
    maxPressure: '随装配而定',
    maxTemp: '配合加热器可至高温',
    function: '传压介质与电绝缘；中心钻孔放加热器与样品。',
    layer: 4,
  },
  'sample-core': {
    id: 'sample-core',
    name: 'Furnace + Sample',
    nameZh: '加热炉与样品',
    material: '石墨 / LaCrO₃ / Re + 金属胶囊',
    maxPressure: '样品腔多 GPa',
    maxTemp: '可达 ~2000+ °C（示意）',
    function: '电阻加热 + 热电偶监测；可示意高压相变。',
    layer: 5,
  },
};
