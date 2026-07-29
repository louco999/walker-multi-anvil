# CAD 导出与网页资源路径

项目根目录：`walker-multi-anvil/`

## 1. CAD 文件（FreeCAD / STEP / STL）— 本地权威副本

| 内容 | 路径 |
|------|------|
| **整机**（压机 + module + cell） | `cad/exports/full_apparatus/` |
| 整机 FreeCAD | `cad/exports/full_apparatus/WalkerFullApparatus.FCStd` |
| 整机 STEP | `cad/exports/full_apparatus/WalkerFullApparatus.step` |
| 整机零件 STEP | `cad/exports/full_apparatus/parts/*.step` |
| 整机零件 STL | `cad/exports/full_apparatus/parts_stl/*.stl` |
| **Walker 模块**（hatbox + 6+8 + cell） | `cad/exports/` |
| 模块 FreeCAD | `cad/exports/WalkerTypeModule.FCStd` |
| 模块 STEP | `cad/exports/WalkerTypeModule.step` |
| 模块零件 STL | `cad/exports/parts_stl/` |
| **14/8 cell**（独立教学尺寸，未缩入空腔） | `cad/exports/cell_14_8/` |
| Cell FreeCAD | `cad/exports/cell_14_8/Cell_14_8.FCStd` |
| Cell STEP | `cad/exports/cell_14_8/Cell_14_8.step` |

用 FreeCAD 打开 `.FCStd`；用其它 CAD 打开 `.step`。

### 重新导出 CAD

```bash
# 整机
/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd -c \
  "import runpy; runpy.run_path('cad/scripts/build_full_apparatus.py', run_name='__main__')"

# 仅模块
/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd -c \
  "import runpy; runpy.run_path('cad/scripts/build_walker_module.py', run_name='__main__')"

# 仅 cell
/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd -c \
  "import runpy; runpy.run_path('cad/scripts/build_14_8_cell.py', run_name='__main__')"
```

脚本会同时写入 `cad/exports/…` 并同步到网页目录。

---

## 2. 网页版文件（Vite 静态资源）

浏览器通过 `public/` 提供服务，对应 URL 前缀 `/cad/…`。

| 用途 | 磁盘路径 | 网页 URL |
|------|----------|----------|
| 整机清单 | `public/cad/full_manifest.json` | `/cad/full_manifest.json` |
| 整机 STL 等 | `public/cad/full_apparatus/` | `/cad/full_apparatus/…` |
| 模块清单 | `public/cad/manifest.json` | `/cad/manifest.json` |
| 模块 STL | `public/cad/parts_stl/` | `/cad/parts_stl/…` |
| Cell 清单 | `public/cad/cell_manifest.json` | `/cad/cell_manifest.json` |
| Cell STL | `public/cad/cell_14_8/` | `/cad/cell_14_8/…` |

本地预览：

```bash
npm run dev
# 浏览器打开终端提示的地址，例如 http://127.0.0.1:5173
# 界面切换 Full press / Module / Cell
```

---

## 3. 关系说明

- **CAD 权威目录**：`cad/exports/`（改几何请改 `cad/scripts/` 后重跑导出）
- **网页镜像**：`public/cad/`（构建脚本从 exports 复制；改网页外观在 `src/`）
- Module 内 cell 已按 WC 截角对齐（Z 转 105° + 缩放入空腔）；独立 Cell 视图仍为 14 mm 教学尺寸
