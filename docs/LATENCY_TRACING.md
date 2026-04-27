---
title: PharmaAlpha 端到端延迟打点
tags:
  - 性能
  - 可观测性
  - 协议
---

# 端到端延迟打点（Latency Tracing）

## 1. 目标

回答 "一次完整 PEC 请求各阶段的耗时是多少？" 而无需手动查日志。

- **每次请求**实时把每个阶段的 `elapsed_ms` 推给前端
- 前端**逐阶段渲染**（PhaseBlock 旁的 `[3.2s]`、ToolEventBadge 旁的 `[200ms]`）
- 提供消息级 `TimingPanel`（按阶段、按 LLM 调用、按 tool 调用展开）
- 提供跨会话 `TimingStatsBar`（最近 50 次请求的 P50 / P95，存浏览器 localStorage）

## 2. 协议（新增 `timing` 事件）

新增 `Timing` dataclass：`agents/base/protocol.py`。

```json
{
  "type": "timing",
  "phase": "memory_recall|rag_search|plan|execute|check|synthesize|llm_call|tool_call|total",
  "round": 0,
  "elapsed_ms": 1234,
  "metadata": { "...": "phase-specific" }
}
```

**phase 分类**：

| phase                                                | 语义        | 何时 emit                  |
| ---------------------------------------------------- | ----------- | -------------------------- |
| `memory_recall`                                      | 顶层        | `_recall_memory` 完成后    |
| `rag_search`                                         | 顶层        | `_pre_search_rag` 完成后   |
| `plan` / `execute` / `check` / `synthesize`          | 顶层 PEC 阶段 | 每个 phase 结束时           |
| `llm_call`                                           | 嵌套子项    | 每次 LLM API 调用结束       |
| `tool_call`                                          | 嵌套子项    | 每次工具执行结束            |
| `total`                                              | 顶层汇总    | session 完成时              |

**`metadata`** 关键字段：

- `phase_owner`：嵌套事件归属的 PEC 阶段（如 `llm_call.metadata.phase_owner = "execute"`）
- `loop`：tool loop 第几次（`execute` / `synthesize` 内部循环计数）
- `stream`：是流式调用（`true`）还是 JSON 模式（`false`）
- `tool_name`：tool_call 的工具名
- `success`：tool_call 是否成功
- `text_chars` / `tool_calls`：流式调用回收的内容长度 / 工具调用数（用于排查瓶颈）

## 3. 打点位置

### Python（`agents/supervisor_agent/pec_agent.py`）

- **`_recall_memory`**：整体耗时（包含 embedding 生成 + pgvector 查询）
- **`_pre_search_rag`**：整体耗时
- **主循环**：plan/execute/check/synthesize 各阶段在 `PhaseStart` 之后取 `t = time.perf_counter()`，`PhaseEnd` 前 emit `Timing`
- **`_call_llm_json`**：返回值改成 `(parsed, elapsed_ms)`，调用方 emit `llm_call`
- **`_run_tool_loop`**：内部每次 LLM 流式调用 + 每次 tool 执行都 yield `Timing`

> 用 `time.perf_counter()` 而非 `time.time()`：单调时钟，不受 NTP 校时影响，精度足够（10ns 级）。

### Next.js（透传）

- **`src/lib/agents/types.ts`**：`AgentOutputChunk.type` 加 `"timing"`，并加 `elapsed_ms?: number` 字段
- **`src/app/api/chat/route.ts`**：`passthroughTypes` 集合加上 `"timing"`，事件直接通过 SSE 推到前端
- **`src/lib/agents/executor.ts`**：无需改动（已经按行 JSON.parse 转发）

### 前端

- **`src/hooks/use-chat-stream.ts`**：
  - `TimingEntry` / `TimingSummary` 类型
  - `applyTimingToBlocks()`：把顶层阶段耗时挂到对应 `MessageBlock.elapsedMs`
  - `buildTimingSummary()`：聚合 `byPhase` / `llmCalls` / `toolCalls` / `totalMs`
  - `ChatMessage.timingSummary` 实时更新
- **`src/hooks/use-timing-stats.ts`**：跨会话累计样本（localStorage `pharma:timing-stats:v1`，最多 50 个），输出 P50 / P95 / Avg
- **`src/components/chat/`**：
  - `phase-block.tsx`：标题旁渲染 `[N.Ns]`
  - `tool-event-badge.tsx`：工具徽章末尾渲染 `[N.Ns]`
  - `timing-panel.tsx`：消息底部折叠面板，展示 phase 占比条形图、LLM/Tool 调用列表
  - `timing-stats-bar.tsx`：聊天面板顶部，紧凑显示 `P50 ?s / P95 ?s · n=N`

## 4. 验证

后端协议序列化 smoke test：

```bash
python3 - <<'PY'
import sys; sys.path.insert(0, 'agents')
from base.protocol import Timing
print(Timing(phase='plan', round=1, elapsed_ms=3260, metadata={'steps':4}).to_json())
PY
```

输出：

```json
{"type": "timing", "phase": "plan", "elapsed_ms": 3260, "round": 1, "metadata": {"steps": 4}}
```

完整端到端 smoke test 见 commit / 讨论记录，模拟一次 PEC 1 轮路径，输出：

```
Total: 29726 ms
   memory_recall:    812 ms (  2.7%)
      rag_search:    634 ms (  2.1%)
            plan:   3260 ms ( 11.0%)
         execute:  15300 ms ( 51.5%)
           check:   2020 ms (  6.8%)
      synthesize:   7700 ms ( 25.9%)
  llm calls: 5 (sum=27420 ms)   ← LLM 占 92%
  tool calls: 1 (sum=312 ms)
```

## 5. 限制 & 后续

| 现状                                               | 待改进                                      |
| -------------------------------------------------- | ------------------------------------------- |
| 样本仅在浏览器 localStorage（每浏览器独立 50 条）    | 写一份到 Postgres 的 `request_timing` 表     |
| 没有 ContextBuilder 装配 / token 估算的耗时         | 在 `ContextBuilder.build()` 里加打点         |
| 没记录 LLM provider / model / 网络往返延迟          | 在 `llm_call.metadata` 里再加 `provider/model` |
| 没区分 embedding 调用 vs DB 查询                    | 把 memory_recall 拆成 `embedding_gen` + `vector_query` 两个子事件 |
| 没有自动告警（如 P95 > 60s 时报警）                | 后续在 stats 累计的基础上加阈值告警          |

## 6. 故障排查

- **前端 TimingPanel 不出现**：检查 `chunk.type === "timing"` 是否在 `passthroughTypes` 里；查看浏览器 Network 面板的 SSE 流是否包含 `data: {"type":"timing",...}`
- **某阶段耗时为 0**：说明 `_call_llm_json` 抛了异常 / 提前 return，没走到 emit 路径。`_LLMFileLogger` 写的 jsonl 里有完整请求轨迹，可以对照排查
- **跨会话 P50 / P95 异常大**：清理 localStorage 中的 `pharma:timing-stats:v1` 后重测
