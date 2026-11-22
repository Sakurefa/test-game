# Astra project work log — index

> 本文件是索引与当前状态摘要，不是历史流水账。详细执行过程见 Astra/WORKFLOWS/；设计依据见 Astra/DISCUSSIONS/；强制工程原则见 Astra/IMPORTANT_PRINCIPLES/。

## Repository snapshot

- Repository: https://github.com/Sakurefa/test-game
- Branch: `main`; Engine source/test revision: `78028fb60da90e91f906851837710f8ae0b9753d`; documentation checkpoint updated in workflow 2026-11-22_17. Trigger source snapshots now preserve the complete JSON-safe Domain Event payload instead of incorrectly applying the smaller Trigger-definition payload limit; daily Trigger Queue validation is performed once in the due-processing path.
- Latest successful Windows source CI: [44987890324](https://github.com/Sakurefa/test-game/actions/runs/44987890324). Engine/Electron syntax checks passed; `npm test` passed **233/233** with 0 failures; Renderer build and generated-renderer step succeeded. The new end-to-end Trigger scenario passed. The subsequent documentation commit CI [44988145049](https://github.com/Sakurefa/test-game/actions/runs/44988145049) also completed successfully.
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
- 2026-11-22: 01–16

Latest focused record: `Astra/WORKFLOWS/2026-11-22_16_trigger-functional-test-and-defect-fixes.txt`.

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
- Due sources support valid future campaign dates, positive integer elapsed campaign days and one-shot Domain Event matching. A Domain Event Trigger matches newly appended facts by exact type and optional exact scope/subject filters; it captures the source fact in the pending entry, does not scan/backfill history, and becomes due on the next completed day. No dayFraction/sub-day or condition/threshold triggers.
- At each completed day, after clock advance and before `campaign.before-day`, the Engine processes already-due triggers. Hook-created triggers wait until the next full day boundary. Recurring annual/monthly/weekly/daily systems then run in their existing order.
- System Event is a transient internal request. Resolution handlers receive a detached snapshot and return a JSON-safe `{ result, effects, domainEvents? }` plan (maximum 16 Effects and 16 Domain Event descriptors). Current built-in Resolutions are `effect.apply`, `formula.effect` and `event.emit`; the latter emits one Mod-namespaced Domain Event using the Trigger owner's identity.
- `engine/settlement.cjs` provides a reusable `settleSystemEvent()` pipeline: it validates and runs the Resolution plan, applies Effects through the injected validated Effect executor, and returns the planned Domain Event descriptors. It does not own Trigger scheduling or write event history.
- `engine/triggers.cjs` owns due detection, System Event creation, Settlement invocation, appending approved planned Domain Events to the candidate world, the `trigger.resolved` fact, queue removal and receipts. Each approved Effect records `mod.effect-applied`.
- A Domain Event emitted by a Trigger can activate another pending Trigger, which is scheduled for the next completed day. Event Bus remains read-only and publishes only after candidate-world commit. Presentation/UI remains separate.
- Trigger resolution, calculation audit/random state, approved Effect mutation, Domain Events, queue removal and receipts share the candidate-world daily transaction. A failure discards the entire candidate day. A new late-failure integration test now proves rollback after an earlier Effect and its `mod.effect-applied` fact have already been created in the candidate.
- Approved Mod Effects currently perform immediate state transitions through one shared `applyModEffect()` executor; they do not create active, source-tracked or reversible modifier instances. The enabled `example-market` Mod currently consumes only `mod.state.increment`; other approved types are contract/test-covered but not used by shipped Mod scripts. Timed-effect expiry therefore remains unimplemented.

Not yet implemented: condition/threshold sources; Command Resolution; generic numeric modifiers and temporary-effect lifecycle; random result pools; Presentation/UI for committed facts.

The current Trigger implementation has a real Mod-loader + daily-settlement integration scenario under `tests/fixtures/trigger-test/` (not shipped under `mods/`). It exercises all 13 approved Effect types, all three current Resolution types, all three due sources, deterministic random selection, Domain Event chaining and save/restore of a matched source snapshot. Windows source CI [44987890324](https://github.com/Sakurefa/test-game/actions/runs/44987890324) passed 233/233. This is automated Engine/Mod/storage validation, not user-device GUI acceptance.

## Next Engine foundation step

The Effect whitelist audit is recorded. The `mod.state.increment` null-vs-missing ambiguity is fixed; other Effects remain immediate mutations, not active temporary modifiers. Do not add a general modifier/effect-lifecycle framework until a real consumer and its stacking, refresh, base-value and expiry semantics are defined. Command Resolution still waits for a simulation-side consumer and authority semantics; condition/threshold sources still require an authoritative consumer and a defined evaluation point, edge/level semantics and re-arm behavior. Keep each step backed by real consumers and focused tests.

## Relevant project records

- Principles: `Astra/IMPORTANT_PRINCIPLES/【最高优先级重要原则】AK 原则.txt`, `Astra/IMPORTANT_PRINCIPLES/【最高优先级重要原则】MOD 化原则.txt`.
- Trigger semantics: `Astra/DISCUSSIONS/Trigger System 与系统 Event 架构.txt`.
- Current status and next decisions: `Astra/DISCUSSIONS/关于现状.txt`, `Astra/DISCUSSIONS/关于接下来的工作.txt`.
- Execution details: `Astra/WORKFLOWS/2026-11-22_09_trigger-system-engine-foundation.txt`, `Astra/WORKFLOWS/2026-11-22_10_resolution-effect-plan-and-formula-consumer.txt`, `Astra/WORKFLOWS/2026-11-22_11_settlement-runner-separated-from-trigger-queue.txt`. Historical workflow files preserve their original state and must not be rewritten as current status.


## 2026-11-22_17 — Trigger completion checkpoint and next direction

- Documentation commit: `8eec2a3bf0d0ade150b1bd16df34c1a04bf988be` (workflow result metadata is recorded in the following documentation-only commit).
- Trigger status: **core implementation complete; automated simulation test passed; Windows user-device GUI acceptance outstanding**. Do not continue expanding Trigger without a real consumer.
- Evidence: source CI [44987890324](https://github.com/Sakurefa/test-game/actions/runs/44987890324), 233/233 tests plus syntax and Renderer build; documentation CI [44988145049](https://github.com/Sakurefa/test-game/actions/runs/44988145049), success.
- Next direction recommendation (not yet approved implementation scope): design population-group-level needs and goods consumption. Current settlement already calculates requested, stock-limited consumed, unmet and satisfaction per commodity, and deducts colony stockpiles, but all of it is colony-aggregate. The missing foundation is explicit group-level need profiles and a defined allocation of shared stock among groups. Core defines commodity daily_need_per_thousand but has no actual demographic composition. Respect independent population dimensions; never infer joint distributions by multiplying marginal proportions. Affordability, substitutions and market purchasing remain open.
- Defer workforce/condition settlement until actual employed workforce groups and headcounts exist. Recipe workforce remains metadata.
- No code was changed or tested in this documentation/review session. No user-device GUI test and no Runtime/Launcher rebuild were performed.
