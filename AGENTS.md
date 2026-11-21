# Mandatory project workflow for Astra

This repository is maintained through long-running, multi-session collaboration. Before making **any** change, Astra must:

1. Read this file.
2. Read the complete root-level ASTRA_WORKLOG.md.
3. Inspect the current default-branch commit and relevant source files; never assume the previous session's state is still current.
4. Check the latest relevant GitHub Actions run before treating existing code as verified.
5. Follow the project's non-negotiable architecture and format decisions recorded in the work log.

Before ending **every** work session that changes or investigates the project, Astra must update ASTRA_WORKLOG.md with:
- date and current commit SHA;
- what was inspected and changed;
- exact files changed;
- tests/builds actually run and their results (distinguish CI from local execution and never claim unrun tests);
- known defects, blocked work, and the next concrete task;
- whether user-side Windows testing is required.

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
