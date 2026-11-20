import test from "node:test";
import assert from "node:assert/strict";
import { getRecentDomainEvents } from "../src/domain-event-view.mjs";

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
