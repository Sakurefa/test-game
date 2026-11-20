import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateCampaignDayFraction,
  estimateCampaignWeekFraction,
  getCampaignWeekFraction
} from "../src/time-display.mjs";

test("campaign display interpolation advances smoothly between authoritative clock samples", () => {
  const start = 0.25;
  const atFrame = estimateCampaignDayFraction({ dayFraction: start, speed: 1, baseDayDurationMs: 60000, elapsedMs: 1000 });
  assert.ok(atFrame > start);
  assert.ok(Math.abs(atFrame - (0.25 + 1 / 60)) < 1e-12);
});

test("campaign display interpolation scales with speed and never changes paused time", () => {
  const paused = estimateCampaignDayFraction({ dayFraction: 0.4, speed: 0, baseDayDurationMs: 10000, elapsedMs: 5000 });
  const fourX = estimateCampaignDayFraction({ dayFraction: 0.4, speed: 4, baseDayDurationMs: 10000, elapsedMs: 1000 });
  assert.equal(paused, 0.4);
  assert.equal(fourX, 0.8);
});

test("weekly progress spans seven daily segments and resets at the confirmed week boundary", () => {
  assert.equal(getCampaignWeekFraction(0, 0), 0);
  assert.equal(getCampaignWeekFraction(3, 0.5), 0.5);
  assert.equal(getCampaignWeekFraction(6, 0), 6 / 7);
  assert.equal(getCampaignWeekFraction(7, 0), 0);
  assert.equal(getCampaignWeekFraction(14, 0), 0);
});

test("weekly interpolation moves continuously within the current daily segment", () => {
  const fraction = estimateCampaignWeekFraction({ day: 2, dayFraction: 0.25, speed: 2, baseDayDurationMs: 10000, elapsedMs: 1250 });
  assert.ok(Math.abs(fraction - (2.5 / 7)) < 1e-12);
});

test("weekly progress does not visually reach the next week before authoritative confirmation", () => {
  const fraction = estimateCampaignWeekFraction({ day: 6, dayFraction: 0.95, speed: 4, baseDayDurationMs: 1000, elapsedMs: 500 });
  assert.equal(fraction, 0.999);
  assert.equal((fraction * 100).toFixed(1), "99.9");
});

test("campaign display rejects invalid timing inputs", () => {
  assert.throws(() => estimateCampaignDayFraction({ dayFraction: 1, speed: 1, baseDayDurationMs: 60000, elapsedMs: 0 }), /fraction/);
  assert.throws(() => getCampaignWeekFraction(-1, 0), /day/);
});
