const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { initializeStorage, listSaveSlots, createSaveSlot, readGameState, readGameStateWithReceipt, writeGameState } = require("../electron/storage.cjs");
const { createAutomaticSaveManager } = require("../electron/autosave.cjs");

test("daily and weekly autosaves rotate independently across two slots", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "frontier-autosave-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await initializeStorage(root);
  const manager = createAutomaticSaveManager({ root, listSaveSlots, createSaveSlot, readGameState, writeGameState });
  const world = (day) => ({ schemaVersion: 9, triggerQueue: { pending: [], receipts: [] }, clock: { day, date: `2478-04-${String(day + 1).padStart(2, "0")}` }, marker: day });

  await manager.save("daily", world(1));
  await manager.save("daily", world(2));
  await manager.save("weekly", world(7));
  await manager.save("weekly", world(14));

  assert.equal((await readGameState(root, "slot_auto_daily_1")).marker, 2);
  assert.equal((await readGameState(root, "slot_auto_daily_2")).marker, 1);
  assert.equal((await readGameState(root, "slot_auto_weekly_1")).marker, 14);
  assert.equal((await readGameState(root, "slot_auto_weekly_2")).marker, 7);
  assert.equal((await readGameStateWithReceipt(root, "slot_auto_daily_1")).receipt.status, "verified");
  assert.equal((await readGameStateWithReceipt(root, "slot_auto_weekly_1")).receipt.status, "verified");
  const slots = await listSaveSlots(root);
  assert.equal(slots.filter((slot) => slot.id.startsWith("slot_auto_daily_")).length, 2);
  assert.equal(slots.filter((slot) => slot.id.startsWith("slot_auto_weekly_")).length, 2);
});
