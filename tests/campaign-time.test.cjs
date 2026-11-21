const test = require("node:test");
const assert = require("node:assert/strict");
const { CampaignTimeController } = require("../engine/campaign-time.cjs");
const { createClock, advanceClockTime } = require("../engine/clock.cjs");

test("campaign clock retains fractional game time until a day boundary", () => {
  let clock = createClock("2478-04-01");
  clock = advanceClockTime(clock, 0.25);
  assert.deepEqual(clock, { date: "2478-04-01", day: 0, dayFraction: 0.25 });
  clock = advanceClockTime(clock, 0.75);
  assert.deepEqual(clock, { date: "2478-04-02", day: 1, dayFraction: 0 });
});

test("campaign controller pauses and applies 1x to 4x speed multipliers", () => {
  let now = 0;
  let elapsedDays = 0;
  const controller = new CampaignTimeController({
    baseDayDurationMs: 1000,
    now: () => now,
    onAdvance: (days) => { elapsedDays += days; }
  });

  now = 2000;
  controller.tick();
  assert.equal(elapsedDays, 0);

  controller.setSpeed(1);
  now = 2500;
  controller.tick();
  assert.equal(elapsedDays, 0.5);

  controller.setSpeed(4);
  now = 2750;
  controller.tick();
  assert.equal(elapsedDays, 1.5);

  controller.pause();
  now = 5000;
  controller.tick();
  assert.equal(elapsedDays, 1.5);
});

test("changing base duration does not retroactively change elapsed campaign time", () => {
  let now = 0;
  let elapsedDays = 0;
  const controller = new CampaignTimeController({
    baseDayDurationMs: 1000,
    now: () => now,
    onAdvance: (days) => { elapsedDays += days; }
  });
  controller.setSpeed(1);
  now = 500;
  controller.setBaseDayDurationMs(2000);
  assert.equal(elapsedDays, 0.5);
  now = 1500;
  controller.tick();
  assert.equal(elapsedDays, 1);
});

test("campaign controller rejects invalid speeds and non-monotonic time", () => {
  let now = 10;
  const controller = new CampaignTimeController({ now: () => now });
  assert.throws(() => controller.setSpeed(5), /1x–4x/);
  controller.setSpeed(1);
  now = 5;
  assert.throws(() => controller.tick(), /monotonic/);
});

test("campaign settlement failures are distinguishable from control-input errors and can be stopped without ticking again", () => {
  let now = 0;
  const failure = new Error("settlement failed");
  const controller = new CampaignTimeController({
    baseDayDurationMs: 1000,
    now: () => now,
    onAdvance: () => { throw failure; }
  });

  controller.setSpeed(1);
  now = 1000;
  assert.throws(() => controller.tick(), (error) =>
    error.code === "CAMPAIGN_TIME_ADVANCE_FAILURE"
      && error.cause === failure
      && /settlement failed/.test(error.message)
  );

  now = 1100;
  assert.throws(() => controller.pause(), (error) =>
    error.code === "CAMPAIGN_TIME_ADVANCE_FAILURE" && error.cause === failure
  );

  controller.reset();
  assert.equal(controller.getState().speed, 0);
  assert.equal(controller.getState().paused, true);
  assert.equal(controller.lastTimestamp, 1100);
});

test("invalid base duration does not advance campaign time before rejecting", () => {
  let now = 0;
  let advances = 0;
  const controller = new CampaignTimeController({
    baseDayDurationMs: 1000,
    now: () => now,
    onAdvance: () => { advances += 1; }
  });

  controller.setSpeed(1);
  now = 500;
  assert.throws(() => controller.setBaseDayDurationMs(999), /between 1 and 3600 seconds/);
  assert.equal(advances, 0);
  assert.equal(controller.getState().baseDayDurationMs, 1000);

  now = 1000;
  controller.tick();
  assert.equal(advances, 1);
});
