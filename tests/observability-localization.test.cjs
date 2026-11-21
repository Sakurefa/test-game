const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { readModPackages } = require("../electron/mod-loader.cjs");
const { compileCatalog } = require("../engine/catalog.cjs");

test("player-readable audit and event labels are available through the Core content localization table", async () => {
  const packages = await readModPackages(path.join(__dirname, "..", "mods"));
  const compiled = compileCatalog(packages);
  assert.equal(compiled.ok, true, compiled.error);
  const strings = compiled.catalog.localizations["zh-CN"];
  const keys = [
    "audit.formula.commodity_price",
    "audit.formula.security_price",
    "audit.formula.colony_production",
    "audit.explanation.commodity_scarce",
    "audit.explanation.commodity_surplus",
    "audit.explanation.security_price",
    "audit.explanation.colony_production",
    "audit.event.market_settled",
    "audit.event.war_advanced",
    "audit.event.colony_production",
    "audit.cadence.market_daily",
    "audit.cadence.war_daily",
    "audit.cadence.colony_weekly",
    "audit.cadence.event_driven",
    "audit.raw_calculation",
    "audit.raw_event"
  ];
  for (const key of keys) assert.ok(strings[key], "Missing localization key: " + key);
});
