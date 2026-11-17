# 验证记录

本文档记录 v1.3.0 的本地验收基线与执行方式,便于维护者复现。

## 门禁命令

```bash
npm run verify          # 前端 typecheck + 全部单测 + E2E + 构建 + 后端测试/构建
npm run test:e2e:full   # 全栈浏览器测试(真实 API + SQLite)
npm run desktop:test    # 桌面主进程类型检查 + 单测
npm run test:e2e:desktop # 真实 Electron 端到端(受限环境加 WHATIF_E2E_NO_SANDBOX=1)
```

## 最近一次通过结果(2026-11-17)

| 检查 | 结果 |
|---|---|
| `npm run typecheck` | 通过 |
| `npm test`(根 Vitest,含前端与后端) | 70 文件 / 312 项通过 |
| `npm run server:test`(后端 Vitest) | 35 文件 / 120 项通过 |
| `npm run test:e2e`(浏览器) | 13 项通过 |
| `npm run test:e2e:full`(真实前后端) | 2 项通过 |
| `npm run desktop:test`(桌面主进程) | 9 文件 / 45 项通过 |
| `npm run test:e2e:desktop`(真实 Electron) | 11 项通过 |
| `npm run build`(前端生产构建) | 通过,首屏 269 kB(gzip 85 kB)+ 表格 427 kB / Word 171 kB 懒加载块 |
| `npm run server:build` | 通过 |
| `npm run smoke`(server,真实进程) | 健康/就绪/注册端点通过 |
| `docker compose config` | 配置有效 |
| `electron-builder --mac arm64`(dmg + zip) | 打包成功,打包后启动冒烟通过 |

## 覆盖要点

- 核心:确定性指标、并列规则、零值边界、报告模型、影响列表、状态机、迁移。
- 适配器:Excel/CSV 解析与非法输入、Word OOXML 内容、本地存储与项目文件。
- API:认证生命周期、刷新家族轮换、RBAC、项目 CRUD 与乐观锁、草稿生命周期、报告与分析、审计、限流、请求体上限、404/400 规范化、安全头、OpenAPI。
- 浏览器:导入→试改→定位→应用→导出、恢复与清除、CSV 列映射、配置持久化、可访问性与键盘操作、无外发请求、真实后端注册与云项目保存。
- 性能:SQLite 查询计划验证索引命中。

## 手动验证

- 启动 `npm run dev:full`:web 5173 与 api 3001 同时就绪。
- 容器:`docker compose up -d --build` 后访问 8080,`/health` 与 `/api/docs` 可用。
- 截图:`docs/screenshot.png` 由真实浏览器会话生成,`docs/desktop.png` 由真实 Electron 窗口截取。
- 桌面:启动打包后的 `.app` 后 `logs/main.log` 出现 `api listening`,访问该 origin 的 `/health` 返回 `ok`、`/` 返回 200,`data/whatif.db` 与 `jwt-secret.key` 生成。
