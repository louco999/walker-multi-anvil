# 部署到 GitHub Pages

部署完成后，任意电脑浏览器打开：

```text
https://<你的GitHub用户名>.github.io/walker-multi-anvil/
```

（仓库名若不同，把路径里的 `walker-multi-anvil` 改成实际仓库名。）

---

## 一次性步骤

### 1. 安装 Git（若还没有）

https://git-scm.com/

### 2. 在 GitHub 上新建仓库

1. 打开 https://github.com/new  
2. Repository name 填：`walker-multi-anvil`（建议与本项目文件夹同名）  
3. 选 **Public**（免费 Pages 需要公开仓库，或用 Pro 的私有 Pages）  
4. **不要**勾选 “Add a README”  
5. 点 **Create repository**

### 3. 本机推送代码

在项目目录执行（把 `YOUR_USER` 换成你的 GitHub 用户名）：

```bash
cd ~/walker-multi-anvil

git init
git add .
git commit -m "Initial commit: Walker multi-anvil web + CAD"

git branch -M main
git remote add origin https://github.com/YOUR_USER/walker-multi-anvil.git
git push -u origin main
```

若用 SSH：

```bash
git remote add origin git@github.com:YOUR_USER/walker-multi-anvil.git
git push -u origin main
```

### 4. 打开 GitHub Pages

1. 打开仓库页 → **Settings** → 左侧 **Pages**  
2. **Build and deployment → Source** 选 **GitHub Actions**  
3. 等待 **Actions** 里 `Deploy GitHub Pages` 变绿（约 1–3 分钟）  
4. 再回到 **Settings → Pages**，顶部会显示站点地址  

### 5. 访问

```text
https://YOUR_USER.github.io/walker-multi-anvil/
```

以后每次 `git push` 到 `main`，网站会自动重新构建发布。

---

## 本地模拟 Pages 路径（可选）

```bash
VITE_BASE_PATH=/walker-multi-anvil/ npm run build
npx serve dist
# 浏览器打开提示的地址，再进入 /walker-multi-anvil/ 若 serve 支持
```

或：

```bash
npm run build
npx vite preview --base /walker-multi-anvil/
```

---

## 常见问题

| 问题 | 处理 |
|------|------|
| 页面 404 | 确认 Pages Source = GitHub Actions；仓库名与 `VITE_BASE_PATH` 一致 |
| 白屏 / CAD 加载失败 | 打开开发者工具 Network，看 `/cad/...` 是否 404；确认 `public/cad` 已提交 |
| Actions 失败 | 看 Actions 日志；常见是 `npm ci` 需要有 `package-lock.json` |
| 想改仓库名 | 改名后 `base` 会随仓库名自动变（工作流用 `github.event.repository.name`） |

---

## 已为你准备好的文件

- `.github/workflows/deploy-pages.yml` — 自动构建并发布  
- `vite.config.ts` — 支持 `VITE_BASE_PATH`  
- `src/components/CadModel.tsx` — CAD 路径带 base，Pages 子路径下也能加载  
