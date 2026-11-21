"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createResolutionRegistry, settleSystemEvent } = require("../engine/index.cjs");

test("Settlement resolves against a detached world snapshot and applies Effects separately", () => {
  const world = { value: 1 };
  const catalog = { modIds: ["test-mod"] };
  const resolutions = createResolutionRegistry([{
    id: "test.plan",
    resolve: ({ event, world: snapshot }) => {
      assert.equal(snapshot.value, 1);
      snapshot.value = 100;
      return {
        result: { calculated: event.payload.value + 1 },
        effects: [{ type: "test.value.set", payload: { value: event.payload.value + 1 } }]
      };
    }
  }]);
  const event = {
    id: "system-event:test-mod.plan",
    type: "test.plan",
    sourceId: "test-mod",
    triggerId: "test-mod.plan",
    day: 11,
    date: "2480-02-29",
    payload: { value: 8 }
  };

  const settlement = settleSystemEvent(event, {
    world,
    catalog,
    day: 11,
    resolutions,
    applyEffect: ({ effect, world: candidate }) => {
      assert.equal(candidate, world);
      assert.equal(candidate.value, 1);
      candidate.value = effect.payload.value;
      return { after: candidate.value };
    }
  });

  assert.equal(world.value, 9);
  assert.deepEqual(settlement, {
    result: { calculated: 9 },
    effects: [{ effectType: "test.value.set", result: { after: 9 } }]
  });
});

test("Settlement accepts a no-Effect resolution and does not call the Effect executor", () => {
  const world = {};
  let effectCalls = 0;
  const resolutions = createResolutionRegistry([{
    id: "test.noop",
    resolve: () => ({ result: { status: "checked" }, effects: [] })
  }]);
  const result = settleSystemEvent({
    id: "system-event:test-noop",
    type: "test.noop",
    sourceId: "test-mod",
    triggerId: "test-mod.noop",
    day: 1,
    date: "2480-02-29",
    payload: {}
  }, {
    world,
    day: 1,
    resolutions,
    applyEffect: () => { effectCalls += 1; }
  });
  assert.deepEqual(result, { result: { status: "checked" }, effects: [] });
  assert.equal(effectCalls, 0);
  assert.deepEqual(world, {});
});

test("Settlement rejects missing or asynchronous Effect executors", () => {
  const resolutions = createResolutionRegistry([{
    id: "test.effect",
    resolve: () => ({ result: {}, effects: [{ type: "test.effect", payload: {} }] })
  }]);
  const event = { id: "system-event:test-effect", type: "test.effect", payload: {} };
  const world = {};

  assert.throws(() => settleSystemEvent(event, {
    world, day: 1, resolutions
  }), /Effect executor/);
  assert.throws(() => settleSystemEvent(event, {
    world, day: 1, resolutions,
    applyEffect: async () => ({})
  }), /must be synchronous/);
  assert.deepEqual(world, {});
});

