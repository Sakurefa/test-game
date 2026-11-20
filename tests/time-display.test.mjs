import test from "node:test";
import assert from "node:assert/strict";
import { estimateCampaignDayFraction } from "../src/time-display.mjs";

test("campaign display interpolation advances smoothly between authoritative clock samples", () => {
  const start = 0.25;
  const atFrame = estimateCampaignDayFraction({
    dayFraction: start,
    speed: 1,
    baseDayDurationMs: 60000,
    elapsedMs: 1000
  });
  assert.ok(atFrame > start);
  assert.ok(Math.abs(atFrame - (0.25 + 1 / 60)) < 1e-12);
});

test("campaign display interpolation scales with speed and never changes paused time", () => {
  const paused = estimateCampaignDayFraction({
    dayFraction: 0.4,
    speed: 0,
    baseDayDurationMs: 10000,
    elapsedMs: 5000
  });
  const fourX = estimateCampaignDayFraction({
    dayFraction: 0.4,
    speed: 4,
    baseDayDurationMs: 10000,
    elapsedMs: 1000
  });
  assert.equal(paused, 0.4);
  assert.equal(fourX, 0.8);
});

test("campaign display waits at 99.9 percent for authoritative day-boundary confirmation", () => {
  const fraction = estimateCampaignDayFraction({
    dayFraction: 0.95,
    speed: 4,
    baseDayDurationMs: 1000,
    elapsedMs: 500
  });
  assert.equal(fraction, 0.999);
});

test("campaign display rejects invalid timing inputs", () => {
  assert.throws(() => estimateCampaignDayFraction({
    dayFraction: 1,
    speed: 1,
    baseDayDurationMs: 60000,
    elapsedMs: 0
  }), /fraction/);
});
