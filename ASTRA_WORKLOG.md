# Astra project work log — index

> 本文件是当前状态索引，不是历史流水账。具体执行过程见 Astra/WORKFLOWS/；设计依据见 Astra/DISCUSSIONS/；强制原则见 Astra/IMPORTANT_PRINCIPLES/。

## Repository snapshot (2026-11-23)

- Repository: https://github.com/Sakurefa/test-game
- Branch: main
- Latest inspected baseline before this documentation update: 04f604cb6c8b8bce48f761157fdbf1b3df7979b3.
- Baseline Windows source CI: [45059248600](https://github.com/Sakurefa/test-game/actions/runs/45059248600), success: Electron/Engine syntax, simulation + Mod loader tests, Renderer build and generated-renderer steps all passed.
- Last explicitly counted full Trigger integration suite: [44987890324](https://github.com/Sakurefa/test-game/actions/runs/44987890324), 233/233 tests passed. Documentation CI [44988145049](https://github.com/Sakurefa/test-game/actions/runs/44988145049) succeeded.
- Latest successful Runtime/Launcher workflow: [44953518367](https://github.com/Sakurefa/test-game/actions/runs/44953518367). Launcher artifact Market-Simulator-Launcher-EXE (~92.7 MB) was uploaded; this confirms CI packaging only, not user-device launch.
- No local full test/build and no user-side Windows GUI acceptance have been performed in this review.

## Mandatory principles and reading order

Read AGENTS.md → Astra/README.txt → full Astra/WORKING_MEMORY.txt → this index → both:
- Astra/IMPORTANT_PRINCIPLES/【最高优先级重要原则】AK 原则.txt
- Astra/IMPORTANT_PRINCIPLES/【最高优先级重要原则】MOD 化原则.txt

Then read only relevant discussions and workflow records. The user owns project direction; inspection and recommendations do not authorize code changes.

## Workflow archive

Files use YYYY-MM-DD_NN_topic.txt; NN is one shared chronological sequence per date.
- 2026-11-20: 01
- 2026-11-21: 01–08
- 2026-11-22: 01–17
- 2026-11-23: 01–02

Latest records:
- Astra/WORKFLOWS/2026-11-23_01_victoria3-population-economy-production-research.txt
- Astra/WORKFLOWS/2026-11-23_02_repository-state-and-population-foundation-review.txt

## Current engine snapshot

- World schema 9; legacy schemas 1–8 migrate to 9.
- Generic population groups are authoritative per colony; colony scalar population is a derived compatibility projection. Mod INI may define complete initial groups. Group split/merge/dimension updates exist; independent dimensions do not imply joint distributions.
- Campaign clock and simulation registry support annual/monthly/weekly/daily/manual cadence. Current consumers: weekly colony production; daily population needs, market repricing and war chronology.
- Daily settlement uses a detached candidate world and commits atomically. Deterministic named random streams, versioned calculation audit, commands, finance ledger, typed Domain Events and post-commit read-only Event Bus exist.
- Trigger core is implemented and automated-simulation-tested: date, elapsed-day and new Domain Event sources; three Resolutions; 13 approved immediate Effects; shared Settlement runner and atomic daily execution. Do not expand without a concrete consumer.
- Production is weekly and stock-constrained. Market pricing is daily. There is no complete inter-colony cargo/logistics or market-clearing system.
- Daily needs still use colony total population and commodity daily_need_per_thousand; stock-limited consumption and requested/consumed/unmet/satisfaction reporting exist. No group-level Need Profile or shared-stock allocation across groups exists.
- Recipe workforce remains metadata. No actual building employment allocation, wages, population migration or ownership system exists.
- Mod content and localization remain INI; Core is a required Mod, not Engine.

## Current design direction

Long-term setting constraints are recorded:
- Organic Pops need biological goods; synthetic/android/mechanical Pops instead need energy, precision components and maintenance.
- AI/automation means production capacity is not simply proportional to organic headcount.
- Energy is a scarce, geographically and technically capacity-limited strategic resource. Future design must distinguish generation, available supply, consumption/allocation, storage and transportable energy carriers.
- Interstellar travel, gates and mixed transport exist. Inhospitable colonies are possible; local self-sufficiency can be extremely expensive.
- Population location, political jurisdiction, origin, employment and ownership are separate relations. A building references employed residents; it does not own a second population count. Migration is globally count-conserving; unemployment, political change and ownership transfer do not themselves change population totals.

Next recommended work: design the minimal Mod-defined group-level Need Profile assignment and deterministic allocation of shared colony stock among groups. Consider energy as a design boundary case, but do not implement energy generation, capacity dispatch or interstellar energy markets in that work.

Deferred: cross-colony migration/robot transfer, origin distributions, ownership/lease structures, actual building workforce and wages, full energy infrastructure/market, and logistics. Preserve their constraints without building speculative frameworks.

## Verification and acceptance boundary

The latest inspected source CI is successful. This documentation review did not run local tests/builds. Windows GUI acceptance remains outstanding. CI Runtime packaging is not equivalent to user-device testing.
