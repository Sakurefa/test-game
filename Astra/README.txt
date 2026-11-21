ASTRA / COLLABORATION MEMORY
=============================

This folder stores shared, user-readable design records and work history.
These files are documentation only; they are not loaded by the game.

DIRECTORY STRUCTURE
-------------------
IMPORTANT_PRINCIPLES/ — mandatory high-priority engineering principles:
  【最高优先级重要原则】AK 原则.txt
  【最高优先级重要原则】MOD 化原则.txt
WORKING_MEMORY.txt — concise durable decisions and continuity notes.
DISCUSSIONS/ — topic-based design records; a topic keeps its file across dates.
WORKFLOWS/ — dated, sequenced records of concrete work sessions:
  YYYY-MM-DD_NN_work-direction-specific-topic.txt
Root ASTRA_WORKLOG.md — short index/current-state summary, never a transcript.

MANDATORY READING ORDER
-----------------------
1. Root AGENTS.md.
2. This file.
3. WORKING_MEMORY.txt.
4. Root ASTRA_WORKLOG.md.
5. Both files under IMPORTANT_PRINCIPLES/ before design or implementation.
6. Only discussion topics relevant to the current task.
7. Only workflow records relevant to the task or bug history.
8. Current repository state and latest relevant CI result.

Do not read the entire WORKFLOWS archive by default. For old bugs, search
topic titles and dated sequence-numbered workflow filenames first, then open
matching records.

SOURCE OF TRUTH
---------------
- The user's latest explicit instruction outranks older notes.
- The current repository and verified CI results define current implementation.
- IMPORTANT_PRINCIPLES contains mandatory high-priority engineering constraints.
- WORKING_MEMORY records durable decisions.
- DISCUSSIONS records design rationale, current topic decisions and open questions.
- WORKFLOWS records what actually happened in a specific session.
- ASTRA_WORKLOG points to current state and relevant records.
- A recommendation is not an approved task.

Follow DISCUSSIONS/日志编写规范.txt. Discussion by topic; workflow by date
and one shared chronological sequence per day. Keep status current and never
claim unperformed work.
