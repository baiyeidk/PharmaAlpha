## Context

当前架构：Supervisor Agent 通过 `delegate_to_agent` 工具调用 3 个独立子 Agent 进程（pharma_analyst、stock_analyst、investment_advisor）。每个子 Agent 是一个完整的 `ToolCallableAgent`，有自己的 ToolRegistry 和 tool loop。Supervisor 本身也是 `ToolCallableAgent`，它的唯一工具就是 `delegate_to_agent`。

问题：子 Agent 职责重叠、重复获取数据、重复创建 Canvas 节点、无真正的审查机制、tool_call JSON 泄漏。

目标：用单进程 PEC 内部循环替换多进程子 Agent 架构。

## Goals / Non-Goals

**Goals:**
- 实现 Plan → Execute → Check 内部循环，Check fail 时带缺失项回到 Plan
- 单一工具池，消除重复数据获取和 Canvas 节点创建
- 前端按 PEC 阶段分块展示（plan / execute / check / synthesize），为后续动画留接口
- 修复 tool_call JSON 泄漏

**Non-Goals:**
- 不改变 `ToolCallableAgent` 基类的 tool loop 机制（PEC Agent 在基类之上构建）
- 不改变 Canvas 组件或数据库结构
- 不改变认证/会话系统
- 暂不实现阶段动画（仅留接口）

## Decisions

### D1: PEC 循环引擎架构

PEC Agent 不继承 `ToolCallableAgent`（后者的 execute 方法是一个 LLM → tool → LLM 的 flat loop），而是**直接继承 `BaseAgent`**，在 `execute` 方法中实现 PEC 状态机：

```
class PECAgent(BaseAgent):
    execute(request):
        tools = unified ToolRegistry
        context = build_initial_context(request)

        for round in range(MAX_PEC_ROUNDS):  # 默认 3

            # ── PLAN ──
            yield PlanPhaseStart()
            plan = call_llm(PLAN_PROMPT, context)   # 非 streaming
            yield PlanPhaseResult(steps=plan.steps)

            # ── EXECUTE ──
            yield ExecutePhaseStart()
            results = {}
            for step in plan.steps:
                # 使用 ToolCallableAgent 的 tool loop 逻辑
                # 但封装在内部：LLM + tools 循环直到该步骤完成
                step_result = execute_step(step, tools)
                results[step.id] = step_result
                yield ExecuteStepResult(step=step, result=step_result)

            # ── CHECK ──
            yield CheckPhaseStart()
            check = call_llm(CHECK_PROMPT, context + results)
            yield CheckPhaseResult(passed=check.passed, gaps=check.gaps)

            if check.passed:
                break

            context.append(check_feedback)  # 带缺失项回 Plan

        # ── SYNTHESIZE ──
        yield SynthesizePhaseStart()
        final = call_llm(SYNTHESIZE_PROMPT, context + all_results)
        yield stream final content as chunks
        yield AgentResult(final)
```

**理由**：`ToolCallableAgent` 的 execute 是一个扁平的 LLM-tool 循环，不支持阶段切换。PEC 需要在不同阶段使用不同的 system prompt，所以需要自己管理 LLM 调用。但 Execute 阶段内部的 tool loop 可以复用 `ToolCallableAgent` 的逻辑或直接用 registry.execute。

### D2: LLM 调用策略

每个阶段使用**同一个 LLM 客户端**但**不同的 system prompt**：

| 阶段 | System Prompt 角色 | Streaming | 工具 |
|------|-------------------|-----------|------|
| Plan | 任务规划器 | 否（需要结构化 JSON 输出） | 无 |
| Execute | 数据获取执行器 | 是（tool loop） | 全部工具 |
| Check | 质量审查员 | 否（需要结构化 JSON 输出） | 无 |
| Synthesize | 分析报告合成 | 是（流式输出给用户） | canvas_add_chart, canvas_add_text |

**Plan 和 Check 不 streaming**：它们需要返回结构化 JSON（步骤列表 / pass+gaps），用 `response_format: {"type": "json_object"}` 保证格式。

**Execute streaming**：工具调用过程对用户可见（tool_start / tool_result 事件）。

**Synthesize streaming**：最终文本流式输出给用户。

### D3: 协议层事件设计

复用现有 `AgentPlan` 和 `AgentCheck`，新增阶段开始/结束事件：

```
新增事件类型：
- phase_start  { phase: "plan" | "execute" | "check" | "synthesize", round: number }
- phase_end    { phase: "plan" | "execute" | "check" | "synthesize", round: number }

复用现有事件：
- plan         { steps: [...], reasoning: "..." }
- check        { passed: bool, summary: "...", gaps: [...] }
- tool_start   { name, args }
- tool_result  { name, result, success }
- chunk        { content }     （Synthesize 阶段流式输出）
- result       { content }     （最终结果）
```

前端通过 `phase_start` / `phase_end` 事件划分展示区块，每个阶段对应一个 MessageBlock。

### D4: 废弃子 Agent 目录

直接删除 `agents/pharma_analyst/`、`agents/stock_analyst/`、`agents/investment_advisor/` 目录以及 `agents/supervisor_agent/sub_agents.py`。

`agents/supervisor_agent/` 目录保留，但 `agent.py` 重写为 PEC 引擎，`prompts.py` 重写为 4 个阶段的 prompt。

### D5: 修复 route.ts tool_call JSON 泄漏

删除 `route.ts` 中的 `toolCallPattern` 正则和对 `chunk.content` 的 `matchAll` 逻辑。协议层的 `type: "tool_call"` 事件已经通过独立 JSON line 传递，不需要从文本中提取。

同时在 `passthroughTypes` 中新增 `"phase_start"` 和 `"phase_end"`。

### D6: Execute 阶段内部的 tool loop

Execute 阶段不是一次性调 LLM，而是一个内部 tool loop（类似 `ToolCallableAgent.execute`）：

1. 将 Plan 的步骤作为用户指令发给 LLM（Execute prompt + 步骤列表）
2. LLM 自主决定调用哪些工具，tool loop 自动循环
3. 每次 tool_start / tool_result 都 yield 给前端
4. 当 LLM 不再返回 tool_calls 时，Execute 阶段结束

这意味着 Execute 阶段的 LLM 拥有全部工具的 schema，可以自主规划工具调用顺序。Plan 阶段只提供高层步骤（如"查询以岭药业行情"、"获取财务数据"），Execute 阶段的 LLM 负责具体的工具调用编排。

## Risks / Trade-offs

- **[风险] PEC 循环增加延迟** → 缓解：Plan 和 Check 不使用工具、不 streaming，应该很快（<5s 每次）。最差情况 3 轮循环 ≈ 额外 30s
- **[风险] Plan/Check 的 JSON 输出格式不稳定** → 缓解：使用 `response_format: {"type": "json_object"}` + prompt 中提供严格的 JSON schema
- **[风险] 单一 Execute Agent 的 prompt 过长（所有领域知识集中在一处）** → 缓解：Execute prompt 保持精简，只描述工具用途，不包含领域分析框架；领域知识由 Synthesize prompt 承载
- **[权衡] 废弃子 Agent 后无法独立运行某个分析** → 可接受：PEC Agent 是统一入口，后续如需独立分析可通过 prompt 参数控制
