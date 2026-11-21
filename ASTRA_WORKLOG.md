# Astra project work log — index

> 本文件是索引与当前状态摘要，不再累积历史正文。工作过程见 Astra/WORKFLOWS/；设计讨论见 Astra/DISCUSSIONS/；最高优先级工程原则见 Astra/IMPORTANT_PRINCIPLES/。

## Repository snapshot
- Repository: https://github.com/Sakurefa/test-game
- Branch: `main`; latest population source commit: `9e515649734269e2ef71ed40d530740b83c36017`; test expectation correction: `0aa769dc97bf9c76718c3215b3d786e2869d07a1`.
- Latest relevant Windows CI: [44926697353](https://github.com/Sakurefa/test-game/actions/runs/44926697353), successful on `0aa769dc97bf9c76718c3215b3d786e2869d07a1): Electron/Engine syntax checks passed; `npm test` passed **201/201**; Renderer build and generated-renderer step succeeded. No local full suite/build was run.
- First CI for source commit [44926516064](https://github.com/Sakurefa/test-game/actions/runs/44926516064) passed syntax checks but found two test expectation mismatches (199/201); the follow-up test-only correction is the successful commit above.
- No user-side Windows GUI acceptance was performed. This change did not trigger Electron Runtime/Launcher packaging; no new runtime build or standalone Launcher is claimed.

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
- 2026-11-22: 01

## Current project state
The project remains in generic Engine development. All playable game content is supplied through Mods under `mods/`; `mods/core` is the required baseline content Mod, not Engine code. The Engine remains independent of specific game definitions and balance.

World save schema is 8. Population group counts are the authoritative runtime population records; each colony's total population is their sum. The scalar `population` field is retained only as a derived compatibility/read projection, recalculated from group counts after population operations and checked against the group sum at save/day boundaries. It is not an independent ledger.

Enabled Mod `population_group` INI definitions, when present for a colony, constitute its complete initial population; their sum determines the runtime total. No automatic `unclassified` remainder is appended and the sum need not equal the colony definition's fallback `population` value. Only a colony with no group definitions receives one `unclassified` group initialized from that fallback. Schema 1–7 saves migrate their legacy scalar once into a neutral group; after migration, group counts are authoritative.

The existing `colony.population.delta` effect remains compatible. New Mod effects split a group, merge groups and replace a group's dimension distribution. Split/merge preserve the colony total; each effect is applied through the existing Mod result pipeline and recorded by `mod.effect-applied`. `colony.summary` exposes detached group data and derives total population from group counts; faction summaries likewise use derived totals.

Core has no actual demographic composition yet. Daily needs still use derived colony total, not per-group demand. No concrete employment, wages, demographic movement or market rules were added. Personnel entities and workforce snapshots remain future designs. Consolidated Windows desktop acceptance remains outstanding.

## Next unresolved Engine foundation design
Review Query projections, Mod hook inputs, domain events and scheduler conditions to define how Mods can refer to the derived colony population total through generic threshold/condition triggers (such as colony-size limits or crossed population thresholds). Engine supplies the reusable condition/trigger mechanism; Mod content supplies the actual thresholds and effects. Do not hardcode a particular colony-level or population-reward rule.

## Current session record
See `Astra/WORKFLOWS/2026-11-22_01_population-group-authoritative-runtime-transitions.txt` and the population design discussion in `Astra/DISCUSSIONS/人口系统设计.txt`. The correction that groups constitute total population is a durable project rule, not a local implementation detail.
