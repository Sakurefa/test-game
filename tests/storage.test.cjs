const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createLogger } = require("../electron/logger.cjs");
const {
  initializeStorage, readSettings, writeSettings, listSaveSlots,
  createSaveSlot, readGameState, writeGameState, removeSaveSlot
} = require("../electron/storage.cjs");

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "market-storage-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("logger writes separate JSONL records and rotates runtime logs", async (t) => {
  const root = await fixture(t);
  const logger = createLogger(root, { maxBytes: 512 });
  logger.startup("INFO", "bootstrap", "initialization");
  for (let i = 0; i < 20; i += 1) logger.info("test", "x".repeat(30));
  const files = await fs.readdir(path.join(root, "Logs"));
  assert.ok(files.includes("startup.log"));
  assert.ok(files.includes("runtime.log"));
  assert.ok(files.length <= 6);
  const startup = await fs.readFile(path.join(root, "Logs", "startup.log"), "utf8");
  assert.match(startup, /initialization/);
  assert.equal(startup.trimEnd().split("\n").length, 1);
  const runtime = await fs.readFile(path.join(root, "Logs", "runtime.log"), "utf8");
  const records = runtime.trimEnd().split("\n").map((line) => JSON.parse(line));
  assert.ok(records.length > 0);
  assert.ok(records.every((record) => record.timestamp && record.level && record.scope === "test"));
});

test("initializes root setting, save and Logs directories with default INI files", async (t) => {
  const root = await fixture(t);
  await initializeStorage(root);
  const settings = await readSettings(root);
  assert.equal(settings.general.window_mode, "windowed");
  assert.equal(settings.graphics.ui_scale, 100);
  assert.equal(settings.simulation.base_day_seconds, 60);
  assert.equal(settings.mods.enabled.core, true);
  for (const file of ["general.ini", "graphics.ini", "audio.ini", "simulation.ini", "mods.ini"]) {
    assert.ok(await fs.stat(path.join(root, "setting", file)));
  }
  for (const directory of ["save", "Logs"]) assert.ok(await fs.stat(path.join(root, directory)));
});

test("writes validated settings atomically and prevents disabling core", async (t) => {
  const root = await fixture(t);
  await initializeStorage(root);
  await writeSettings(root, { graphics: { ui_scale: 120 }, simulation: { base_day_seconds: 120 }, mods: { enabled: { core: false, example: true } } });
  const settings = await readSettings(root);
  assert.equal(settings.graphics.ui_scale, 120);
  assert.equal(settings.simulation.base_day_seconds, 120);
  assert.equal(settings.mods.enabled.core, true);
  assert.equal(settings.mods.enabled.example, true);
  await assert.rejects(() => writeSettings(root, { graphics: { ui_scale: 999 } }), /Invalid setting/);
  await assert.rejects(() => writeSettings(root, { simulation: { base_day_seconds: 5 } }), /Invalid setting/);
});

test("creates, lists and removes versioned save slots", async (t) => {
  const root = await fixture(t);
  await initializeStorage(root);
  const created = await createSaveSlot(root, "slot_001", "Test World");
  assert.equal(created.status, "ok");
  const [slot] = await listSaveSlots(root);
  assert.equal(slot.id, "slot_001");
  assert.equal(slot.metadata.name, "Test World");
  assert.equal(slot.hasWorld, false);
  await removeSaveSlot(root, "slot_001");
  assert.deepEqual(await listSaveSlots(root), []);
});

test("migrates settings without schema version and rejects future schemas", async (t) => {
  const root = await fixture(t);
  await initializeStorage(root);
  await fs.writeFile(path.join(root, "setting", "graphics.ini"), "[graphics]\nui_scale = 120\n");
  const settings = await readSettings(root);
  assert.equal(settings.graphics.ui_scale, 120);
  assert.match(await fs.readFile(path.join(root, "setting", "graphics.ini"), "utf8"), /schema_version = 1/);
  await fs.writeFile(path.join(root, "setting", "graphics.ini"), "[graphics]\nschema_version = 999\n");
  await assert.rejects(() => readSettings(root), /Unsupported graphics settings schema version/);
});

test("reports damaged save metadata instead of hiding the slot", async (t) => {
  const root = await fixture(t);
  await initializeStorage(root);
  await fs.mkdir(path.join(root, "save", "slot_broken"), { recursive: true });
  await fs.writeFile(path.join(root, "save", "slot_broken", "metadata.ini"), "not an ini");
  const [slot] = await listSaveSlots(root);
  assert.equal(slot.status, "damaged");
});


test("writes and restores a versioned game world inside its save slot", async (t) => {
  const root = await fixture(t);
  await initializeStorage(root);
  await createSaveSlot(root, "slot_world", "Frontier Test");
  const state = {
    schemaVersion: 6,
    contentHash: "test-content",
    universeId: "test-universe",
    clock: { date: "2478-04-01", day: 0 },
    rng: { seed: 42, streams: {} },
    audit: { calculations: [] },
    domainEventSequence: 0,
    domainEvents: [],
    commandReceipts: [],
    colonies: { "test-colony": { stockpiles: { ore: 10 } } },
    player: { factionId: "test-faction", accountId: "player-main" },
    finance: { currencies: { CR: { id: "CR", minorUnitDigits: 2 } }, accounts: {}, sequence: 0, transactions: [] }
  };
  await writeGameState(root, "slot_world", state);
  assert.deepEqual(await readGameState(root, "slot_world"), state);
  const [slot] = await listSaveSlots(root);
  assert.equal(slot.metadata.name, "Frontier Test");
  assert.equal(slot.hasWorld, true);
  assert.ok(slot.metadata.updated_at);
});

test("game-state storage rejects unsafe slot IDs and unsupported schemas", async (t) => {
  const root = await fixture(t);
  await initializeStorage(root);
  await assert.rejects(() => readGameState(root, "../outside"), /Invalid save slot ID/);
  await createSaveSlot(root, "slot_bad", "Bad Save");
  await assert.rejects(() => writeGameState(root, "slot_bad", { schemaVersion: 999 }), /unsupported game state/i);
});
