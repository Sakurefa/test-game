# Astra project work log — index

> 本文件是索引与当前状态摘要，不再累积历史正文。工作过程见 Astra/WORKFLOWS/；设计讨论见 Astra/DISCUSSIONS/；最高优先级工程原则见 Astra/IMPORTANT_PRINCIPLES/。

## Repository snapshot
- Repository: https://github.com/Sakurefa/test-game
- Branch: main; current HEAD at this documentation update: see the latest repository commit.
- Implementation commit: `f383d2978e3db76d7909f336d4e407a4b6f85982`; schema-test correction commit: `eef6c49995af3ea06f5bd94dd12809e6c3a6922f`.
- Latest main Actions run: [44920939138](https://github.com/Sakurefa/test-game/actions/runs/44920939138), successful on `eef6c49995af3ea06f5bd94dd12809e6c3a6922f`: syntax checks passed, `npm test` passed **185/185**, Renderer build passed and generated-renderer step completed. No local test suite/build was run.
- The earlier runtime preparation run [44920738556](https://github.com/Sakurefa/test-game/actions/runs/44920738556) failed on the first implementation commit because six test fixtures/assertions still expected schema 7. Those were corrected in `eef6c499...`; the main source workflow then passed all 185 tests. Runtime packaging was not rerun after the test-only correction because that workflow is path-filtered to package/runtime files. Do not claim a fresh Electron runtime bundle or launcher upload.
- This session changes Engine code, schema migration, tests and documentation; it does not change Core/optional Mod content or balance values.

## Mandatory high-priority principles
Read both before design or implementation:
- Astra/IMPORTANT_PRINCIPLES/【最高优先级重要原则】AK 原则.txt
- Astra/IMPORTANT_PRINCIPLES/【最高优先级重要原则】MOD 化原则.txt

## Reading order
AGENTS.md → Astra/README.txt → Astra/WORKING_MEMORY.txt → this index → both IMPORTANT_PRINCIPLES files → relevant DISCUSSIONS topics → relevant WORKFLOWS records. Do not read the entire workflow archive by default.

## Discussion archive
See Astra/DISCUSSIONS/: 关于游戏设计的讨论.txt, 经济系统设计.txt, 人口系统设计.txt, 人员与建筑结算设计.txt, 关于现状.txt, 关于接下来的工作.txt, 日志编写规范.txt.

## Workflow archive
Files use YYYY-MM-DD_NN_topic.txt. NN is one shared chronological sequence for the whole date. Historical grouped archives were numbered in their preserved source-log order:
- 2026-11-20: 01
- 2026-11-21: 01–07

## Current project state
The project remains in generic Engine development. All playable game content is supplied through Mods under `mods/`; `mods/core` is the required baseline content Mod, not Engine code. The Engine remains independent of specific game definitions and balance.

World save schema is now 8. Each colony retains scalar `population` and persists generic `populationGroups` with stable IDs, counts and independent dimension distributions. Population-group totals must match the colony total; every dimension's proportions must sum to 1; independent dimensions are not expanded into joint distributions. Positive `colony.population.delta` adds to `unclassified`; negative delta reduces groups proportionally. Schema 1–7 saves migrate by creating a neutral group when needed.

No actual demographic composition was added: new colonies begin entirely `unclassified`. Daily needs still settle against scalar colony population, not per group. Profession and wealth-tier remain independent INI catalog types with neutral Core placeholders. Weekly production exists; recipe workforce remains metadata. Personnel entities and workforce snapshots remain confirmed designs, not implemented systems. Consolidated Windows desktop acceptance remains outstanding.

## Next confirmed Engine foundation direction
Design the generic Mod INI contract for declaring initial population groups and independent dimension distributions. Engine owns field loading, stable-ID reference validation, initialization, persistence and migration; Core/optional Mods provide concrete groups, categories and values. Validate the contract with test Mod fixtures without adding unapproved population composition or balance data. Do not implement a game-specific population/economy system inside Engine.

## Engine / Mod boundary clarification
- Long-term population and goods economy is a game-content direction, not the current Engine task list.
- All playable content is provided by Mods. Core is the required baseline Mod at `mods/core`; it is not part of the Engine.
- The population-group runtime structure is now an Engine foundation; initial group composition and actual dimension/category values must come from Mod INI.
- Detailed implementation and next direction are in `Astra/DISCUSSIONS/关于接下来的工作.txt` and `Astra/WORKFLOWS/2026-11-21_07_aggregate-population-groups-engine-foundation.txt`.

## Documentation organization update
Baseline for this update: cd9c7bb78443a0ba18a5b944840e064111accfbb.
- Added Astra/IMPORTANT_PRINCIPLES/ with separate AK and Mod principles.
- Renamed historical workflows to YYYY-MM-DD_NN_... using preserved source-log order.
- 2026-11-21 sequence: 01 simulation/calculation/finance; 02 AK/observability/Mod API; 03 clock/save/population; 04 previous log restructuring; 05 important principles and daily ordering; 06 Engine/Mod boundary clarification; 07 aggregate population-group Engine foundation.
- Updated AGENTS.md, Astra/README.txt, WORKING_MEMORY and logging conventions to require reading both principles and to enforce one shared sequence per day.
- Tests/builds: not run (documentation-only). No Windows GUI test required.
