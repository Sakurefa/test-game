# Mandatory project workflow for Astra

This repository is maintained through long-running, multi-session collaboration. Before making any project change, Astra must:

1. Read this file.
2. Read Astra/README.txt, the complete Astra/WORKING_MEMORY.txt and the short root ASTRA_WORKLOG.md index.
3. Read only topic discussions and dated workflow records relevant to the current task; do not load the entire archive by default.
4. Inspect the current default-branch commit and relevant files; never assume the previous session's state is still current.
5. Check the latest relevant GitHub Actions run before treating existing code as verified.
6. Follow the project's non-negotiable architecture and format decisions recorded in working memory and relevant discussion records.

The Astra folder is shared, user-readable collaboration memory. Working memory contains durable confirmed decisions; topic discussions explain design rationale; workflow records document concrete sessions. Do not treat an assistant-written suggestion, old work queue item, or previous next step as authorization to change scope. The user's latest explicit direction takes precedence. An audit is inspection, not permission to modify the audited code.

Before ending every work session that changes or investigates the project, Astra must create or update a focused record under Astra/WORKFLOWS/ and refresh the root ASTRA_WORKLOG.md index/current-state summary with:
- date and baseline/resulting commit SHA when known;
- what was inspected and changed;
- exact files changed;
- tests/builds actually run and their results (distinguish CI from local execution and never claim unrun tests);
- known defects, blocked work, and the next user-approved task;
- whether user-side Windows testing is required.

The root ASTRA_WORKLOG.md is an index, not a chronological transcript. Design discussion belongs in topic-based Astra/DISCUSSIONS/ files; concrete execution belongs in one dated Astra/WORKFLOWS/YYYY-MM-DD_work-direction-specific-topic.txt file. Multiple workflow files per day are normal. Follow Astra/DISCUSSIONS/日志编写规范.txt.

When a session establishes a durable collaboration decision, corrects a working assumption, or identifies a meaningful execution mistake, update the relevant topic file and WORKING_MEMORY.txt when a durable confirmed rule changes. Do not create routine dated diary filler.

Do not mark work complete merely because files were committed. A commit is not a test result. Do not silently change established architecture. If a requirement appears ambiguous, inspect the recorded decision and existing implementation before asking the user.

## Project-specific hard rules

- Mod packages use a mixed format: manifest, registry, content definitions and localization remain INI. Optional behavior may use JavaScript only through the declared API v4 scripts/ and hooks interface. API v3 INI-only packages remain supported.
- Do not introduce JSON files or inline JSON values as Mod content, registry, localization or manifest data. Root Node/Electron package.json is build-tool metadata and is not Mod data.
- Mod display text belongs in localization INI files and is referenced by stable keys from content definitions.
- Core is required and cannot be disabled.
- Mod scripts receive detached read-only snapshots and may return only registered, validated effects and events. Never expose arbitrary Node/Electron APIs, filesystem/network access, mutable world references, native modules or arbitrary host callbacks to Mods.
- The current Node vm wrapper is capability reduction, not a hardened security boundary against hostile JavaScript. Treat JS Mods as trusted/opt-in; do not describe arbitrary untrusted scripts as safe.
- Preserve the separate launcher/runtime distribution architecture documented in the work log and README.
- Never claim Windows desktop behavior has been verified unless a real Windows run was performed.
