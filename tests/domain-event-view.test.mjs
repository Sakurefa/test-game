import test from "node:test";
import assert from "node:assert/strict";
import { getRecentDomainEvents, summarizeDomainEvent } from "../src/domain-event-view.mjs";

test("domain event inspector returns newest records first without mutating saved history", () => {
  const world = { domainEvents: [
    { sequence: 1, type: "market.prices-settled" },
    { sequence: 2, type: "war.chronology-advanced" },
    { sequence: 3, type: "colony.production-settled" }
  ] };
  const before = structuredClone(world);
  assert.deepEqual(getRecentDomainEvents(world, 2), [world.domainEvents[2], world.domainEvents[1]]);
  assert.deepEqual(world, before);
});

test("domain event inspector handles empty history and rejects invalid limits", () => {
  assert.deepEqual(getRecentDomainEvents({}), []);
  assert.deepEqual(getRecentDomainEvents({ domainEvents: [] }), []);
  assert.throws(() => getRecentDomainEvents({}, 0), /positive integer/);
});

test("market settlement is labeled as one expected event per market per day", () => {
  const summary = summarizeDomainEvent({ type: "market.prices-settled",
    payload: { instrumentCount: 5, changes: { ore: 1.5, water: -0.5 } } });
  assert.equal(summary.titleKey, "audit.event.market_settled");
  assert.equal(summary.cadenceKey, "audit.cadence.market_daily");
  assert.deepEqual(summary.changes, { ore: 1.5, water: -0.5 });
});

test("war chronology is labeled as one expected event per active war per day", () => {
  const summary = summarizeDomainEvent({ type: "war.chronology-advanced", payload: { daysActive: 42 } });
  assert.equal(summary.cadenceKey, "audit.cadence.war_daily");
  assert.equal(summary.facts[0].value, 42);
});

test("colony production is labeled as one expected event per colony per week", () => {
  const summary = summarizeDomainEvent({ type: "colony.production-settled",
    payload: { industryCount: 2, activeIndustryCount: 1, production: { food: 12 } } });
  assert.equal(summary.cadenceKey, "audit.cadence.colony_weekly");
  assert.equal(summary.facts[1].value, 1);
  assert.deepEqual(summary.production, { food: 12 });
});

test("unknown domain events are described as event-driven rather than daily recurring", () => {
  const summary = summarizeDomainEvent({ type: "mod.example-market.monthly-market-observation" });
  assert.equal(summary.cadenceKey, "audit.cadence.event_driven");
  assert.equal(summary.kind, "event-driven");
});

test("daily colony needs event is labeled with daily cadence and shortage counts", () => {
  const summary = summarizeDomainEvent({
    type: "colony.needs-settled",
    payload: {
      needCount: 2,
      shortageCount: 1,
      needs: [
        { commodityId: "food", requested: 1, consumed: 1, unmet: 0, satisfaction: 1 },
        { commodityId: "water", requested: 2, consumed: 1, unmet: 1, satisfaction: 0.5 }
      ]
    }
  });
  assert.equal(summary.titleKey, "audit.event.colony_needs");
  assert.equal(summary.cadenceKey, "audit.cadence.colony_needs_daily");
  assert.equal(summary.facts[1].value, 1);
  assert.equal(summary.needs[1].unmet, 1);
});

test("daily colony needs is identified as an ordinary daily settlement", () => {
  const summary = summarizeDomainEvent({
    type: "colony.needs-settled",
    payload: {
      needCount: 2,
      shortageCount: 1,
      needs: [{ commodityId: "water", requested: 2.175, consumed: 1, unmet: 1.175, satisfaction: .4598 }]
    }
  });
  assert.equal(summary.kind, "population-needs");
  assert.equal(summary.cadenceKey, "audit.cadence.colony_needs_daily");
  assert.equal(summary.needs[0].unmet, 1.175);
});
