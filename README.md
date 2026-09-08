<p align="center">
  <img src="assets/brand/icon-rounded.png" alt="Rooster" width="128" height="128" />
</p>

<h1 align="center">Rooster</h1>

<p align="center">在浏览器里与本机 Hermes Agent 对话，查看会话和工具执行过程。</p>

<p align="center">
  <a href="docs/README.en.md">English</a>
</p>

## 这是什么

Rooster 是 Hermes Agent 的个人 Web 面板。浏览器通过 Hono 与 Socket.IO 服务连接 Hermes bridge，显示流式回复、推理片段和工具调用，并将会话和消息保存在本地 SQLite 中。

它适合已经配置好 Hermes Agent、希望使用浏览器对话和回看记录的使用者。Hermes Agent、模型配置和 Python bridge 由外部安装管理；本仓库提供面板及其服务端，没有内置登录或多用户管理。

## 功能

- 流式显示回复、Markdown、代码块、推理内容与工具执行状态，支持中断当前运行。
- 响应 bridge 发出的工具审批和澄清请求，显示上下文压缩进度及连接状态。
- 浏览、搜索、重命名和删除本地会话，导出 JSON 或 Markdown；支持聊天附件上传。
- 从 bridge 已有会话中发现 profile、model 和 provider，选择后用于新对话。
- 提供浅色 / 深色主题，以及面向协议事件的调试面板。

管理区的 Profiles、Models 目前是从已有会话发现信息的只读预览。Skills、Plugins、Memory、Files、Logs、Jobs、Settings 页面尚未接入各自的 bridge 协议和服务端接口，不能用来管理相应资源。对话、审批和压缩能力取决于连接的 bridge 是否支持这些事件。

## 使用

### 准备 Hermes 与 bridge

先在本机安装并配置 Hermes Agent，确认它能调用所选模型。还需要兼容的 `hermes_bridge.py` 和具备其依赖的 Python 环境；该脚本来自外部 `hermes-web-ui` 安装或 checkout，未包含在 Rooster 仓库中。

启动脚本会尝试查找 Hermes 的虚拟环境和 `~/.hermes/hermes-web-ui/` 下的 bridge，也支持明确指定路径。克隆项目并安装依赖后，在启动 Rooster 的终端中设置实际路径：

```bash
export HERMES_AGENT_ROOT="/absolute/path/to/hermes-agent"
export HERMES_AGENT_BRIDGE_PYTHON="/absolute/path/to/hermes-agent/venv/bin/python3"
export HERMES_BRIDGE_SCRIPT="/absolute/path/to/hermes-web-ui/dist/server/agent-bridge/hermes_bridge.py"

bun run dev:all
```

打开 `http://localhost:7037`。启动脚本先连接或启动 bridge，再启动服务端和前端；默认服务端地址为 `http://127.0.0.1:7038`。如果已有兼容 bridge 正在运行，可用 `bun run dev` 只启动前后端。

### 常用配置

配置通过进程环境变量传入：

| 变量 | 用途 / 默认值 |
| --- | --- |
| `HERMES_HOME` | Hermes 数据目录；bridge 脚本默认 `~/.hermes` |
| `HERMES_AGENT_ROOT` | Hermes Agent checkout；默认 `~/.hermes/hermes-agent` |
| `HERMES_AGENT_BRIDGE_PYTHON` | 运行 bridge 的 Python 可执行文件 |
| `HERMES_BRIDGE_SCRIPT` | 外部 `hermes_bridge.py` 路径 |
| `HERMES_AGENT_BRIDGE_ENDPOINT` | bridge 的 IPC 或 TCP 地址；默认 Unix socket `/tmp/hermes-agent-bridge.sock` |
| `ROOSTER_DB_PATH` | SQLite 路径；默认服务进程工作目录下的 `rooster.db` |
| `BIND_HOST` / `PORT` | 服务监听地址与端口；默认 `127.0.0.1` / `7038` |

上传文件保存在服务进程工作目录下的 `uploads/`。默认开发代理固定转发到端口 `7038`，修改服务端口时需同步调整 `packages/client/vite.config.ts`。服务没有内置鉴权，跨机器访问时需要由自己的反向代理或网络访问控制限制入口。

## 开发

需要 Bun、Node.js 22.12+、Bash 和可用的 Python 3 环境。`better-sqlite3` 是原生扩展；没有匹配 Node ABI 的预编译包时，需要 Python 与 C/C++ 构建工具。

```bash
git clone https://github.com/nocoo/rooster.git
cd rooster
bun install --frozen-lockfile
bun run rebuild:native
```

随后按上面的 bridge 配置运行 `bun run dev:all`。`rebuild:native` 会检查 SQLite 扩展是否适用于当前 Node，并在必要时下载预编译包或调用 node-gyp 编译。更换 Node 版本后可重新运行。

```bash
bun run build
bun run typecheck
bun run lint
```

`build` 生成服务端 JavaScript 和客户端静态文件。服务端的 `start` 脚本运行编译结果，但当前 Hono 入口不托管客户端静态目录；独立部署需要为客户端、`/api`、`/health` 与 Socket.IO 配置对应服务入口。

```text
packages/client/    Preact 界面、signals 状态和 Socket.IO 客户端
packages/server/    Hono API、SQLite、聊天运行编排与 bridge 客户端
scripts/            bridge 生命周期和原生依赖工具
docs/               架构、协议记录与英文 README
```

## 测试

从仓库根目录运行：

| 测试层 | 命令 |
| --- | --- |
| 服务端单元测试与前端组件测试 | `bun run test` |
| HTTP / Socket.IO 集成测试 | `bun run test:e2e` |
| bridge 启动脚本集成测试 | `bash scripts/test-bridge-lifecycle.sh` |

前两项会先检查并重建 SQLite 原生扩展。HTTP / Socket.IO 测试使用临时端口、内存数据库和模拟 bridge，不需要真实 Hermes 或模型凭据；脚本测试需要 Bash、Python 3 和 Unix socket，使用临时目录及 dry-run 模式。`bun run test:coverage` 生成覆盖率报告。当前没有配置浏览器端到端测试命令。

## 技术栈

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Preact](https://img.shields.io/badge/Preact-673AB8?logo=preact&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?logo=socketdotio&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)

| 部分 | 实现 |
| --- | --- |
| Web 界面 | Preact、Preact Signals、Primer CSS、Vite |
| 服务端 | TypeScript、Node.js、Hono、Socket.IO、Pino |
| 本地数据 | SQLite / better-sqlite3，文件附件 |
| Agent 连接 | JSON 行协议，通过 Unix socket 或 TCP 连接外部 Python bridge |
| 测试 | Vitest、Preact Testing Library、happy-dom |

依赖以根目录及各 workspace 的 [package.json](package.json) 为准。

## 文档

- [文档索引](docs/README.md)
- [架构概览](docs/01-architecture-overview.md)
- [服务端设计](docs/02-server-design.md)
- [前端设计](docs/03-frontend-design.md)
- [通信协议](docs/04-communication-protocol.md)
- [WebSocket 协议](docs/06-websocket-protocol.md)
- [品牌资源与使用](assets/brand/README.md)

设计文档包含规划和历史阶段；上面的功能范围以当前实现为准。

## 许可证

[Apache License 2.0](LICENSE)
