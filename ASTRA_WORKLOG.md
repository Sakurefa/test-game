# Astra project work log — index

> 本文件是索引与当前状态摘要，不再累积历史正文。工作过程见 Astra/WORKFLOWS/；设计讨论见 Astra/DISCUSSIONS/；最高优先级工程原则见 Astra/IMPORTANT_PRINCIPLES/。

## Repository snapshot
- Repository: https://github.com/Sakurefa/test-game
- Branch: main; aggregate group implementation: `f383d2978e3db76d7909f336d4e407a4b6f85982`; schema-test correction: `eef6c49995af3ea06f5bd94dd12809e6c3a6922f`; Astra state-record commit: `900c43cfb796e2341d5ef6b06a8b30a083889bd4`; Mod INI group-loading commit: `6d17b9b86cdc9589aa71bb3f3ef58c37763ac06c`.
- Latest main Actions run: [44921871092](https://github.com/Sakurefa/test-game/actions/runs/44921871092), successful on `6d17b9b86cdc9589aa71bb3f3ef58c37763ac06c`: Engine/Electron syntax checks passed, `npm test` passed **188/188**, Renderer build passed, and generated-renderer step completed. No local full test suite/build was run.
- The earlier schema-8 runtime preparation run [44920738556](https://github.com/Sakurefa/test-game/actions/runs/44920738556) failed on the first implementation commit because six old tests still expected schema 7; the test-only correction then passed the main workflow with 185/185. Runtime packaging was not rerun because the correction did not change runtime/package paths. The new population_group batch also did not touch the runtime workflow's path filters, so no fresh Electron Runtime build or Launcher upload is claimed.
- This session changes generic Engine/Mod-loading contracts, tests and docs; it adds no actual Core demographic composition or population balance values. CI is Windows Runner evidence, not user-side desktop GUI acceptance.

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
- 2026-11-21: 01–08

## Current project state
The project remains in generic Engine development. All playable game content is supplied through Mods under `mods/`; `mods/core` is the required baseline content Mod, not Engine code. The Engine remains independent of specific game definitions and balance.

World save schema is 8. Each colony retains scalar `population` and persists generic `populationGroups` with stable IDs, counts and independent dimension distributions. Mod INI can initialize groups through registered `population_group` definitions. All group counts for a colony across enabled Mods must equal its configured population; absent definitions use a neutral `unclassified` fallback. Profession and wealth categories reference the registered catalogs; other dimensions remain generic stable IDs. Empty populationGroups are omitted from content fingerprint serialization to preserve old schema-8 fingerprints; actual definitions enter the fingerprint. Positive `colony.population.delta` adds to `unclassified`; negative delta reduces groups proportionally. Schema 1–7 saves migrate by creating a neutral group when needed.

No actual demographic composition was added to Core: new colonies begin entirely `unclassified` unless an enabled Mod supplies groups. Daily needs still settle against scalar colony population, not per group. Weekly production exists; recipe workforce remains metadata. Personnel entities and workforce snapshots remain confirmed designs, not implemented systems. Consolidated Windows desktop acceptance remains outstanding.

## Next unresolved Engine foundation design
Review the existing effect/command/event contracts and define safe generic runtime semantics for population-group transitions (create/remove/split/merge/change a dimension) while preserving total population and traceability. Do not implement mutation APIs or gameplay rules until the operation semantics are clear.
## Engine / Mod boundary clarification
- Long-term population and goods economy is a game-content direction, not the current Engine task list.
- All playable content is provided by Mods. Core is the required baseline Mod at `mods/core`; it is not part of the Engine.
- The Engine now loads Mod-defined `population_group` INI records while Core remains neutral and supplies no demographic composition.
- Detailed implementation and next direction are in `Astra/DISCUSSIONS/关于接下来的工作.txt` and `Astra/WORKFLOWS/2026-11-21_08_mod-defined-population-groups-ini-foundation.txt`.

## Documentation organization update
Baseline for this update: cd9c7bb78443a0ba18a5b944840e064111accfbb.
- Added Astra/IMPORTANT_PRINCIPLES/ with separate AK and Mod principles.
- Renamed historical workflows to YYYY-MM-DD_NN_... using preserved source-log order.
- 2026-11-21 sequence: 01 simulation/calculation/finance; 02 AK/observability/Mod API; 03 clock/save/population; 04 previous log restructuring; 05 important principles and daily ordering; 06 Engine/Mod boundary clarification; 07 aggregate population-group Engine foundation; 08 Mod INI population-group loading.
- Updated AGENTS.md, Astra/README.txt, WORKING_MEMORY and logging conventions to require reading both principles and to enforce one shared sequence per day.
- Tests/builds: not run (documentation-only). No Windows GUI test required.
