# Astra project work log — index

> 本文件是索引与当前状态摘要，不再累积完整历史。详细工作过程见 Astra/WORKFLOWS/；设计决策见 Astra/DISCUSSIONS/。

## Repository snapshot
- Repository: https://github.com/Sakurefa/test-game
- Branch: main
- Baseline before this restructure: d8ab44d36b72fa2bfbfa557cdd40ea759a8737b1
- This restructure changes collaboration documentation only; no game source, Mods, schema, tests, Renderer or balance data changed.
- Combined status for the baseline returned no entries; this is not evidence of passing CI.
- Latest separately verified implementation evidence remains CI run 44912016537 on e4025edca93e816f50d62c43427a9212a146016b: syntax checks passed, npm test 178/178, Vite Renderer build and generated Renderer step passed. Do not attribute that result to later commits.

## Reading order
AGENTS.md → Astra/README.txt → Astra/WORKING_MEMORY.txt → this index → relevant Astra/DISCUSSIONS/ topics → relevant Astra/WORKFLOWS/ records. Do not read the entire workflow archive by default.

## Discussion archive
See Astra/DISCUSSIONS/: 关于游戏设计的讨论.txt, 经济系统设计.txt, 人口系统设计.txt, 人员与建筑结算设计.txt, 关于现状.txt, 关于接下来的工作.txt, 日志编写规范.txt.

## Workflow archive
Historical session entries have been split into four focused workstream archives under Astra/WORKFLOWS/. Filenames use date plus work direction/topic. Multiple files on one date are normal.
A separate current-session record documents this restructure.

## Current project state
Population still uses a scalar colony total; runtime cohorts do not exist. Profession and wealth-tier are independent INI catalog types with neutral Core placeholders. Daily needs are aggregate; weekly production exists; recipe workforce remains metadata. Personnel entities and workforce snapshots are confirmed designs, not implemented systems. Save schema remains 7 in the last inspected baseline. Consolidated Windows acceptance remains outstanding.

## Next confirmed direction
Inspect population/colony state, Mod effects, save schema and tests; then design the smallest persisted aggregate population-group representation while preserving scalar population and colony.population.delta compatibility. Do not add unconfirmed game content or balance values.

## This restructure
Base commit: d8ab44d36b72fa2bfbfa557cdd40ea759a8737b1. Tests/builds: not run (documentation-only). No new CI result claimed. Windows GUI test: not required. The current-session record is under Astra/WORKFLOWS/.
