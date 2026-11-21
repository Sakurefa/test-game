# Astra project work log — index

> 本文件是索引与当前状态摘要，不再累积历史正文。工作过程见 Astra/WORKFLOWS/；设计讨论见 Astra/DISCUSSIONS/；最高优先级工程原则见 Astra/IMPORTANT_PRINCIPLES/。

## Repository snapshot
- Repository: https://github.com/Sakurefa/test-game
- Branch: main
- This update changes collaboration documentation only; no game source, Mods, schema, tests, Renderer or balance data changed.
- CI status is not inferred from empty status-check responses.
- Latest separately verified implementation evidence remains CI run 44912016537 on e4025edca93e816f50d62c43427a9212a146016b: syntax checks passed, npm test 178/178, Vite Renderer build and generated Renderer step passed. Do not attribute that result to later commits.

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
- 2026-11-21: 01–05

## Current project state
Population still uses a scalar colony total; runtime cohorts do not exist. Profession and wealth-tier are independent INI catalog types with neutral Core placeholders. Daily needs are aggregate; weekly production exists; recipe workforce remains metadata. Personnel entities and workforce snapshots are confirmed designs, not implemented systems. Save schema remains 7 in the last inspected baseline. Consolidated Windows acceptance remains outstanding.

## Next confirmed direction
Inspect population/colony state, Mod effects, save schema and tests; then design the smallest persisted aggregate population-group representation while preserving scalar population and colony.population.delta compatibility. Do not add unconfirmed game content or balance values.

## Documentation organization update
Baseline for this update: cd9c7bb78443a0ba18a5b944840e064111accfbb.
- Added Astra/IMPORTANT_PRINCIPLES/ with separate AK and Mod principles.
- Renamed historical workflows to YYYY-MM-DD_NN_... using preserved source-log order.
- 2026-11-21 sequence: 01 simulation/calculation/finance; 02 AK/observability/Mod API; 03 clock/save/population; 04 previous log restructuring; 05 important principles and daily ordering.
- Updated AGENTS.md, Astra/README.txt, WORKING_MEMORY and logging conventions to require reading both principles and to enforce one shared sequence per day.
- Tests/builds: not run (documentation-only). No Windows GUI test required.
