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
  (
    'demo-social-finance',
    'demo-employee-finance',
    'internal-feed',
    'finance-group',
    NULL,
    true,
    '{"channel":"internal://feeds/finance-group","deliveryMode":"digest"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'demo-social-policy',
    'demo-employee-policy',
    'internal-feed',
    'policy-watch',
    NULL,
    true,
    '{"channel":"internal://feeds/policy-watch","deliveryMode":"urgent"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'demo-social-clinical',
    'demo-employee-clinical',
    'internal-feed',
    'clinical-signal',
    NULL,
    true,
    '{"channel":"internal://feeds/clinical-signal","deliveryMode":"thread"}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT ("employeeProfileId", "platform", "accountRef") DO UPDATE
SET "metadata" = EXCLUDED."metadata",
    "updatedAt" = NOW();

INSERT INTO "EmployeeObservation" (
  "id", "employeeProfileId", "category", "title", "content", "source", "metadata", "observedAt", "createdAt", "updatedAt"
)
VALUES
  (
    'demo-obs-finance-1',
    'demo-employee-finance',
    'financial_model',
    '现金流承压观察',
    '目标公司近两个季度销售费用提升明显，经营现金流改善弱于收入增长，需要关注商业化扩张效率。',
    'quarterly-review',
    '{"company":"DemoBio A","priority":"high"}'::jsonb,
    NOW() - INTERVAL '14 days',
    NOW(),
    NOW()
  ),
  (
    'demo-obs-finance-2',
    'demo-employee-finance',
    'valuation_signal',
    '可比公司估值分化',
    '同类创新药公司在医保谈判前后估值波动较大，需结合催化剂窗口调整折现率假设。',
    'peer-benchmark',
    '{"sector":"innovative-drugs","priority":"medium"}'::jsonb,
    NOW() - INTERVAL '9 days',
    NOW(),
    NOW()
  ),
  (
    'demo-obs-policy-1',
    'demo-employee-policy',
    'policy_watch',
    '医保目录动态监控',
    '近期支付端强调真实世界证据与成本效果评估，进入医保目录的证据门槛在提高。',
    'policy-briefing',
    '{"scope":"NRDL","priority":"high"}'::jsonb,
    NOW() - INTERVAL '11 days',
    NOW(),
    NOW()
  ),
  (
    'demo-obs-policy-2',
    'demo-employee-policy',
    'approval_risk',
    '注册审评节奏变化',
    '同靶点产品在补充资料要求上趋严，审评时间存在拉长风险，需要预留时间缓冲。',
    'regulatory-monitor',
    '{"scope":"NMPA","priority":"medium"}'::jsonb,
    NOW() - INTERVAL '6 days',
    NOW(),
    NOW()
  ),
  (
    'demo-obs-clinical-1',
    'demo-employee-clinical',
    'clinical_signal',
    '二期读出亮点',
    '核心终点改善趋势清晰，但亚组样本量偏小，后续需要验证统计稳健性。',
    'trial-readout',
    '{"study":"Phase II","priority":"high"}'::jsonb,
    NOW() - INTERVAL '12 days',
    NOW(),
    NOW()
  ),
  (
    'demo-obs-clinical-2',
    'demo-employee-clinical',
    'competition_scan',
    '竞品给药便利性优势',
    '竞品在给药频次上更优，若目标产品无法拉开疗效差距，商业化压力会提升。',
    'landscape-review',
    '{"focus":"competitive-landscape","priority":"medium"}'::jsonb,
    NOW() - INTERVAL '4 days',
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO UPDATE
SET "content" = EXCLUDED."content",
    "metadata" = EXCLUDED."metadata",
    "updatedAt" = NOW();

INSERT INTO "EmployeeInvestmentBehavior" (
  "id", "employeeProfileId", "target", "action", "thesis", "outcome", "metadata", "decidedAt", "createdAt", "updatedAt"
)
VALUES
  (
    'demo-behavior-finance-1',
    'demo-employee-finance',
    'DemoBio A',
    'increase_position',
    '看好产品商业化放量，但前提是销售费用率能够在两个季度内见顶。',
    'watching',
    '{"reason":"cashflow-improving","confidence":"0.72"}'::jsonb,
    NOW() - INTERVAL '20 days',
    NOW(),
    NOW()
  ),
  (
    'demo-behavior-policy-1',
    'demo-employee-policy',
    'PolicyMed B',
    'hold',
    '政策催化尚未完全落地，维持观察仓位，等待支付规则进一步明确。',
    'watching',
    '{"reason":"reimbursement-uncertainty","confidence":"0.68"}'::jsonb,
    NOW() - INTERVAL '16 days',
    NOW(),
    NOW()
  ),
  (
    'demo-behavior-clinical-1',
    'demo-employee-clinical',
    'TrialCure C',
    'open_research',
    '临床信号存在潜在超预期，但样本量和竞品比较仍需进一步核验。',
    'researching',
    '{"reason":"phase2-signal","confidence":"0.75"}'::jsonb,
    NOW() - INTERVAL '10 days',
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO UPDATE
SET "thesis" = EXCLUDED."thesis",
    "outcome" = EXCLUDED."outcome",
    "metadata" = EXCLUDED."metadata",
    "updatedAt" = NOW();

INSERT INTO "SkillDefinition" (
  "id", "employeeProfileId", "name", "description", "category", "mergeMode", "enabled", "metadata", "createdAt", "updatedAt"
)
VALUES
  (
    'demo-skill-financial-review',
    'demo-employee-finance',
    'innovative_drug_financial_review',
    '针对创新药企业做估值、利润质量和现金流韧性的综合财务分析 skill。',
    'financial_analysis',
    'merge',
    true,
    '{
      "merge_mode":"merge",
      "default_sop":"innovative_drug_valuation",
      "node_blueprints":[
        {
          "node_type":"financial_analysis",
          "title":"Innovative Drug Financial Review",
          "merge_mode":"merge",
          "depends_on_types":["data_analysis"],
          "sop_name":"innovative_drug_valuation",
          "params":{"focus":"valuation-and-cashflow","output":"financial-memo"}
        }
      ]
    }'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'demo-skill-policy-risk',
    'demo-employee-policy',
    'policy_risk_scan',
    '围绕注册审评、医保支付和合规政策的投资风险扫描 skill。',
    'policy_monitoring',
    'parallel',
    true,
    '{
      "merge_mode":"parallel",
      "default_sop":"reimbursement_policy_screen",
      "node_blueprints":[
        {
          "node_type":"policy_monitoring",
          "title":"Policy Risk Scan",
          "merge_mode":"parallel",
          "depends_on_types":[],
          "sop_name":"reimbursement_policy_screen",
          "params":{"focus":"reimbursement-and-approval","output":"policy-brief"}
        }
      ]
    }'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'demo-skill-clinical-review',
    'demo-employee-clinical',
    'clinical_signal_review',
    '对临床读出、关键终点和竞品对比进行快速解读的临床信号分析 skill。',
    'data_analysis',
    'parallel',
    true,
    '{
      "merge_mode":"parallel",
      "default_sop":"phase2_signal_readout",
      "node_blueprints":[
        {
          "node_type":"data_analysis",
          "title":"Clinical Signal Review",
          "merge_mode":"parallel",
          "depends_on_types":[],
          "sop_name":"phase2_signal_readout",
          "params":{"focus":"signal-quality","output":"signal-note"}
        }
      ]
    }'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT ("employeeProfileId", "name") DO UPDATE
SET "description" = EXCLUDED."description",
    "category" = EXCLUDED."category",
    "mergeMode" = EXCLUDED."mergeMode",
    "metadata" = EXCLUDED."metadata",
    "updatedAt" = NOW();

INSERT INTO "SkillScript" (
  "id", "skillDefinitionId", "name", "description", "language", "entryPoint", "content", "version", "checksum", "isActive", "metadata", "createdAt", "updatedAt"
)
VALUES
  (
    'demo-script-financial-review-v1',
    'demo-skill-financial-review',
    'financial_review_runner',
    '财务分析脚本示例，模拟估值和现金流分析流程。',
    'python',
    'skills/financial_review_runner.py',
    'def run(context):\n    # pseudo: load revenue, cashflow, margin metrics\n    # pseudo: compare valuation multiples and DCF assumptions\n    return {\n        \"summary\": \"Revenue growth is strong but cash conversion remains the key watch item.\",\n        \"risk_flags\": [\"cashflow_lag\", \"commercial-expense-ramp\"],\n    }\n',
    1,
    'demo-financial-v1',
    true,
    '{"kind":"pseudo-script","owner":"finance-demo"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'demo-script-policy-risk-v1',
    'demo-skill-policy-risk',
    'policy_risk_runner',
    '政策扫描脚本示例，模拟医保和审评规则检查。',
    'python',
    'skills/policy_risk_runner.py',
    'def run(context):\n    # pseudo: fetch reimbursement policy updates\n    # pseudo: score approval timeline risk\n    return {\n        \"summary\": \"Recent policy language implies higher evidence requirements.\",\n        \"risk_flags\": [\"reimbursement-threshold\", \"approval-delay\"],\n    }\n',
    1,
    'demo-policy-v1',
    true,
    '{"kind":"pseudo-script","owner":"policy-demo"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'demo-script-clinical-review-v1',
    'demo-skill-clinical-review',
    'clinical_signal_runner',
    '临床信号脚本示例，模拟读出摘要与竞品对比。',
    'python',
    'skills/clinical_signal_runner.py',
    'def run(context):\n    # pseudo: summarize endpoint deltas and subgroup consistency\n    # pseudo: compare signal strength against peer trials\n    return {\n        \"summary\": \"Primary endpoint trend is encouraging but subgroup size is limited.\",\n        \"risk_flags\": [\"sample-size\", \"peer-advantage\"],\n    }\n',
    1,
    'demo-clinical-v1',
    true,
    '{"kind":"pseudo-script","owner":"clinical-demo"}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT ("skillDefinitionId", "name", "version") DO UPDATE
SET "description" = EXCLUDED."description",
    "entryPoint" = EXCLUDED."entryPoint",
    "content" = EXCLUDED."content",
    "checksum" = EXCLUDED."checksum",
    "metadata" = EXCLUDED."metadata",
    "updatedAt" = NOW();

INSERT INTO "SkillSop" (
  "id", "skillDefinitionId", "name", "description", "config", "isDefault", "createdAt", "updatedAt"
)
VALUES
  (
    'demo-sop-financial-valuation',
    'demo-skill-financial-review',
    'innovative_drug_valuation',
    '创新药估值 SOP：收入预测、毛利率、销售费用率和折现率联合校准。',
    '{"steps":["normalize revenue assumptions","stress-test cashflow","compare peer multiples"],"deliverable":"valuation-memo"}'::jsonb,
    true,
    NOW(),
    NOW()
  ),
  (
    'demo-sop-financial-cashflow',
    'demo-skill-financial-review',
    'cashflow_resilience_check',
    '现金流韧性 SOP：聚焦经营现金流与扩张支出的匹配关系。',
    '{"steps":["review operating cashflow","map burn multiple","flag cost elasticity"],"deliverable":"cashflow-risk-note"}'::jsonb,
    false,
    NOW(),
    NOW()
  ),
  (
    'demo-sop-policy-reimbursement',
    'demo-skill-policy-risk',
    'reimbursement_policy_screen',
    '医保支付政策 SOP：筛查支付门槛、成本效果证据和谈判风险。',
    '{"steps":["scan reimbursement updates","extract evidence requirements","score negotiation risk"],"deliverable":"policy-brief"}'::jsonb,
    true,
    NOW(),
    NOW()
  ),
  (
    'demo-sop-policy-approval',
    'demo-skill-policy-risk',
    'approval_pathway_watch',
    '注册审评路径 SOP：评估补充资料要求和审批时间窗口。',
    '{"steps":["track review notices","identify CMC gaps","estimate approval slippage"],"deliverable":"approval-watch-note"}'::jsonb,
    false,
    NOW(),
    NOW()
  ),
  (
    'demo-sop-clinical-readout',
    'demo-skill-clinical-review',
    'phase2_signal_readout',
    '二期临床读出 SOP：提取终点趋势、统计显著性和亚组稳定性。',
    '{"steps":["summarize endpoint deltas","check subgroup consistency","flag sample size risk"],"deliverable":"signal-note"}'::jsonb,
    true,
    NOW(),
    NOW()
  ),
  (
    'demo-sop-clinical-competition',
    'demo-skill-clinical-review',
    'competitive_landscape_crosscheck',
    '竞品对照 SOP：比较给药便利性、疗效幅度和安全性差异。',
    '{"steps":["compare peer trials","rank convenience factors","summarize differentiation"],"deliverable":"competition-crosscheck"}'::jsonb,
    false,
    NOW(),
    NOW()
  )
ON CONFLICT ("skillDefinitionId", "name") DO UPDATE
SET "description" = EXCLUDED."description",
    "config" = EXCLUDED."config",
    "isDefault" = EXCLUDED."isDefault",
    "updatedAt" = NOW();
