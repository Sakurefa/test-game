# Playtest Guide — Frontier continuous-time foundation

This guide checks the continuous campaign clock and the daily/weekly scheduler. It is an inspection route, not a claim that later systems such as logistics, finance or combat are finished.

## 1. Update the portable folder

1. Open the repository: https://github.com/Sakurefa/test-game
2. Choose **Code → Download ZIP** and extract the archive.
3. Put your separately distributed `Market Simulator.exe` beside the extracted repository files.
4. Double-click the EXE. The launcher remains separate from the game source; the latest engine, Mods and renderer are loaded from the extracted folder.

Do not copy an old `dist/`, `engine/` or `mods/` folder over the new download. Use the folder from the same ZIP so the renderer and simulation content match.

## 2. Start a new world

Choose **开始新航程**. The prototype creates a save slot and enters the **赫利俄斯边境** scenario. The campaign clock starts paused.

Expected starting situation:

- Date: `2478-04-01`
- 4 star systems: 澄光、烬环、曙星、帷幕
- 3 factions: 赫利俄斯协约、烬环财团、自由港同盟
- 3 colonies: 新曙光、翡翠、灰烬之落
- 6 commodity types, 6 production recipes and 3 local markets
- 2 fleets and 1 active border conflict

## 3. Inspect the world

Use the four tabs at the top of the world screen:

- **星域总览** — inspect the four-system network, connections, trade-route parameters and recent event history.
- **殖民地与生产** — inspect population, stability, resource inventories and each colony's production facilities.
- **市场与金融** — inspect local commodity quotes and the three company securities.
- **势力与战争** — inspect faction descriptions, fleet composition, readiness and the active conflict.

The player starts in 自由港同盟 with an initial account balance displayed in CR.

## 4. Test the continuous clock

1. Confirm the world initially shows **时间已暂停** and its calendar day does not change.
2. Select **1x**. The weekly progress bar should move smoothly without clicking anything. It is divided into seven daily segments; each segment fills over one game day. At the default setting, one in-game day takes 60 real seconds.
3. Select **2x**, **3x** and **4x**. At the default base rate, one in-game day takes approximately 30, 20 and 15 real seconds respectively.
4. Select the pause control. The day-progress percentage should stop increasing and the calendar should stop advancing.
5. Open **设置 → 基础时间流速**. Change the number of real seconds assigned to one game day, save, and confirm the selected speed remains independent of that base duration.
6. Start a fresh test world or continue the current one until it crosses a day boundary. The calendar and only the active view region due for that day should update. On the overview, scroll down to 最近动态 before a new day arrives: the log should gain the new daily report without sending the content view back to the top. The weekly progress bar should cross one segment per day.
7. Continue until elapsed day 7. The weekly bar should finish its seventh segment and reset into the next week only after the day boundary is confirmed. Open **殖民地与生产**: industrial inventories should reflect one weekly production cycle. Production should run again on elapsed day 14, 21 and so on.

The initial scheduler is intentionally simple:
- Market commodity/security quotes and active-war chronology: daily.
- Colony industrial production: every seventh elapsed day.
- At a shared weekly boundary, production runs before that day's market repricing.

## 5. Test persistence and migration

1. Let time run briefly, then pause it.
2. Click **保存世界** and wait for confirmation.
3. Click **返回主菜单**, then choose **读取存档**.
4. Load the world slot you just created.
5. Confirm the calendar date, fractional day progress, inventories, prices, random state and scheduler markers are restored. The world should load paused.
6. Resume time and confirm daily/weekly updates continue without duplicating the last completed day.

Version-1 world saves are migrated by preserving their date and elapsed day count, adding zero fractional progress and creating the new scheduler state. A save made with different Mod content is still rejected explicitly.

World data is stored at:

`save/<slot-id>/data/world.json`

The slot's display metadata is stored separately in `save/<slot-id>/metadata.ini`.

## 6. What is not implemented yet

These are deliberate future systems, not hidden features:

- No actual inter-colony cargo transport or trade-route traffic yet. Route travel days, risk and capacity are currently data definitions.
- No player buy/sell orders, share ownership changes, loans, dividends or full financial ledger yet. Company securities currently have simulated quotes only.
- No population growth, consumer demand, taxes, facility construction or colony expansion yet.
- No fleet movement, player fleet commands, fronts, casualties, tactical battle instances or real-time RTS combat yet. Tactical combat is explicitly deferred from the current foundation phase.
- No full typed domain-event/command framework, shared asset manager, 2D scene renderer or audio playback service yet. The current architecture work is establishing their boundaries first.
- Calculation audit display, named random streams, contextual help, font selection and actual dynamic 2D scenes are later foundation steps.

## 7. If something goes wrong

- Check `Logs/startup.log` first, then the newest `Logs/runtime.log`.
- Keep the full Logs folder. Do not replace or delete `startup.log`; it records early initialization.
- Note which speed control or tab you used, which save slot was open, and the exact error text.
- Do not edit the active save JSON while the game is running.

This prototype is designed to be inspected and broken safely. A damaged save should be reported rather than silently overwritten.


### Incremental view refresh expectations

- Overview date changes update the recent-event region, not the entire world screen.
- Market and military tabs update only their daily changing sections.
- Colony stockpiles and production details update only after a weekly production cycle.
- The central content scroll position should remain stable during all of these updates.
