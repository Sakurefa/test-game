# Astra project work log — index

> 本文件是索引与当前状态摘要，不是历史流水账。详细执行过程见 Astra/WORKFLOWS/；设计依据见 Astra/DISCUSSIONS/；强制工程原则见 Astra/IMPORTANT_PRINCIPLES/。

## Repository snapshot

- Repository: https://github.com/Sakurefa/test-game
- Branch: `main`; latest architecture/source revision recorded for this session: `b6617ac99551fb329dcd5d967639f7a74a369ca0` (cadence/Trigger boundary docs plus shared campaign-date validation).
- Latest completed Windows CI for that revision: [44933468019](https://github.com/Sakurefa/test-game/actions/runs/44933468019), successful. Electron/Engine syntax check passed; `npm test` passed **204/204** with 0 failures; Renderer build and generated-renderer step succeeded.
- No local full test suite/build was run in this session. GitHub Windows CI is not user-side Windows GUI acceptance.
- No user-side Windows GUI acceptance has been completed for the accumulated version. Launcher/Runtime packaging was not part of this session.

## Mandatory high-priority principles

Read both before design or implementation:
- `Astra/IMPORTANT_PRINCIPLES/【最高优先级重要原则】AK 原则.txt`
- `Astra/IMPORTANT_PRINCIPLES/【最高优先级重要原则】MOD 化原则.txt`

## Reading order

`AGENTS.md` → `Astra/README.txt` → complete `Astra/WORKING_MEMORY.txt` → this index → both IMPORTANT_PRINCIPLES files → relevant DISCUSSIONS topics → relevant WORKFLOWS records. Do not read the entire workflow archive by default.

## Workflow archive

Files use `YYYY-MM-DD_NN_topic.txt`. NN is one shared chronological sequence for the whole date. Historical grouped archives keep their original source-log order.

- 2026-11-20: 01
- 2026-11-21: 01–08
- 2026-11-22: 01–05

Latest focused record: `Astra/WORKFLOWS/2026-11-22_05_discussion-and-trigger-boundary-update.txt`.

## Current foundation state

The project remains in generic Engine development. All playable game content is supplied through Mods under `mods/`; `mods/core` is the required baseline content Mod, not Engine code. Mod manifests, registry, content definitions and localization remain INI. API v4 JS is restricted to declared hooks and approved result contracts.

World save schema is 8. Population group counts are authoritative; each colony's total population is their sum. Scalar `population` is a derived compatibility/read projection only. Mod `population_group` definitions, when present, define the complete initial group population; only colonies without group definitions receive one fallback `unclassified` group. Schema 1–7 saves migrate legacy scalar population once into neutral groups.

Needs still settle daily against derived colony total, not per-group demand. Weekly production exists; recipe workforce remains metadata. No actual personnel pool, employed workforce groups, wages, demographic composition or building-condition settlement has been added.

## Scheduling, Trigger and effect status

The campaign clock and deterministic simulation registry exist. Registry cadence supports annual, monthly, weekly, daily and manual:
- annual: January 1;
- monthly: first calendar day of each month;
- weekly: every seven elapsed campaign days;
- daily: each completed campaign day;
- manual: explicit call only.

Coincident recurring systems run annual → monthly → weekly → daily, with dependencies and configured order within those phases. Existing actual consumers remain weekly colony production and daily population needs, market pricing and active-war chronology. No annual/monthly gameplay system is registered.

**Cadence and Trigger instances have separate responsibilities:**
- Recurring simulation-system cadence owns repeated system work.
- A persisted Trigger instance will own an individual one-shot date/elapsed/condition/domain-event action, including temporary-effect expiry. It must not duplicate the recurring cadence scheduler.
- Date triggers must reuse campaign clock date rules. Initial elapsed triggers are aligned to completed whole-day settlement; `dayFraction` does not currently run sub-day simulation.
- Trigger execution, queue removal and resulting effects/events must happen inside the detached candidate-world day settlement. They commit together on success or are all discarded on failure; Event Bus delivery occurs after world commit.
- Trigger actions may call only explicitly registered and payload-validated Effect/Command/Event entry points, never arbitrary Mod functions or world patches.

The general Trigger Queue is **not implemented**. Also absent: trigger-to-approved-action invocation, condition/threshold and event trigger evaluation, temporary-effect state/lifecycle, and the generic source/target/operation/value modifier layer. The Event Bus observes committed facts; it is not a gameplay trigger system.

Before implementation, the first real Trigger consumer must establish the precise execution phase relative to cadence systems, stable-ID creation/replay semantics and event-trigger cursor/re-entrancy rules. Sub-day triggers are out of scope until a real consumer requires them.

## Next Engine foundation step

Continue the approved generic direction:
1. Define a narrow Trigger → registered Effect/Command/Event invocation contract using an actual generic action consumer.
2. Pin the trigger execution phase relative to annual/monthly/weekly/daily systems and stable-ID / duplicate-creation / replay semantics.
3. Implement the smallest persisted date/elapsed due queue, processing only due entries and keeping action application plus queue removal inside the candidate-world commit.
4. Add condition/event-driven sources and generic numeric effects only when a real consumer and test contract exist.
5. Defer workforce conditions until actual employed group records and headcounts exist.

The design rationale and current implementation state are in `Astra/DISCUSSIONS/关于接下来的工作.txt`, `Astra/DISCUSSIONS/人员与建筑结算设计.txt`, and workflow 05. Historical workflow records retain the state at the time and must not be rewritten as current status.
