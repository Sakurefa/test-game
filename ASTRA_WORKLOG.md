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
- Latest source CI: [45161571754](https://github.com/Sakurefa/test-game/actions/runs/45161571754), success; 250/250 tests passed, Electron/Simulation syntax, Simulation/Mod Loader tests, Renderer build and generated-renderer steps all succeeded. Intermediate attempts on the prior source commit encountered 50ms timeouts in different existing Hooks; final conditional-injection commit passed without changing the timeout. Local Node tests/build were not run.
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
- 2026-11-23: 01–11

Latest 2026-11-23 records:
- Astra/WORKFLOWS/2026-11-23_04_tag-based-population-needs-design.txt
- Astra/WORKFLOWS/2026-11-23_05_need-allocation-policy-interface.txt
- Astra/WORKFLOWS/2026-11-23_06_engine-mod-boundary-cleanup.txt
- Astra/WORKFLOWS/2026-11-23_07_shared-stockpile-allocation-engine-contract.txt
- Astra/WORKFLOWS/2026-11-23_08_species-based-population-matching-foundation.txt
- Astra/WORKFLOWS/2026-11-23_09_population-tag-mapping-foundation.txt
- Astra/WORKFLOWS/2026-11-23_10_population-need-rule-contract-foundation.txt
- Astra/WORKFLOWS/2026-11-23_11_population-need-line-and-request-provenance.txt

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
- The generic population module provides exact matching within one Mod-defined dimension; Catalog supports population_tag and population_need_rule. API v4 Hooks can evaluate one rule against one group as an independent demand line; unknown shares remain null. Allocation requests may carry optional sourceId; the allocator retains per-request results and aggregates only stockpile subtraction by commodity. Helpers are injected only when relevant Catalog content exists. Core still uses colony-aggregate Needs; overlap policy, aggregation of multiple source rules into one request, unknown-share policy, explicit joint shares and Core group-level consumer remain unresolved. Allocation policy stays Mod-owned.
- No full cargo logistics, energy generation/capacity/storage/scheduling, cross-colony migration/robot transfer, ownership/lease framework.
- engine/queries.cjs retains read-only data projections for the current Core world model. Effect whitelist remains a bounded state-transition interface, not an arbitrary World patch.

## Confirmed design constraints

- Pop Group race/species categories are Mod-defined. Different races may have different Needs through Mod-defined Tags and rules; Engine does not predefine life-form population types or infer Needs from a race ID.
- Production capacity is not inferred from species labels or raw population totals; labor, automation and other contributors need explicit Mod-defined data.
- Energy is location/technology/capacity constrained; future design must distinguish generation, available supply, consumption/allocation, storage and transportable energy.
- Interstellar travel, gates and mixed transport exist; inhospitable colonies are possible but local self-sufficiency may be very expensive.
- Population location, political jurisdiction, origin, employment and ownership are separate relations. Employment references resident groups; it must not create a second population ledger.

Next work: define Mod-owned semantics for overlapping rules (accumulate / duplicate / modifier / conflict / exclusive), and define handling of unknown population shares. If a Mod aggregates multiple rule sources into one request, it must retain the full source mapping; one sourceId represents one source. Then connect Core group requests only after actual Core population data and its allocation policy are defined. Never infer joint population from marginal dimensions; Engine adds no rationing default.

## Verification and acceptance

Code commits: [0b253ab](https://github.com/Sakurefa/test-game/commit/0b253ab23eaf8e82cb1b0d0a3ad4222714a54ae2) added the shared-stock allocation contract; [29945fc](https://github.com/Sakurefa/test-game/commit/29945fc7e61bc9def4c03fa72a22ac55c582dea2) fixed allocation ID validation and test integration; [26641ef](https://github.com/Sakurefa/test-game/commit/26641ef625e3ad3c1c980b07a3075b61b3f43df8) added exact one-dimension matching; [bee6505](https://github.com/Sakurefa/test-game/commit/bee65051bce21cebdf85372d620c68ac3d418ef8) added population Tag mappings; [11226f0](https://github.com/Sakurefa/test-game/commit/11226f0af016db4f13679d5066a6ad5d2e3f287a) added Need Rule descriptors and the Hook matching helper. CI [45158883203](https://github.com/Sakurefa/test-game/actions/runs/45158883203) succeeded on retry: 249/249 tests passed. The initial attempt had a transient pre-existing 50ms Core market Hook timeout; no timeout limit was changed. Direction docs commit [b19df9c](https://github.com/Sakurefa/test-game/commit/b19df9ce7c706b91b82363e063ff32e98a195403) also passed CI [45155199026](https://github.com/Sakurefa/test-game/actions/runs/45155199026). The earlier allocation run 45151047812 exposed an uppercase-ID validation issue and strict floating-point/test-load problems; those were corrected in 29945fc. No local Node tests/build were run. User-side Windows GUI acceptance remains outstanding.


Latest population Need implementation: [e49c0b2](https://github.com/Sakurefa/test-game/commit/e49c0b2c5955d979ecfd56fea928f38c93495faf). API v4 evaluates one Need Rule per Pop Group; shared-stock requests retain optional sourceId provenance and separate same-commodity request outcomes. CI [45161571754](https://github.com/Sakurefa/test-game/actions/runs/45161571754) passed 250/250 tests. See Astra/WORKFLOWS/2026-11-23_11_population-need-line-and-request-provenance.txt. Local Node tests/build were not run; Windows GUI acceptance remains outstanding.