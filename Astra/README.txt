ASTRA / COLLABORATION MEMORY
=============================

This folder stores shared working memory and a user-readable diary for the
long-running collaboration on this repository. It is documentation only.
It is not loaded by the game and must never become runtime configuration.

FILES
-----

WORKING_MEMORY.txt
  The concise, durable memory Astra must read before every project task.
  It stores confirmed project decisions, engineering principles and
  collaboration boundaries. Keep it focused; do not turn it into a task list.

DIARY/
  Dated plain-text entries about meaningful sessions, decisions, mistakes,
  corrections and lessons. The diary is for both Astra and the user to read.
  Entries should be honest, specific and calm. Do not invent events, claim
  unperformed work, or write fictional emotions as evidence.

ASTRA_WORKLOG.md (repository root)
  The formal engineering record: commits, exact files, code inspections,
  tests, builds, CI results, known defects and desktop-test status.

READING ORDER
-------------

At the beginning of every project task, read:
1. Root AGENTS.md.
2. This file.
3. WORKING_MEMORY.txt.
4. The complete root ASTRA_WORKLOG.md, as required by AGENTS.md.
5. The current repository state and latest relevant CI result.

Read older diary entries when they are relevant to the task or when the user
asks about the collaboration history. The diary grows over time; it does not
need to be reread in full every session.

SOURCE OF TRUTH
---------------

- The user's latest explicit instruction outranks older notes.
- The current repository and verified CI results are the source of truth for
  current implementation status.
- WORKING_MEMORY.txt records durable decisions, not speculative plans.
- ASTRA_WORKLOG.md records engineering evidence and historical session facts.
- Diary entries explain context and lessons; they do not silently change
  project requirements or grant permission for future changes.

A recommendation is not an approved task. A previous "next step" is not
automatic authorization. When in doubt, preserve the existing system and
report the uncertainty rather than expanding the scope.
