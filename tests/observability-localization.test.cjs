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
    "audit.formula.population_needs",
    "audit.explanation.commodity_scarce",
    "audit.explanation.commodity_surplus",
    "audit.explanation.security_price",
    "audit.explanation.colony_production",
    "audit.explanation.population_needs_met",
    "audit.explanation.population_needs_shortage",
    "audit.event.market_settled",
    "audit.event.war_advanced",
    "audit.event.colony_production",
    "audit.event.colony_needs",
    "audit.cadence.market_daily",
    "audit.cadence.war_daily",
    "audit.cadence.colony_weekly",
    "audit.cadence.colony_needs_daily",
    "audit.cadence.event_driven",
    "audit.raw_calculation",
    "audit.raw_event",
    "audit.formula.population_needs",
    "audit.explanation.population_needs_met",
    "audit.explanation.population_needs_shortage",
    "audit.event.colony_needs",
    "audit.explanation.colony_needs_event",
    "audit.explanation.colony_needs_shortage_event",
    "audit.cadence.colony_needs_daily",
    "audit.status.needs_met",
    "audit.status.needs_shortage",
    "audit.field.population",
    "audit.field.need_count",
    "audit.field.shortage_count",
    "audit.status.needs_met",
    "audit.status.needs_shortage",
    "audit.field.population",
    "audit.field.need_count",
    "audit.field.shortage_count"
  ];
  for (const key of keys) assert.ok(strings[key], "Missing localization key: " + key);
});
