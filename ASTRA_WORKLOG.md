# Astra project work log — index

> 本文件是索引与当前状态摘要，不是历史流水账。详细执行过程见 Astra/WORKFLOWS/；设计依据见 Astra/DISCUSSIONS/；强制工程原则见 Astra/IMPORTANT_PRINCIPLES/。

## Repository snapshot

- Repository: https://github.com/Sakurefa/test-game
- Branch: `main`; latest code/test revision: `b8cdd7cda5f5b3ace825c198e34efdc0a2b0293a` (Resolution result/effect-plan separation, formula Resolution consumer and Trigger test fixture correction).
- Latest successful Windows source CI: [44953041332](https://github.com/Sakurefa/test-game/actions/runs/44953041332). Electron/Engine syntax checks passed; `npm test` passed **219/219** with 0 failures; Renderer build and generated-renderer step succeeded.
- No local full test suite/build was run. GitHub Windows CI is not user-side Windows GUI acceptance.
- User-side Windows GUI acceptance and the separate Electron Runtime/Launcher packaging workflow were not run in this stage.

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
- 2026-11-22: 01–10

Latest focused record: `Astra/WORKFLOWS/2026-11-22_10_resolution-effect-plan-and-formula-consumer.txt`.

## Current foundation state

The project remains in generic Engine development. All playable game content is supplied through Mods under `mods/`; `mods/core` is the required baseline content Mod, not Engine code. Mod manifests, registry, content definitions and localization remain INI. API v4 JS is restricted to declared hooks and approved result contracts; API v3 INI-only Mods remain compatible.

World save schema is **9**. Engine migrates schemas 1–8 to 9; schema 8 saves retain their existing data and gain an empty Trigger Queue. Electron storage reads schemas 1–9 and only writes schema 9; the main-process load path migrates and validates before activating a save. This stage adds no persisted world fields and does not change schema.

Population group counts are authoritative; each colony's total population is their sum. Scalar `population` is a derived compatibility/read projection only. Mod `population_group` definitions, when present, define the complete initial group population; only colonies without group definitions receive one fallback `unclassified` group. Legacy scalar populations are converted once during migration.

Needs still settle daily against derived colony total, not per-group demand. Weekly production exists; recipe workforce remains metadata. No actual personnel pool, employed workforce groups, wages, demographic composition or building-condition settlement has been added.

## Scheduling, Trigger and effect status

The campaign clock and deterministic simulation registry exist. Registry cadence supports annual, monthly, weekly, daily and manual:
- annual: January 1;
- monthly: first calendar day of each month;
- weekly: every seven elapsed campaign days;
- daily: each completed campaign day;
- manual: explicit call only.

Recurring systems run annual → monthly → weekly → daily. Existing consumers remain weekly colony production and daily population needs, market pricing and active-war chronology. No annual/monthly gameplay system is registered.

**The Trigger System and two-step Resolution/Effect pipeline are implemented and passed source CI:**
- Recurring simulation-system cadence still owns repeated work; persisted Trigger instances are single-shot actions and do not replace the cadence registry.
- World contains a persisted Trigger Queue with pending instances and the latest 256 receipts.
- Mod API v4 hooks can return bounded `triggers` descriptors. The Engine injects owner Mod ID; Trigger IDs must be owner-namespaced. Same-ID/same-definition resubmission is idempotent while the pending entry/recent receipt exists; conflicting reuse fails.
- Due sources currently support valid future campaign dates and positive integer elapsed campaign days only. No dayFraction/sub-day, condition or Domain-Event-driven triggers.
- At each completed day, after clock advance and before `campaign.before-day`, the Engine processes already-due triggers. Hook-created triggers wait until the next full day boundary. Recurring annual/monthly/weekly/daily systems then run in their existing order.
- Resolution handlers receive a detached snapshot and return a JSON-safe `{ result, effects }` plan (maximum 16 Effects). They do not mutate authoritative World state. Trigger Runner applies the ordered plan separately through the existing validated Mod Effect executor.
- Current built-in Resolutions are `effect.apply` and `formula.effect`. The latter invokes an existing Engine-registered versioned formula, uses JSON-safe inputs captured when the Trigger is scheduled, derives an independent random stream from the Trigger ID, and maps selected top-level result fields into approved Effect payloads. No Mod-defined formulas, callbacks or expression language are introduced.
- Successful Effects write standard `mod.effect-applied` facts; `trigger.resolved` records calculation output and applied Effect results. System Event is an internal processing request; Domain Event is a completed fact published through the read-only Event Bus only after candidate-world commit.
- Trigger resolution, calculation audit/random state, approved Effect mutation, Domain Events, queue removal and receipts share the candidate-world daily transaction. A failure discards the entire candidate day, leaving the live world and pending trigger untouched.

Not yet implemented: condition/threshold and Domain-Event-driven sources; Command/Event Resolution types; generic numeric modifiers and temporary-effect lifecycle; random result pools; Presentation/UI for committed facts.

## Next Engine foundation step

Choose a Trigger source backed by existing authoritative data, then define its evaluation frequency, replay/cursor semantics and candidate-world commit boundary. Condition/threshold and Domain-Event-driven sources should be designed separately; do not add a general expression language or scan the full Domain Event history. Keep each step backed by a real consumer and focused failure/atomicity tests.

## Relevant project records

- Principles: `Astra/IMPORTANT_PRINCIPLES/【最高优先级重要原则】AK 原则.txt`, `Astra/IMPORTANT_PRINCIPLES/【最高优先级重要原则】MOD 化原则.txt`.
- Trigger semantics: `Astra/DISCUSSIONS/Trigger System 与系统 Event 架构.txt`.
- Current status and next decisions: `Astra/DISCUSSIONS/关于现状.txt`, `Astra/DISCUSSIONS/关于接下来的工作.txt`.
- Execution details: `Astra/WORKFLOWS/2026-11-22_09_trigger-system-engine-foundation.txt`, `Astra/WORKFLOWS/2026-11-22_10_resolution-effect-plan-and-formula-consumer.txt`. Historical workflow files preserve their original state and must not be rewritten as current status.
