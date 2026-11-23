# Astra project work log — index

> 本文件是当前状态索引，不是历史流水账。具体执行过程见 Astra/WORKFLOWS/；设计依据见 Astra/DISCUSSIONS/；强制原则见 Astra/IMPORTANT_PRINCIPLES/。

## Repository snapshot (2026-11-23)

- Repository: https://github.com/Sakurefa/test-game
- Branch: main
- Functional boundary-cleanup commit: [7c441c0b3dd59406bd127947fbfc904c1e8dc7a1](https://github.com/Sakurefa/test-game/commit/7c441c0b3dd59406bd127947fbfc904c1e8dc7a1).
- CI-generated Renderer output baseline: [a2d90f588de220276bc476aab28cbe795e625df9](https://github.com/Sakurefa/test-game/commit/a2d90f588de220276bc476aab28cbe795e625df9).
- Astra current-state/worklog archive commit: [e13b901c476da2b2c11459d0424ecde02e73874d](https://github.com/Sakurefa/test-game/commit/e13b901c476da2b2c11459d0424ecde02e73874d).
- Latest source CI: [45144034925](https://github.com/Sakurefa/test-game/actions/runs/45144034925), success; 235/235 tests passed; syntax check, Simulation/Mod Loader tests, Renderer build and generated-renderer step all succeeded.
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
- 2026-11-23: 01–08

Latest 2026-11-23 records:
- Astra/WORKFLOWS/2026-11-23_04_tag-based-population-needs-design.txt
- Astra/WORKFLOWS/2026-11-23_05_need-allocation-policy-interface.txt
- Astra/WORKFLOWS/2026-11-23_06_engine-mod-boundary-cleanup.txt
- Astra/WORKFLOWS/2026-11-23_07_shared-stockpile-allocation-engine-contract.txt
- Astra/WORKFLOWS/2026-11-23_08_species-based-population-matching-foundation.txt

Key boundary discussion:
- Astra/DISCUSSIONS/Engine 与 Mod 边界清单.txt
- Astra/DISCUSSIONS/关于现状.txt
- Astra/DISCUSSIONS/经济系统设计.txt
- Astra/DISCUSSIONS/Trigger System 与系统 Event 架构.txt
- Astra/DISCUSSIONS/关于接下来的工作.txt

## Current Engine snapshot

- World schema 9; legacy schemas 1–8 migrate to 9.
- Population groups are authoritative per colony; scalar population is a derived compatibility projection. Group split/merge/dimension updates exist; independent dimensions do not imply joint distributions.
- Engine Formula service has no built-in gameplay defaults; API v4 Mods register versioned formulas through manifest [formulas]. Engine executes, injects named random streams, and audits inputs/steps/modifiers/random draws/results.
- Engine System Registry owns only generic cadence/order/dependency execution. API v4 Mods declare recurring systems in manifest [systems].
- Core is API v4 and provides four baseline systems in mods/core/scripts/simulation.js: weekly production, daily aggregate-population needs, daily market pricing and daily war chronology. The script is Mod-owned game behavior, not Engine foundation code. Content, formulas' balance parameters, opening finance data and player text remain in Core INI.
- Fresh-world financial initialization requires Mod-defined currencies/accounts and balanced opening balances. Historical CR/player-main/system-treasury initialization is isolated in a legacy-save migration function.
- Engine retains campaign clock, named random streams, catalog/INI loading and validation, population-group mechanics, Mod Runtime, command/event/trigger/resolution/settlement protocols, bounded Effects, save migration and atomic candidate-world day commits.
- Core Mod has no Engine scheduler, formula engine, Event Bus, Trigger Queue, low-level persistence or runtime storage implementation.

## Current gameplay foundation and non-goals

- Core currently keeps the transitional colony-aggregate daily-need rule: population × commodity.daily_need_per_thousand, stock-limited shared inventory consumption, requested/consumed/unmet/satisfaction reporting. It is not group Tag Need or a group-level allocation policy.
- Shared-stock execution is implemented as the generic Mod Effect `colony.stockpile.allocate`. Mod submits the allocation plan; Engine validates complete request coverage, per-request bounds and per-commodity inventory conservation, then applies and audits the result. No Engine allocation policy or fallback exists.
- The generic population module now provides exact matching of one or more categories within one Mod-defined dimension; it does not combine independent dimensions. Need rule loading, Tag mapping, overlapping-rule semantics, explicit joint shares and group-level Need requests remain unimplemented. The shared-stock allocation executor exists, with Core's colony-aggregate Need as its current consumer. Purchasing power, wages, workforce assignment, goods substitution, quality-batch inventory and market clearing remain unimplemented.
- No full cargo logistics, energy generation/capacity/storage/scheduling, cross-colony migration/robot transfer, ownership/lease framework.
- engine/queries.cjs retains read-only data projections for the current Core world model. Effect whitelist remains a bounded state-transition interface, not an arbitrary World patch.

## Confirmed design constraints

- Pop Group race/species categories are Mod-defined. Different races may have different Needs through Mod-defined Tags and rules; Engine does not predefine organic/synthetic/android/mechanical population types or infer Needs from a race ID.
- AI/automation means production capacity is not simply proportional to organic headcount.
- Energy is location/technology/capacity constrained; future design must distinguish generation, available supply, consumption/allocation, storage and transportable energy.
- Interstellar travel, gates and mixed transport exist; inhospitable colonies are possible but local self-sufficiency may be very expensive.
- Population location, political jurisdiction, origin, employment and ownership are separate relations. Employment references resident groups; it must not create a second population ledger.

Next work: define the minimal Mod INI Tag-to-population-category mapping and Need-rule contract, then handle rule overlap and explicit joint shares. The Engine's current matcher only selects categories within one dimension. The shared-stock executor already exists; distribution policy stays Mod-owned. Never infer joint population from marginal dimensions. Keep race categories, Needs and balance values in Mods.

## Verification and acceptance

Code commits: [0b253ab](https://github.com/Sakurefa/test-game/commit/0b253ab23eaf8e82cb1b0d0a3ad4222714a54ae2) added the allocation contract; [29945fc](https://github.com/Sakurefa/test-game/commit/29945fc7e61bc9def4c03fa72a22ac55c582dea2) fixed entity-ID validation and test integration. Final CI [45151414787](https://github.com/Sakurefa/test-game/actions/runs/45151414787) succeeded: 238/238 tests passed, syntax checks and Renderer build succeeded, and the generated-renderer step completed. The first run 45151047812 exposed an uppercase-ID validation issue and a strict floating-point assertion; both were corrected. No local build/tests were run in this session. User-side Windows GUI acceptance remains outstanding.
