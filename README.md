# Walker-type Multi-Anvil Apparatus · 大腔体压机 3D

两条几何路线：

1. **CAD（推荐）** — FreeCAD 参数化实体，闭环尺寸链，导出 STEP/STL  
2. **旧程序化** — Three.js 示意（已知物理错误，仅对照）

默认网页视图加载 `public/cad/WalkerTypeModule.stl`（CAD 网格）。

## 技术栈

- **Vite** + **React 19** + **TypeScript**
- **Three.js** + **React Three Fiber** + **Drei**
- **Zustand** 状态管理

## 设备结构（由外向内）

| 层级 | 部件 | 实现要点 |
|------|------|----------|
| 0 | 液压机框架与推杆 | 四柱、上下压盘、橙色上油缸、控制柜 |
| 1 | Walker 模块外壳 | 厚壁不锈钢圆筒 + 顶法兰螺栓 + 冷却口 |
| 2 | 6 个一级钢砧 | **3 上 + 3 下**，立方体面法向；立方体 [111] 对齐加压轴 |
| 3 | 8 个 WC 截角立方体 | 程序化截角，组合成八面体空腔（Kawai 二级） |
| 4 | MgO 八面体传压介质 | 陶瓷外观 + 炉孔；P–T 热色 |
| 5 | 加热器 + 样品 | 石墨 / LaCrO₃ / Re、热电偶、相变示意 |

## 功能

1. **爆炸视图**：滑块沿真实推力方向拆开各级部件。
2. **半剖 Cutaway**：隐藏部分外壳 / 砧块，看内部装配。
3. **层级开关**：单独显示/隐藏每一层；点击层名打开部件卡片。
4. **高压相变测试**：0→~23 GPa + 升温，样品热色与 Diamond-risk 状态（示意）。
5. **应力粒子流**：沿一级砧法向向心流动，随压强变化。
6. **交互**：OrbitControls；悬停高亮；点击部件弹出材质/功能说明。

## 运行

```bash
cd walker-multi-anvil
npm install
npm run dev
```

构建：

```bash
npm run build
npm run preview
```

## 目录结构

```
src/
  components/
    Scene.tsx              # Canvas / 灯光 / 相机
    WalkerApparatus.tsx    # 整机装配
    InteractivePart.tsx    # 拾取与高亮
    StressParticles.tsx    # 应力粒子
    parts/                 # 各层程序化几何
  geometry/
    orientation.ts         # [111]→Y、面/角方向、SCALE
    firstStageSolid.ts     # 一级扇形砧实体
    truncatedCube.ts       # WC 截角立方体 / 八面体
    materials.ts           # 金属/陶瓷/热色
  store/useWalkerStore.ts  # 爆炸、P–T、层级、选中
  ui/                      # HUD
  types/parts.ts           # 部件目录
references/                # 实验室/厂商参考照片（几何依据）
```

## 几何约定

- 加压轴 = **+Y**
- 二级 8 立方体所在立方体的 **体对角线 [111]** 对齐 +Y
- 一级砧推力 = 该立方体 **六个面法向**（世界系）
- WC 截角面朝向模块中心，围成八面体空腔

## 说明

- 尺寸与工况为**教学/可视化示意**，非工程图纸、非特定型号。
- 石墨→金刚石风险区阈值（约 ≥12 GPa 且 ≥1200 °C）为示意简化。
- 参考图见 `references/`（Hiroshima / Voggenreiter / ETH 等公开资料）。
