# Astra project work log — index

> 本文件是当前状态索引，不是历史流水账。具体执行过程见 Astra/WORKFLOWS/；设计依据见 Astra/DISCUSSIONS/；强制原则见 Astra/IMPORTANT_PRINCIPLES/。

## Repository snapshot (2026-11-23)

- Repository: https://github.com/Sakurefa/test-game
- Branch: main
- Functional boundary-cleanup commit: [7c441c0b3dd59406bd127947fbfc904c1e8dc7a1](https://github.com/Sakurefa/test-game/commit/7c441c0b3dd59406bd127947fbfc904c1e8dc7a1).
- CI-generated Renderer output baseline: [a2d90f588de220276bc476aab28cbe795e625df9](https://github.com/Sakurefa/test-game/commit/a2d90f588de220276bc476aab28cbe795e625df9).
- Astra current-state/worklog archive commit: [e13b901c476da2b2c11459d0424ecde02e73874d](https://github.com/Sakurefa/test-game/commit/e13b901c476da2b2c11459d0424ecde02e73874d).
- Latest Engine code commit: [e49c0b2c5955d979ecfd56fea928f38c93495faf](https://github.com/Sakurefa/test-game/commit/e49c0b2c5955d979ecfd56fea928f38c93495faf), adding per-rule/per-group population Need evaluation, optional request sourceId provenance and conditional population helper injection; prior [11226f0](https://github.com/Sakurefa/test-game/commit/11226f0af016db4f13679d5066a6ad5d2e3f287a) established Need Rule content and Tag matching.
- Latest species-direction documentation commit: [b19df9ce7c706b91b82363e063ff32e98a195403](https://github.com/Sakurefa/test-game/commit/b19df9ce7c706b91b82363e063ff32e98a195403).
- Latest source CI: [45163818200](https://github.com/Sakurefa/test-game/actions/runs/45163818200), success; 251/251 tests passed, Electron/Simulation syntax, Simulation/Mod Loader tests, Renderer build and generated-renderer steps all succeeded. The first integration-test attempt had one strict floating-point assertion error plus an intermittent existing Core market Hook 50ms timeout; the assertion now uses tolerance, and no timeout was changed. Local Node tests/build were not run.
- Direction-documentation CI: [45155199026](https://github.com/Sakurefa/test-game/actions/runs/45155199026), success; syntax check, all tests and Renderer build succeeded.
- CI-generated follow-up commit a2d90f5 only updates dist/assets/index-BU1AwfrZ.js and dist/index.html; it contains generated Renderer output, not additional simulation source changes.
- No local tests/build were executed in this session. User-side Windows GUI acceptance remains outstanding. CI results do not prove user-device launch behavior.

## Mandatory principles and reading order

Read AGENTS.md → Astra/README.txt → WORKING_MEMORY.txt → this index → both:
- Astra/IMPORTANT_PRINCIPLES/【最高优先级重要原则】AK 原则.txt
- Astra/IMPORTANT_PRINCIPLES/【最高优先级重要原则】MOD 化原则.txt

Then read only relevant discussions and workflow records. The user owns project direction; inspection/recommendation does not authorize unrelated changes.

## Workflow archive

Files use YYYY-MM-DD_NN_topic.txt; NN is one shared chronological sequence per date.
- 2026-11-20: 01
- 2026-11-21: 01–08
- 2026-11-22: 01–17
- 2026-11-23: 01–12

Latest 2026-11-23 records:
- Astra/WORKFLOWS/2026-11-23_04_tag-based-population-needs-design.txt
- Astra/WORKFLOWS/2026-11-23_05_need-allocation-policy-interface.txt
- Astra/WORKFLOWS/2026-11-23_06_engine-mod-boundary-cleanup.txt
- Astra/WORKFLOWS/2026-11-23_07_shared-stockpile-allocation-engine-contract.txt
- Astra/WORKFLOWS/2026-11-23_08_species-based-population-matching-foundation.txt
- Astra/WORKFLOWS/2026-11-23_09_population-tag-mapping-foundation.txt
- Astra/WORKFLOWS/2026-11-23_10_population-need-rule-contract-foundation.txt
- Astra/WORKFLOWS/2026-11-23_11_population-need-line-and-request-provenance.txt
- Astra/WORKFLOWS/2026-11-23_12_population-need-mod-request-integration-test.txt

Key boundary discussion:
- Astra/DISCUSSIONS/Engine 与 Mod 边界清单.txt
- Astra/DISCUSSIONS/关于现状.txt
- Astra/DISCUSSIONS/经济系统设计.txt
- Astra/DISCUSSIONS/Trigger System 与系统 Event 架构.txt
- Astra/DISCUSSIONS/关于接下来的工作.txt

## Current Engine snapshot

- World schema 9; legacy schemas 1–8 migrate to 9.
- Population groups are authoritative per colony; scalar population is a derived compatibility projection. Group split/merge/dimension updates exist. `matchPopulationDimensionCategories` selects OR categories within one Mod-defined dimension and returns their exact headcount; independent dimensions do not imply joint distributions.
- Engine Formula service has no built-in gameplay defaults; API v4 Mods register versioned formulas through manifest [formulas]. Engine executes, injects named random streams, and audits inputs/steps/modifiers/random draws/results.
- Engine System Registry owns only generic cadence/order/dependency execution. API v4 Mods declare recurring systems in manifest [systems].
- Core is API v4 and provides four baseline systems in mods/core/scripts/simulation.js: weekly production, daily aggregate-population needs, daily market pricing and daily war chronology. The script is Mod-owned game behavior, not Engine foundation code. Content, formulas' balance parameters, opening finance data and player text remain in Core INI.
- Fresh-world financial initialization requires Mod-defined currencies/accounts and balanced opening balances. Historical CR/player-main/system-treasury initialization is isolated in a legacy-save migration function.
- Engine retains campaign clock, named random streams, catalog/INI loading and validation, population-group mechanics, Mod Runtime, command/event/trigger/resolution/settlement protocols, bounded Effects, save migration and atomic candidate-world day commits.
- Core Mod has no Engine scheduler, formula engine, Event Bus, Trigger Queue, low-level persistence or runtime storage implementation.

## Current gameplay foundation and non-goals

- Core currently keeps the transitional colony-aggregate daily-need rule: population × commodity.daily_need_per_thousand, stock-limited shared inventory consumption, requested/consumed/unmet/satisfaction reporting. It is not group Tag Need or a group-level allocation policy.
- Shared-stock execution is implemented as the generic Mod Effect `colony.stockpile.allocate`. Mod submits the allocation plan; Engine validates complete request coverage, per-request bounds and per-commodity inventory conservation, then applies and audits the result. No Engine allocation policy or fallback exists.
- The generic population module provides exact matching within one Mod-defined dimension; Catalog supports population_tag and population_need_rule. API v4 Hooks evaluate one rule against one group as an independent demand line; unknown shares remain null. Allocation requests may carry optional sourceId; per-request outcomes preserve provenance and same-commodity requests remain separate. A test Mod now verifies the full Hook → demand line → request → allocation Effect → audit path, with an explicitly fixture-only policy (separate request per rule/group and fail on unknown). Core still uses colony-aggregate Needs; formal overlap/unknown/shortage policy, explicit joint shares and a Core group-level consumer remain unresolved.
- No full cargo logistics, energy generation/capacity/storage/scheduling, cross-colony migration/robot transfer, ownership/lease framework.
- engine/queries.cjs retains read-only data projections for the current Core world model. Effect whitelist remains a bounded state-transition interface, not an arbitrary World patch.

## Confirmed design constraints

- Pop Group race/species categories are Mod-defined. Different races may have different Needs through Mod-defined Tags and rules; Engine does not predefine life-form population types or infer Needs from a race ID.
- Production capacity is not inferred from species labels or raw population totals; labor, automation and other contributors need explicit Mod-defined data.
- Energy is location/technology/capacity constrained; future design must distinguish generation, available supply, consumption/allocation, storage and transportable energy.
- Interstellar travel, gates and mixed transport exist; inhospitable colonies are possible but local self-sufficiency may be very expensive.
- Population location, political jurisdiction, origin, employment and ownership are separate relations. Employment references resident groups; it must not create a second population ledger.

Next work: define actual Mod-owned semantics for overlapping Need rules (accumulate / duplicate / modifier / conflict / exclusive), handling unknown population shares, and what happens under stock shortage. The test fixture's separate-request / fail-on-unknown behavior is illustrative only, not a project default. Only connect Core group requests after actual Core population data and its allocation policy are defined. Never infer joint population from marginal dimensions; Engine adds no rationing default.

## Verification and acceptance

Code commits: [0b253ab](https://github.com/Sakurefa/test-game/commit/0b253ab23eaf8e82cb1b0d0a3ad4222714a54ae2) added the shared-stock allocation contract; [29945fc](https://github.com/Sakurefa/test-game/commit/29945fc7e61bc9def4c03fa72a22ac55c582dea2) fixed allocation ID validation and test integration; [26641ef](https://github.com/Sakurefa/test-game/commit/26641ef625e3ad3c1c980b07a3075b61b3f43df8) added exact one-dimension matching; [bee6505](https://github.com/Sakurefa/test-game/commit/bee65051bce21cebdf85372d620c68ac3d418ef8) added population Tag mappings; [11226f0](https://github.com/Sakurefa/test-game/commit/11226f0af016db4f13679d5066a6ad5d2e3f287a) added Need Rule descriptors and the Hook matching helper. CI [45158883203](https://github.com/Sakurefa/test-game/actions/runs/45158883203) succeeded on retry: 249/249 tests passed. The initial attempt had a transient pre-existing 50ms Core market Hook timeout; no timeout limit was changed. Direction docs commit [b19df9c](https://github.com/Sakurefa/test-game/commit/b19df9ce7c706b91b82363e063ff32e98a195403) also passed CI [45155199026](https://github.com/Sakurefa/test-game/actions/runs/45155199026). The earlier allocation run 45151047812 exposed an uppercase-ID validation issue and strict floating-point/test-load problems; those were corrected in 29945fc. No local Node tests/build were run. User-side Windows GUI acceptance remains outstanding.


Latest population Need implementation: [e49c0b2](https://github.com/Sakurefa/test-game/commit/e49c0b2c5955d979ecfd56fea928f38c93495faf). API v4 evaluates one Need Rule per Pop Group; shared-stock requests retain optional sourceId provenance and separate same-commodity request outcomes. CI [45161571754](https://github.com/Sakurefa/test-game/actions/runs/45161571754) passed 250/250 tests. See Astra/WORKFLOWS/2026-11-23_11_population-need-line-and-request-provenance.txt. Local Node tests/build were not run; Windows GUI acceptance remains outstanding.

Latest Need integration-test commit: [14477c8](https://github.com/Sakurefa/test-game/commit/14477c8acc1f4c34edf06e749ba0f3e598f27e02), adding an end-to-end test fixture for Rule × Group evaluation, provenance-bearing stockpile requests and allocation audit. CI [45163818200](https://github.com/Sakurefa/test-game/actions/runs/45163818200) passed 251/251 tests. The test's separate-request and fail-on-unknown choices are fixture-only. See Astra/WORKFLOWS/2026-11-23_12_population-need-mod-request-integration-test.txt.

## 全局地基审视：下一阶段工作入口（2026-11-23）

用户已明确：下一轮新对话先讨论“下一个方向”的详细需求；在选定方向前，先以全局 Engine 地基为视角盘点，不把近期 Population Need 工作误当成项目唯一主线。当前尚未批准具体施工方向。

建议审视范围（不是已排定的施工顺序）：
1. **生产与商品经济**：商品/配方/库存及 Core 基线生产已有；建筑实体与生产能力、投入产出链、生产规模/容量、品质批次等仍需按真实消费者逐项审视。
2. **建筑与劳动力**：人口群体基础已有；建筑雇佣关系、就业人数、岗位/劳动力需求、工资与建筑条件结算尚未闭合。就业必须引用权威 Pop Group 人数，不得形成第二人口账本。
3. **人口需求与生活水平**：人口群体、单维份额匹配、Tag/Need Rule 描述、逐群体需求行、共享库存执行与审计基础已有；正式规则重叠、unknown、短缺政策及真实 Core 群体人口/Need 消费者仍未决定。
4. **市场、贸易与金融**：财务账本、账户转账、市场报价/价格计算等基础已有；订单/成交、市场清算、购买力与支付、工资流、跨殖民地贸易等仍需分别界定。报价、成交、货物流转和资金结算不能混为一谈。
5. **物流与能源**：完整货运路线、载具容量、在途库存、运输时间/成本与星际转运尚未形成；能源发电、可用供给、消耗分配、储能、传输分别是不同契约。
6. **政治、战争与军事**：战争时间线等部分基线行为已有；势力/政治归属、管辖关系、舰队实体与行动、战争目标、补给和战斗结果对世界状态的影响仍需盘点。
7. **跨系统 Engine 机制与表现边界**：时钟、随机流、Mod Runtime、Formula/System 注册执行与审计、Command、Domain Event、Trigger/Resolution、Effect、Settlement、持久化等已有不同程度基础；条件来源、动作调用、Modifier 生命周期及 Presentation 契约需按实际消费者审视，不为未来可能性先造框架。

建议新对话的第一项工作是逐项核对仓库代码和现有讨论，形成“已有 / 部分已有 / 缺失 / 依赖 / 暂不做”的全局矩阵，再由用户选择一个方向进入详细需求讨论。生产与建筑、人口与劳动力、市场贸易、物流能源、政治战争之间存在依赖，但不在本记录中替用户锁定优先级。

工程边界：继续遵守 AK 原则与 MOD 化原则；Engine 只做通用机制，Core 是 mods/core 下的必需内容 Mod。所有具体规则、内容 ID、数值和平衡由 Mod 定义。审视和建议不等于施工授权；没有用户确认，不实现某一方向，也不把测试夹具策略提升为正式游戏政策。

本次交接记录：Astra/WORKFLOWS/2026-11-23_13_global-foundation-roadmap-handoff.txt。
