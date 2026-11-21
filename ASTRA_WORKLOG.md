# Astra project work log — index

> 本文件是索引与当前状态摘要，不是历史流水账。详细执行过程见 Astra/WORKFLOWS/；设计依据见 Astra/DISCUSSIONS/；强制工程原则见 Astra/IMPORTANT_PRINCIPLES/。

## Repository snapshot

- Repository: https://github.com/Sakurefa/test-game
- Branch: `main`; latest Engine source/test revision: `e4340796e78d7aafc18899f27f4a84d5b86f334d` (Settlement runner extracted from Trigger Queue). Latest main head: `0f2d9a5fc41c34dfd1c669d043a19bfd08743aeb` (Runtime workflow's generated `resources/app/package.json` sync).
- Latest successful Windows source CI: [44953518426](https://github.com/Sakurefa/test-game/actions/runs/44953518426). Engine/Electron syntax checks passed; `npm test` passed **221/221** with 0 failures; Renderer build and generated-renderer step succeeded.
- Latest successful Windows Runtime/Launcher workflow: [44953518367](https://github.com/Sakurefa/test-game/actions/runs/44953518367). Mod loader tests, Renderer build, minimal Electron app preparation, Windows Electron Runtime build, dependency sync, generated-file commit and Launcher EXE upload all succeeded.
- Launcher artifact: `Market-Simulator-Launcher-EXE`, Artifact ID `14726491849`, about 92.7 MB, expires 2026-12-05 21:50 UTC. This confirms CI packaging/upload, not user-device launch verification.
- No local full test suite/build was run. User-side Windows GUI acceptance remains outstanding.

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
- 2026-11-22: 01–11

Latest focused record: `Astra/WORKFLOWS/2026-11-22_11_settlement-runner-separated-from-trigger-queue.txt`.

## Current foundation state

The project remains in generic Engine development. All playable game content is supplied through Mods under `mods/`; `mods/core` is the required baseline content Mod, not Engine code. Mod manifests, registry, content definitions and localization remain INI. API v4 JS is restricted to declared hooks and approved result contracts; API v3 INI-only Mods remain compatible.

World save schema is **9**. Engine migrates schemas 1–8 to 9; schema 8 saves retain their existing data and gain an empty Trigger Queue. Electron storage reads schemas 1–9 and only writes schema 9. The Settlement extraction adds no persistent World fields and does not change schema.

Population group counts are authoritative; each colony's total population is their sum. Scalar `population` is a derived compatibility/read projection only. Mod `population_group` definitions, when present, define the complete initial group population; only colonies without group definitions receive one fallback `unclassified` group. Legacy scalar populations are converted once during migration.

Needs still settle daily against derived colony total, not per-group demand. Weekly production exists; recipe workforce remains metadata. No actual personnel pool, employed workforce groups, wages, demographic composition or building-condition settlement has been added.

## Scheduling, Trigger, Settlement and effect status

The campaign clock and deterministic simulation registry exist. Registry cadence supports annual, monthly, weekly, daily and manual:
- annual: January 1;
- monthly: first calendar day of each month;
- weekly: every seven elapsed campaign days;
- daily: each completed campaign day;
- manual: explicit call only.

Recurring systems run annual → monthly → weekly → daily. Existing consumers remain weekly colony production and daily population needs, market pricing and active-war chronology. No annual/monthly gameplay system is registered.

**Trigger scheduling and System Event settlement are separate Engine layers:**
- Recurring simulation-system cadence still owns repeated work; persisted Trigger instances are single-shot actions and do not replace the cadence registry.
- World contains a persisted Trigger Queue with pending instances and the latest 256 receipts.
- Mod API v4 hooks can return bounded `triggers` descriptors. The Engine injects owner Mod ID; Trigger IDs must be owner-namespaced. Same-ID/same-definition resubmission is idempotent while the pending entry/recent receipt exists; conflicting reuse fails.
- Due sources currently support valid future campaign dates and positive integer elapsed campaign days only. No dayFraction/sub-day, condition or Domain-Event-driven triggers.
- At each completed day, after clock advance and before `campaign.before-day`, the Engine processes already-due triggers. Hook-created triggers wait until the next full day boundary. Recurring annual/monthly/weekly/daily systems then run in their existing order.
- System Event is a transient internal request. Resolution handlers receive a detached snapshot and return a JSON-safe `{ result, effects }` plan (maximum 16 Effects). Current built-in Resolutions are `effect.apply` and `formula.effect`; the latter uses an existing versioned Engine formula, scheduling-time input snapshot, per-Trigger deterministic random stream and top-level result-field mapping.
- `engine/settlement.cjs` provides a reusable `settleSystemEvent()` pipeline: it runs the Resolution plan and applies Effects through the injected validated Effect executor. It does not own Trigger scheduling, Domain Event history or Presentation.
- `engine/triggers.cjs` owns due detection, System Event creation, Settlement invocation, `trigger.resolved` fact, queue removal and receipts. Each approved Effect records `mod.effect-applied`.
- Domain Event is a completed fact delivered via the read-only Event Bus only after candidate-world commit. Presentation/UI remains separate.
- Trigger resolution, calculation audit/random state, approved Effect mutation, Domain Events, queue removal and receipts share the candidate-world daily transaction. A failure discards the entire candidate day.

Not yet implemented: condition/threshold and Domain-Event-driven sources; Command/Event Resolution types; generic numeric modifiers and temporary-effect lifecycle; random result pools; Presentation/UI for committed facts.

## Next Engine foundation step

Choose a Trigger source backed by existing authoritative data, then define its evaluation frequency, replay/cursor semantics and candidate-world commit boundary. Condition/threshold and Domain-Event-driven sources should be designed separately; do not add a general expression language or scan the full Domain Event history. Keep each step backed by a real consumer and focused failure/atomicity tests.

## Relevant project records

- Principles: `Astra/IMPORTANT_PRINCIPLES/【最高优先级重要原则】AK 原则.txt`, `Astra/IMPORTANT_PRINCIPLES/【最高优先级重要原则】MOD 化原则.txt`.
- Trigger semantics: `Astra/DISCUSSIONS/Trigger System 与系统 Event 架构.txt`.
- Current status and next decisions: `Astra/DISCUSSIONS/关于现状.txt`, `Astra/DISCUSSIONS/关于接下来的工作.txt`.
- Execution details: `Astra/WORKFLOWS/2026-11-22_09_trigger-system-engine-foundation.txt`, `Astra/WORKFLOWS/2026-11-22_10_resolution-effect-plan-and-formula-consumer.txt`, `Astra/WORKFLOWS/2026-11-22_11_settlement-runner-separated-from-trigger-queue.txt`. Historical workflow files preserve their original state and must not be rewritten as current status.
