ASTRA / COLLABORATION MEMORY
=============================

This folder stores shared, user-readable design records and work history.
These files are documentation only; they are not loaded by the game.

DIRECTORY STRUCTURE
-------------------
WORKING_MEMORY.txt — concise durable rules and confirmed decisions.
DISCUSSIONS/ — topic-based design records; a topic keeps its file across dates.
WORKFLOWS/ — dated records of concrete work sessions:
  YYYY-MM-DD_work-direction-specific-topic.txt
  Multiple records on the same date are expected.
Root ASTRA_WORKLOG.md — short index/current-state summary, never a transcript.

READING ORDER
-------------
1. Root AGENTS.md.
2. This file.
3. WORKING_MEMORY.txt.
4. Root ASTRA_WORKLOG.md.
5. Only discussion topics relevant to the current task.
6. Only workflow records relevant to the task or bug history.
7. Current repository state and latest relevant CI result.

Do not read the entire WORKFLOWS archive by default. For old bugs, search
topic titles and workflow filenames first, then open matching records.

SOURCE OF TRUTH
---------------
- The user's latest explicit instruction outranks older notes.
- The current repository and verified CI results define current implementation.
- WORKING_MEMORY records durable decisions.
- DISCUSSIONS records design rationale, current topic decisions and open questions.
- WORKFLOWS records what actually happened in a specific session.
- ASTRA_WORKLOG points to current state and relevant records.
- A recommendation is not an approved task.

Follow DISCUSSIONS/日志编写规范.txt. Discussion by topic; workflow by date
and concrete work content. Keep status current and never claim unperformed work.
