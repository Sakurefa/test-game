# Mandatory project workflow for Astra

This repository is maintained through long-running, multi-session collaboration. Before making **any** change, Astra must:

1. Read this file.
2. Read the complete root-level `ASTRA_WORKLOG.md`.
3. Inspect the current default-branch commit and relevant source files; never assume the previous session's state is still current.
4. Check the latest relevant GitHub Actions run before treating existing code as verified.
5. Follow the project's non-negotiable architecture and format decisions recorded in the work log.

Before ending **every** work session that changes or investigates the project, Astra must update `ASTRA_WORKLOG.md` with:
- date and current commit SHA;
- what was inspected and changed;
- exact files changed;
- tests/builds actually run and their results (distinguish CI from local execution and never claim unrun tests);
- known defects, blocked work, and the next concrete task;
- whether user-side Windows testing is required.

Do not mark work complete merely because files were committed. A commit is not a test result. Do not silently change established architecture. If a requirement appears ambiguous, inspect the recorded decision and existing implementation before asking the user.

## Project-specific hard rules

- Mod package data is INI-only. Do not introduce JSON content, registry, localization, or Mod manifest files. The root Node/Electron `package.json` is build tooling metadata and is not Mod data.
- Mod display text belongs in localization INI files and is referenced by stable keys from content definitions.
- Core is required and cannot be disabled.
- Mods are data-only; no executable scripts or code hooks.
- Preserve the separate launcher/runtime distribution architecture documented in the work log and README.
- Never claim Windows desktop behavior has been verified unless a real Windows run was performed.
