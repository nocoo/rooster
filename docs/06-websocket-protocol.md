# WebSocket 协议规范（前端实现）

本文档详细描述 Rooster 项目中前端需要实现的 WebSocket 通信协议。协议基于 **Socket.IO**（仅 WebSocket 传输），命名空间为 `/chat-run`。

---

## 1. 连接

### 1.1 连接方式

```typescript
import { io } from 'socket.io-client'

const socket = io('/chat-run', { transports: ['websocket'] })
```

| 配置项 | 值 | 说明 |
|--------|------|------|
| 命名空间 | `/chat-run` | 聊天运行专用命名空间 |
| 传输方式 | `websocket` | 仅使用 WebSocket，不回退到轮询 |

### 1.2 连接状态

前端维护一个 `connected` 信号量，监听 Socket.IO 内置事件：

| 事件 | 行为 |
|------|------|
| `connect` | 设置 `connected = true` |
| `disconnect` | 设置 `connected = false` |

---

## 2. 客户端发送事件（Client → Server）

前端可主动发送以下 3 个事件：

### 2.1 `run` — 发起对话

触发一次 AI 对话运行。

```typescript
socket.emit('run', payload)
```

**Payload 类型：`RunPayload`**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `input` | `string` | ✅ | 用户输入的消息文本 |
| `session_id` | `string` | ❌ | 会话 ID，不传则由服务端生成 UUID |
| `model` | `string` | ❌ | 指定模型（如 `"claude-sonnet-4-6"`） |
| `provider` | `string` | ❌ | 提供商标识 |
| `profile` | `string` | ❌ | Agent 配置文件名 |
| `instructions` | `string` | ❌ | 额外系统指令 |
| `source` | `string` | ❌ | 消息来源标识 |
| `display_input` | `string` | ❌ | 用于展示的替代文本（实际发给模型的仍是 `input`） |
| `display_role` | `string` | ❌ | 展示角色 |
| `storage_message` | `boolean` | ❌ | 是否持久化存储消息 |
| `model_groups` | `string[]` | ❌ | 模型组列表 |
| `queue_id` | `string` | ❌ | 队列标识 |

**示例：**

```json
{
  "input": "帮我解释这段代码的作用",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "model": "claude-sonnet-4-6",
  "profile": "coder"
}
```

---

### 2.2 `abort` — 中止运行

中止当前正在执行的对话运行。

```typescript
socket.emit('abort', payload)
```

**Payload 类型：`AbortPayload`**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_id` | `string` | ✅ | 要中止运行的会话 ID |

**示例：**

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### 2.3 `resume` — 恢复会话

重新加入一个已有会话，拉取历史消息和当前状态。

```typescript
socket.emit('resume', payload)
```

**Payload 类型：`ResumePayload`**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_id` | `string` | ✅ | 要恢复的会话 ID |

**示例：**

```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 3. 服务端推送事件（Server → Client）

服务端在对话运行的不同生命周期阶段推送以下事件。所有事件 payload 均包含 `event` 字段（值等于事件名称）作为类型鉴别符。

### 3.1 `run.started` — 运行已启动

表示服务端已成功启动一次对话运行。

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | `"run.started"` | 事件类型标识 |
| `session_id` | `string` | 会话 ID |
| `run_id` | `string` | 本次运行的唯一 ID |
| `queue_length` | `number` | 当前队列中等待处理的任务数 |

**示例：**

```json
{
  "event": "run.started",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "run_id": "run_abc123",
  "queue_length": 0
}
```

**前端行为：** 记录 `run_id`，将 UI 标记为"正在响应"状态。

---

### 3.2 `message.delta` — 文本流式增量

传输 AI 生成文本的流式片段。

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | `"message.delta"` | 事件类型标识 |
| `session_id` | `string` | 会话 ID |
| `run_id` | `string` | 运行 ID |
| `delta` | `string` | 本次增量文本（相对于上一次的新增部分） |
| `output` | `string` | 截至当前的完整累积输出 |

**示例：**

```json
{
  "event": "message.delta",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "run_id": "run_abc123",
  "delta": "这段代码的作用是",
  "output": "这段代码的作用是"
}
```

**前端行为：** 直接使用 `output` 字段更新流式显示区域（`output` 是服务端维护的累积值，无需客户端拼接）。

---

### 3.3 `run.completed` — 运行完成

表示一次对话运行正常结束。

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | `"run.completed"` | 事件类型标识 |
| `session_id` | `string` | 会话 ID |
| `run_id` | `string` | 运行 ID |
| `output` | `string` | 最终完整输出文本 |
| `result` | `unknown \| undefined` | Agent 返回的结构化结果（可选） |
| `error` | `string \| null \| undefined` | 非致命错误信息（有值时仍算正常完成） |
| `inputTokens` | `number \| undefined` | 输入 token 消耗量 |
| `outputTokens` | `number \| undefined` | 输出 token 消耗量 |
| `contextTokens` | `number \| undefined` | 上下文 token 消耗量 |
| `queue_remaining` | `number \| undefined` | 队列剩余任务数 |

**示例：**

```json
{
  "event": "run.completed",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "run_id": "run_abc123",
  "output": "这段代码实现了一个事件驱动的消息队列...",
  "result": null,
  "error": null,
  "inputTokens": 1250,
  "outputTokens": 340,
  "contextTokens": 8000
}
```

**前端行为：**
1. 将 `output`（或已流式收集的输出）作为 assistant 消息追加到消息列表
2. 清除运行状态（streaming、tools、reasoning 等全部重置）
3. 刷新会话列表

---

### 3.4 `run.failed` — 运行失败

表示对话运行发生致命错误。

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | `"run.failed"` | 事件类型标识 |
| `session_id` | `string` | 会话 ID |
| `run_id` | `string \| undefined` | 运行 ID（可能不存在，如 session 不存在时） |
| `error` | `string` | 错误描述 |
| `output` | `string \| undefined` | 失败前已产生的部分输出 |
| `inputTokens` | `number \| undefined` | 输入 token 消耗量 |
| `outputTokens` | `number \| undefined` | 输出 token 消耗量 |
| `contextTokens` | `number \| undefined` | 上下文 token 消耗量 |
| `queue_remaining` | `number \| undefined` | 队列剩余任务数 |

**示例：**

```json
{
  "event": "run.failed",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "run_id": "run_abc123",
  "error": "Agent run failed"
}
```

**前端行为：**
1. 如果已有部分流式输出，将其作为 assistant 消息保存
2. 清除运行状态
3. 设置 `error` 信号以展示错误提示

---

### 3.5 `tool.started` — 工具调用开始

Agent 开始调用一个工具。

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | `"tool.started"` | 事件类型标识 |
| `session_id` | `string` | 会话 ID |
| `run_id` | `string` | 运行 ID |
| `tool_call_id` | `string` | 工具调用唯一标识（用于匹配 completed 事件） |
| `tool` | `string` | 工具类型标识 |
| `name` | `string` | 工具名称（如 `"read_file"`、`"bash""`） |
| `arguments` | `string` | 工具调用参数（JSON 字符串） |
| `preview` | `string \| undefined` | 参数摘要/预览文本 |

**示例：**

```json
{
  "event": "tool.started",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "run_id": "run_abc123",
  "tool_call_id": "tc_m5k2x9",
  "tool": "read_file",
  "name": "read_file",
  "arguments": "{\"path\":\"/src/index.ts\"}",
  "preview": "/src/index.ts"
}
```

**前端行为：** 向 `tools` 数组追加一项 `{ tool_call_id, name, status: 'started', arguments, preview }`，在 UI 中展示正在执行的工具。

---

### 3.6 `tool.completed` — 工具调用完成

对应一个之前 started 的工具调用已完成。

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | `"tool.completed"` | 事件类型标识 |
| `session_id` | `string` | 会话 ID |
| `run_id` | `string` | 运行 ID |
| `tool_call_id` | `string` | 与 `tool.started` 对应的标识 |
| `tool` | `string` | 工具类型标识 |
| `name` | `string` | 工具名称 |
| `output` | `string` | 工具输出结果 |
| `duration` | `number \| undefined` | 执行耗时（毫秒） |
| `error` | `string \| undefined` | 工具执行错误信息 |

**示例：**

```json
{
  "event": "tool.completed",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "run_id": "run_abc123",
  "tool_call_id": "tc_m5k2x9",
  "tool": "read_file",
  "name": "read_file",
  "output": "import express from 'express'...",
  "duration": 45
}
```

**前端行为：** 通过 `tool_call_id` 匹配，将对应工具条目更新为 `status: 'completed'`，附加 `output`、`duration`、`error`。

---

### 3.7 `reasoning.delta` — 推理文本增量

传输 AI 推理（reasoning）过程的流式片段。

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | `"reasoning.delta"` | 事件类型标识 |
| `session_id` | `string` | 会话 ID |
| `run_id` | `string` | 运行 ID |
| `text` | `string` | 推理文本增量 |

**示例：**

```json
{
  "event": "reasoning.delta",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "run_id": "run_abc123",
  "text": "Let me analyze the code structure..."
}
```

**前端行为：** 将 `text` 追加到 `reasoning` 累积字符串中，展示 AI 的思考过程。

---

### 3.8 `thinking.delta` — 思考文本增量

与 `reasoning.delta` 语义相同，是推理文本的等价事件（模型可能使用不同的事件名称发出思考内容）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | `"thinking.delta"` | 事件类型标识 |
| `session_id` | `string` | 会话 ID |
| `run_id` | `string` | 运行 ID |
| `text` | `string` | 思考文本增量 |

**示例：**

```json
{
  "event": "thinking.delta",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "run_id": "run_abc123",
  "text": "I need to check the function signature..."
}
```

**前端行为：** 与 `reasoning.delta` 处理逻辑完全一致——追加到同一个 `reasoning` 累积字符串中。

---

### 3.9 `reasoning.available` — 推理已就绪

表示推理阶段已完成，后续的 `message.delta` 为正式输出。

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | `"reasoning.available"` | 事件类型标识 |
| `session_id` | `string` | 会话 ID |
| `run_id` | `string` | 运行 ID |

**示例：**

```json
{
  "event": "reasoning.available",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "run_id": "run_abc123"
}
```

**前端行为：** 设置 `reasoningDone = true`，UI 可据此收起思考区域或展示"思考完毕"标识。

---

### 3.10 `agent.event` — Agent 自定义事件

Agent 运行过程中的通用事件通道，用于传递不属于上述标准事件的额外信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | `"agent.event"` | 事件类型标识 |
| `session_id` | `string` | 会话 ID |
| `run_id` | `string` | 运行 ID |
| `type` | `string` | 自定义事件类型（如 `"status"`、`"config_loaded"`） |
| `profile` | `string \| undefined` | Agent 配置文件名 |
| `model` | `string \| undefined` | 当前使用的模型 |
| `provider` | `string \| undefined` | 当前提供商 |
| `tool_count` | `number \| undefined` | 可用工具数量 |
| `[key: string]` | `unknown` | 其他任意扩展字段 |

**示例：**

```json
{
  "event": "agent.event",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "run_id": "run_abc123",
  "type": "status",
  "profile": "coder",
  "model": "claude-sonnet-4-6",
  "provider": "anthropic",
  "tool_count": 12
}
```

**前端行为：** 追加到 `agentEvents` 数组中，UI 可展示 Agent 状态信息（如状态栏显示当前模型、配置、工具数量等）。

---

### 3.11 `abort.started` — 中止已发起

服务端已收到中止请求，正在执行优雅停止。

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | `"abort.started"` | 事件类型标识 |
| `session_id` | `string` | 会话 ID |
| `run_id` | `string` | 运行 ID |
| `graceMs` | `number` | 优雅停止的等待时间（毫秒） |

**示例：**

```json
{
  "event": "abort.started",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "run_id": "run_abc123",
  "graceMs": 5000
}
```

**前端行为：** 可选择展示"正在停止..."提示。注意：当前前端代码未监听此事件，但服务端会发出。

---

### 3.12 `abort.completed` — 中止已完成

运行已被成功中止。

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | `"abort.completed"` | 事件类型标识 |
| `session_id` | `string` | 会话 ID |
| `run_id` | `string` | 运行 ID |
| `synced` | `boolean` | 中止是否与 Agent 同步完成（`true` = 正常中止，`false` = 可能未完全同步） |
| `error` | `string \| undefined` | 中止过程中的错误 |
| `queue_length` | `number \| undefined` | 中止后的队列长度 |

**示例：**

```json
{
  "event": "abort.completed",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "run_id": "run_abc123",
  "synced": true
}
```

**前端行为：** 清除该 session 的全部运行状态（streaming、aborting、tools 等全部重置）。

---

### 3.13 `resumed` — 会话恢复

对 `resume` 请求的响应，返回会话的当前状态快照。

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | `"resumed"` | 事件类型标识 |
| `session_id` | `string` | 会话 ID |
| `messages` | `Message[]` | 会话的完整消息列表 |
| `isWorking` | `boolean` | 当前是否有运行中的任务 |
| `isAborting` | `boolean` | 当前是否正在中止 |
| `events` | `unknown[]` | 未完成事件列表 |
| `inputTokens` | `number \| undefined` | 累计输入 token |
| `outputTokens` | `number \| undefined` | 累计输出 token |
| `contextTokens` | `number \| undefined` | 上下文 token |
| `queueLength` | `number \| undefined` | 队列长度 |
| `queueMessages` | `unknown[] \| undefined` | 队列中的消息 |

其中 `Message` 类型为：

```typescript
interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string  // ISO 8601 格式
}
```

**示例：**

```json
{
  "event": "resumed",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "messages": [
    {
      "id": "msg_001",
      "session_id": "550e8400-e29b-41d4-a716-446655440000",
      "role": "user",
      "content": "你好",
      "timestamp": "2026-05-26T10:00:00.000Z"
    },
    {
      "id": "msg_002",
      "session_id": "550e8400-e29b-41d4-a716-446655440000",
      "role": "assistant",
      "content": "你好！有什么可以帮你的？",
      "timestamp": "2026-05-26T10:00:05.000Z"
    }
  ],
  "isWorking": false,
  "isAborting": false,
  "events": []
}
```

**前端行为：**
1. 仅处理 `activeSessionId` 对应的恢复事件
2. 如果 `messages` 非空，替换当前消息列表
3. 恢复 `streaming` 和 `aborting` 状态

---

## 4. 事件生命周期与状态机

### 4.1 正常对话流程

```
Client                          Server
  │                               │
  │─── run ──────────────────────►│
  │                               │
  │◄── run.started ───────────────│
  │                               │
  │◄── reasoning.delta ───────────│  (0~N 次)
  │◄── thinking.delta ────────────│  (0~N 次)
  │◄── reasoning.available ───────│  (0~1 次)
  │                               │
  │◄── tool.started ──────────────│  ┐
  │◄── tool.completed ────────────│  ┘ (0~N 组)
  │                               │
  │◄── message.delta ─────────────│  (0~N 次)
  │                               │
  │◄── agent.event ──────────────│  (0~N 次, 可能穿插)
  │                               │
  │◄── run.completed ─────────────│
  │                               │
```

### 4.2 中止流程

```
Client                          Server
  │                               │
  │─── abort ────────────────────►│
  │                               │
  │◄── abort.started ─────────────│
  │                               │  (等待 graceMs)
  │◄── abort.completed ───────────│
  │                               │
```

### 4.3 恢复流程

```
Client                          Server
  │                               │
  │─── resume ───────────────────►│
  │                               │
  │◄── resumed ───────────────────│  (会话存在)
  │  或                            │
  │◄── run.failed ────────────────│  (会话不存在)
  │                               │
```

### 4.4 断连处理

当 WebSocket 连接断开时，服务端自动中止该连接上的活跃运行（调用 `abortController.abort()`）。

---

## 5. 前端状态模型

每个 `session_id` 维护独立的运行状态：

```typescript
interface RunState {
  streaming: boolean       // 是否正在流式接收
  aborting: boolean        // 是否正在中止
  runId: string | null     // 当前运行 ID
  output: string           // 累积输出文本
  reasoning: string        // 累积推理文本
  reasoningDone: boolean   // 推理是否完成
  tools: ToolEvent[]       // 工具调用事件列表
  agentEvents: AgentStatus[] // Agent 事件列表
  error: string | null     // 错误信息
}

interface ToolEvent {
  tool_call_id: string
  name: string
  arguments?: string
  preview?: string
  output?: string
  duration?: number
  error?: string
  status: 'started' | 'completed'
}
```

**状态转换规则：**

| 收到事件 | 状态变化 |
|----------|----------|
| `run.started` | `runId = run_id` |
| `message.delta` | `output = payload.output` |
| `reasoning.delta` / `thinking.delta` | `reasoning += payload.text` |
| `reasoning.available` | `reasoningDone = true` |
| `tool.started` | 追加新 ToolEvent |
| `tool.completed` | 匹配 tool_call_id，更新为 completed |
| `agent.event` | 追加到 agentEvents |
| `run.completed` | 清除整个 RunState |
| `run.failed` | 清除 RunState，设置 error |
| `abort.completed` | 清除整个 RunState |
| `resumed` | 恢复 messages，设置 streaming/aborting |

---

## 6. 多会话并发

前端使用 `Record<string, RunState>` 按 `session_id` 隔离状态。所有服务端推送事件均携带 `session_id`，前端据此路由到对应的状态槽：

- 仅当事件的 `session_id` 等于当前 `activeSessionId` 时，才更新 UI 显示
- 非活跃会话的事件仍会更新对应的 RunState（支持后台运行）
- `run.completed` 和 `run.failed` 中的消息持久化仅针对 activeSession

---

## 7. 错误处理

| 场景 | 服务端行为 |
|------|-----------|
| `run` 执行期间异常 | 发送 `run.failed`，携带 error 描述 |
| `abort` 执行期间异常 | 发送 `abort.completed`，`synced: false`，携带 error |
| `resume` 的 session 不存在 | 发送 `run.failed`，`error: "Session not found"` |
| Agent 返回失败结果 | 发送 `run.failed`，error 为 Agent 的错误消息 |
| WebSocket 断连 | 服务端自动 abort 活跃运行 |

---

## 8. 注意事项

1. **事件鉴别**：所有事件 payload 的 `event` 字段值与 Socket.IO 事件名一致，可用于日志/调试
2. **output 语义**：`message.delta` 的 `output` 是累积值（非增量），前端可直接覆盖渲染，无需手动拼接
3. **tool_call_id 匹配**：`tool.started` 和 `tool.completed` 通过 `tool_call_id` 一一对应
4. **reasoning vs thinking**：两者在前端处理上完全等价，合并写入同一个 `reasoning` 字段
5. **连接唯一性**：当前实现为单 Socket 连接，多次调用 `connect()` 不会创建重复连接
6. **传输层**：仅使用 WebSocket 传输，不支持 HTTP long-polling 回退
