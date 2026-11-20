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
