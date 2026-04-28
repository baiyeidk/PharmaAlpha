---
title: PharmaAlpha 端到端延迟 + Token 用量打点
tags:
  - 性能
  - 可观测性
  - 协议
  - 成本
---

# 端到端延迟 + Token 用量打点（Latency & Token Tracing）

## 1. 目标

回答两个面试常考问题：
1. **"一次完整 PEC 请求各阶段的耗时是多少？"**
2. **"一次请求消耗多少 tokens？多少成本？"**

无需翻日志，前端实时展示 + 跨会话累计 P50/P95。

### 提供的能力

- **每次请求**实时把每个阶段的 `elapsed_ms` 和每次 LLM 调用的 `prompt_tokens / completion_tokens / cached_tokens` 推给前端
- 前端**逐阶段渲染**（PhaseBlock 旁的 `4.2k tok [3.2s]`、ToolEventBadge 旁的 `[200ms]`）
- 消息级 `TimingPanel`：双 tab（Latency / Tokens），含阶段占比条形图、LLM 调用明细（带 token 数）、按阶段聚合的 token 用量、估算成本
- 跨会话 `TimingStatsBar`：最近 50 次请求的延迟 P50/P95 + token 总量 P50/P95 + cache hit 率，存浏览器 localStorage

## 2. 协议（新增 `timing` + `token_usage` 事件）

均在 `agents/base/protocol.py` 定义。

### `timing`

```json
{
  "type": "timing",
  "phase": "memory_recall|rag_search|plan|execute|check|synthesize|llm_call|tool_call|total",
  "round": 0,
  "elapsed_ms": 1234,
  "metadata": { "...": "phase-specific" }
}
```

### `token_usage`

```json
{
  "type": "token_usage",
  "phase": "llm_call",
  "round": 1,
  "prompt_tokens": 5100,
  "completion_tokens": 820,
  "total_tokens": 5920,
  "cached_tokens": 3800,
  "metadata": {
    "phase_owner": "execute",
    "loop": 1,
    "stream": true,
    "model": "deepseek-chat",
    "reasoning_tokens": 0
  }
}
```

#### 数据来源

| Provider 字段                                | 协议字段                                |
| -------------------------------------------- | --------------------------------------- |
| `usage.prompt_tokens`                        | `prompt_tokens`                         |
| `usage.completion_tokens`                    | `completion_tokens`                     |
| `usage.total_tokens`                         | `total_tokens`                          |
| `usage.prompt_cache_hit_tokens` (DeepSeek)   | `cached_tokens`                         |
| `usage.prompt_tokens_details.cached_tokens` (OpenAI) | `cached_tokens`                 |
| `usage.completion_tokens_details.reasoning_tokens` | `metadata.reasoning_tokens` |

`_extract_usage()` 在 PEC Agent 里做了双家归一化，OpenAI / DeepSeek / Qwen 都能用同一份代码。

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
- **`_call_llm_json`**：返回值改成 `(parsed, elapsed_ms, usage)`，调用方 emit `llm_call` + `token_usage`
- **`_run_tool_loop`**：
  - 给流式调用传 `stream_options={"include_usage": True}`，循环中捕获 `chunk.usage`
  - 每次 LLM 流式调用 + 每次 tool 执行都 yield `Timing`
  - 流式结束后 yield `TokenUsage`

> 用 `time.perf_counter()` 而非 `time.time()`：单调时钟，不受 NTP 校时影响，精度足够（10ns 级）。
>
> `_extract_usage()` 静态方法把 OpenAI / DeepSeek 不同的 usage 字段名归一化成统一字典。

### Next.js（透传）

- **`src/lib/agents/types.ts`**：`AgentOutputChunk.type` 加 `"timing" | "token_usage"`，加 `elapsed_ms / prompt_tokens / completion_tokens / total_tokens / cached_tokens` 字段
- **`src/app/api/chat/route.ts`**：`passthroughTypes` 集合加上 `"timing"` 和 `"token_usage"`，事件直接通过 SSE 推到前端
- **`src/lib/agents/executor.ts`**：无需改动（已经按行 JSON.parse 转发）

### 前端

- **`src/hooks/use-chat-stream.ts`**：
  - 类型：`TimingEntry / TimingSummary / TokenUsageEntry / TokenUsageSummary`
  - `applyTimingToBlocks()`：把顶层阶段耗时挂到对应 `MessageBlock.elapsedMs`
  - `applyTokenToBlocks()`：把 `llm_call.metadata.phase_owner` 对应的 token 累加到 PhaseBlock 的 `totalTokens`
  - `buildTimingSummary()` / `buildTokenSummary()`：聚合
  - **交叉链接**：在 `updateAssistant()` 里把每个 `llmCall` 和它对应的 `tokenUsage` 配对（按 phase_owner + loop + stream），让 TimingPanel 一行显示 `Plan stream 5.2s · 3.1k tok`
  - `ChatMessage.timingSummary / tokenSummary` 实时更新
- **`src/hooks/use-timing-stats.ts`**：跨会话累计样本（localStorage `pharma:timing-stats:v2`，最多 50 个），输出延迟 P50/P95/Avg + token P50/P95/Avg + cache hit 率
- **`src/components/chat/`**：
  - `phase-block.tsx`：标题旁渲染 `4.2k tok [N.Ns]`
  - `tool-event-badge.tsx`：工具徽章末尾渲染 `[N.Ns]`
  - `timing-panel.tsx`：消息底部折叠面板，**双 tab**（Latency / Tokens）：
    - **Latency tab**：phase 占比条形图、Per-round Execute、LLM 调用明细（含 token 数）、Tool 调用列表
    - **Tokens tab**：四个 stat 卡（Prompt / Completion / Cached / ~Cost）、按 phase 聚合的 token 占比条形图、cache 命中率、avg per call
  - `timing-stats-bar.tsx`：聊天面板顶部，紧凑显示 `P50 ?s / P95 ?s / Total tok · n=N`，展开后两张表（Per-phase latency + Token usage）

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

完整端到端 smoke test 模拟一次 PEC 1 轮路径：

```
Total latency: 29726 ms (LLM ~92%, tools ~1%)

Token usage (5 LLM calls):
              total tokens   prompt   completion   cached
  execute:        12,840    11,600       1,240    8,600   (×2)
  synthesize:      9,650     8,200       1,450    5,200   (×1)
  plan:            4,580     4,200         380    3,200   (×1)
  check:           3,920     3,800         120    2,900   (×1)
  ─────────────────────────────────────────────────────
  Total:          30,990    27,800       3,190   19,900

Cache hit: 71.6% (19.9k / 27.8k prompt)
Estimated cost @ DeepSeek public pricing: $0.00411 per request
```

> [!info] 协议事件序列
> 一次完整请求会按时间顺序 emit：
> ```
> timing(memory_recall) → timing(rag_search)
> phase_start(plan) → timing(llm_call, owner=plan) → token_usage(owner=plan)
>   → plan event → timing(plan) → phase_end(plan)
> phase_start(execute)
>   → timing(llm_call, owner=execute, loop=1) → token_usage(owner=execute, loop=1)
>   → tool_start → tool_result → timing(tool_call)
>   → timing(llm_call, owner=execute, loop=2) → token_usage(owner=execute, loop=2)
>   → timing(execute) → phase_end(execute)
> phase_start(check) → timing(llm_call, owner=check) → token_usage(owner=check)
>   → check event → timing(check) → phase_end(check)
> phase_start(synthesize)
>   → chunk… → timing(llm_call, owner=synthesize) → token_usage(owner=synthesize)
>   → timing(synthesize) → timing(total) → result → phase_end(synthesize)
> ```

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
