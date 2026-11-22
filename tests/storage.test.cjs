const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createLogger } = require("../electron/logger.cjs");
const {
  initializeStorage, readSettings, writeSettings, listSaveSlots,
  createSaveSlot, readGameState, readGameStateWithReceipt, writeGameState, removeSaveSlot
} = require("../electron/storage.cjs");

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "market-storage-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("logger writes separate JSONL records and rotates runtime logs", async (t) => {
  const root = await fixture(t);
  const logger = createLogger(root, { maxBytes: 4096 });
  logger.startup("INFO", "bootstrap", "initialization");
  for (let i = 0; i < 100; i += 1) logger.info("test", "x".repeat(30));
  const rootCause = new Error("root diagnostic cause");
  logger.error("failure-test", { error: new Error("sample diagnostic failure", { cause: rootCause }) });
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
  assert.ok(records.every((record) => record.timestamp && record.level));
  const failure = records.find((record) => record.scope === "failure-test");
  assert.match(failure.message.error.stack, /sample diagnostic failure/);
  assert.match(failure.message.error.cause.stack, /root diagnostic cause/);
});

test("initializes root setting, save and Logs directories with default INI files", async (t) => {
  const root = await fixture(t);
  await initializeStorage(root);
  const settings = await readSettings(root);
  assert.equal(settings.general.window_mode, "windowed");
  assert.equal(settings.graphics.ui_scale, 100);
  assert.equal(settings.simulation.base_day_seconds, 60);
  assert.equal(settings.mods.enabled.core, true);
  assert.equal(settings.mods.enabled["trigger-test"], false);
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

test("validates every group in a settings patch before writing any group", async (t) => {
  const root = await fixture(t);
  await initializeStorage(root);
  const graphicsPath = path.join(root, "setting", "graphics.ini");
  const audioPath = path.join(root, "setting", "audio.ini");
  const graphicsBefore = await fs.readFile(graphicsPath, "utf8");
  const audioBefore = await fs.readFile(audioPath, "utf8");

  await assert.rejects(
    () => writeSettings(root, {
      graphics: { ui_scale: 120 },
      audio: { master_volume: 101 }
    }),
    /Invalid setting audio\.master_volume/
  );

  assert.equal(await fs.readFile(graphicsPath, "utf8"), graphicsBefore);
  assert.equal(await fs.readFile(audioPath, "utf8"), audioBefore);
  const settings = await readSettings(root);
  assert.equal(settings.graphics.ui_scale, 100);
  assert.equal(settings.audio.master_volume, 100);
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
    schemaVersion: 9,
    triggerQueue: { pending: [], receipts: [] },
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
  const writtenReceipt = await writeGameState(root, "slot_world", state);
  const restored = await readGameStateWithReceipt(root, "slot_world");
  assert.deepEqual(restored.state, state);
  assert.equal(writtenReceipt.status, "written");
  const repeatedReceipt = await writeGameState(root, "slot_world", state);
  assert.equal(repeatedReceipt.fingerprint, writtenReceipt.fingerprint);
  assert.equal(repeatedReceipt.bytes, writtenReceipt.bytes);
  assert.equal(restored.receipt.status, "verified");
  assert.equal(restored.receipt.fingerprint, writtenReceipt.fingerprint);
  assert.equal(restored.receipt.bytes, writtenReceipt.bytes);
  const [slot] = await listSaveSlots(root);
  assert.equal(slot.metadata.name, "Frontier Test");
  assert.equal(slot.hasWorld, true);
  assert.equal(slot.receipt.status, "stored");
  assert.equal(slot.receipt.fingerprint, writtenReceipt.fingerprint);
  assert.ok(slot.metadata.updated_at);
});


test("writeGameState rejects legacy schema until Engine migration upgrades it", async (t) => {
  const root = await fixture(t);
  await initializeStorage(root);
  await createSaveSlot(root, "slot_old_schema", "Old Schema");
  await assert.rejects(
    () => writeGameState(root, "slot_old_schema", { schemaVersion: 8, clock: { day: 1, date: "2478-04-02" } }),
    /Invalid or unsupported game state/
  );
});

test("save receipt rejects world file changes before returning a world state", async (t) => {
  const root = await fixture(t);
  await initializeStorage(root);
  await createSaveSlot(root, "slot_receipt_tamper", "Receipt Test");
  const state = {
    schemaVersion: 9,
    contentHash: "receipt-content",
    universeId: "receipt-universe",
    clock: { date: "2478-04-04", day: 3 },
    metadata: { marker: "receipt-test-marker" }
  };
  const receipt = await writeGameState(root, "slot_receipt_tamper", state);
  assert.equal(receipt.fingerprint.length, 64);

  const worldPath = path.join(root, "save", "slot_receipt_tamper", "data", "world.json");
  const serialized = await fs.readFile(worldPath, "utf8");
  await fs.writeFile(worldPath, serialized.replace("receipt-test-marker", "receipt-test-tamper"));

  await assert.rejects(
    () => readGameStateWithReceipt(root, "slot_receipt_tamper"),
    /Save receipt mismatch: world file SHA-256 fingerprint changed/
  );
});

test("legacy saves without a receipt remain loadable and gain one on the next save", async (t) => {
  const root = await fixture(t);
  await initializeStorage(root);
  await createSaveSlot(root, "slot_legacy_receipt", "Legacy Receipt Test");
  const state = {
    schemaVersion: 9,
    contentHash: "legacy-content",
    universeId: "legacy-universe",
    clock: { date: "2478-04-02", day: 1 },
    marker: "legacy-world"
  };
  const worldPath = path.join(root, "save", "slot_legacy_receipt", "data", "world.json");
  await fs.writeFile(worldPath, JSON.stringify(state, null, 2));

  const legacy = await readGameStateWithReceipt(root, "slot_legacy_receipt");
  assert.deepEqual(legacy.state, state);
  assert.equal(legacy.receipt.status, "legacy-unverified");
  assert.equal((await readGameState(root, "slot_legacy_receipt")).marker, "legacy-world");

  // Engine migration upgrades schema 8 before the next authoritative save.
  const migratedState = {
    ...legacy.state,
    schemaVersion: 9,
    triggerQueue: { pending: [], receipts: [] }
  };
  await writeGameState(root, "slot_legacy_receipt", migratedState);
  const upgraded = await readGameStateWithReceipt(root, "slot_legacy_receipt");
  assert.equal(upgraded.receipt.status, "verified");
  assert.equal(upgraded.receipt.fingerprint.length, 64);
});

test("partial or malformed receipt metadata marks a save damaged", async (t) => {
  const root = await fixture(t);
  await initializeStorage(root);
  await createSaveSlot(root, "slot_bad_receipt", "Bad Receipt");
  const state = {
    schemaVersion: 9,
    contentHash: "receipt-content",
    clock: { date: "2478-04-01", day: 0 }
  };
  await writeGameState(root, "slot_bad_receipt", state);
  const metadataPath = path.join(root, "save", "slot_bad_receipt", "metadata.ini");
  let metadata = await fs.readFile(metadataPath, "utf8");
  metadata = metadata.split(/\r?\n/).filter((line) => !line.startsWith("world_receipt_fingerprint = ")).join("\n");
  await fs.writeFile(metadataPath, metadata);

  const [slot] = await listSaveSlots(root);
  assert.equal(slot.status, "damaged");
  assert.match(slot.error, /Save receipt metadata is incomplete/);
  await assert.rejects(() => readGameState(root, "slot_bad_receipt"), /Save receipt metadata is incomplete/);
});

test("game-state storage rejects unsafe slot IDs and unsupported schemas", async (t) => {
  const root = await fixture(t);
  await initializeStorage(root);
  await assert.rejects(() => readGameState(root, "../outside"), /Invalid save slot ID/);
  await createSaveSlot(root, "slot_bad", "Bad Save");
  await assert.rejects(() => writeGameState(root, "slot_bad", { schemaVersion: 999 }), /unsupported game state/i);
});
