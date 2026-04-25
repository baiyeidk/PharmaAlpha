-- Project-first demo seed for PharmaAlpha.
-- Run this after the project-first migration:
--   psql "$DATABASE_URL" -f prisma/seeds/project_first_demo.sql
--
-- Demo login users all use the same bcrypt hash as the existing employee demo seed.
-- If you prefer your own account, register/login first; this seed also adds a default skill
-- to every existing EmployeeProfile so the project session selector has data.

BEGIN;

INSERT INTO "Agent" ("id", "name", "displayName", "description", "entryPoint", "config", "enabled", "createdAt", "updatedAt")
VALUES
  (
    'agent-employee-investment-team',
    'employee_investment_team',
    'Employee Investment Team',
    'Project-aware employee investment collaboration agent',
    'employee_investment_team/agent.py',
    '{"domain":"employee-investment","projectAware":true}'::jsonb,
    true,
    NOW(),
    NOW()
  ),
  (
    'agent-supervisor',
    'supervisor_agent',
    'Supervisor Agent',
    'General supervisor agent with canvas support',
    'supervisor_agent/agent.py',
    '{"domain":"general"}'::jsonb,
    true,
    NOW(),
    NOW()
  )
ON CONFLICT ("name") DO UPDATE
SET "displayName" = EXCLUDED."displayName",
    "description" = EXCLUDED."description",
    "entryPoint" = EXCLUDED."entryPoint",
    "config" = EXCLUDED."config",
    "enabled" = true,
    "updatedAt" = NOW();

INSERT INTO "User" ("id", "name", "email", "password", "createdAt", "updatedAt")
VALUES
  ('demo-user-finance', '林岚', 'linlan.finance@demo.local', '$2b$10$OE7DCBVqsmjKoi.Dd7HF7eGtfatJw8MZHFzInV454lYLXqSWDCoEa', NOW(), NOW()),
  ('demo-user-policy', '周策', 'zhouce.policy@demo.local', '$2b$10$OE7DCBVqsmjKoi.Dd7HF7eGtfatJw8MZHFzInV454lYLXqSWDCoEa', NOW(), NOW()),
  ('demo-user-clinical', '许衡', 'xuheng.clinical@demo.local', '$2b$10$OE7DCBVqsmjKoi.Dd7HF7eGtfatJw8MZHFzInV454lYLXqSWDCoEa', NOW(), NOW())
ON CONFLICT ("email") DO UPDATE
SET "name" = EXCLUDED."name",
    "password" = EXCLUDED."password",
    "updatedAt" = NOW();

INSERT INTO "EmployeeProfile" (
  "id", "userId", "employeeCode", "displayName", "title", "department",
  "focusAreas", "tags", "preferences", "createdAt", "updatedAt"
)
VALUES
  (
    'demo-employee-finance',
    'demo-user-finance',
    'demo-finance-001',
    '林岚',
    '高级财务分析师',
    'Finance Strategy',
    ARRAY['innovative_drug_valuation', 'cashflow_analysis', 'bd_modeling'],
    ARRAY['finance', 'valuation', 'profitability'],
    '{"reportStyle":"financial-memo","riskBias":"balanced","preferredMergeMode":"merge"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'demo-employee-policy',
    'demo-user-policy',
    'demo-policy-001',
    '周策',
    '政策监控经理',
    'Policy Intelligence',
    ARRAY['nmpa', 'nrddl', 'reimbursement', 'compliance'],
    ARRAY['policy', 'reimbursement', 'regulation'],
    '{"reportStyle":"policy-brief","riskBias":"conservative","preferredMergeMode":"parallel"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'demo-employee-clinical',
    'demo-user-clinical',
    'demo-clinical-001',
    '许衡',
    '临床数据科学家',
    'Clinical Data Science',
    ARRAY['clinical_signal', 'endpoint_review', 'competitive_landscape'],
    ARRAY['clinical', 'data', 'trial-readout'],
    '{"reportStyle":"signal-note","riskBias":"evidence-first","preferredMergeMode":"parallel"}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT ("employeeCode") DO UPDATE
SET "displayName" = EXCLUDED."displayName",
    "title" = EXCLUDED."title",
    "department" = EXCLUDED."department",
    "focusAreas" = EXCLUDED."focusAreas",
    "tags" = EXCLUDED."tags",
    "preferences" = EXCLUDED."preferences",
    "updatedAt" = NOW();

INSERT INTO "EmployeeSocialAccount" (
  "id", "employeeProfileId", "platform", "accountRef", "webhookUrl", "isActive", "metadata", "createdAt", "updatedAt"
)
VALUES
  ('demo-social-finance', 'demo-employee-finance', 'internal-feed', 'finance-group', NULL, true, '{"channel":"internal://feeds/finance-group","deliveryMode":"digest"}'::jsonb, NOW(), NOW()),
  ('demo-social-policy', 'demo-employee-policy', 'internal-feed', 'policy-watch', NULL, true, '{"channel":"internal://feeds/policy-watch","deliveryMode":"urgent"}'::jsonb, NOW(), NOW()),
  ('demo-social-clinical', 'demo-employee-clinical', 'internal-feed', 'clinical-signal', NULL, true, '{"channel":"internal://feeds/clinical-signal","deliveryMode":"thread"}'::jsonb, NOW(), NOW())
ON CONFLICT ("employeeProfileId", "platform", "accountRef") DO UPDATE
SET "metadata" = EXCLUDED."metadata",
    "isActive" = true,
    "updatedAt" = NOW();

INSERT INTO "SkillDefinition" (
  "id", "employeeProfileId", "name", "description", "category", "mergeMode", "enabled", "metadata", "createdAt", "updatedAt"
)
VALUES
  (
    'skill-finance-valuation',
    'demo-employee-finance',
    '创新药估值与现金流压力测试',
    '围绕收入峰值、销售费用率、研发投入、医保降价和折现率生成投资备忘录。',
    'valuation',
    'merge',
    true,
    '{"defaultOutput":"valuation_memo"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'skill-policy-risk',
    'demo-employee-policy',
    '医保与监管政策风险扫描',
    '跟踪医保目录、集采、注册审评和支付端变化，输出政策风险摘要。',
    'policy',
    'parallel',
    true,
    '{"defaultOutput":"policy_risk_note"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'skill-clinical-readout',
    'demo-employee-clinical',
    '临床读出与竞品格局评估',
    '评估临床终点、样本量、疗效安全性信号和竞品差异化。',
    'clinical',
    'parallel',
    true,
    '{"defaultOutput":"clinical_signal_note"}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT ("employeeProfileId", "name") DO UPDATE
SET "description" = EXCLUDED."description",
    "category" = EXCLUDED."category",
    "mergeMode" = EXCLUDED."mergeMode",
    "enabled" = true,
    "metadata" = EXCLUDED."metadata",
    "updatedAt" = NOW();

INSERT INTO "SkillSop" (
  "id", "skillDefinitionId", "name", "description", "config", "isDefault", "createdAt", "updatedAt"
)
VALUES
  (
    'sop-finance-valuation-default',
    'skill-finance-valuation',
    '投资备忘录标准版',
    '先列核心假设，再给估值区间、敏感性和投资结论。',
    '{"steps":["整理项目资产","抽取核心假设","输出估值区间","列出关键敏感性"]}'::jsonb,
    true,
    NOW(),
    NOW()
  ),
  (
    'sop-policy-risk-default',
    'skill-policy-risk',
    '政策风险快照',
    '按政策事件、影响机制、受影响收入、置信度和跟踪动作输出。',
    '{"steps":["识别政策事件","评估影响路径","判断收入暴露","给出跟踪动作"]}'::jsonb,
    true,
    NOW(),
    NOW()
  ),
  (
    'sop-clinical-readout-default',
    'skill-clinical-readout',
    '临床读出核查清单',
    '检查终点、样本量、安全性、亚组一致性和竞品比较。',
    '{"steps":["复核临床终点","检查样本量","总结安全性","比较竞品差异"]}'::jsonb,
    true,
    NOW(),
    NOW()
  )
ON CONFLICT ("skillDefinitionId", "name") DO UPDATE
SET "description" = EXCLUDED."description",
    "config" = EXCLUDED."config",
    "isDefault" = EXCLUDED."isDefault",
    "updatedAt" = NOW();

UPDATE "SkillSop"
SET
  "name" = '创新药财报与估值分析 SOP（标准版）',
  "description" = '面向创新药企业投资研究的财报分析规程：从收入拆分、费用结构、现金流 runway、管线估值和敏感性分析出发，形成可执行的投资备忘录。',
  "config" = $$
  {
    "role": "你是买方医药行业财务分析师，目标是把项目资料转化为可复核的投资判断，而不是泛泛总结。",
    "workflow": [
      {
        "step": "1. 业务与收入拆分",
        "instruction": "识别核心产品、适应症、商业化阶段、收入来源、增长驱动和单一产品依赖度。"
      },
      {
        "step": "2. 财报质量检查",
        "instruction": "检查收入增速、毛利率、销售费用率、研发费用率、管理费用率、经营现金流、货币资金和短期债务。若缺数据，明确列为待补充，不得虚构。"
      },
      {
        "step": "3. 创新药管线估值",
        "instruction": "按核心管线拆分适应症、临床阶段、成功率、峰值销售、上市时间、专利/竞争窗口，并说明关键假设来源。"
      },
      {
        "step": "4. 现金流 runway 与融资压力",
        "instruction": "基于研发投入、销售投入和经营现金流判断现金可支撑周期，评估是否存在融资、降本或 BD 需求。"
      },
      {
        "step": "5. 敏感性分析",
        "instruction": "至少讨论医保降价幅度、峰值销售、研发成功率、折现率、销售费用率五个变量对结论的影响。"
      },
      {
        "step": "6. 投资结论",
        "instruction": "输出明确评级倾向：积极跟踪、谨慎增配、中性观察、回避，并给出触发条件。"
      }
    ],
    "outputSections": [
      "一句话结论",
      "关键财务与经营事实",
      "核心假设表",
      "估值与敏感性",
      "主要风险",
      "需要补充的数据",
      "下一步协作任务"
    ],
    "qualityBar": [
      "每个判断必须绑定证据、假设或缺失数据说明。",
      "不要输出 demo fallback 口吻。",
      "不要只说建议关注，要说明为什么、看什么指标、什么条件改变结论。",
      "如果输入没有完整财报，仍应产出分析框架和待补数据清单。"
    ]
  }
  $$::jsonb,
  "isDefault" = true,
  "updatedAt" = NOW()
WHERE "id" = 'sop-finance-valuation-default';

UPDATE "SkillSop"
SET
  "name" = '医保政策与支付风险分析 SOP',
  "description" = '围绕医保谈判、集采、支付方式改革和准入节奏，评估政策事件对创新药收入、价格体系和估值假设的影响。',
  "config" = $$
  {
    "role": "你是医药政策研究员，负责把政策事件翻译成收入、价格、放量节奏和估值假设变化。",
    "workflow": [
      "识别政策事件和适用范围",
      "判断影响机制：降价、准入、放量、竞品替代、处方限制",
      "映射受影响产品、适应症和收入敞口",
      "给出乐观/基准/悲观三种政策情景",
      "列出需要继续跟踪的政策节点"
    ],
    "outputSections": [
      "政策结论",
      "影响路径",
      "收入与估值影响",
      "情景分析",
      "跟踪清单"
    ],
    "qualityBar": [
      "区分确定政策、市场预期和研究假设。",
      "不要把所有政策都简单判为利空。",
      "必须说明政策如何传导到财务模型。"
    ]
  }
  $$::jsonb,
  "isDefault" = true,
  "updatedAt" = NOW()
WHERE "id" = 'sop-policy-risk-default';

UPDATE "SkillSop"
SET
  "name" = '临床读出与竞品差异化分析 SOP',
  "description" = '从临床终点、样本量、疗效安全性、亚组一致性和竞品格局判断管线资产的成功概率与商业化差异化。',
  "config" = $$
  {
    "role": "你是临床数据与医药行业研究员，负责判断临床数据是否支持投资假设。",
    "workflow": [
      "确认适应症、治疗线数、患者分层和临床阶段",
      "复核主要/次要终点及统计显著性",
      "比较疗效、安全性、给药便利性和人群覆盖",
      "对标竞品数据与上市/在研节奏",
      "判断对峰值销售和成功率假设的影响"
    ],
    "outputSections": [
      "临床结论",
      "证据表",
      "竞品比较",
      "对估值假设的影响",
      "风险与待验证数据"
    ],
    "qualityBar": [
      "不要只复述临床结果，要转化为投资含义。",
      "区分数据强证据、弱信号和未知项。",
      "明确哪些临床风险会改变财务假设。"
    ]
  }
  $$::jsonb,
  "isDefault" = true,
  "updatedAt" = NOW()
WHERE "id" = 'sop-clinical-readout-default';

UPDATE "SkillSop"
SET
  "name" = '创新药财报与估值分析 SOP（标准版）',
  "description" = '面向创新药企业投资研究的财报分析规程：从收入拆分、费用结构、现金流 runway、管线估值和敏感性分析出发，形成可执行的投资备忘录。',
  "config" = $$
  {
    "role": "你是买方医药行业财务分析师，目标是把项目资料转化为可复核的投资判断，而不是泛泛总结。",
    "workflow": [
      {"step":"1. 业务与收入拆分","instruction":"识别核心产品、适应症、商业化阶段、收入来源、增长驱动和单一产品依赖度。"},
      {"step":"2. 财报质量检查","instruction":"检查收入增速、毛利率、销售费用率、研发费用率、管理费用率、经营现金流、货币资金和短期债务。若缺数据，明确列为待补充，不得虚构。"},
      {"step":"3. 创新药管线估值","instruction":"按核心管线拆分适应症、临床阶段、成功率、峰值销售、上市时间、专利/竞争窗口，并说明关键假设来源。"},
      {"step":"4. 现金流 runway 与融资压力","instruction":"基于研发投入、销售投入和经营现金流判断现金可支撑周期，评估是否存在融资、降本或 BD 需求。"},
      {"step":"5. 敏感性分析","instruction":"至少讨论医保降价幅度、峰值销售、研发成功率、折现率、销售费用率五个变量对结论的影响。"},
      {"step":"6. 投资结论","instruction":"输出明确评级倾向：积极跟踪、谨慎增配、中性观察、回避，并给出触发条件。"}
    ],
    "outputSections": ["一句话结论","关键财务与经营事实","核心假设表","估值与敏感性","主要风险","需要补充的数据","下一步协作任务"],
    "qualityBar": ["每个判断必须绑定证据、假设或缺失数据说明。","不要输出 demo fallback 口吻。","不要只说建议关注，要说明为什么、看什么指标、什么条件改变结论。","如果输入没有完整财报，仍应产出分析框架和待补数据清单。"]
  }
  $$::jsonb,
  "isDefault" = true,
  "updatedAt" = NOW()
WHERE "id" = 'demo-sop-financial-valuation';

UPDATE "SkillSop"
SET
  "name" = '创新药现金流韧性分析 SOP',
  "description" = '评估创新药企业研发投入、销售投入、经营现金流和融资压力之间的匹配关系，判断现金 runway 与经营安全边际。',
  "config" = '{"role":"你是医药财务质量分析师，重点判断企业能否支撑管线推进和商业化投入。","workflow":["整理现金及等价物、短债、经营现金流、资本开支和研发投入","估算年度现金消耗速度和 runway","识别销售费用扩张是否带来收入效率改善","判断融资、BD、裁撤管线或降本需求","输出现金流风险等级和触发指标"],"outputSections":["现金流结论","runway 估算","费用效率","融资压力","后续跟踪指标"],"qualityBar":["现金流判断必须说明关键缺失数据。","不要把账面现金多简单等同于安全。","说明什么情况下结论会反转。"]}'::jsonb,
  "updatedAt" = NOW()
WHERE "id" = 'demo-sop-financial-cashflow';

UPDATE "SkillSop"
SET
  "name" = '医保政策与支付风险分析 SOP',
  "description" = '围绕医保谈判、集采、支付方式改革和准入节奏，评估政策事件对创新药收入、价格体系和估值假设的影响。',
  "config" = '{"role":"你是医药政策研究员，负责把政策事件翻译成收入、价格、放量节奏和估值假设变化。","workflow":["识别政策事件和适用范围","判断影响机制：降价、准入、放量、竞品替代、处方限制","映射受影响产品、适应症和收入敞口","给出乐观/基准/悲观三种政策情景","列出需要继续跟踪的政策节点"],"outputSections":["政策结论","影响路径","收入与估值影响","情景分析","跟踪清单"],"qualityBar":["区分确定政策、市场预期和研究假设。","不要把所有政策都简单判为利空。","必须说明政策如何传导到财务模型。"]}'::jsonb,
  "isDefault" = true,
  "updatedAt" = NOW()
WHERE "id" = 'demo-sop-policy-reimbursement';

UPDATE "SkillSop"
SET
  "name" = '临床读出与竞品差异化分析 SOP',
  "description" = '从临床终点、样本量、疗效安全性、亚组一致性和竞品格局判断管线资产的成功概率与商业化差异化。',
  "config" = '{"role":"你是临床数据与医药行业研究员，负责判断临床数据是否支持投资假设。","workflow":["确认适应症、治疗线数、患者分层和临床阶段","复核主要/次要终点及统计显著性","比较疗效、安全性、给药便利性和人群覆盖","对标竞品数据与上市/在研节奏","判断对峰值销售和成功率假设的影响"],"outputSections":["临床结论","证据表","竞品比较","对估值假设的影响","风险与待验证数据"],"qualityBar":["不要只复述临床结果，要转化为投资含义。","区分数据强证据、弱信号和未知项。","明确哪些临床风险会改变财务假设。"]}'::jsonb,
  "isDefault" = true,
  "updatedAt" = NOW()
WHERE "id" = 'demo-sop-clinical-readout';

-- Give every existing employee at least one usable skill, including the currently logged-in user
-- if that user already has an EmployeeProfile.
INSERT INTO "SkillDefinition" (
  "id", "employeeProfileId", "name", "description", "category", "mergeMode", "enabled", "metadata", "createdAt", "updatedAt"
)
SELECT
  'skill-default-project-analysis-' || ep."id",
  ep."id",
  '项目综合分析',
  '对项目已有 artifacts、会话上下文和投资问题进行综合分析，输出可沉淀的项目结论。',
  'project_analysis',
  'merge',
  true,
  '{"seededFor":"all-existing-employees"}'::jsonb,
  NOW(),
  NOW()
FROM "EmployeeProfile" ep
WHERE NOT EXISTS (
  SELECT 1
  FROM "SkillDefinition" sd
  WHERE sd."employeeProfileId" = ep."id"
    AND sd."name" = '项目综合分析'
);

INSERT INTO "SkillSop" (
  "id", "skillDefinitionId", "name", "description", "config", "isDefault", "createdAt", "updatedAt"
)
SELECT
  'sop-default-project-analysis-' || sd."id",
  sd."id",
  '项目综合分析默认 SOP',
  '读取输入 artifacts，归纳证据、判断机会、列出风险和下一步动作。',
  '{"steps":["读取项目资产","提炼投资问题","输出机会与风险","给出下一步动作"]}'::jsonb,
  true,
  NOW(),
  NOW()
FROM "SkillDefinition" sd
WHERE sd."name" = '项目综合分析'
  AND NOT EXISTS (
    SELECT 1
    FROM "SkillSop" sop
    WHERE sop."skillDefinitionId" = sd."id"
      AND sop."name" = '项目综合分析默认 SOP'
  );

INSERT INTO "InvestmentProject" (
  "id", "employeeProfileId", "projectCode", "title", "topic", "status", "objective", "priority", "config", "createdAt", "updatedAt"
)
VALUES
  (
    'project-demo-hengrui',
    'demo-employee-finance',
    'proj-demo-hengrui',
    '恒瑞医药创新管线投资评估',
    '围绕恒瑞医药创新药管线、医保政策、临床读出和商业化效率进行协作分析，形成可复用的投资判断。',
    'active',
    '在项目主会话、画布和技能 session 中沉淀投资结论，形成可追溯项目资产。',
    'high',
    '{"demo":true,"scenario":"project-first"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'project-demo-cxo-policy',
    'demo-employee-policy',
    'proj-demo-cxo-policy',
    'CXO 政策与订单景气度跟踪',
    '跟踪 CXO 行业订单、海外监管环境、地缘政策和估值修复条件。',
    'active',
    '验证项目资产和政策风险分析如何支撑后续 session。',
    'normal',
    '{"demo":true,"scenario":"policy-risk"}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT ("projectCode") DO UPDATE
SET "title" = EXCLUDED."title",
    "topic" = EXCLUDED."topic",
    "status" = EXCLUDED."status",
    "objective" = EXCLUDED."objective",
    "priority" = EXCLUDED."priority",
    "config" = EXCLUDED."config",
    "updatedAt" = NOW();

INSERT INTO "InvestmentProjectMember" (
  "id", "investmentProjectId", "employeeProfileId", "role", "isInitiator", "status", "metadata", "joinedAt", "createdAt", "updatedAt"
)
VALUES
  ('member-hengrui-finance', 'project-demo-hengrui', 'demo-employee-finance', 'owner', true, 'active', '{"seeded":true}'::jsonb, NOW(), NOW(), NOW()),
  ('member-hengrui-policy', 'project-demo-hengrui', 'demo-employee-policy', 'member', false, 'active', '{"seeded":true}'::jsonb, NOW(), NOW(), NOW()),
  ('member-hengrui-clinical', 'project-demo-hengrui', 'demo-employee-clinical', 'member', false, 'active', '{"seeded":true}'::jsonb, NOW(), NOW(), NOW()),
  ('member-cxo-policy', 'project-demo-cxo-policy', 'demo-employee-policy', 'owner', true, 'active', '{"seeded":true}'::jsonb, NOW(), NOW(), NOW()),
  ('member-cxo-finance', 'project-demo-cxo-policy', 'demo-employee-finance', 'member', false, 'active', '{"seeded":true}'::jsonb, NOW(), NOW(), NOW())
ON CONFLICT ("investmentProjectId", "employeeProfileId") DO UPDATE
SET "role" = EXCLUDED."role",
    "isInitiator" = EXCLUDED."isInitiator",
    "status" = 'active',
    "metadata" = EXCLUDED."metadata",
    "updatedAt" = NOW();

INSERT INTO "Conversation" (
  "id", "title", "userId", "investmentProjectId", "conversationType", "createdAt", "updatedAt"
)
VALUES
  ('conv-project-demo-hengrui-main', '恒瑞医药创新管线投资评估', 'demo-user-finance', 'project-demo-hengrui', 'project_main', NOW(), NOW()),
  ('conv-project-demo-cxo-main', 'CXO 政策与订单景气度跟踪', 'demo-user-policy', 'project-demo-cxo-policy', 'project_main', NOW(), NOW())
ON CONFLICT ("id") DO UPDATE
SET "title" = EXCLUDED."title",
    "investmentProjectId" = EXCLUDED."investmentProjectId",
    "conversationType" = EXCLUDED."conversationType",
    "updatedAt" = NOW();

INSERT INTO "Message" ("id", "role", "content", "metadata", "conversationId", "agentId", "createdAt")
VALUES
  (
    'msg-hengrui-user-1',
    'user',
    '请基于当前项目资产，先判断恒瑞创新药管线的主要投资机会和政策风险。',
    '{"seeded":true}'::jsonb,
    'conv-project-demo-hengrui-main',
    (SELECT "id" FROM "Agent" WHERE "name" = 'employee_investment_team'),
    NOW() - INTERVAL '20 minutes'
  ),
  (
    'msg-hengrui-assistant-1',
    'assistant',
    '初步判断：项目应重点跟踪三条线索：一是核心创新药管线能否持续兑现临床和商业化节奏；二是医保谈判和集采政策对价格体系的影响；三是销售费用率与现金流能否改善。建议将政策风险和临床读出拆成两个技能 session 分别验证。',
    '{"seeded":true}'::jsonb,
    'conv-project-demo-hengrui-main',
    (SELECT "id" FROM "Agent" WHERE "name" = 'employee_investment_team'),
    NOW() - INTERVAL '18 minutes'
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "CanvasNode" (
  "id", "conversationId", "type", "label", "positionX", "positionY", "width", "height", "data", "createdAt", "updatedAt"
)
VALUES
  (
    'canvas-hengrui-thesis',
    'conv-project-demo-hengrui-main',
    'text',
    '核心投资假设',
    40,
    40,
    420,
    260,
    '{"label":"核心投资假设","nodeType":"text","content":"# 核心投资假设\n\n恒瑞医药创新药管线具备持续兑现空间，但估值修复依赖三个条件：\n\n1. 临床读出保持差异化优势。\n2. 医保谈判后价格压力可控。\n3. 商业化效率改善，销售费用率不再继续上行。","width":420,"height":260}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'canvas-hengrui-chart',
    'conv-project-demo-hengrui-main',
    'chart',
    '600276 走势观察',
    500,
    40,
    360,
    280,
    '{"label":"600276 走势观察","nodeType":"chart","tickers":["600276"],"description":"恒瑞医药二级市场观察节点","width":360,"height":280}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO UPDATE
SET "label" = EXCLUDED."label",
    "positionX" = EXCLUDED."positionX",
    "positionY" = EXCLUDED."positionY",
    "width" = EXCLUDED."width",
    "height" = EXCLUDED."height",
    "data" = EXCLUDED."data",
    "updatedAt" = NOW();

INSERT INTO "ProjectArtifact" (
  "id", "investmentProjectId", "createdByEmployeeProfileId", "workflowDraftId", "workflowExecutionId",
  "skillDefinitionId", "skillSopId", "artifactType", "title", "content", "attachments",
  "inputArtifactIds", "metadata", "createdAt", "updatedAt"
)
VALUES
  (
    'artifact-hengrui-thesis',
    'project-demo-hengrui',
    'demo-employee-finance',
    NULL,
    NULL,
    'skill-finance-valuation',
    'sop-finance-valuation-default',
    'markdown',
    '恒瑞创新药投资假设初稿',
    '# 恒瑞创新药投资假设初稿\n\n## 机会\n- 创新药管线持续推进，具备中长期估值支撑。\n- 如果商业化效率改善，利润弹性可能被重新定价。\n\n## 风险\n- 医保谈判可能压缩价格空间。\n- 竞品读出若更优，可能削弱核心品种峰值销售假设。\n\n## 下一步\n建议分别发起政策风险扫描和临床读出评估 session。',
    NULL,
    '[]'::jsonb,
    '{"source":"seed","demo":true}'::jsonb,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'artifact-hengrui-policy',
    'project-demo-hengrui',
    'demo-employee-policy',
    NULL,
    NULL,
    'skill-policy-risk',
    'sop-policy-risk-default',
    'policy_risk_note',
    '医保谈判影响路径',
    '# 医保谈判影响路径\n\n支付端更关注真实世界证据、成本效果和竞品价格锚。当前需要重点观察：\n\n1. 核心品种是否进入医保谈判。\n2. 降价幅度是否影响峰值销售假设。\n3. 是否存在适应症扩展抵消单价下降。\n\n结论：政策风险不是单点否定因素，但会提高估值敏感性。',
    NULL,
    '["artifact-hengrui-thesis"]'::jsonb,
    '{"source":"seed","demo":true}'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    'artifact-cxo-watch',
    'project-demo-cxo-policy',
    'demo-employee-policy',
    NULL,
    NULL,
    'skill-policy-risk',
    'sop-policy-risk-default',
    'markdown',
    'CXO 政策风险观察',
    '# CXO 政策风险观察\n\n海外监管、地缘政策和订单能见度仍是核心变量。短期更适合作为跟踪项目，而非立即形成强结论。',
    NULL,
    '[]'::jsonb,
    '{"source":"seed","demo":true}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO UPDATE
SET "artifactType" = EXCLUDED."artifactType",
    "title" = EXCLUDED."title",
    "content" = EXCLUDED."content",
    "inputArtifactIds" = EXCLUDED."inputArtifactIds",
    "metadata" = EXCLUDED."metadata",
    "updatedAt" = NOW();

INSERT INTO "WorkflowDraft" (
  "id", "employeeProfileId", "investmentProjectId", "skillDefinitionId", "skillSopId",
  "sourceConversationId", "sessionType", "topic", "status", "selectedSkills", "config",
  "confirmedAt", "createdAt", "updatedAt"
)
VALUES
  (
    'session-hengrui-policy-risk',
    'demo-employee-policy',
    'project-demo-hengrui',
    'skill-policy-risk',
    'sop-policy-risk-default',
    'conv-project-demo-hengrui-main',
    'project_skill_session',
    '医保谈判和集采政策对恒瑞创新药估值的影响',
    'completed',
    '["skill-policy-risk"]'::jsonb,
    '{"inputArtifactIds":["artifact-hengrui-thesis"]}'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    'session-hengrui-clinical-readout',
    'demo-employee-clinical',
    'project-demo-hengrui',
    'skill-clinical-readout',
    'sop-clinical-readout-default',
    'conv-project-demo-hengrui-main',
    'project_skill_session',
    '核心管线临床读出和竞品差异化核查',
    'draft',
    '["skill-clinical-readout"]'::jsonb,
    '{"inputArtifactIds":["artifact-hengrui-thesis","artifact-hengrui-policy"]}'::jsonb,
    NULL,
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO UPDATE
SET "topic" = EXCLUDED."topic",
    "status" = EXCLUDED."status",
    "config" = EXCLUDED."config",
    "updatedAt" = NOW();

INSERT INTO "WorkflowNode" (
  "id", "workflowDraftId", "nodeKey", "nodeType", "title", "dependsOn", "enabled", "mergeMode",
  "skillDefinitionId", "skillSopId", "params", "position", "createdAt", "updatedAt"
)
VALUES
  ('node-hengrui-policy-collect', 'session-hengrui-policy-risk', 'collect_policy_inputs', 'skill', '整理政策输入', '[]'::jsonb, true, 'parallel', 'skill-policy-risk', 'sop-policy-risk-default', '{"step":"collect"}'::jsonb, 1, NOW(), NOW()),
  ('node-hengrui-policy-impact', 'session-hengrui-policy-risk', 'estimate_policy_impact', 'skill', '估算政策影响', '["collect_policy_inputs"]'::jsonb, true, 'merge', 'skill-policy-risk', 'sop-policy-risk-default', '{"step":"estimate"}'::jsonb, 2, NOW(), NOW()),
  ('node-hengrui-clinical-endpoints', 'session-hengrui-clinical-readout', 'review_endpoints', 'skill', '复核临床终点', '[]'::jsonb, true, 'parallel', 'skill-clinical-readout', 'sop-clinical-readout-default', '{"step":"endpoint"}'::jsonb, 1, NOW(), NOW()),
  ('node-hengrui-clinical-competition', 'session-hengrui-clinical-readout', 'compare_competition', 'skill', '比较竞品差异', '["review_endpoints"]'::jsonb, true, 'merge', 'skill-clinical-readout', 'sop-clinical-readout-default', '{"step":"competition"}'::jsonb, 2, NOW(), NOW())
ON CONFLICT ("workflowDraftId", "nodeKey") DO UPDATE
SET "title" = EXCLUDED."title",
    "dependsOn" = EXCLUDED."dependsOn",
    "enabled" = EXCLUDED."enabled",
    "mergeMode" = EXCLUDED."mergeMode",
    "params" = EXCLUDED."params",
    "position" = EXCLUDED."position",
    "updatedAt" = NOW();

INSERT INTO "WorkflowExecution" (
  "id", "workflowDraftId", "employeeProfileId", "currentWorkflowNodeId", "status", "summary",
  "inputArtifactIds", "executionContext", "metadata", "startedAt", "finishedAt", "createdAt", "updatedAt"
)
VALUES
  (
    'execution-hengrui-policy-risk-1',
    'session-hengrui-policy-risk',
    'demo-employee-policy',
    NULL,
    'completed',
    '医保谈判会提高估值敏感性，但在适应症扩展和放量兑现情况下不构成单点否定。',
    '["artifact-hengrui-thesis"]'::jsonb,
    '{"projectId":"project-demo-hengrui","source":"seed"}'::jsonb,
    '{"demo":true}'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day' + INTERVAL '5 minutes',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day' + INTERVAL '5 minutes'
  )
ON CONFLICT ("id") DO UPDATE
SET "status" = EXCLUDED."status",
    "summary" = EXCLUDED."summary",
    "inputArtifactIds" = EXCLUDED."inputArtifactIds",
    "executionContext" = EXCLUDED."executionContext",
    "metadata" = EXCLUDED."metadata",
    "startedAt" = EXCLUDED."startedAt",
    "finishedAt" = EXCLUDED."finishedAt",
    "updatedAt" = NOW();

UPDATE "ProjectArtifact"
SET "workflowDraftId" = 'session-hengrui-policy-risk',
    "workflowExecutionId" = 'execution-hengrui-policy-risk-1',
    "updatedAt" = NOW()
WHERE "id" = 'artifact-hengrui-policy';

COMMIT;
