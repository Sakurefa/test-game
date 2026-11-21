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
    effects: [{ effectType: "test.value.set", result: { after: 9 } }],
    domainEvents: []
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
  assert.deepEqual(result, { result: { status: "checked" }, effects: [], domainEvents: [] });
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


test("Settlement returns separately validated Domain Event plans without writing history itself", () => {
  const world = { domainEventSequence: 0, domainEvents: [] };
  const resolutions = createResolutionRegistry([{
    id: "test.emit-event",
    resolve: () => ({
      result: { accepted: true },
      effects: [],
      domainEvents: [{
        type: "mod.test-mod.changed",
        scope: "mod",
        subjectId: "test-mod",
        payload: { value: 5 }
      }]
    })
  }]);
  const result = settleSystemEvent({
    id: "system-event:test-event",
    type: "test.emit-event",
    sourceId: "test-mod",
    triggerId: "test-mod.emit-event",
    day: 4,
    date: "2480-03-02",
    payload: {}
  }, {
    world,
    day: 4,
    resolutions,
    applyEffect: () => { throw new Error("No Effects expected"); }
  });
  assert.deepEqual(result, {
    result: { accepted: true },
    effects: [],
    domainEvents: [{
      type: "mod.test-mod.changed",
      scope: "mod",
      subjectId: "test-mod",
      payload: { value: 5 }
    }]
  });
  assert.deepEqual(world, { domainEventSequence: 0, domainEvents: [] });
});

test("Resolution rejects malformed or excessive Domain Event plans", () => {
  const malformed = createResolutionRegistry([{
    id: "test.bad-event",
    resolve: () => ({
      result: {},
      effects: [],
      domainEvents: [{ type: "MOD.Invalid", scope: "world", payload: {} }]
    })
  }]);
  assert.throws(() => malformed.resolve({
    id: "system-event:bad-event",
    type: "test.bad-event",
    payload: {}
  }), /invalid Domain Event descriptor/);

  const tooMany = createResolutionRegistry([{
    id: "test.too-many-events",
    resolve: () => ({
      result: {},
      effects: [],
      domainEvents: Array.from({ length: 17 }, (_, index) => ({
        type: "mod.test.event-" + index,
        scope: "mod",
        subjectId: "test-mod",
        payload: {}
      }))
    })
  }]);
  assert.throws(() => tooMany.resolve({
    id: "system-event:too-many-events",
    type: "test.too-many-events",
    payload: {}
  }), /cannot return more than 16 Domain Events/);
});
