# What-if Report（数据沙盘）

[![CI](https://github.com/XianingY/cooffice/actions/workflows/ci.yml/badge.svg)](https://github.com/XianingY/cooffice/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-1f6feb?logo=githubpages)](https://xianingy.github.io/cooffice/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node >=22](https://img.shields.io/badge/Node-%3E%3D22-339933?logo=node.js)](package.json)

[English](README.en.md) · **简体中文**

一个**本地优先、可选云端**的全栈数据沙盘工具：导入 Excel / CSV 或试用内置业务场景，试改数值，即时预览指标、排名与报告结论的变化并溯源高亮，确认后导出新的 Excel / Word 或一键复制 Markdown。登录后可把项目保存到 SQLite 后端跨设备续作；不登录也能完成全部本地功能。

> **立即在线体验（零配置、纯浏览器本地运行，不上传任何数据）：**
> **👉 [https://xianingy.github.io/cooffice/](https://xianingy.github.io/cooffice/)**
> 打开页面后，点击顶部「**试一试：模拟华东下滑 25%（第一名易主）**」，3 秒即可体验指标重算、排名翻转、报告联动与来源单元格高亮。

![3 秒体验数据沙盘：试改数值、影响联动与来源高亮](docs/demo.gif)

## 架构

```text
桌面壳 (Electron 36)
   ├── 主进程         内嵌 API、原生菜单/对话框、PathAuthorizer 路径白名单、窗口状态、最近打开、更新检查
   └── preload        contextBridge 暴露受控的 window.desktop（含 webUtils.getPathForFile）
        │ 同源 http://127.0.0.1:<port>/
        ▼
浏览器 / Electron 渲染进程 (React 19 + Vite 6)
   ├── src/core        纯 TypeScript 领域逻辑（指标、影响、报告、可扩展场景模板、数值护栏）
   ├── src/adapters    xlsx / csv / docx / storage / ai / wps
   ├── src/api         类型化 API 客户端（单飞 401 刷新、幂等重试、超时控制）
   ├── src/auth        内存会话 + HttpOnly 刷新 Cookie
   └── src/components  三栏编辑器 + 快速体验场景栏 + 可选云面板
        │ 同源 /api/
        ▼
Fastify 5 + SQLite(better-sqlite3 v13, WAL)
   ├── 认证:注册/登录/原子刷新轮换/盗用全会话吊销/登出/RBAC
   ├── 项目:CRUD + 基线/草稿分离 + 乐观锁 + 分页/防抖搜索
   ├── 报告:服务端权威指标、报告块、图表
   ├── 实时:SSE（项目变更推送、单用户并发上限、优雅关闭）
   └── 运维:健康检查、OpenAPI、审计、限流、安全头
```

## 快速开始

### 方式一：一键初始化（推荐给贡献者）

```bash
npm run setup -- --web    # 仅前端本地模式
npm run setup -- --full   # 前后端全栈（自动创建 server/.env 并迁移 SQLite）
npm run setup             # 全部（前端 + 后端 + Electron 桌面端）
```

也可直接在 GitHub 点击 **Code → Codespaces → Create codespace on main**，仓库内置 [.devcontainer/devcontainer.json](.devcontainer/devcontainer.json) 会自动完成全栈初始化并转发 `5173` / `3001` 端口。

### 方式二：纯本地模式（零配置）

```bash
npm ci
npm run dev
```

打开 `http://localhost:5173`。此模式下不发起任何网络请求，底部云面板自动折叠为轻量提示。

### 方式三：全栈模式

```bash
npm run setup -- --full
npm run dev:full                            # web :5173 + api :3001
```

要启用前端云功能，创建 `.env.local`：

```text
VITE_API_BASE_URL=http://127.0.0.1:3001
```

### 方式四：Docker Compose 一键部署

```bash
cp .env.example .env                        # 设置强随机 JWT_SECRET
docker compose up -d --build
```

访问 `http://localhost:8080`。详见 [部署指南](docs/deployment.md)。

### 方式五：桌面应用（离线可用）

```bash
npm --prefix desktop install     # 首次：安装 Electron 与打包工具
npm run desktop:stage            # 构建前端 + 后端并准备 Node-API 运行时
npm run desktop:start            # 启动应用
npm run desktop:dist             # 产出 dmg / zip / nsis / AppImage 安装包
```

![桌面版主界面](docs/desktop.png)

不装 Node、不联网也能用：本地功能全部在应用内完成，账号与云项目存在本机 SQLite。详见 [桌面应用说明](docs/desktop.md)。

## 功能一览

| 能力 | 说明 |
|---|---|
| 快速体验 | 内置 3 套业务场景（区域销售同比 / 部门预算执行 / 产品线季度营收）与一键试改预设 |
| 导入 | `.xlsx` / `.xls`（Sales 工作表）、`.csv`（引导式列映射，支持千分位、货币符号、科学计数法）与 `.whatif` / `.json` 项目文件 |
| 试改与溯源 | 仅「当前」列可编辑；指标、影响列表、报告与图表即时联动；点击影响项高亮来源单元格与报告块 |
| 配置与导出 | 报告块显示/排序配置；支持已确认版/草稿版导出 `.xlsx` / `.docx` 及一键复制 Markdown |
| 可选 AI 润色 | 默认纯确定性模板零网络；主动开启后受数值与单位护栏保护，密钥仅存内存不落盘 |
| 本地恢复 | 版本化 localStorage（v1/v2 自动迁移至 v3）；覆盖前与清除前均有二次确认 |
| 云端同步 | 注册/登录、基线与草稿分离保存、乐观锁、另存为新项目、搜索/分页/删除、SSE 实时通知 |
| 安全与运维 | scrypt 哈希、JWT + HttpOnly 刷新 Cookie、原子家族轮换、RBAC、限流、CSP、OpenAPI、审计日志 |
| 桌面应用 | Electron 36 原生菜单/对话框、PathAuthorizer 路径白名单、深色主题、拖拽导入、`.whatif` 文件关联 |

## 验证命令

```bash
npm run lint              # 静态不变量检查（版本对齐、零误留 console.log、Docker 路由防回归）
npm run typecheck         # 前端类型检查
npm test                  # 全部 Vitest（前端 + 后端 + 桌面）
npm run test:e2e          # 前端浏览器 E2E
npm run test:e2e:full     # 全栈浏览器 E2E（真实 Fastify + SQLite）
npm run desktop:test      # 桌面主进程类型检查 + 单测
npm run test:e2e:desktop  # 真实 Electron 端到端
npm run verify            # Web + API 门禁（lint / typecheck / 单测 / E2E / 构建）
```

验收基线见 [验证记录](docs/verification.md)。

## 参与贡献

欢迎任何形式的贡献（Bug 修复、新业务场景模板、导出格式、国际化、无障碍优化、WPS 真机验证与文档完善）！

- 浏览适合新手的 [**Good First Issues**](https://github.com/XianingY/cooffice/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
- 阅读 [贡献指南（CONTRIBUTING.md）](CONTRIBUTING.md)——内含 **「5 分钟新增一个沙盘场景模板」** 实操示例
- 遵循 [行为准则（CODE_OF_CONDUCT.md）](CODE_OF_CONDUCT.md) 与 [安全说明（SECURITY.md）](SECURITY.md)

## 文档

- [用户指南](docs/user-guide.md) · [桌面应用](docs/desktop.md) · [开发指南](docs/development.md) · [部署指南](docs/deployment.md)
- [验证记录](docs/verification.md) · [WPS 集成验证说明](docs/wps-integration-notes.md)
- [路线图](ROADMAP.md) · [变更记录](CHANGELOG.md) · [安全说明](SECURITY.md) · [贡献指南](CONTRIBUTING.md)

## License

[MIT](LICENSE) © 2026 What-if Report contributors
