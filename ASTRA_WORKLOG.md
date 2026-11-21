# Astra project work log — index

> 本文件是索引与当前状态摘要，不再累积历史正文。工作过程见 Astra/WORKFLOWS/；设计讨论见 Astra/DISCUSSIONS/；最高优先级工程原则见 Astra/IMPORTANT_PRINCIPLES/。

## Repository snapshot
- Repository: https://github.com/Sakurefa/test-game
- Branch: `main`; latest repository HEAD: `7c135078a3fb80c3edc12887562f09736a71b558` (documentation archive); latest runtime-code HEAD: `ac9cab507819af4852fdbe51ba16b6386b96d978` (calendar cadence fix), based on `f232d8038dd9fab8292ae5c2e9f2530fe68d13f0`.
- Latest completed Windows CI: [44930542013](https://github.com/Sakurefa/test-game/actions/runs/44930542013), successful on `7c135078a3fb80c3edc12887562f09736a71b558`: Electron/Engine syntax checks passed; `npm test` passed **204/204**; Renderer build and generated-renderer step succeeded. The runtime implementation was also verified by [44930171027](https://github.com/Sakurefa/test-game/actions/runs/44930171027) on code HEAD `ac9cab507819af4852fdbe51ba16b6386b96d978`. The earlier feature commit's first CI [44929912985](https://github.com/Sakurefa/test-game/actions/runs/44929912985) failed on an over-escaped calendar-date regex; this was corrected before the successful runs. No local full suite/build was run.
- Population implementation source commit: `9e515649734269e2ef71ed40d530740b83c36017`; test expectation correction: `0aa769dc97bf9c76718c3215b3d786e2869d07a1`.
- No user-side Windows GUI acceptance was performed for the current accumulated revision. The recent population/trigger audit did not trigger Electron Runtime/Launcher packaging.

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
- 2026-11-22: 01–04

## Discussion record consistency review (2026-11-22_04)

The current design decisions remain aligned across WORKING_MEMORY, 人口系统设计, 人员与建筑结算设计 and 关于接下来的工作: group-authoritative aggregate population; effects separate from triggers; due-only processing; approved effect/action calls; source/target/operation/value numeric influence; actual employed headcounts for workforce conditions; and annual → monthly → weekly → daily settlement priority.

Two discussion summaries have stale implementation statements and should be refreshed in a later documentation-maintenance pass:
- Astra/DISCUSSIONS/关于现状.txt still describes scalar population as authoritative and says runtime population groups do not exist.
- Astra/DISCUSSIONS/经济系统设计.txt still says the colony's current population storage is scalar-authoritative. Its unresolved economy topics (need baskets, affordability, wages, market clearing, logistics and population feedback) remain unresolved.

Astra/DISCUSSIONS/关于接下来的工作.txt reflects the 2026-11-22_03 calendar-cadence implementation. Astra/DISCUSSIONS/人员与建筑结算设计.txt remains a valid design record, but its fixed-date wording should distinguish the now-implemented recurring annual/monthly system cadence from the still-unimplemented general persisted trigger queue. Historical WORKFLOWS entries preserve their state at the time and must not be rewritten as current status.

One boundary remains to be clarified before the next trigger implementation: recurring system cadence (annual/monthly/weekly/daily) versus individual persisted trigger instances (date/elapsed/condition/event). They must have a clear relationship and must not maintain duplicate competing calendar logic. See Astra/WORKFLOWS/2026-11-22_04_discussion-record-consistency-audit.txt. This review did not edit any topic-based discussion file.

## Current project state
The project remains in generic Engine development. All playable game content is supplied through Mods under `mods/`; `mods/core` is the required baseline content Mod, not Engine code. The Engine remains independent of specific game definitions and balance.

World save schema is 8. Population group counts are the authoritative runtime population records; each colony's total population is their sum. The scalar `population` field is retained only as a derived compatibility/read projection, recalculated from group counts after population operations and checked against the group sum at save/day boundaries. It is not an independent ledger.

Enabled Mod `population_group` INI definitions, when present for a colony, constitute its complete initial population; their sum determines the runtime total. No automatic `unclassified` remainder is appended and the sum need not equal the colony definition's fallback `population` value. Only a colony with no group definitions receives one `unclassified` group initialized from that fallback. Schema 1–7 saves migrate their legacy scalar once into a neutral group; after migration, group counts are authoritative.

The existing `colony.population.delta` effect remains compatible. New Mod effects split a group, merge groups and replace a group's dimension distribution. Split/merge preserve the colony total; each effect is applied through the existing Mod result pipeline and recorded by `mod.effect-applied`. `colony.summary` exposes detached group data and derives total population from group counts; faction summaries likewise use derived totals.

### Scheduling, triggers, effects and calculation status
The campaign clock, pause/speed controls, and deterministic system registry exist. The registry supports annual, monthly, weekly, daily and manual cadence. Annual systems are due on January 1; monthly systems on the first day of each calendar month; weekly remains anchored to every seven elapsed campaign days; daily remains every completed day. When boundaries coincide, registered systems run in annual → monthly → weekly → daily phase order; manual systems remain explicitly invoked. Stable IDs, dependencies, order and per-system last-run-day markers remain in place. No annual or monthly gameplay system is registered yet; actual settlements still comprise weekly production and daily population needs, market pricing and war chronology.

The broader design remains: effects and triggers are separate; permanent effects need no timer; temporary effects are managed by due triggers; due processing must not scan historical effects; trigger actions may expire/change effects, emit events or invoke approved actions; generic numerical influence uses source, target, operation and value; building conditions use actual employed headcounts sampled at scheduled boundaries and remain stable between them.

The broader Trigger System is **not yet implemented**. There is no persisted general trigger registry/queue, elapsed-time/condition/event trigger evaluator, trigger-to-approved-action call contract, temporary-effect lifecycle or generic numeric modifier layer. Fixed Mod hooks exist only at named engine call sites. The example Mod's “monthly” observation runs from `campaign.after-day` and checks `day % 30`; it is a script-level 30-elapsed-day check, not a calendar-month scheduler. The event bus is an observer of completed facts, not a gameplay trigger system.

The calculation service is implemented and auditable, but currently registers four Engine-defined formulas: `economy.population-needs`, `economy.colony-production`, `economy.commodity-price`, and `economy.security-price`. This does not yet provide the agreed general source/target/operation/value effect system. Commands, Event Bus, Mod Hooks and Mod Effects exist as separate rails; the general approved invocation layer connecting triggers to those rails is still absent.

Core has no actual demographic composition yet. Daily needs still use derived colony total, not per-group demand. No concrete employment, wages, demographic movement or market rules were added. Recipe workforce remains metadata; actual employed workforce groups and building-condition settlement are not implemented. Personnel entities and workforce snapshots remain future designs. Consolidated Windows desktop acceptance remains outstanding.

## Next Engine foundation step
Continue the already confirmed general architecture without narrowing it to population thresholds:
1. define the persisted due-trigger record and queue lifecycle for scheduled date and elapsed-time triggers, with stable IDs, duplicate handling and a clear failure/commit boundary; process only due entries;
2. connect due triggers to a narrow registry of approved Effect/Command/Event invocations, with no arbitrary Mod function or world patch access;
3. add condition/event-driven trigger sources and generic source/target/operation/value effects only when the invocation and lifecycle contracts have a real test consumer;
4. keep temporary-effect expiry separate from the effect record; defer building workforce conditions until real employed groups and headcounts exist.
See `Astra/WORKFLOWS/2026-11-22_03_calendar-settlement-cadence-foundation.txt` for the latest implementation and verification record, and `2026-11-22_02_trigger-settlement-call-numeric-architecture-audit.txt` for the preceding audit.
