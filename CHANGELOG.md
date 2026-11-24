# 变更记录

本项目采用 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 的结构，并在发布后使用语义化版本。

## [1.4.0] - 2026-11-24（桌面体验补齐）

### Added

- 深色主题：「视图 › 外观」与工具栏按钮都可在跟随系统/浅色/深色之间切换；偏好写入 `state/theme.json`，主进程同步 `nativeTheme.themeSource`，原生窗框、CSS 调色板与首帧背景一起变化。
- 浏览器端同款主题控制：手动选择存 localStorage，「跟随系统」监听 `prefers-color-scheme`；除浅色外补齐深色变量，表格高亮、错误/提示条、图表轨道、AI 结果等原有硬编码浅色一并变量化。
- 拖拽导入：把 `.json` 项目或 `.xlsx/.xls/.csv` 表格拖入窗口即可导入；主进程复用打开对话框的校验（扩展名、大小、必须是普通文件），渲染进程只拿到重建后的 `File`。
- 主进程拦截拖放触发的 `file://` / `data:` 导航，避免本地文件被交给系统浏览器。

### Changed

- 主题由 `<html data-theme>` 显式驱动，桌面与浏览器共用一份控制器；原生菜单在主题变化后重建，radio 勾选状态立即更新。

### Verified

- 根 Vitest：76 文件 / 329 项；后端 Vitest：35 文件 / 120 项；桌面单测：10 文件 / 52 项。
- 浏览器 E2E 13 项、全栈 E2E 2 项、Electron E2E 14 项通过。
- 新增 E2E 覆盖主题切换与持久化、项目拖入导入、不支持文件的拒绝；新增前端单测覆盖主题三态与拖放路径回退。

## [1.3.0] - 2026-11-17（桌面加固与性能）

### Added

- 桌面 API 会话令牌：每次启动生成 32 字节随机令牌，`/api/*` 必须携带 `x-whatif-session`，阻断同机其它进程直接读写项目库；令牌经同步 IPC 交给渲染进程（不走 argv）。
- 迁移前自动快照：schema 有变更时用 SQLite 在线备份 API 复制到 `<profile>/backups`，保留最近 5 份；快照失败不阻塞启动。
- Electron fuses：关闭 `runAsNode`、`NODE_OPTIONS`、CLI inspect 与额外 file 协议权限，开启 Cookie 加密、asar 完整性校验与 only-load-from-asar。
- 桌面 E2E 增至 11 项：未保存标记、菜单指令回传、窗口位置跨重启恢复、经守卫的注册流程。
- 后端日志测试（文件写入、脱敏、pretty 缺失回退）与数据库快照测试。

### Changed

- 首屏 JS 从 694 kB 降到 269 kB（gzip 227→85 kB）：SheetJS 改为按需加载，只在导入/导出表格时下载 427 kB 分块。
- 桌面构建不再注册 Swagger UI，并把 `pino-pretty` 移到 devDependencies：包体减少约 4.7 MB，少一个可访问路由；缺少 pretty 传输时自动退回 JSON 日志。
- 桌面顶部拖拽条改为半透明 + 背景模糊，滚动内容不再被不透明色块切掉。
- CI 桌面任务缓存 Electron 与 Playwright 浏览器，失败时上传 `test-results` 与报告。

### Verified

- 根 Vitest：70 文件 / 312 项；后端 Vitest：35 文件 / 120 项；桌面单测：9 文件 / 45 项。
- 浏览器 E2E 13 项、全栈 E2E 2 项、Electron E2E 11 项通过。
- 打包后启动冒烟通过，`electron-fuses read` 确认八个 fuse 均为预期状态。

## [1.2.0] - 2026-11-17（桌面应用迭代）

### Added

- Electron 桌面应用：主进程内嵌 Fastify 服务，同源托管 React 前端，仅监听 `127.0.0.1` 随机端口。
- 原生菜单（文件/编辑/视图/窗口/帮助）、系统对话框（打开/保存/导入）、最近打开、窗口状态记忆、单实例。
- 快捷键 ⌘O 打开、⌘S 就地保存、⌘I 导入、⌘E/⇧⌘E 导出；未应用草稿在关闭按钮上显示圆点。
- 命令行与 Finder「打开方式」传入 `.json` 时自动载入；站外链接与权限请求一律拦截。
- 每安装独立 JWT 密钥（0600）、主进程/服务端日志落盘（2 MB 轮转）、页脚数据与日志目录入口。
- electron-updater 更新检查（`WHATIF_UPDATE_FEED`，仅 https）、electron-builder 打包（dmg/zip/nsis/AppImage）、纯 Node 图标生成脚本。
- 桌面主进程单测 45 项、真实 Electron 端到端 7 项。

### Changed

- 后端支持 `SERVE_STATIC`/`STATIC_DIR` 托管前端产物（CSP、深链回退、assets 长缓存）与 `LOG_FILE` 落盘日志。
- 导出统一为「保存 Blob」抽象：桌面走系统保存对话框并提示保存路径，浏览器保持下载行为。
- 表格导入抽出 `importTabularFile`，文件选择与桌面打开对话框共用同一套校验与列映射。
- 前端 API 基址支持运行时推导：桌面取页面 origin，浏览器仍由 `VITE_API_BASE_URL` 决定。
- 版本统一到 1.2.0（根 / 后端 / 桌面），OpenAPI 版本随 manifest 生成。

### Fixed

- `@fastify/static` 十版 `setHeaders` 收到的是 Fastify reply 而非裸 `ServerResponse`，改为使用 reply 头方法。
- 桌面主进程的 `import()` 被 TypeScript 降级为 `require(file://…)` 导致启动失败，改用具名 `require` 加载 ESM 入口。
- better-sqlite3 与 Electron ABI 冲突：在隔离的暂存目录执行 `npm ci` + `electron-rebuild`，不再破坏系统 Node 下的后端测试。
- Vitest 不再收集 `e2e-desktop/`，避免与 Playwright 用例冲突。

### Verified

- 根 Vitest：70 文件 / 293 项通过；后端 Vitest：32 文件 / 103 项通过。
- 浏览器 E2E 13 项、全栈 E2E 2 项、桌面单测 45 项、Electron E2E 7 项通过。
- 前端/后端/主进程构建、`npm run smoke`、dmg 与 zip 打包及打包后启动冒烟通过。

## [1.1.0] - 2026-11-17（全栈化迭代）

### Added

- 后端 Fastify 5 + SQLite(better-sqlite3,WAL)服务,分层为 routes/services/repositories。
- 集中环境变量校验、类型化错误体系、结构化日志与请求 ID、全局错误处理、健康检查与优雅停机。
- 认证体系:scrypt 密码哈希、JWT 访问令牌、哈希存储的刷新令牌与家族轮换、HttpOnly Cookie、RBAC。
- 项目与报告 API:CRUD、草稿编辑/应用/撤销、乐观锁、服务端权威计算、分页排序、审计日志与 OpenAPI。
- SSE 项目变更通知(带心跳与自动重连)与管理员审计查询端点。
- 前端类型化 API 客户端(401 自动刷新、5xx 指数退避重试)、内存会话、登录注册、项目列表、账号设置与可选云面板。
- Docker 与 docker-compose 部署、CI 前后端并行校验、全栈端到端测试。

### Changed

- 云功能需显式配置 `VITE_API_BASE_URL`;纯本地模式不发任何网络请求。
- Word 导出改为按需加载,首屏 bundle 由 838 kB 降至 692 kB。
- 数据库新增迁移 5 的覆盖索引,列表与审计查询使用索引。

### Verified

- 根 Vitest:59 文件 / 236 项通过;后端 Vitest:30 文件 / 91 项通过。
- 浏览器 E2E 13 项、全栈 E2E(真实 API + SQLite)2 项通过。
- 前后端生产构建、启动冒烟与 `docker compose config` 通过。

## [1.0.0] - 2026-11-16

### Added

- 统一的数据格式:schemaVersion 3 同时用于 localStorage 与项目文件,v1/v2 读取时自动迁移。
- 报告配置随本地存储持久化,刷新后保留。
- 用户指南、开发指南与可访问性端到端检查。
- 可复现发布流程:CI 全门禁与版本标签触发的 GitHub Pages 部署工作流。

### Changed

- `package.json` 版本升至 1.0.0。

### Notes

- Pages 的实际部署需在授权后推送版本标签触发;本版本不声称已完成线上部署。

## [0.5.0] - 2026-11-16

### Added

- WPS 宿主适配器:复用 core 把宿主表格值转换为指标、影响、报告与图表,不引入 WPS 运行时依赖。
- 能力矩阵与集成说明文档,记录客户端基线、权限边界与未验证项。

### Notes

- 本版本是可行性验证,未在真实 WPS 客户端做手动兼容性测试;文件级导入导出仍是正式路径。

## [0.4.0] - 2026-11-16

### Added

- 可选的 AI 文案润色:用户主动打开设置并确认后才执行,默认不改变报告。
- 可替换的 AI provider 接口与 OpenAI 兼容 HTTP 实现;运行时密钥仅存内存,用后清除。
- 确定性模板回退:未配置密钥或 provider 失败时返回原文。
- 数值护栏:校验 AI 结果的所有数值 token 与原报告一致,否则拒绝并回退,AI 不参与数值计算与影响判断。

## [0.3.0] - 2026-11-16

### Added

- 报告配置面板:切换报告块显示、调整顺序,预览即时更新。
- 确定性区域柱状图(纯 CSS,无图表库),随草稿数据变化。
- 项目文件升级到 schemaVersion 3,保存并恢复报告配置;v1/v2 文件自动迁移。

### Fixed

- 清除本地项目时同步恢复默认报告配置,避免残留上一次的显示设置。

## [0.2.0] - 2026-11-16

### Added

- CSV 导入:处理 BOM、CRLF/LF、引号包裹与转义引号,并执行扩展名与 10 MiB 限制。
- 引导式列映射:自动检测区域/上期/当前列,用户确认后才写入项目;取消不改变状态。
- 项目文件(`.json`)导入导出:schemaVersion 2 文档保留 baseline 与 draft,并从 v1 本地快照迁移。
- 精确的数据异常提示(含行号与字段)与迁移单元测试。

### Changed

- 导入控件合并为「导入 Excel 或 CSV」;CSV 需通过列映射对话框确认。

## [0.1.0] - 2026-11-16（本地验收通过，尚未公开发布）

### Added

- 固定 `.xlsx` 模板与虚构示例：导入、结构校验和中文错误提示；拒绝公式、文本数字、空值、负数、非有限值、重复区域与超大文件。
- 纯 TypeScript 核心：总销售额、同比增长率、第一区域及并列规则，确定性中文报告模型与变化影响列表。
- 草稿编辑、应用、撤销、来源单元格与报告块高亮定位。
- 从已确认 `baseline` 导出新的 `.xlsx` 与 `.docx`；未应用草稿不进入导出，并给出常驻提示。
- `what-if-report:project:v1` 版本化本地恢复、刷新恢复，以及二次确认后彻底清除并回到虚构示例。
- 73 项单元测试、5 项 Playwright 端到端测试、CI 工作流，以及覆盖六道命令的发布前验证。
- 界面截图、README、贡献指南、行为准则、安全说明、路线图和 Issue/PR 模板。

### Not yet published

- 推送到公开远程仓库、启用 GitHub Pages、创建 release 与分享静态演示链接。上述均为外部发布动作，需维护者显式批准。
