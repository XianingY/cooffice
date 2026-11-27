# 开发指南

## 技术栈

前后端均为 TypeScript。

- 前端:React 19 + Vite 6 + Vitest + Testing Library + Playwright;SheetJS 处理 xlsx,`docx` 生成 Word。
- 后端:Fastify 5 + better-sqlite3 v13(WAL, Node-API)+ jose(JWT)+ Zod(校验)+ pino(日志),运行在 Node 22+。

## 目录结构

前端:

- `src/core`:纯 TypeScript 领域逻辑(指标、影响、报告、图表、校验、配置、迁移、AI 数值护栏)。不得引用 React、DOM、SheetJS、docx 或 localStorage。
- `src/adapters`:第三方文件格式与浏览器 API 隔离层(xlsx、csv、docx、storage、ai、wps)。
- `src/api`:类型化 API 客户端、错误映射与端点封装。
- `src/auth`:内存会话、AuthProvider、令牌存储。
- `src/hooks`:云项目、SSE 订阅、离线状态。
- `src/state` / `src/components`:状态机与展示层,不复制核心计算。

后端(`server/`,按功能组织 + 三层架构):

- `src/config`:集中环境变量校验,启动失败快速失败。
- `src/errors` / `src/middleware`:类型化错误、全局处理、校验、安全头、请求上下文。
- `src/db`:连接、WAL 配置、追加式迁移、索引。
- `src/modules/<feature>`:每个功能包含 routes(HTTP)→ service(业务规则)→ repository(数据访问)。
- `src/events`:SSE 事件总线与路由。
- `src/docs`:OpenAPI 3.1 文档。
- `src/static`:托管前端产物(深链回退、CSP、assets 长缓存),桌面与单机部署共用。
- `src/desktop`:桌面嵌入入口(`startEmbeddedServer`)、每安装密钥、空闲端口探测。

桌面壳(`desktop/`):

- `src/main`:主进程(生命周期、窗口、菜单、IPC、安全、日志、最近打开、更新检查)。
- `src/preload`:沙箱 preload,只暴露白名单 IPC;通道名与 `src/shared/contract.ts` 由测试强制一致。
- `src/shared`:主进程与 preload 的通道与载荷类型契约。
- `scripts/`:运行时暂存(`stage.mjs`)、打包(`package.mjs`)、图标生成(`make-icons.mjs`)。

## 本地命令

```bash
npm ci
(cd server && npm ci)
cp server/.env.example server/.env
npm run server:migrate
npm run dev:full            # web :5173 + api :3001
```

纯本地前端模式只需 `npm ci && npm run dev`;未配置 VITE_API_BASE_URL 时不发起网络请求。

## 验证门禁

```bash
npm run lint                # 静态不变量检查
npm run typecheck           # 前端类型
npm test                    # 全部 Vitest(前端 + 后端 + 桌面)
npm run test:e2e            # 前端浏览器测试
npm run test:e2e:full       # 全栈浏览器测试(真实 API + SQLite)
npm run build               # 前端构建
npm run server:build        # 后端编译
npm run desktop:stage       # 构建前端+后端并准备 Electron 运行时
npm run desktop:start       # 启动桌面应用
npm run desktop:test        # 桌面主进程类型检查 + 单测
npm run test:e2e:desktop    # 真实 Electron 端到端
npm run verify              # web + API 门禁;桌面与全栈 E2E 单独执行
```

最新实测基线见 [验证记录](verification.md)。CI 包含 `secret`、`web`、`api`、`docker`、`fullstack`、`desktop` 六条并行门禁。

## 代码约束

- 新行为先写失败测试,再做最小实现;不为通过测试删除断言或放宽校验。
- `src/core` 必须保持纯 TypeScript;后端 service 不依赖 Fastify 请求/响应类型。
- 导出只使用已确认的 `baseline`;草稿经显式应用后才成为确认版本。
- 访问令牌只存内存;刷新令牌为 HttpOnly Cookie,服务端仅存哈希。
- 密钥不得进入仓库、日志、localStorage、项目文件或错误信息。
- 数据格式变更必须提供迁移路径与迁移测试。

## 数据格式

- 前端 localStorage / 项目文件:schemaVersion 3,携带 baseline、draft 与报告配置;v1/v2 自动迁移。
- 后端项目文件文档:format + version 1 + 名称/数据/配置,严格校验未知字段。

## 发布

- `ci`:并行执行 web 与 api 校验,api 任务含启动健康检查冒烟。
- `deploy`:版本标签触发,只构建前端并部署到 GitHub Pages(纯前端模式,不构建后端)。
- 容器部署见 [部署指南](deployment.md)。
