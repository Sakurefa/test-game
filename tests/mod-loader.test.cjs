const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  MAX_MANIFEST_BYTES,
  MAX_MOD_JSON_BYTES,
  readModPackages,
  loadCoreContent
} = require("../electron/mod-loader.cjs");
const { parseIni } = require("../electron/ini-parser.cjs");

async function createFixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "market-simulator-mods-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

async function writeMod(root, folder, manifest, dataFiles = {}) {
  const directory = path.join(root, folder);
  const dataDirectory = path.join(directory, "data");
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest));
  for (const [name, content] of Object.entries(dataFiles)) {
    await fs.writeFile(path.join(dataDirectory, name), content);
  }
  return directory;
}

function validManifest(id = "example-mod") {
  return {
    id,
    name: "Example Mod",
    version: "1.0.0",
    author: "Test Suite",
    description: "Fixture",
    apiVersion: 2,
    iniFiles: [],
    dataFiles: ["sample.json"]
  };
}

test("loads a valid data-only Mod and parses its JSON", async (t) => {
  const root = await createFixture(t);
  await writeMod(root, "example-mod", validManifest(), {
    "sample.json": JSON.stringify({ events: [{ id: "market-open" }] })
  });

  const mods = await readModPackages(root);
  assert.equal(mods.length, 1);
  assert.equal(mods[0].id, "example-mod");
  assert.deepEqual(mods[0].data["sample.json"], { events: [{ id: "market-open" }] });
  assert.equal(mods[0].error, undefined);
});

test("reports a malformed Mod without hiding a valid Mod", async (t) => {
  const root = await createFixture(t);
  await writeMod(root, "valid-mod", validManifest("valid-mod"), { "sample.json": "{}" });
  const broken = await writeMod(root, "broken-mod", validManifest("broken-mod"), { "sample.json": "{" });

  const mods = await readModPackages(root);
  assert.equal(mods.length, 2);
  assert.ok(mods.find((mod) => mod.id === "valid-mod").data);
  assert.match(mods.find((mod) => mod.id === "broken-mod").error, /JSON|property|position/i);
  assert.ok(await fs.stat(broken));
});

test("rejects unsupported API versions", async (t) => {
  const root = await createFixture(t);
  const manifest = { ...validManifest(), apiVersion: 999 };
  await writeMod(root, "example-mod", manifest, { "sample.json": "{}" });
  const [mod] = await readModPackages(root);
  assert.match(mod.error, /unsupported Mod API version/i);
});

test("rejects parent traversal and non-JSON data filenames", async (t) => {
  const root = await createFixture(t);
  const manifest = { ...validManifest(), dataFiles: ["../outside.json"] };
  await writeMod(root, "example-mod", manifest);
  const [mod] = await readModPackages(root);
  assert.match(mod.error, /Invalid manifest/i);
});

test("rejects manifests larger than 64 KiB", async (t) => {
  const root = await createFixture(t);
  const directory = await writeMod(root, "example-mod", validManifest());
  await fs.writeFile(path.join(directory, "manifest.json"), " ".repeat(MAX_MANIFEST_BYTES + 1));
  const [mod] = await readModPackages(root);
  assert.match(mod.error, /too large/i);
});

test("rejects JSON data files larger than 2 MiB", async (t) => {
  const root = await createFixture(t);
  await writeMod(root, "example-mod", validManifest(), {
    "sample.json": " ".repeat(MAX_MOD_JSON_BYTES + 1)
  });
  const [mod] = await readModPackages(root);
  assert.match(mod.error, /too large/i);
});

test("ignores folders whose names are not valid Mod IDs", async (t) => {
  const root = await createFixture(t);
  await writeMod(root, "Invalid Mod Name", validManifest("Invalid Mod Name"), {
    "sample.json": "{}"
  });
  const mods = await readModPackages(root);
  assert.deepEqual(mods, []);
});

test("rejects symbolic links for Mod data files when the platform permits creating them", async (t) => {
  const root = await createFixture(t);
  const directory = await writeMod(root, "example-mod", validManifest());
  const outside = path.join(root, "outside.json");
  await fs.writeFile(outside, "{}");
  try {
    await fs.symlink(outside, path.join(directory, "data", "sample.json"), "file");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
      t.skip("Symbolic links are not available in this environment");
      return;
    }
    throw error;
  }

  const [mod] = await readModPackages(root);
  assert.match(mod.error, /linked/i);
});


test("parses INI sections, typed values, quoted strings and inline JSON", () => {
  const parsed = parseIni('; comment\n[market]\nname = "New Market"\nopen = true\nprice = 12.5\nnotes = text with spaces\nitems = ["A", "B"]\n');
  assert.deepEqual(parsed, {
    market: { name: "New Market", open: true, price: 12.5, notes: "text with spaces", items: ["A", "B"] }
  });
});

test("rejects duplicate INI keys and unsafe object keys", () => {
  assert.throws(() => parseIni("[x]\na=1\na=2"), /Duplicate INI key/);
  assert.throws(() => parseIni("[__proto__]\na=1"), /Invalid INI section/);
  assert.throws(() => parseIni("[x]\nconstructor=1"), /Invalid INI key/);
});

test("loads declared INI files as parsed Mod data", async (t) => {
  const root = await createFixture(t);
  const manifest = { ...validManifest(), iniFiles: ["world.ini"], dataFiles: [] };
  await writeMod(root, "example-mod", manifest);
  await fs.writeFile(path.join(root, "example-mod", "data", "world.ini"), "[world]\nname = Test World\nseed = 42\n");
  const [mod] = await readModPackages(root);
  assert.equal(mod.error, undefined);
  assert.deepEqual(mod.data["world.ini"], { world: { name: "Test World", seed: 42 } });
});

test("requires and loads the first-party core content package", async (t) => {
  const root = await createFixture(t);
  await writeMod(root, "core", {
    id: "core", name: "Core", version: "1.0.0", author: "Test",
    apiVersion: 2, iniFiles: ["core.ini"]
  });
  await fs.writeFile(path.join(root, "core", "data", "core.ini"), "[core]\nenabled = true\n");
  const result = await loadCoreContent(root);
  assert.equal(result.ok, true);
  assert.deepEqual(result.core.data["core.ini"], { core: { enabled: true } });
});

test("reports a missing core package explicitly", async (t) => {
  const root = await createFixture(t);
  const result = await loadCoreContent(root);
  assert.equal(result.ok, false);
  assert.match(result.error, /mods\\/core/);
});
