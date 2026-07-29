# DBView - 可视化数据库管理 & 智能 NL-to-SQL 平台

> **光明 · 自然 · 美好** —— 专为晨读营与生命教练打造的现代化可视化数据库管理与智能 AI 检索系统。

---

## 🌟 核心特性

- **✨ 智能 AI 探索器 (Natural Language to SQL)**：无需编写复杂 SQL 语句，输入自然语言意图，AI 自动生成只读 SQL 并呈现结构化数据与图形总结。
- **📊 智能数据罗盘 (Discovery Hub)**：提供开箱即用高频分析卡片，涵盖学员活跃度榜单、生命教练讨论金句、热门主题全览。
- **🔒 安全鉴权与白名单控制 (Supabase Auth)**：集成 Supabase JWT 端到端加密，支持灵活的邮箱白名单列表控制 (`ALLOWED_EMAILS`)。
- **☀️ 光明自然美学 UI**：高通透云光白调色盘、大圆角与气垫般轻盈环境阴影，提供极度舒适的交互体验。
- **🐳 生产级 Docker 容器化**：双核镜像对称架构（Node 20 后端 + Nginx 前端反向代理），提供一键发布 Shell 脚本 (`deploy.sh`)。

---

## 🏗️ 项目架构

```
dbview/                               # 项目根目录
├── backend/                          # 📁 后端独立工程 (Express + Node.js)
│   ├── server.js                     # API 路由与 Supabase 鉴权
│   ├── server-nl.js                  # 自然语言转 SQL AI 服务
│   └── Dockerfile                    # 后端容器构建文件
├── frontend/                         # 📁 前端独立工程 (Vite + React)
│   ├── src/                          # 前端组件与 Supabase 客户端
│   ├── nginx.conf                    # 生产级 Nginx 反向代理配置
│   └── Dockerfile                    # 前端多阶段容器构建文件
├── docs/                             # 系统 Schema 与所有者文档
├── docker-compose.yml                # 容器化统一编排文件
├── deploy.sh                         # 一键自动化发布脚本
└── README.md                         # 项目说明文档
```

---

## 🚀 快速开始

### 1. 本地开发环境启动

```bash
# 1. 复制环境变量模版并配置凭证
cp .env.example .env

# 2. 安装前后端所有依赖
npm run install-all

# 3. 一键并发启动开发服务器 (后端: 3001, 前端: 5173)
npm run dev
```

### 2. Docker 容器化生产发布

```bash
# 执行一键部署发布脚本
./deploy.sh
```

部署完成后：
- 前端入口：`http://localhost` (或在 `.env` 中配置 `FRONTEND_PORT`)
- 健康检查探针：`http://localhost:3001/api/health`

---

## 📄 开源许可

MIT License © 2026 DBView Team
