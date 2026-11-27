# 部署指南

本项目提供两种运行方式:本地开发(前后端分离热重载)与容器化部署(nginx + API)。

## 本地开发

```bash
npm ci
(cd server && npm ci)
cp server/.env.example server/.env   # 开发占位值即可
npm run server:migrate               # 初始化 SQLite 数据库
npm run dev:full                     # web :5173 + api :3001
```

纯前端本地模式不配置 `VITE_API_BASE_URL` 时不发起任何网络请求,云同步面板会显示提示。

启用云功能时,在 `server/.env` 设置 JWT_SECRET,并创建前端 `.env.local`:

```text
VITE_API_BASE_URL=http://127.0.0.1:3001
```

## 容器化部署

1. 复制 `.env.example` 为 `.env`,设置强随机 `JWT_SECRET`(至少 32 字符)。
2. 按需设置 `CORS_ORIGINS`(同源通过 nginx 代理时通常无需改)。
3. 启动:

```bash
docker compose up -d --build
```

访问 `http://localhost:8080`。镜像构建时默认使用 `VITE_API_BASE_URL=/`（各端点路径自带 `/api/`），由 nginx 同源反向代理到后端（含 SSE 配置），避免出现 `/api/api/...` 重复前缀。SQLite 数据保存在 `api-data` 卷中,容器重建不丢数据。

`COOKIE_SECURE` 在 compose 中默认为 `true`(localhost 视为安全上下文),只有纯 HTTP 的非本机地址才需要显式设为 `false`。生产环境仍应置于 HTTPS 之后,并把 `CORS_ORIGINS` 限制为实际域名。

容器方案由 nginx 反向代理 API,compose 已设 `TRUST_PROXY=true`:限流键改用 nginx 每次覆盖写入的 `X-Real-IP`,避免全体用户共用一个桶。该开关**只适用于这个拓扑**——若把 API 直接暴露给公网,必须保持 `TRUST_PROXY=false`,因为客户端伪造的 `X-Forwarded-For` 不会被信任。nginx 同时下发与自托管 SPA 完全一致的 Content-Security-Policy,二者由 `tests/config/nginxCsp.test.ts` 校验一致性。

## 环境变量

后端变量见 `server/.env.example`,全部在启动时校验,缺失或不合法会快速失败。关键项:

| 变量 | 说明 |
|---|---|
| JWT_SECRET | 签名密钥,生产必须替换占位值 |
| JWT_ACCESS_TTL / JWT_REFRESH_TTL | 访问/刷新令牌有效期 |
| TRUST_PROXY | 仅 nginx 反代拓扑设为 true;直接暴露 API 时保持 false |
| COOKIE_SECURE | 默认 true;仅纯 HTTP 的非本机地址需设为 false |
| DATABASE_PATH | SQLite 文件位置 |
| CORS_ORIGINS | 显式来源,生产禁止 `*` |
| RATE_LIMIT_MAX / WINDOW | 全局限流阈值 |

## 健康检查

- `GET /health`:存活探针;nginx 的 `/health` 会代理到 API,后端不可达时容器判为 unhealthy。
- `GET /ready`:就绪探针(检查数据库连接)。
- `GET /api/docs/json`:OpenAPI 文档。
- `GET /api/docs`:Swagger UI。

## 数据迁移

迁移是追加式的,由 `npm run server:migrate` 在部署前执行;应用启动时也会自动补齐未应用的迁移。已应用的迁移不可修改。

## 备份与恢复

SQLite 单文件便于备份:停止 API 容器后复制 `api-data` 卷中的 `.db` 文件。恢复时放回同名文件并重启即可。
