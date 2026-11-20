const path = require("node:path");

const AUTO_SAVE_KINDS = Object.freeze({
  daily: { label: "每日自动存档", slots: ["slot_auto_daily_1", "slot_auto_daily_2"] },
  weekly: { label: "每周自动存档", slots: ["slot_auto_weekly_1", "slot_auto_weekly_2"] }
});

function createAutomaticSaveManager({ root, listSaveSlots, createSaveSlot, readGameState, writeGameState }) {
  let queue = Promise.resolve();

  async function saveNow(kind, world) {
    const definition = AUTO_SAVE_KINDS[kind];
    if (!definition) throw new Error("Unknown automatic save kind: " + kind);
    const slots = await listSaveSlots(root);
    const byId = new Map(slots.map((slot) => [slot.id, slot]));
    const [latestId, previousId] = definition.slots;
    const latest = byId.get(latestId);
    if (latest?.hasWorld) {
      const previousWorld = await readGameState(root, latestId);
      if (!byId.has(previousId)) await createSaveSlot(root, previousId, definition.label + "（上一份）");
      await writeGameState(root, previousId, previousWorld);
    } else if (!byId.has(previousId)) {
      await createSaveSlot(root, previousId, definition.label + "（上一份）");
    }
    if (!byId.has(latestId)) await createSaveSlot(root, latestId, definition.label + "（最新）");
    await writeGameState(root, latestId, world);
    return { kind, saveId: latestId, previousSaveId: previousId, day: world.clock.day, date: world.clock.date };
  }

  function save(kind, world) {
    const snapshot = structuredClone(world);
    const task = queue.then(() => saveNow(kind, snapshot), () => saveNow(kind, snapshot));
    queue = task.catch(() => {});
    return task;
  }

  return { save, flush: () => queue };
}

module.exports = { AUTO_SAVE_KINDS, createAutomaticSaveManager };
