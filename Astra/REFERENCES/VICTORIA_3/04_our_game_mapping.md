# Victoria 3 机制与本项目现状映射

研究日期：2026-11-23
本文件是设计审视，不是已批准的实现规格。

## 1. 当前项目已经有什么

依据当前 main（0e7582ffc8b8935a6d4718cc22acae76d2dcdd98）检查：

| 领域 | 本项目当前实现 | 与 Victoria 3 的主要差别 |
|---|---|---|
| 人口权威数据 | 每殖民地保存 populationGroups；群体人数汇总为殖民地总人口 | 当前群体维度是独立边际分布，不是完整的职业/财富/工作地联合 Pop |
| 初始人口内容 | Mod INI 的 population_group 定义完整初始群体；Core 仅定义 neutral profession/wealth 分类 | Core 没有实际人口构成 |
| 人口需求 | 每日按殖民地总人口 × commodity.daily_need_per_thousand 计算 | 没有群体级需求配置、财富消费包或需求类别 |
| 实际消费 | 每种商品 consumed = min(requested, available stock)，并从殖民地 stockpiles 扣减 | 没有群体间库存分配、购买订单或货币支付 |
| 生产 | 每周按 industry level × stability efficiency 计算 recipe batches；投入库存限制批次，扣投入并加产出 | recipe.workforce 只是 metadata，没有实际就业 |
| 市场报价 | 每日按库存相对 target_stock、price_elasticity、volatility 与平滑更新计算商品价格 | 不是由完整 buy/sell orders 清算形成的市场价格 |
| 市场库存/空间 | Market 定义关联殖民地并列出商品；当前报价读取对应殖民地库存 | 没有完整跨殖民地市场订单汇总/货物流转/贸易清算 |
| 人口收入 | 尚无实际工资、分红或人口现金流 | 不能计算真实购买力或财富演化 |

代码定位：
- engine/simulation.cjs：produceForColony()、settlePopulationNeeds()、updateMarket() 和当前 weekly/daily system 顺序。
- engine/formulas.cjs：economy.population-needs v2、economy.colony-production v1、economy.commodity-price v2。
- engine/population.cjs：人口群体人数权威、维度独立分布、split/merge 质量守恒。
- mods/core/content/economy.ini：商品 daily_need_per_thousand、基础价格/库存目标，以及 recipe 输入/输出与 workforce metadata。
- mods/core/content/population.ini：仅有 unassigned 和 unclassified 两种中性分类，没有实际人口构成。

## 2. 当前日结算与周结算的真实边界

当前日需求公式对每种商品计算：
- requested = population / 1000 × dailyNeedPerThousand
- consumed = min(requested, available)
- unmet = max(0, requested - consumed)
- satisfaction = consumed / requested（requested 为 0 时为 1）

结算器会将 consumed 从殖民地 stockpiles 扣除，并在 needs report / Domain Event 中记录 requested、consumed、unmet、satisfaction。**因此当前已经有最基本的库存约束消费，不是单纯估算需求。**但它是殖民地总量级别的统一消费，没有说明哪个人口群体得到商品。

每周生产按配方输入库存计算可运行批次，再扣投入、增加产出。recipe.workforce 当前只在 Catalog 校验，不参与招聘或生产公式。市场价格计算读取库存和目标库存，不读取人口需求报告中的买单，也不读取真实买卖订单。

## 3. 最重要的结构差异：不能假造联合人口

当前 population group 的每个 dimension 是单独的分布，例如 profession 分布和 wealth_tier 分布各自合计 1。它们没有说明哪些工人同时属于某个财富等级，也没有提供某个职业群体中不同财富等级的具体人数。

Victoria 3 的 Pop 组合更接近一个明确的联合群体。我们不能把独立边际比例相乘来制造类似联合 Pop。

如果需求需要按群体差异结算，必须有明确的权威归属。可研究的方案之一是让人口群体显式引用 Mod 定义的 need_profile_id；这只是设计候选，不是既定决议。不要仅凭 profession 或 wealth_tier 的边际分布自动推断需求配置。

## 4. 对项目最合适的推进顺序

### 阶段 A：需求配置与群体归属
- 确定需求配置是简单的“商品单位/千人/日”，还是“需求类别 + 可替代商品 + 权重/份额”。
- 由 Mod INI 定义具体需求档案和商品数值；Engine 只加载、验证和计算。
- 明确人口群体如何显式关联档案，以及 split/merge 后关联如何保留。
- 先让需求报告可按 groupId 展示，并能汇总回 colony commodity totals。

### 阶段 B：共享库存分配
- 一个殖民地只有一份商品库存。多个群体对同一商品有需求时，必须定义库存分配政策。
- 候选政策：按群体需求比例分配、明确优先级、或按需求类别分层。不同政策会产生不同群体满足率和后续人口结果。
- 分配顺序必须确定、可审计；不能依赖对象迭代偶然顺序。
- 报告至少区分每群体 requested / allocated(consumed) / unmet / satisfaction，以及殖民地总库存变化。

### 阶段 C：人口经济反馈
- 先有权威工资/收入/资金归属，再讨论 affordability。
- 区分需求量、市场买单、实际买到的量、消费成本和剩余现金。
- 再引入财富变化、生活水平或其他人口后果。不要把价格高直接等同于库存短缺。

### 阶段 D：市场清算与空间物流
- 明确市场边界、订单汇总、价格算法、库存归属、跨殖民地转运和运输时间。
- 只有商品流真实存在后，订单供需价格才有权威输入。
- 贸易路线应考虑利润、运输能力、时间、成本与风险；暂不需要一次做完整全球市场。

### 阶段 E：就业与生产方式
- 先让建筑记录实际雇佣的群体和人数，保证人口总量不会被重复计算。
- 再引入岗位需求、资格、工资、招聘/裁员和失业处理。
- 最后考虑可切换生产方式与自动化权衡。当前 recipe.workforce metadata 不等于就业系统。

## 5. 不应照搬的内容

- 不复制 V3 的完整文化/宗教/政治/资格维度；我们的世界和模拟粒度不同。
- 不模拟每个个人，也不把人口拆成完整多维交叉表。
- 不引入 V3 所有财富等级、SoL 阈值和社会后果作为硬编码。
- 不先做跨星域市场/贸易复杂性，再回头补人口消费的权威归属。
- 不在 Engine 硬编码商品、需求类别、职业、工资、生产方法或数值。内容进入 Core/可选 Mod INI。

## 6. 当前建议

最直接的下一项工作仍然是**先设计群体需求配置与库存分配**。建议先把需求 profile 的数据语义和分配规则讲清楚，再决定是否扩展 Catalog/World/Formula。此研究没有批准具体实现，也没有修改 Engine 或 Mod。
