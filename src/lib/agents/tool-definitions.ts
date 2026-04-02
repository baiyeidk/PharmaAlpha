export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required: string[];
  };
}

export const CANVAS_TOOLS: ToolDefinition[] = [
  {
    name: "canvas.add_node",
    description: "在当前对话的分析画布上添加一个内容节点。可添加股票走势图、文本笔记、图片或 PDF。当你需要向用户展示可视化内容（图表、分析摘要、对比数据等）时使用此工具。",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "节点类型",
          enum: ["chart", "text", "image", "pdf"],
        },
        label: {
          type: "string",
          description: "节点标题，如「恒瑞医药 走势」「Q3 分析摘要」",
        },
        tickers: {
          type: "array",
          description: "A 股代码列表（仅 type=chart），如 [\"600276\", \"300760\"]",
          items: { type: "string" },
        },
        content: {
          type: "string",
          description: "文本内容（仅 type=text），支持 markdown",
        },
        description: {
          type: "string",
          description: "节点描述，显示在底部",
        },
      },
      required: ["type", "label"],
    },
  },
  {
    name: "canvas.remove_node",
    description: "从画布上移除指定节点",
    parameters: {
      type: "object",
      properties: {
        nodeId: {
          type: "string",
          description: "要移除的节点 ID",
        },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "canvas.update_node",
    description: "更新画布上已有节点的内容",
    parameters: {
      type: "object",
      properties: {
        nodeId: {
          type: "string",
          description: "目标节点 ID",
        },
        label: { type: "string", description: "新标题" },
        content: { type: "string", description: "新文本内容" },
        tickers: {
          type: "array",
          description: "新的股票代码列表",
          items: { type: "string" },
        },
        description: { type: "string", description: "新描述" },
      },
      required: ["nodeId"],
    },
  },
];

export function buildToolSystemPrompt(tools: ToolDefinition[]): string {
  const toolDescriptions = tools.map((t) => {
    const params = Object.entries(t.parameters.properties)
      .map(([k, v]) => {
        const req = t.parameters.required.includes(k) ? "必填" : "可选";
        const enumStr = v.enum ? `，可选值: ${v.enum.join("/")}` : "";
        return `    - ${k} (${v.type}, ${req}): ${v.description}${enumStr}`;
      })
      .join("\n");
    return `**${t.name}**: ${t.description}\n  参数:\n${params}`;
  }).join("\n\n");

  return `你有以下工具可以使用，当需要在画布上展示内容时请调用：

${toolDescriptions}

调用方式：在回复中输出如下格式的 JSON 行（独占一行）：
\`\`\`
{"type":"tool_call","name":"canvas.add_node","args":{"type":"chart","label":"恒瑞医药 走势","tickers":["600276"]}}
\`\`\`

规则：
- 当用户提到股票代码或公司名称时，自动添加走势图到画布
- 当生成分析结论时，将摘要添加为文本节点
- 工具调用行必须是合法 JSON，独占一行
- 可以在一次回复中多次调用工具
- 工具调用会被系统自动执行，用户会在画布上看到结果`;
}

export function getCanvasSystemMessage(): string {
  return buildToolSystemPrompt(CANVAS_TOOLS);
}

export function getCanvasToolsForLLM(): ToolDefinition[] {
  return CANVAS_TOOLS;
}
